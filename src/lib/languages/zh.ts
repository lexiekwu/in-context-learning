/**
 * Chinese (Mandarin) language configuration.
 *
 * Pinyin verification logic is replicated from src/lib/pinyin.ts
 * to fit the ReadingSystem interface. The original pinyin.ts remains
 * unchanged and is still used by existing code paths.
 */

import type { LanguageConfig } from "./types";

// ---------------------------------------------------------------------------
// Tone-mark detection (mirrors src/lib/pinyin.ts)
// ---------------------------------------------------------------------------

/**
 * Unicode ranges for tone-marked pinyin vowels.
 * Covers a/e/i/o/u macron, acute, caron, grave, plus u-diaeresis variants.
 */
const TONE_MARK_REGEX =
  /[\u0101\u00E1\u01CE\u00E0\u0113\u00E9\u011B\u00E8\u012B\u00ED\u01D0\u00EC\u014D\u00F3\u01D2\u00F2\u016B\u00FA\u01D4\u00F9\u01D6\u01D8\u01DA\u01DC\u00FC]/;

function hasToneMarks(input: string): boolean {
  return TONE_MARK_REGEX.test(input);
}

// ---------------------------------------------------------------------------
// Normalization (mirrors src/lib/pinyin.ts)
// ---------------------------------------------------------------------------

/**
 * Normalize a pinyin string for comparison:
 * 1. Trim leading/trailing whitespace
 * 2. Convert to lowercase
 * 3. Remove all internal spaces, hyphens, and apostrophes
 */
function normalizePinyin(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s\-']/g, "");
}

// ---------------------------------------------------------------------------
// Language config
// ---------------------------------------------------------------------------

export const chineseConfig: LanguageConfig = {
  code: "zh",
  name: "Chinese",
  nativeName: "中文",
  isPhonetic: false,
  readingSystem: {
    name: "Pinyin",
    placeholder: "e.g., xue2xi2",
    instructions: "Use numbered tones (1-4, or 5/0 for neutral tone)",
    normalize: normalizePinyin,
    verify: (input: string, expected: string): boolean => {
      // Check against all accepted readings (separated by "/")
      const normalizedInput = normalizePinyin(input);
      const acceptedReadings = expected.split("/").map(normalizePinyin);
      return acceptedReadings.some((reading) => reading === normalizedInput);
    },
    detectWrongFormat: (input: string): string | null => {
      if (hasToneMarks(input)) {
        return (
          "Please use numbered tones instead of tone marks. " +
          "For example, type ni3hao3 instead of nǐhǎo."
        );
      }
      return null;
    },
  },
  variants: {
    label: "Script",
    options: [
      { code: "zh-Hans", label: "Simplified", nativeLabel: "简体" },
      { code: "zh-Hant", label: "Traditional", nativeLabel: "繁體" },
    ],
    default: "zh-Hans",
  },
  wordSegmentation: "llm-breakdown",
};
