import { z } from "zod";
import { getLanguageConfig, DEFAULT_LANGUAGE } from "./languages";

// ─── Shared ────────────────────────────────────────────────────────

/**
 * Word breakdown item schema for Chinese (backwards compatible).
 *
 * Pinyin is required. For multi-language support, use
 * `GenericWordBreakdownItemSchema` or `createWordBreakdownItemSchema()`.
 */
export const WordBreakdownItemSchema = z.object({
  word: z.string().min(1, "Word must not be empty"),
  pinyin: z.string(),
  meaning: z.string().min(1, "Meaning must not be empty"),
});

/**
 * Generic word breakdown item schema that supports any language.
 *
 * - `reading` is the generic pronunciation/reading field (optional)
 * - `pinyin` is kept as an optional alias for Chinese backwards compat
 */
export const GenericWordBreakdownItemSchema = z.object({
  word: z.string().min(1, "Word must not be empty"),
  pinyin: z.string().optional(),
  reading: z.string().optional(),
  meaning: z.string().min(1, "Meaning must not be empty"),
});

export type WordBreakdownItem = z.infer<typeof WordBreakdownItemSchema>;
export type GenericWordBreakdownItem = z.infer<typeof GenericWordBreakdownItemSchema>;

// ─── Call 1: Sentence Generation ───────────────────────────────────

/**
 * Sentence generation response schema (Chinese-compatible, backwards compatible).
 *
 * Validates that the sentence contains Chinese characters and that
 * word breakdown items have pinyin. For other languages, use
 * `createSentenceGenerationSchema()`.
 */
export const SentenceGenerationResponseSchema = z.object({
  sentence: z
    .string()
    .min(2, "Sentence must contain at least 2 characters")
    .refine(
      (s) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s),
      "Sentence must contain Chinese characters",
    ),
  sentenceWithHighlight: z
    .string()
    .refine(
      (s) => s.includes("<mark>") && s.includes("</mark>"),
      "Sentence must contain <mark> tags around the target word",
    ),
  translation: z
    .string()
    .min(2, "Translation must not be empty")
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Translation must contain English text",
    ),
  wordBreakdown: z
    .array(WordBreakdownItemSchema)
    .min(1, "Word breakdown must have at least one entry"),
});

export type SentenceGenerationResponse = z.infer<
  typeof SentenceGenerationResponseSchema
>;

/**
 * Create a language-specific sentence generation schema with appropriate
 * script validation and word breakdown fields.
 *
 * For Chinese ('zh'), this produces a schema equivalent to the default
 * `SentenceGenerationResponseSchema`.
 *
 * @param language - ISO 639-1 language code (defaults to 'zh')
 */
export function createSentenceGenerationSchema(language: string = DEFAULT_LANGUAGE) {
  const lang = getLanguageConfig(language);

  // Choose appropriate word breakdown item schema
  const breakdownItemSchema = lang.needsReading
    ? lang.code === "zh"
      ? WordBreakdownItemSchema
      : GenericWordBreakdownItemSchema
    : z.object({
        word: z.string().min(1, "Word must not be empty"),
        meaning: z.string().min(1, "Meaning must not be empty"),
      });

  return z.object({
    sentence: z
      .string()
      .min(2, "Sentence must contain at least 2 characters")
      .refine(
        (s) => lang.scriptPattern.test(s),
        `Sentence must contain ${lang.scriptDescription}`,
      ),
    sentenceWithHighlight: z
      .string()
      .refine(
        (s) => s.includes("<mark>") && s.includes("</mark>"),
        "Sentence must contain <mark> tags around the target word",
      ),
    translation: z
      .string()
      .min(2, "Translation must not be empty")
      .refine(
        (s) => /[a-zA-Z]/.test(s),
        "Translation must contain English text",
      ),
    wordBreakdown: z
      .array(breakdownItemSchema)
      .min(1, "Word breakdown must have at least one entry"),
  });
}

