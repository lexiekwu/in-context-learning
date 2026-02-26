/**
 * Language configuration for multi-language LLM prompt generation.
 *
 * Each language defines its display name, script characteristics, and
 * language-specific prompt instructions for the LLM.
 */

export interface LanguageConfig {
  /** ISO 639-1 code (e.g. 'zh', 'ja', 'es') */
  code: string;
  /** Human-readable name (e.g. "Mandarin Chinese", "Japanese", "Spanish") */
  name: string;
  /** Whether the script is non-phonetic (needs reading/pronunciation annotations) */
  needsReading: boolean;
  /** Label for the reading/pronunciation field (e.g. "pinyin", "furigana", "romaji") */
  readingLabel?: string;
  /** Whether the language has character set variants (e.g. Chinese traditional/simplified) */
  hasVariants: boolean;
  /** Language-specific sentence generation instructions (appended to the system message) */
  sentenceInstructions?: string;
  /** Language-specific reading format instructions */
  readingFormatInstructions?: string;
  /** Language-specific card creation instructions */
  cardCreationInstructions?: string;
  /** Unicode regex pattern to validate that text contains this language's characters */
  scriptPattern: RegExp;
  /** Description of the script for validation error messages */
  scriptDescription: string;
}

/**
 * Registry of supported languages.
 *
 * Chinese ('zh') is the primary/default language and includes the most
 * detailed prompt instructions, preserved exactly from the original
 * Chinese-only implementation.
 */
export const LANGUAGES: Record<string, LanguageConfig> = {
  zh: {
    code: "zh",
    name: "Mandarin Chinese",
    needsReading: true,
    readingLabel: "pinyin",
    hasVariants: true,
    scriptPattern: /[\u4e00-\u9fff\u3400-\u4dbf]/,
    scriptDescription: "Chinese characters",
    readingFormatInstructions: `Write pinyin in numbered tone format: ni3hao3, NOT nǐhǎo.
The neutral tone is tone 0 (e.g., 嗎 = ma0, 的 = de0).`,
    sentenceInstructions: `The wordBreakdown must segment the sentence into individual words (not characters, unless the word IS a single character). Every word in the sentence must appear in the breakdown, in order. Include punctuation marks (。，！？、；：) as their own entries with reading "" and meaning "punctuation".`,
    cardCreationInstructions: `If the user provides Chinese in a different character set than requested, convert to the requested set.`,
  },
  ja: {
    code: "ja",
    name: "Japanese",
    needsReading: true,
    readingLabel: "reading",
    hasVariants: false,
    scriptPattern: /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/,
    scriptDescription: "Japanese characters (hiragana, katakana, or kanji)",
    readingFormatInstructions: `Write readings in hiragana for all kanji words. For katakana loanwords, provide the katakana as the reading.`,
    sentenceInstructions: `The wordBreakdown must segment the sentence into individual words/particles. Every word in the sentence must appear in the breakdown, in order. Include punctuation marks (。、！？) as their own entries with reading "" and meaning "punctuation".`,
    cardCreationInstructions: `If the user provides romaji, convert to the appropriate Japanese script.`,
  },
  ko: {
    code: "ko",
    name: "Korean",
    needsReading: true,
    readingLabel: "romanization",
    hasVariants: false,
    scriptPattern: /[\uac00-\ud7af\u1100-\u11ff]/,
    scriptDescription: "Korean characters (Hangul)",
    readingFormatInstructions: `Write romanization using Revised Romanization of Korean (e.g., 한국어 = hangugeo).`,
    sentenceInstructions: `The wordBreakdown must segment the sentence into individual words/particles. Every word in the sentence must appear in the breakdown, in order. Include punctuation marks as their own entries with reading "" and meaning "punctuation".`,
  },
  es: {
    code: "es",
    name: "Spanish",
    needsReading: false,
    hasVariants: false,
    scriptPattern: /[a-záéíóúüñ]/i,
    scriptDescription: "Spanish text",
    sentenceInstructions: `The wordBreakdown must segment the sentence into individual words. Every word in the sentence must appear in the breakdown, in order. Include punctuation marks as their own entries with meaning "punctuation".`,
  },
  fr: {
    code: "fr",
    name: "French",
    needsReading: false,
    hasVariants: false,
    scriptPattern: /[a-zàâæçéèêëïîôœùûüÿ]/i,
    scriptDescription: "French text",
    sentenceInstructions: `The wordBreakdown must segment the sentence into individual words. Every word in the sentence must appear in the breakdown, in order. Include punctuation marks as their own entries with meaning "punctuation".`,
  },
  de: {
    code: "de",
    name: "German",
    needsReading: false,
    hasVariants: false,
    scriptPattern: /[a-zäöüß]/i,
    scriptDescription: "German text",
    sentenceInstructions: `The wordBreakdown must segment the sentence into individual words. Every word in the sentence must appear in the breakdown, in order. Include punctuation marks as their own entries with meaning "punctuation".`,
  },
};

/** Default language code when none is specified. */
export const DEFAULT_LANGUAGE = "zh";

/**
 * Get language config by ISO 639-1 code, falling back to Chinese.
 */
export function getLanguageConfig(code: string = DEFAULT_LANGUAGE): LanguageConfig {
  return LANGUAGES[code] ?? LANGUAGES[DEFAULT_LANGUAGE];
}

/**
 * Get the display name for a variant (e.g. "traditional" → "Traditional Chinese").
 * Only meaningful for languages with hasVariants = true.
 */
export function getVariantDisplayName(language: string, variant: string): string {
  if (language === "zh") {
    return variant === "traditional" ? "繁體字" : "简体字";
  }
  return variant;
}
