/**
 * Korean language configuration.
 *
 * Korean uses Hangul, a non-phonetic writing system for English speakers,
 * so it requires a romanization reading step.
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

export const koreanConfig: LanguageConfig = {
  code: "ko",
  name: "Korean",
  nativeName: "한국어",
  isPhonetic: false,
  readingSystem: {
    name: "Romanization",
    placeholder: "e.g., annyeonghaseyo",
    instructions: "Type the reading in romanized Korean (Latin letters)",
    normalize: normalizeRomanization,
    verify: (input: string, expected: string): boolean => {
      const normalizedInput = normalizeRomanization(input);
      const acceptedReadings = expected.split("/").map(normalizeRomanization);
      return acceptedReadings.some((reading) => reading === normalizedInput);
    },
  },
  wordSegmentation: "whitespace",
  exampleWord: "안녕하세요",
  exampleMeaning: "hello",
};
