import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";

/**
 * Google Gemini API client (first-party, via Google AI Studio / Generative Language API).
 *
 * All LLM calls go through Google's first-party Gemini API. The SDK handles
 * auth via the GEMINI_API_KEY env var (passed explicitly so a missing/empty
 * key fails fast at client construction in production).
 */

export const gemini = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
  httpOptions: {
    timeout: 10_000, // 10s timeout at SDK level as a safety net (callLLM enforces its own)
  },
});

/** Default model for all LLM calls. */
export const DEFAULT_MODEL = "gemini-2.5-flash";

/** Fallback model for quality-sensitive calls (e.g., translation checking). */
export const FALLBACK_MODEL = "gemini-2.5-pro";
