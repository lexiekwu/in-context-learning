import { z } from "zod";

// ─── Shared ────────────────────────────────────────────────────────

export const WordBreakdownItemSchema = z.object({
  word: z.string().min(1, "Word must not be empty"),
  pinyin: z
    .string()
    .min(1)
    .regex(
      /^[a-z]+[0-5]?([a-z]+[0-5]?)*$/,
      "Pinyin must be in numbered format (e.g., ni3hao3)"
    ),
  meaning: z.string().min(1, "Meaning must not be empty"),
});

// ─── Call 1: Sentence Generation ───────────────────────────────────

export const SentenceGenerationResponseSchema = z.object({
  sentence: z
    .string()
    .min(2, "Sentence must contain at least 2 characters")
    .refine(
      (s) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s),
      "Sentence must contain Chinese characters"
    ),
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
    .min(1, "Word must not be empty")
    .refine(
      (s) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s),
      "Word must contain Chinese characters"
    ),
  pinyin: z
    .string()
    .min(1)
    .regex(
      /^[a-z]+[0-5]?([a-z]+[0-5]?)*$/,
      "Pinyin must be in numbered format (e.g., xue2xi2)"
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
      "Example sentence must contain Chinese characters"
    ),
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
