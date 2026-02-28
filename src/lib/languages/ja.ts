/**
 * Japanese language configuration.
 *
 * Japanese uses a logographic writing system (kanji + kana), so it
 * requires a reading/pronunciation quiz step. Romaji is used as the
 * reading system for learners.
 */

import type { LanguageConfig } from "./types";

// ---------------------------------------------------------------------------
// Romaji normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a romaji string for comparison:
 * 1. Trim leading/trailing whitespace
 * 2. Convert to lowercase
 * 3. Remove all internal spaces, hyphens, and apostrophes
 * 4. Normalize long vowel markers (macrons to doubled vowels)
 */
function normalizeRomaji(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s\-']/g, "")
    .replace(/\u014D/g, "ou") // ō -> ou
    .replace(/\u016B/g, "uu") // ū -> uu
    .replace(/\u0113/g, "ei") // ē -> ei
    .replace(/\u0101/g, "aa") // ā -> aa;
}

// ---------------------------------------------------------------------------
// Language config
// ---------------------------------------------------------------------------

export const japaneseConfig: LanguageConfig = {
  code: "ja",
  name: "Japanese",
  nativeName: "日本語",
  isPhonetic: false,
  readingSystem: {
    name: "Romaji",
    placeholder: "e.g., benkyou",
    instructions: "Type the reading in romaji (Latin letters)",
    normalize: normalizeRomaji,
    verify: (input: string, expected: string): boolean => {
      const normalizedInput = normalizeRomaji(input);
      // Support multiple accepted readings separated by "/"
      const acceptedReadings = expected.split("/").map(normalizeRomaji);
      return acceptedReadings.some((reading) => reading === normalizedInput);
    },
  },
  wordSegmentation: "llm-breakdown",
  exampleWord: "勉強",
  exampleMeaning: "to study",
};
