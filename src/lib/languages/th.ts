/**
 * Thai language configuration.
 *
 * Thai uses the Thai script and has no whitespace between words,
 * so it requires both a romanization reading step and LLM-based
 * word segmentation.
 */

import type { LanguageConfig } from "./types";

// ---------------------------------------------------------------------------
// Romanization normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a romanization string for comparison:
 * 1. Trim leading/trailing whitespace
 * 2. Convert to lowercase
 * 3. Remove all internal spaces, hyphens, and apostrophes
 */
function normalizeRomanization(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s\-']/g, "");
}

// ---------------------------------------------------------------------------
// Language config
// ---------------------------------------------------------------------------

export const thaiConfig: LanguageConfig = {
  code: "th",
  name: "Thai",
  nativeName: "ภาษาไทย",
  isPhonetic: false,
  readingSystem: {
    name: "Romanization",
    placeholder: "e.g., sawatdee",
    instructions: "Type the reading in romanized Thai (Latin letters)",
    normalize: normalizeRomanization,
    verify: (input: string, expected: string): boolean => {
      const normalizedInput = normalizeRomanization(input);
      const acceptedReadings = expected.split("/").map(normalizeRomanization);
      return acceptedReadings.some((reading) => reading === normalizedInput);
    },
  },
  wordSegmentation: "llm-breakdown",
  exampleWord: "สวัสดี",
  exampleMeaning: "hello",
};
