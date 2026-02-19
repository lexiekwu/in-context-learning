import OpenAI from "openai";
import { env } from "@/lib/env";

/**
 * Poe API client using the OpenAI-compatible interface.
 *
 * All LLM calls go through Poe's API gateway, which provides access
 * to multiple model families (Gemini, GPT, Claude, etc.) via a single
 * API key and billing account.
 */
export const poe = new OpenAI({
  apiKey: env.POE_API_KEY,
  baseURL: "https://api.poe.com/v1",
});

/** Default model for all LLM calls (Poe bot name). */
export const DEFAULT_MODEL = "Gemini-2.5-Flash";

/** Fallback model for quality-sensitive calls (e.g., translation checking). */
export const FALLBACK_MODEL = "Gemini-2.5-Pro";
