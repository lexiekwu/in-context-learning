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
  CharacterSet,
  Rating,
  SubscriptionStatus,
} from "@/generated/prisma/client";

// Re-export Prisma enums for convenience
export type { CardState, CharacterSet, Rating, SubscriptionStatus };

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
  pinyin: string;
  englishMeaning: string;
  exampleSentence?: string;
}

/** Body for PUT /api/flashcards/:id */
export interface UpdateFlashcardInput {
  word?: string;
  pinyin?: string;
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
  pinyin: string;
  meaning: string;
  isTarget?: boolean;
}

/** POST /api/quiz/generate-sentence response */
export interface GenerateSentenceResponse {
  sentence: string;
  translation: string;
  wordBreakdown: WordBreakdownEntry[];
}

/** POST /api/quiz/check-translation response */
export interface CheckTranslationResponse {
  correct: boolean;
  explanation: string;
  targetWordUsedCorrectly: boolean;
  suggestedTranslation: string;
}

/** POST /api/quiz/check-pinyin response */
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
  userPinyin: string;
  pinyinCorrect: boolean;
  responseTimeMs?: number;
}

/** POST /api/quiz/submit-result response */
export interface SubmitResultResponse {
  flashcard: FlashcardScheduleResponse;
}

/** GET /api/quiz/today-stats response */
export interface TodayStatsResponse {
  todayStats: {
    cardsReviewed: number;
    cardsCorrect: number;
    accuracy: number;
    newCardsStudied: number;
    currentStreak: number;
  };
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
    pinyin: string;
    englishMeaning: string;
    exampleSentence: string;
  };
  confirmed: false;
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
