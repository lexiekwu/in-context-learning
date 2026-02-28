/**
 * Arabic language configuration.
 *
 * Arabic uses the Arabic script, so it requires a romanization
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

export const arabicConfig: LanguageConfig = {
  code: "ar",
  name: "Arabic",
  nativeName: "العربية",
  isPhonetic: false,
  readingSystem: {
    name: "Romanization",
    placeholder: "e.g., marhaba",
    instructions: "Type the reading in romanized Arabic (Latin letters)",
    normalize: normalizeRomanization,
    verify: (input: string, expected: string): boolean => {
      const normalizedInput = normalizeRomanization(input);
      const acceptedReadings = expected.split("/").map(normalizeRomanization);
      return acceptedReadings.some((reading) => reading === normalizedInput);
    },
  },
  wordSegmentation: "whitespace",
  exampleWord: "مرحبا",
  exampleMeaning: "hello",
};
