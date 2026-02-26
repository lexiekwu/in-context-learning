/**
 * Language configuration types for multi-language support.
 *
 * Each supported language defines a LanguageConfig that controls
 * quiz behavior: phonetic languages (Spanish, French) skip the
 * pronunciation/reading step, while logographic languages (Chinese,
 * Japanese) require it.
 */

export interface ReadingSystem {
  /** Display name for the reading system, e.g. 'Pinyin', 'Romaji' */
  name: string;
  /** Input placeholder hint, e.g. 'e.g., xue2xi2' */
  placeholder: string;
  /** Brief instructions shown to the user, e.g. 'Use numbered tones (1-4)' */
  instructions: string;
  /** Normalize raw input for comparison (lowercase, strip separators, etc.) */
  normalize: (input: string) => string;
  /** Check whether normalized input matches the expected reading */
  verify: (input: string, expected: string) => boolean;
  /**
   * Detect if the user typed in a wrong format (e.g. tone marks instead of
   * numbered tones). Returns a user-facing message if a problem is found,
   * or null if the format is acceptable.
   */
  detectWrongFormat?: (input: string) => string | null;
}

export interface LanguageVariant {
  /** ISO-style code, e.g. 'zh-Hans', 'zh-Hant' */
  code: string;
  /** English label, e.g. 'Simplified' */
  label: string;
  /** Label in the target language, e.g. '简体' */
  nativeLabel: string;
}

export interface LanguageConfig {
  /** ISO 639-1 language code, e.g. 'zh', 'es', 'ja' */
  code: string;
  /** English name, e.g. 'Chinese' */
  name: string;
  /** Name in the target language, e.g. '中文' */
  nativeName: string;
  /**
   * Whether the writing system is phonetic (alphabetic).
   * Phonetic languages skip the reading/pronunciation quiz step.
   */
  isPhonetic: boolean;
  /** Reading system config (required for non-phonetic languages) */
  readingSystem?: ReadingSystem;
  /** Optional script/dialect variants */
  variants?: {
    /** Label for the variant selector, e.g. 'Script' */
    label: string;
    options: LanguageVariant[];
    /** Default variant code */
    default: string;
  };
  /**
   * How to segment words in a sentence:
   * - 'whitespace': split on spaces (phonetic/alphabetic languages)
   * - 'llm-breakdown': use LLM to break down (logographic languages)
   */
  wordSegmentation: "whitespace" | "llm-breakdown";
}