// ─── Call 2: Translation Checking ──────────────────────────────────

export const TranslationCheckResponseSchema = z.object({
  correct: z.boolean(),
  explanation: z
    .string()
    .min(5, "Explanation must be substantive")
    .max(500, "Explanation must not exceed 500 characters"),
  targetWordUsedCorrectly: z.boolean(),
  suggestedTranslation: z
    .string()
    .min(2, "Suggested translation must not be empty")
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Suggested translation must contain English text",
    ),
});

export type TranslationCheckResponse = z.infer<
  typeof TranslationCheckResponseSchema
>;

// ─── Call 3: AI Card Creation ──────────────────────────────────────

/**
 * AI card creation response schema (Chinese-compatible, backwards compatible).
 *
 * Validates Chinese characters in the word and pinyin format.
 * For other languages, use `createAICardCreationSchema()`.
 */
export const AICardCreationResponseSchema = z.object({
  word: z
    .string()
    .min(1, "Word must not be empty")
    .refine(
      (s) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s),
      "Word must contain Chinese characters",
    ),
  pinyin: z
    .string()
    .min(1)
    .regex(
      /^[a-z]+[0-5]?([a-z]+[0-5]?)*$/,
      "Pinyin must be in numbered format (e.g., xue2xi2)",
    ),
  meaning: z
    .string()
    .min(1, "Meaning must not be empty")
    .max(200, "Meaning must not exceed 200 characters"),
  exampleSentence: z
    .string()
    .min(2)
    .refine(
      (s) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s),
      "Example sentence must contain Chinese characters",
    ),
  exampleTranslation: z
    .string()
    .min(2)
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Example translation must contain English text",
    ),
});

export type AICardCreationResponse = z.infer<
  typeof AICardCreationResponseSchema
>;

/**
 * Create a language-specific AI card creation schema.
 *
 * For Chinese ('zh'), this produces a schema equivalent to the default
 * `AICardCreationResponseSchema`.
 *
 * @param language - ISO 639-1 language code (defaults to 'zh')
 */
export function createAICardCreationSchema(language: string = DEFAULT_LANGUAGE) {
  const lang = getLanguageConfig(language);

  const wordSchema = z
    .string()
    .min(1, "Word must not be empty")
    .refine(
      (s) => lang.scriptPattern.test(s),
      `Word must contain ${lang.scriptDescription}`,
    );

  const meaningSchema = z
    .string()
    .min(1, "Meaning must not be empty")
    .max(200, "Meaning must not exceed 200 characters");

  const exampleSentenceSchema = z
    .string()
    .min(2)
    .refine(
      (s) => lang.scriptPattern.test(s),
      `Example sentence must contain ${lang.scriptDescription}`,
    );

  const exampleTranslationSchema = z
    .string()
    .min(2)
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Example translation must contain English text",
    );

  if (lang.code === "zh") {
    // Chinese: pinyin required with format validation
    return z.object({
      word: wordSchema,
      pinyin: z
        .string()
        .min(1)
        .regex(
          /^[a-z]+[0-5]?([a-z]+[0-5]?)*$/,
          "Pinyin must be in numbered format (e.g., xue2xi2)",
        ),
      meaning: meaningSchema,
      exampleSentence: exampleSentenceSchema,
      exampleTranslation: exampleTranslationSchema,
    });
  }

  if (lang.needsReading) {
    // Non-phonetic languages: reading field optional
    return z.object({
      word: wordSchema,
      reading: z.string().optional(),
      meaning: meaningSchema,
      exampleSentence: exampleSentenceSchema,
      exampleTranslation: exampleTranslationSchema,
    });
  }

  // Phonetic languages: no reading/pinyin field
  return z.object({
    word: wordSchema,
    meaning: meaningSchema,
    exampleSentence: exampleSentenceSchema,
    exampleTranslation: exampleTranslationSchema,
  });
}
