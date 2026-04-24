import { z } from "zod";
import { gemini, DEFAULT_MODEL } from "./client";
import { AppError, ErrorCode } from "@/lib/errors";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallLLMOptions<T> {
  systemMessage: string;
  userMessage: string;
  schema: z.ZodSchema<T>;
  /** Max retries on failure (default: 1). */
  maxRetries?: number;
  /** Model override (default: gemini-2.5-flash). */
  model?: string;
  /** Temperature (default: 0.7). */
  temperature?: number;
  /** Max tokens (default: 1000). */
  maxTokens?: number;
  /** Purpose label for usage tracking (e.g. "generate-sentence"). */
  purpose?: string;
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

/** Check if an error is an auth failure (401/403). */
function isAuthError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    return status === 401 || status === 403;
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
 * - Native JSON mode via responseMimeType (Gemini returns JSON directly)
 * - Strips code fences as a safety net if the model still wraps output
 * - Validates parsed JSON against the provided Zod schema
 * - Throws typed AppError for: timeout, malformed JSON, rate limit, auth
 */
export async function callLLM<T>(options: CallLLMOptions<T>): Promise<T> {
  const {
    systemMessage,
    userMessage,
    schema,
    maxRetries = 1,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 1000,
    purpose = "unknown",
  } = options;

  const overallStart = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let callStart = Date.now();
    try {
      // Create an AbortController for the 10s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      let response;
      callStart = Date.now();
      try {
        response = await gemini.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          config: {
            systemInstruction: systemMessage,
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
            abortSignal: controller.signal,
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const durationMs = Date.now() - callStart;

      if (durationMs > 3000) {
        logger.warn({ purpose, attempt, durationMs, model }, "Slow LLM response");
      }

      // Log LLM call for usage tracking (fire-and-forget)
      logLlmCall({
        model,
        purpose,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        durationMs,
      });

      const content = response.text;
      if (!content) {
        throw new AppError(
          ErrorCode.LLM_ERROR,
          "Empty response from LLM"
        );
      }

      // Strip markdown code fences if present (safety net; responseMimeType should prevent this)
      const cleaned = stripCodeFences(content);

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Retryable — LLM may produce valid JSON on next attempt
        if (attempt < maxRetries) {
          logger.warn({ attempt: attempt + 1, preview: cleaned.slice(0, 200) }, "Malformed JSON from LLM, retrying");
          continue;
        }
        logger.error({ preview: cleaned.slice(0, 200) }, "Malformed JSON in LLM response after all retries");
        throw new AppError(
          ErrorCode.LLM_ERROR,
          "Malformed JSON in LLM response"
        );
      }

      // Validate with Zod schema
      const result = schema.safeParse(parsed);
      if (!result.success) {
        // Retryable — LLM may produce valid schema on next attempt
        if (attempt < maxRetries) {
          logger.warn({ attempt: attempt + 1, zodErrors: result.error.flatten() }, "LLM response failed schema validation, retrying");
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

      const attemptDurationMs = Date.now() - callStart;
      const errorName = error instanceof Error ? error.name : String(error);
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Rate limit / quota exhausted — back off then retry
      if (isRateLimitError(error)) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        logger.warn({ purpose, attempt, attemptDurationMs, backoffMs }, "LLM rate limited");
        if (attempt < maxRetries) {
          await sleep(backoffMs);
          continue;
        }
        throw new AppError(
          ErrorCode.RATE_LIMITED,
          "LLM rate limit exceeded. Please try again shortly."
        );
      }

      // Timeout (AbortError) — check both native DOMException and wrapped variants
      const isAbort =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError") ||
        (error instanceof Error && "code" in error && (error as { code: string }).code === "ECONNABORTED") ||
        (error instanceof Error && error.message?.includes("abort"));

      if (isAbort) {
        logger.error({ purpose, attempt, attemptDurationMs, totalElapsedMs: Date.now() - overallStart }, "LLM request timed out");
        if (attempt < maxRetries) continue;
        throw new AppError(
          ErrorCode.LLM_TIMEOUT,
          "LLM request timed out."
        );
      }

      // On last attempt, rethrow as-is (if already AppError) or wrap
      if (attempt === maxRetries) {
        logger.error({ purpose, attempt, attemptDurationMs, totalElapsedMs: Date.now() - overallStart, errorName, errorMsg }, "LLM call failed after all retries");
        if (error instanceof AppError) throw error;
        throw new AppError(
          ErrorCode.LLM_ERROR,
          error instanceof Error
            ? error.message
            : "LLM call failed after retries"
        );
      }

      // Otherwise, retry
      logger.warn({ purpose, attempt, attemptDurationMs, errorName, errorMsg }, "LLM call failed, retrying");
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new AppError(ErrorCode.LLM_ERROR, "LLM call failed after retries");
}

// ---------------------------------------------------------------------------
// Usage logging (fire-and-forget)
// ---------------------------------------------------------------------------

function logLlmCall(data: {
  model: string;
  purpose: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
}) {
  // Lazy import to avoid circular dependency issues
  import("@/lib/db").then(({ db }) => {
    db.llmCall
      .create({
        data: {
          model: data.model,
          purpose: data.purpose,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          durationMs: data.durationMs,
        },
      })
      .catch((err: unknown) => {
        logger.warn({ err }, "Failed to log LLM call");
      });
  });
}
