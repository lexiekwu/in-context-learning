import { z } from "zod";

// ─── Shared ────────────────────────────────────────────────────────

/** Word breakdown item with required reading (Chinese, Japanese, Korean) */
export const WordBreakdownItemSchema = z.object({
  word: z.string().min(1, "Word must not be empty"),
  pinyin: z.string().optional(),
  reading: z.string().optional(),
  meaning: z.string().min(1, "Meaning must not be empty"),
});

/** Word breakdown item where reading is explicitly not expected (phonetic languages) */
export const WordBreakdownItemPhoneticSchema = z.object({
  word: z.string().min(1, "Word must not be empty"),
  meaning: z.string().min(1, "Meaning must not be empty"),
});

// ─── Call 1: Sentence Generation ───────────────────────────────────

export const SentenceGenerationResponseSchema = z.object({
  sentence: z
    .string()
    .min(2, "Sentence must contain at least 2 characters"),
  sentenceWithHighlight: z
    .string()
    .refine(
      (s) => s.includes("<mark>") && s.includes("</mark>"),
      "Sentence must contain <mark> tags around the target word"
    ),
  translation: z
    .string()
    .min(2, "Translation must not be empty")
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Translation must contain English text"
    ),
  wordBreakdown: z
    .array(WordBreakdownItemSchema)
    .min(1, "Word breakdown must have at least one entry"),
});

/**
 * Schema variant for phonetic languages — no reading field in breakdown,
 * no Chinese character requirement in sentence.
 */
export const SentenceGenerationPhoneticResponseSchema = z.object({
  sentence: z
    .string()
    .min(2, "Sentence must contain at least 2 characters"),
  sentenceWithHighlight: z
    .string()
    .refine(
      (s) => s.includes("<mark>") && s.includes("</mark>"),
      "Sentence must contain <mark> tags around the target word"
    ),
  translation: z
    .string()
    .min(2, "Translation must not be empty")
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Translation must contain English text"
    ),
  wordBreakdown: z
    .array(WordBreakdownItemPhoneticSchema)
    .min(1, "Word breakdown must have at least one entry"),
});

export type SentenceGenerationResponse = z.infer<
  typeof SentenceGenerationResponseSchema
>;

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
      "Suggested translation must contain English text"
    ),
});

export type TranslationCheckResponse = z.infer<
  typeof TranslationCheckResponseSchema
>;

// ─── Call 3: AI Card Creation ──────────────────────────────────────

export const AICardCreationResponseSchema = z.object({
  word: z
    .string()
    .min(1, "Word must not be empty"),
  pinyin: z
    .string()
    .optional(),
  reading: z
    .string()
    .optional(),
  meaning: z
    .string()
    .min(1, "Meaning must not be empty")
    .max(200, "Meaning must not exceed 200 characters"),
  exampleSentence: z
    .string()
    .min(2),
  exampleTranslation: z
    .string()
    .min(2)
    .refine(
      (s) => /[a-zA-Z]/.test(s),
      "Example translation must contain English text"
    ),
});

export type AICardCreationResponse = z.infer<
  typeof AICardCreationResponseSchema
>;
