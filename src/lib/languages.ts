/**
 * Language configuration for multi-language support.
 *
 * Each supported language defines its display name, writing system properties,
 * available variants, and how the app should behave for that language.
 */

export interface LanguageConfig {
  /** Internal language code (stored in DB) */
  code: string;
  /** Human-readable name */
  name: string;
  /** The native name of the language (e.g. "中文") */
  nativeName: string;
  /** Whether the writing system is phonetic (Latin, Cyrillic, etc.) */
  isPhonetic: boolean;
  /** Whether words are separated by whitespace */
  hasWhitespaceWordSegmentation: boolean;
  /**
   * Whether this language needs a separate "reading" field on flashcards.
   * For Chinese this is pinyin; for Japanese this is furigana/romaji.
   * Phonetic languages (Spanish, French, etc.) do not need this.
   */
  needsReading: boolean;
  /** Label for the reading field (e.g. "Pinyin", "Furigana", "Romaji") */
  readingLabel: string | null;
  /** Available variants (e.g. Traditional/Simplified for Chinese) */
  variants: LanguageVariant[];
  /** Default variant code */
  defaultVariant: string | null;
  /** Name of the script system for prompts (e.g. "Chinese characters", "Japanese kanji/kana") */
  scriptDescription: string;
}

export interface LanguageVariant {
  code: string;
  name: string;
  /** Native name for this variant (e.g. "繁體字") */
  nativeName: string;
}

// ---------------------------------------------------------------------------
// Supported Languages
// ---------------------------------------------------------------------------

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  zh: {
    code: "zh",
    name: "Chinese",
    nativeName: "中文",
    isPhonetic: false,
    hasWhitespaceWordSegmentation: false,
    needsReading: true,
    readingLabel: "Pinyin",
    variants: [
      { code: "traditional", name: "Traditional", nativeName: "繁體字" },
      { code: "simplified", name: "Simplified", nativeName: "简体字" },
    ],
    defaultVariant: "traditional",
    scriptDescription: "Chinese characters",
  },
  ja: {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    isPhonetic: false,
    hasWhitespaceWordSegmentation: false,
    needsReading: true,
    readingLabel: "Romaji",
    variants: [],
    defaultVariant: null,
    scriptDescription: "Japanese kanji and kana",
  },
  ko: {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    isPhonetic: false,
    hasWhitespaceWordSegmentation: true,
    needsReading: true,
    readingLabel: "Romanization",
    variants: [],
    defaultVariant: null,
    scriptDescription: "Korean hangul",
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    isPhonetic: true,
    hasWhitespaceWordSegmentation: true,
    needsReading: false,
    readingLabel: null,
    variants: [],
    defaultVariant: null,
    scriptDescription: "Latin alphabet",
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    isPhonetic: true,
    hasWhitespaceWordSegmentation: true,
    needsReading: false,
    readingLabel: null,
    variants: [],
    defaultVariant: null,
    scriptDescription: "Latin alphabet",
  },
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    isPhonetic: true,
    hasWhitespaceWordSegmentation: true,
    needsReading: false,
    readingLabel: null,
    variants: [],
    defaultVariant: null,
    scriptDescription: "Latin alphabet",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    isPhonetic: true,
    hasWhitespaceWordSegmentation: true,
    needsReading: false,
    readingLabel: null,
    variants: [],
    defaultVariant: null,
    scriptDescription: "Latin alphabet",
  },
  it: {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    isPhonetic: true,
    hasWhitespaceWordSegmentation: true,
    needsReading: false,
    readingLabel: null,
    variants: [],
    defaultVariant: null,
    scriptDescription: "Latin alphabet",
  },
};

/** Default language code when none is set */
export const DEFAULT_LANGUAGE = "zh";
export const DEFAULT_VARIANT = "traditional";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up a language config by code. Falls back to Chinese if not found.
 */
export function getLanguageConfig(code: string | null | undefined): LanguageConfig {
  if (code && SUPPORTED_LANGUAGES[code]) {
    return SUPPORTED_LANGUAGES[code];
  }
  return SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
}

/**
 * Get the list of valid language codes.
 */
export function getSupportedLanguageCodes(): string[] {
  return Object.keys(SUPPORTED_LANGUAGES);
}

/**
 * Derive the effective characterSet from language + variant for backward compat.
 * Only meaningful for Chinese; returns null for other languages.
 */
export function getCharacterSet(
  languageCode: string | null | undefined,
  variant: string | null | undefined
): "traditional" | "simplified" | null {
  const lang = getLanguageConfig(languageCode);
  if (lang.code !== "zh") return null;
  if (variant === "simplified") return "simplified";
  return "traditional"; // default for Chinese
}
