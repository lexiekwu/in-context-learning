/**
 * Hindi language configuration.
 *
 * Hindi uses the Devanagari script, so it requires a romanization
 * reading step for learners.
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

export const hindiConfig: LanguageConfig = {
  code: "hi",
  name: "Hindi",
  nativeName: "हिन्दी",
  isPhonetic: false,
  readingSystem: {
    name: "Romanization",
    placeholder: "e.g., namaste",
    instructions: "Type the reading in romanized Hindi (Latin letters)",
    normalize: normalizeRomanization,
    verify: (input: string, expected: string): boolean => {
      const normalizedInput = normalizeRomanization(input);
      const acceptedReadings = expected.split("/").map(normalizeRomanization);
      return acceptedReadings.some((reading) => reading === normalizedInput);
    },
  },
  wordSegmentation: "whitespace",
  exampleWord: "नमस्ते",
  exampleMeaning: "hello",
};
