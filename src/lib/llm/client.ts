import OpenAI from "openai";
import { env } from "@/lib/env";

/**
 * Poe API client using the OpenAI-compatible interface.
 *
 * All LLM calls go through Poe's API gateway, which provides access
 * to multiple model families (Gemini, GPT, Claude, etc.) via a single
 * API key and billing account.
 *
 * IMPORTANT: We wrap global fetch to disable Next.js caching/deduplication
 * which can cause outbound LLM API calls to hang or timeout.
 */

// Use undici's fetch to bypass Next.js's patched global fetch, which causes
// outbound LLM API calls to hang/timeout due to caching and request deduplication.
import { fetch as undiciFetch } from "undici";

export const poe = new OpenAI({
  apiKey: env.POE_API_KEY,
  baseURL: "https://api.poe.com/v1",
  maxRetries: 0, // We handle retries in callLLM — disable SDK retries to avoid nested retry loops
  timeout: 10_000, // 10s timeout at SDK level as a safety net
  fetch: undiciFetch as unknown as typeof globalThis.fetch,
});

/** Default model for all LLM calls (Poe bot name). */
export const DEFAULT_MODEL = "Gemini-2.5-Flash";

/** Fallback model for quality-sensitive calls (e.g., translation checking). */
export const FALLBACK_MODEL = "Gemini-2.5-Pro";
