import { z } from "zod";
import { poe, DEFAULT_MODEL } from "./client";
import { AppError, ErrorCode } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallLLMOptions<T> {
  systemMessage: string;
  userMessage: string;
  schema: z.ZodSchema<T>;
  /** Max retries on failure (default: 1). */
  maxRetries?: number;
  /** Model override (default: Gemini-2.5-Flash). */
  model?: string;
  /** Temperature (default: 0.7). */
  temperature?: number;
  /** Max tokens (default: 1000). */
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip markdown code fences, preamble text, and thinking blocks from LLM output. */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();

  // Remove thinking blocks (e.g., <think>...</think>)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // If wrapped in code fences, extract the content inside
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // If there's text before the first {, strip it (preamble like "Here is the JSON:")
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace);
  }

  // If there's text after the last }, strip it
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }

  return cleaned.trim();
}

/** Check if an error is an HTTP rate-limit response (429). */
function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status === 429;
  }
  return false;
}

/** Check if an error is an auth failure (401). */
function isAuthError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status === 401;
  }
  return false;
}

/** Check if an error is a points-exhausted / payment required (402). */
function isPaymentError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status === 402;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main callLLM function
// ---------------------------------------------------------------------------

/**
 * Generic LLM call with retry, timeout, Zod validation, and typed errors.
 *
 * - 10 second timeout per attempt
 * - 1 retry on failure (configurable)
 * - Strips code fences before JSON.parse
 * - Validates parsed JSON against the provided Zod schema
 * - Throws typed AppError for: timeout, malformed JSON, rate limit, auth
 */
export async function callLLM<T>(options: CallLLMOptions<T>): Promise<T> {
  const {
    systemMessage,
    userMessage,
    schema,
    maxRetries = 2,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 1000,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create an AbortController for the 10s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      let response;
      try {
        response = await poe.chat.completions.create(
          {
            model,
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: userMessage },
            ],
            temperature,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
          },
          { signal: controller.signal }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AppError(
          ErrorCode.LLM_ERROR,
          "Empty response from LLM"
        );
      }

      // Strip markdown code fences if present
      const cleaned = stripCodeFences(content);

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Retryable — LLM may produce valid JSON on next attempt
        if (attempt < maxRetries) {
          console.warn(`[callLLM] Malformed JSON on attempt ${attempt + 1}, retrying...`, cleaned.slice(0, 200));
          continue;
        }
        throw new AppError(
          ErrorCode.LLM_ERROR,
          "Malformed JSON in LLM response",
          { rawContent: cleaned.slice(0, 200) }
        );
      }

      // Validate with Zod schema
      const result = schema.safeParse(parsed);
      if (!result.success) {
        // Retryable — LLM may produce valid schema on next attempt
        if (attempt < maxRetries) {
          console.warn(`[callLLM] Schema validation failed on attempt ${attempt + 1}, retrying...`, result.error.flatten());
          continue;
        }
        throw new AppError(
          ErrorCode.LLM_ERROR,
          "LLM response failed schema validation",
          { zodErrors: result.error.flatten() }
        );
      }

      return result.data;
    } catch (error) {
      // Auth errors should not be retried
      if (isAuthError(error)) {
        throw new AppError(
          ErrorCode.LLM_ERROR,
          "LLM API authentication failed. AI features temporarily unavailable."
        );
      }

      // Payment / points exhausted should not be retried
      if (isPaymentError(error)) {
        throw new AppError(
          ErrorCode.LLM_ERROR,
          "LLM API points exhausted. AI features temporarily unavailable."
        );
      }

      // Rate limit — back off then retry
      if (isRateLimitError(error)) {
        if (attempt < maxRetries) {
          await sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
        throw new AppError(
          ErrorCode.RATE_LIMITED,
          "LLM rate limit exceeded. Please try again shortly."
        );
      }

      // Timeout (AbortError)
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        if (attempt < maxRetries) continue;
        throw new AppError(
          ErrorCode.LLM_TIMEOUT,
          "LLM request timed out."
        );
      }

      // On last attempt, rethrow as-is (if already AppError) or wrap
      if (attempt === maxRetries) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          ErrorCode.LLM_ERROR,
          error instanceof Error
            ? error.message
            : "LLM call failed after retries"
        );
      }

      // Otherwise, retry
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new AppError(ErrorCode.LLM_ERROR, "LLM call failed after retries");
}
