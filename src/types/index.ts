/**
 * Shared TypeScript types derived from the Prisma schema and API response
 * shapes defined in 02-data-model.md.
 *
 * Prisma generates its own types (e.g. `Flashcard`, `User`). The types here
 * are for API request/response payloads — the shapes that cross the
 * client-server boundary.
 */

import type {
  CardState,
  Rating,
  SubscriptionStatus,
} from "@/generated/prisma/client";

// Re-export Prisma enums for convenience
export type { CardState, Rating, SubscriptionStatus };

// ---------------------------------------------------------------------------
// Auth / Session
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

// ---------------------------------------------------------------------------
// Flashcard API shapes
// ---------------------------------------------------------------------------

/** Returned by GET /api/flashcards and single-card endpoints */
export interface FlashcardResponse {
  id: string;
  word: string;
  pinyin: string;
  englishMeaning: string;
  exampleSentence: string | null;
  state: CardState;
  due: string; // ISO 8601
  reps: number;
  lapses: number;
  createdAt: string; // ISO 8601
}

/** Returned by POST /api/quiz/submit-result (updated scheduling info) */
export interface FlashcardScheduleResponse {
  id: string;
  nextDue: string; // ISO 8601
  state: CardState;
  stability: number;
  difficulty: number;
  reps: number;
}

/** Body for POST /api/flashcards */
export interface CreateFlashcardInput {
  word: string;
  /** @deprecated Use reading instead */
  pinyin?: string;
  /** Reading/pronunciation — optional for phonetic languages */
  reading?: string;
  englishMeaning: string;
  exampleSentence?: string;
  /** Language code (e.g. "zh", "ja", "es") */
  language?: string;
}

/** Body for PUT /api/flashcards/:id */
export interface UpdateFlashcardInput {
  word?: string;
  /** @deprecated Use reading instead */
  pinyin?: string;
  /** Reading/pronunciation — optional for phonetic languages */
  reading?: string;
  englishMeaning?: string;
  exampleSentence?: string | null;
}

/** GET /api/flashcards response */
export interface FlashcardListResponse {
  flashcards: FlashcardResponse[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Quiz API shapes
// ---------------------------------------------------------------------------

/** POST /api/quiz/start response */
export interface StartSessionResponse {
  sessionId: string;
  startedAt: string;
}

/** GET /api/quiz/next-card response */
export interface NextCardResponse {
  flashcard: {
    id: string;
    word: string;
    pinyin: string;
    englishMeaning: string;
    state: CardState;
    reps: number;
    lapses: number;
  } | null;
  cardsRemaining: number;
  newCardsRemaining?: number;
  nextDueAt?: string;
}

/** Word breakdown entry from LLM sentence generation */
export interface WordBreakdownEntry {
  word: string;
  /** Reading/pronunciation (pinyin for Chinese, romaji for Japanese, etc.) */
  pinyin?: string;
  reading?: string;
  meaning: string;
  isTarget?: boolean;
}

/** POST /api/quiz/generate-sentence response */
export interface GenerateSentenceResponse {
  sentence: string;
  sentenceWithHighlight: string;
  translation: string;
  wordBreakdown: WordBreakdownEntry[];
}

/** GET /api/quiz/next-card-with-sentence — combined card + sentence */
export interface NextCardWithSentenceResponse {
  flashcard: NextCardResponse["flashcard"];
  sentence: GenerateSentenceResponse | null;
  cardsRemaining: number;
  newCardsRemaining?: number;
  nextDueAt?: string;
}

/** POST /api/quiz/check-translation response */
export interface CheckTranslationResponse {
  correct: boolean;
}

/** POST /api/quiz/check-reading response */
export interface CheckReadingResponse {
  correct: boolean;
  expectedReading: string;
  correctReading: string;
  feedback?: string;
}

/** @deprecated Use CheckReadingResponse instead */
export interface CheckPinyinResponse {
  correct: boolean;
  expectedPinyin: string;
}

/** POST /api/quiz/submit-result request body */
export interface SubmitResultInput {
  sessionId: string;
  flashcardId: string;
  rating: Rating;
  generatedSentence: string;
  userTranslation: string;
  correctTranslation: string;
  translationCorrect: boolean;
  /** Reading input (pinyin, romaji, etc.) — optional for phonetic languages */
  userReading?: string | null;
  /** Whether the reading was correct — optional for phonetic languages */
  readingCorrect?: boolean | null;
  /** @deprecated Use userReading instead */
  userPinyin?: string | null;
  /** @deprecated Use readingCorrect instead */
  pinyinCorrect?: boolean | null;
  responseTimeMs?: number;
}

/** POST /api/quiz/submit-result response */
export interface SubmitResultResponse {
  flashcard: FlashcardScheduleResponse;
}

/** GET /api/quiz/today-stats response */
export interface TodayStatsResponse {
  dueToday: number;
  reviewedToday: number;
  newToday: number;
  correctToday: number;
  streak: number;
  accuracy: number;
  nextDueAt: string | null;
}

// ---------------------------------------------------------------------------
// Metrics API shapes
// ---------------------------------------------------------------------------

/** GET /api/metrics/overview response */
export interface MetricsOverviewResponse {
  totalCards: number;
  cardsByState: Record<CardState, number>;
  cardsDueToday: number;
  currentStreak: number;
  longestStreak: number;
  todayReviewed: number;
  last7DaysAccuracy: number;
  last30DaysAccuracy: number;
}

/** Single day entry in GET /api/metrics/history */
export interface MetricsHistoryEntry {
  date: string; // YYYY-MM-DD
  cardsReviewed: number;
  cardsCorrect: number;
  accuracy: number;
  newCardsStudied: number;
  timeSpentMinutes: number;
}

/** GET /api/metrics/history response */
export interface MetricsHistoryResponse {
  period: "7d" | "30d" | "90d" | "all";
  data: MetricsHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Billing API shapes
// ---------------------------------------------------------------------------

/** POST /api/billing/create-checkout request */
export interface CreateCheckoutInput {
  priceId: string;
}

/** POST /api/billing/create-checkout response */
export interface CreateCheckoutResponse {
  checkoutUrl: string;
}

/** GET /api/billing/status response */
export interface BillingStatusResponse {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  canAccessQuiz: boolean;
}

// ---------------------------------------------------------------------------
// AI Card Creation
// ---------------------------------------------------------------------------

/** POST /api/flashcards/ai-create response */
export interface AiCardSuggestionResponse {
  suggestion: {
    word: string;
    /** @deprecated Use reading instead */
    pinyin: string;
    /** Reading/pronunciation field */
    reading: string;
    englishMeaning: string;
    exampleSentence: string;
  };
  isDuplicate: boolean;
}

// ---------------------------------------------------------------------------
// Flashcard Export
// ---------------------------------------------------------------------------

/** GET /api/flashcards/export response */
export interface FlashcardExportResponse {
  exportedAt: string;
  totalCards: number;
  cards: Array<{
    word: string;
    pinyin: string;
    englishMeaning: string;
    exampleSentence: string | null;
    state: CardState;
    reps: number;
    lapses: number;
    stability: number;
    difficulty: number;
    due: string;
    createdAt: string;
  }>;
}
