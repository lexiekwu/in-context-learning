"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import type {
  NextCardResponse,
  GenerateSentenceResponse,
  CheckTranslationResponse,
  CheckPinyinResponse,
  FlashcardScheduleResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Quiz States
// ---------------------------------------------------------------------------
export type QuizState =
  | "CARD_START"
  | "AWAITING_TRANSLATION"
  | "CHECKING_TRANSLATION"
  | "TRANSLATION_CORRECT"
  | "TRANSLATION_INCORRECT"
  | "RETYPING_TRANSLATION"
  | "READING_INPUT"
  | "VERIFY_READING"
  | "READING_CORRECT"
  | "READING_INCORRECT"
  | "RETYPING_READING"
  | "CARD_COMPLETE"
  | "SESSION_SUMMARY";

// ---------------------------------------------------------------------------
// Daily stats (displayed in the header)
// ---------------------------------------------------------------------------
export interface DailyStats {
  reviewed: number;
  correct: number;
  maxPossible: number;
  currentStreak: number;
  longestStreak: number;
}

// ---------------------------------------------------------------------------
// Current card data aggregated during the quiz flow
// ---------------------------------------------------------------------------
export interface CurrentCardData {
  flashcard: NonNullable<NextCardResponse["flashcard"]>;
  sentence: GenerateSentenceResponse | null;
  translationResult: CheckTranslationResponse | null;
  readingResult: CheckPinyinResponse | null;
  userTranslation: string;
  userReading: string;
  scheduleResult: FlashcardScheduleResponse | null;
  currentCardCorrect: boolean;
  responseStartTime: number;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------
export interface QuizStateMachine {
  state: QuizState;
  card: CurrentCardData | null;
  dailyStats: DailyStats;
  error: string | null;
  subscriptionBlocked: boolean;

  // Language info
  isPhonetic: boolean;

  // Actions
  loadNextCard: () => Promise<void>;
  updateCurrentCard: (updates: Partial<CurrentCardData["flashcard"]>) => void;
  deleteCurrentCard: () => Promise<void>;
  submitTranslation: (translation: string) => Promise<void>;
  retypeTranslation: (translation: string) => boolean;
  submitReading: (reading: string) => Promise<void>;
  retypeReading: (reading: string) => boolean;
  advanceFromCorrect: () => void;
  advanceFromCardComplete: () => void;
  dismissError: () => void;
}

// ---------------------------------------------------------------------------
// Pinyin tone-mark detection (Unicode ranges for accented pinyin vowels)
// ---------------------------------------------------------------------------
const TONE_MARK_REGEX =
  /[\u0101\u00E1\u01CE\u00E0\u0113\u00E9\u011B\u00E8\u012B\u00ED\u01D0\u00EC\u014D\u00F3\u01D2\u00F2\u016B\u00FA\u01D4\u00F9\u01D6\u01D8\u01DA\u01DC]/;

// CJK Unicode detection
const CJK_REGEX =
  /[\u4E00-\u9FFF\u3400-\u4DBF\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}\u{2B740}-\u{2B81F}\u{2B820}-\u{2CEAF}\u{2CEB0}-\u{2EBEF}\u{30000}-\u{3134F}]/gu;

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------
export interface QuizStateMachineOptions {
  /** If true, the language is phonetic (e.g. Spanish, French) and the reading
   *  step (pinyin input) is skipped entirely. Defaults to false (Chinese). */
  isPhonetic?: boolean;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------
export function useQuizStateMachine(
  options: QuizStateMachineOptions = {},
): QuizStateMachine {
  const { isPhonetic = false } = options;
  const [state, setState] = useState<QuizState>("CARD_START");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [card, setCard] = useState<CurrentCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);

  // Daily stats: baseline from API + session increments
  const [dailyBaseline, setDailyBaseline] = useState({ reviewed: 0, correct: 0, maxPossible: 0 });
  const [sessionStats, setSessionStats] = useState({
    reviewed: 0,
    correct: 0,
    maxPossible: 0,
    currentStreak: 0,
    longestStreak: 0,
  });

  const dailyStats: DailyStats = {
    reviewed: dailyBaseline.reviewed + sessionStats.reviewed,
    correct: dailyBaseline.correct + sessionStats.correct,
    maxPossible: dailyBaseline.maxPossible + sessionStats.maxPossible,
    currentStreak: sessionStats.currentStreak,
    longestStreak: sessionStats.longestStreak,
  };

  // Prefetch ref
  type PrefetchResult =
    | { type: "card"; flashcard: NonNullable<NextCardResponse["flashcard"]>; sentence: GenerateSentenceResponse }
    | { type: "empty" };

  const prefetchRef = useRef<{
    promise: Promise<PrefetchResult | null>;
    sessionId: string;
  } | null>(null);

  // Helper: prefetch the next card + LLM sentence in the background
  async function prefetchNextCard(sid: string, excludeCardId?: string): Promise<PrefetchResult | null> {
    try {
      const res = await api.getNextCardWithSentence(sid, excludeCardId);
      if (!res.flashcard || !res.sentence) return { type: "empty" };
      return { type: "card", flashcard: res.flashcard, sentence: res.sentence };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Auto-start on mount
  // -------------------------------------------------------------------------
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        setError(null);

        // Fetch today's stats and start a session in parallel
        const [todayRes, sessionRes] = await Promise.allSettled([
          api.getTodayStats(),
          api.startSession(),
        ]);

        // Handle today stats
        if (todayRes.status === "fulfilled") {
          setDailyBaseline({
            reviewed: todayRes.value.reviewedToday ?? 0,
            correct: todayRes.value.correctToday ?? 0,
            maxPossible: todayRes.value.maxPossibleToday ?? 0,
          });
        }

        // Handle session start
        if (sessionRes.status === "rejected") {
          const err = sessionRes.reason;
          if (err && typeof err === "object" && "status" in err && err.status === 403) {
            setSubscriptionBlocked(true);
            return;
          }
          throw err;
        }

        const sid = sessionRes.value.sessionId;
        setSessionId(sid);

        // Load first card + sentence in a single request
        const firstCard = await api.getNextCardWithSentence(sid);
        if (!firstCard.flashcard || !firstCard.sentence) {
          setState("SESSION_SUMMARY");
          return;
        }

        setCard({
          flashcard: firstCard.flashcard,
          sentence: firstCard.sentence,
          translationResult: null,
          readingResult: null,
          userTranslation: "",
          userReading: "",
          scheduleResult: null,
          currentCardCorrect: true,
          responseStartTime: Date.now(),
        });
        setState("AWAITING_TRANSLATION");

        // Prefetch card 2
        prefetchRef.current = {
          promise: prefetchNextCard(sid, firstCard.flashcard.id),
          sessionId: sid,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start quiz");
      }
    })();
  }, []);

  // -------------------------------------------------------------------------
  // loadNextCard
  // -------------------------------------------------------------------------
  const loadNextCard = useCallback(async () => {
    if (!sessionId) return;
    try {
      setError(null);

      // Check if we have prefetched data
      const pending = prefetchRef.current?.sessionId === sessionId
        ? prefetchRef.current
        : null;

      if (pending) {
        const raceResult = await Promise.race([
          pending.promise.then((r) => ({ tag: "data" as const, result: r })),
          new Promise<{ tag: "timeout" }>((resolve) =>
            setTimeout(() => resolve({ tag: "timeout" }), 100),
          ),
        ]);

        let prefetched: PrefetchResult | null;
        if (raceResult.tag === "data") {
          prefetched = raceResult.result;
        } else {
          setState("CARD_START");
          prefetched = await pending.promise;
        }
        prefetchRef.current = null;

        if (prefetched) {
          if (prefetched.type === "empty") {
            setState("SESSION_SUMMARY");
            return;
          }
          setCard({
            flashcard: prefetched.flashcard,
            sentence: prefetched.sentence,
            translationResult: null,
            readingResult: null,
            userTranslation: "",
            userReading: "",
            scheduleResult: null,
            currentCardCorrect: true,
            responseStartTime: Date.now(),
          });
          setState("AWAITING_TRANSLATION");
          prefetchRef.current = {
            promise: prefetchNextCard(sessionId, prefetched.flashcard.id),
            sessionId,
          };
          return;
        }
      }

      // Fallback: fetch normally
      setState("CARD_START");
      const nextCard = await api.getNextCard(sessionId);
      if (!nextCard.flashcard) {
        setState("SESSION_SUMMARY");
        return;
      }
      const sentenceRes = await api.generateSentence(nextCard.flashcard.id);
      setCard({
        flashcard: nextCard.flashcard,
        sentence: sentenceRes,
        translationResult: null,
        readingResult: null,
        userTranslation: "",
        userReading: "",
        scheduleResult: null,
        currentCardCorrect: true,
        responseStartTime: Date.now(),
      });
      setState("AWAITING_TRANSLATION");
      prefetchRef.current = {
        promise: prefetchNextCard(sessionId, nextCard.flashcard.id),
        sessionId,
      };
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load next card",
      );
    }
  }, [sessionId]);

  // -------------------------------------------------------------------------
  // updateCurrentCard
  // -------------------------------------------------------------------------
  const updateCurrentCard = useCallback(
    (updates: Partial<CurrentCardData["flashcard"]>) => {
      setCard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          flashcard: { ...prev.flashcard, ...updates },
        };
      });
    },
    [],
  );

  // -------------------------------------------------------------------------
  // deleteCurrentCard
  // -------------------------------------------------------------------------
  const deleteCurrentCard = useCallback(async () => {
    if (!card) return;
    try {
      await api.deleteFlashcard(card.flashcard.id);
      await loadNextCard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete card",
      );
    }
  }, [card, loadNextCard]);

  // -------------------------------------------------------------------------
  // submitTranslation
  // -------------------------------------------------------------------------
  const submitTranslation = useCallback(
    async (translation: string) => {
      if (!card?.sentence) return;
      const trimmed = translation.trim();

      if (!trimmed) {
        // Skip/Empty translation
        setCard((prev) =>
          prev ? { ...prev, userTranslation: "" } : prev,
        );
        const result = { correct: false };
        setCard((prev) =>
          prev
            ? {
                ...prev,
                translationResult: result,
                currentCardCorrect: false,
              }
            : prev,
        );
        setState("TRANSLATION_INCORRECT");
        return;
      }

      const cjkMatches = trimmed.match(CJK_REGEX);
      if (cjkMatches && cjkMatches.length / trimmed.length > 0.5) {
        setError("Please type your answer in English.");
        return;
      }

      try {
        setError(null);
        setState("CHECKING_TRANSLATION");
        setCard((prev) =>
          prev ? { ...prev, userTranslation: trimmed } : prev,
        );

        const result = await api.checkTranslation(
          card.flashcard.id,
          card.sentence.sentence,
          trimmed,
          card.sentence.translation,
        );

        setCard((prev) =>
          prev
            ? {
                ...prev,
                translationResult: result,
                currentCardCorrect: prev.currentCardCorrect && result.correct,
              }
            : prev,
        );

        if (result.correct) {
          if (isPhonetic) {
            // Phonetic languages skip the reading step entirely
            setState("TRANSLATION_CORRECT");
            submitCardResult(true, true, true);
          } else {
            setState("TRANSLATION_CORRECT");
            setState("READING_INPUT");
          }
        } else {
          setState("TRANSLATION_INCORRECT");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to check translation",
        );
        setState("AWAITING_TRANSLATION");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card, isPhonetic],
  );

  // -------------------------------------------------------------------------
  // retypeTranslation
  // -------------------------------------------------------------------------
  const retypeTranslation = useCallback(
    (translation: string): boolean => {
      if (!card) return false;
      setState("RETYPING_TRANSLATION");

      const normalize = (s: string) =>
        s.replace(/\(.*?\)/g, "")
         .replace(/[^a-zA-Z0-9]/g, "")
         .toLowerCase();

      const userNorm = normalize(translation);
      const variants = card.flashcard.englishMeaning.split(/[\/;,]/);
      const matched = variants.some((v) => normalize(v) === userNorm)
        || normalize(card.flashcard.englishMeaning) === userNorm;

      if (matched) {
        if (isPhonetic) {
          // Phonetic languages skip the reading step entirely
          submitCardResult(false, true, false);
        } else {
          setState("READING_INPUT");
        }
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card, isPhonetic],
  );

  // -------------------------------------------------------------------------
  // submitReading (pinyin for Chinese, skip for phonetic languages)
  // -------------------------------------------------------------------------
  const submitReading = useCallback(
    async (reading: string) => {
      if (!card) return;
      const trimmed = reading.trim();

      if (!trimmed) {
        // Skip/Empty reading
        setCard((prev) => (prev ? { ...prev, userReading: "" } : prev));
        const result = {
          correct: false,
          expectedReading: card.flashcard.pinyin || "unknown",
        };
        setCard((prev) =>
          prev
            ? {
                ...prev,
                readingResult: {
                  correct: result.correct,
                  expectedPinyin: result.expectedReading,
                },
                currentCardCorrect: false,
              }
            : prev,
        );
        setState("READING_INCORRECT");
        return;
      }

      if (TONE_MARK_REGEX.test(trimmed)) {
        setError(
          "Please use numbered tones instead of tone marks. For example, type ni3hao3 instead of nihao.",
        );
        return;
      }

      if (!/\d/.test(trimmed) && !TONE_MARK_REGEX.test(trimmed)) {
        setError(
          "Please type the pinyin with tone numbers. For example: ni3hao3",
        );
        return;
      }

      try {
        setError(null);
        setState("VERIFY_READING");
        setCard((prev) => (prev ? { ...prev, userReading: trimmed } : prev));

        const result = await api.checkPinyin(card.flashcard.id, trimmed);

        setCard((prev) =>
          prev
            ? {
                ...prev,
                readingResult: result,
                currentCardCorrect: prev.currentCardCorrect && result.correct,
              }
            : prev,
        );

        if (result.correct) {
          const translationCorrect = card.translationResult?.correct ?? false;
          submitCardResult(translationCorrect, true, card.currentCardCorrect);
        } else {
          setState("READING_INCORRECT");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to check reading",
        );
        setState("READING_INPUT");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card],
  );

  // -------------------------------------------------------------------------
  // retypeReading (pinyin retype for Chinese)
  // -------------------------------------------------------------------------
  const retypeReading = useCallback(
    (reading: string): boolean => {
      if (!card?.readingResult) return false;
      setState("RETYPING_READING");
      const normalize = (s: string) =>
        s.trim().toLowerCase().replace(/[\s\-']/g, "");
      const userNorm = normalize(reading);
      const expectedNorm = normalize(card.readingResult.expectedPinyin);
      if (userNorm === expectedNorm) {
        const translationCorrect = card.translationResult?.correct ?? false;
        submitCardResult(translationCorrect, false, false);
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card],
  );

  // -------------------------------------------------------------------------
  // submitCardResult — internal helper to submit FSRS result
  // -------------------------------------------------------------------------
  const cardRef = useRef(card);
  cardRef.current = card;

  const submitCardResult = useCallback(
    async (translationCorrect: boolean, readingCorrect: boolean, isInitialTry: boolean) => {
      const currentCard = cardRef.current;
      if (!currentCard || !sessionId || !currentCard.sentence) return;
      try {
        // Points logic for accuracy stats:
        // 1 point for reading/pronunciation correct (max 3 points total, or 2 for phonetic)
        const translationPoints = translationCorrect
          ? (currentCard.translationResult?.sentenceCorrect ? 2 : 1)
          : 0;
        const readingPoints = isPhonetic ? 0 : (readingCorrect ? 1 : 0);
        const pointsGained = translationPoints + readingPoints;
        const maxPoints = isPhonetic ? 2 : 3;

        const cardCorrect = isInitialTry && translationCorrect && readingCorrect;

        const rating = cardCorrect ? "GOOD" : "AGAIN";
        const responseTimeMs = Date.now() - currentCard.responseStartTime;

        // Immediately show CARD_COMPLETE and update stats
        setSessionStats((prev) => {
          const newReviewed = prev.reviewed + 1;
          const newCorrect = prev.correct + pointsGained;
          const newMaxPossible = prev.maxPossible + maxPoints;
          const newStreak = cardCorrect ? prev.currentStreak + 1 : 0;
          const newLongest = Math.max(prev.longestStreak, newStreak);
          return {
            reviewed: newReviewed,
            correct: newCorrect,
            maxPossible: newMaxPossible,
            currentStreak: newStreak,
            longestStreak: newLongest,
          };
        });
        setState("CARD_COMPLETE");

        // Fire off API call — schedule data fills in when it resolves
        api.submitResult({
          sessionId,
          flashcardId: currentCard.flashcard.id,
          rating: rating as "GOOD" | "AGAIN",
          generatedSentence: currentCard.sentence.sentence,
          userTranslation: currentCard.userTranslation || "no translation",
          correctTranslation: currentCard.sentence.translation,
          translationCorrect,
          sentenceCorrect: Boolean(currentCard.translationResult?.sentenceCorrect),
          userReading: isPhonetic ? undefined : (currentCard.userReading || "unknown"),
          readingCorrect: isPhonetic ? undefined : readingCorrect,
          userPinyin: isPhonetic ? undefined : (currentCard.userReading || "unknown"),
          pinyinCorrect: isPhonetic ? undefined : readingCorrect,
          responseTimeMs,
        }).then((result) => {
          const apiResult = result as unknown as {
            updatedCard?: { state: string; due: string; stability: number; difficulty: number };
          };
          if (apiResult.updatedCard) {
            setCard((prev) =>
              prev
                ? {
                    ...prev,
                    scheduleResult: {
                      id: currentCard.flashcard.id,
                      nextDue: apiResult.updatedCard!.due,
                      state: apiResult.updatedCard!.state as never,
                      stability: apiResult.updatedCard!.stability,
                      difficulty: apiResult.updatedCard!.difficulty,
                      reps: currentCard.flashcard.reps + 1,
                    },
                  }
                : prev,
            );
          }
        }).catch((err: unknown) => {
          console.error("Failed to submit card result:", err);
          setError(err instanceof Error ? err.message : "Failed to save result. Please check your connection.");
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to submit result",
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, loadNextCard, isPhonetic],
  );

  // -------------------------------------------------------------------------
  // advanceFromCorrect
  // -------------------------------------------------------------------------
  const advanceFromCorrect = useCallback(() => {
    if (state === "TRANSLATION_CORRECT") {
      if (isPhonetic) {
        submitCardResult(true, true, true);
      } else {
        setState("READING_INPUT");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isPhonetic]);

  // -------------------------------------------------------------------------
  // advanceFromCardComplete
  // -------------------------------------------------------------------------
  const advanceFromCardComplete = useCallback(() => {
    loadNextCard();
  }, [loadNextCard]);

  // -------------------------------------------------------------------------
  // dismissError
  // -------------------------------------------------------------------------
  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    state,
    card,
    dailyStats,
    error,
    subscriptionBlocked,
    isPhonetic,
    loadNextCard,
    updateCurrentCard,
    deleteCurrentCard,
    submitTranslation,
    retypeTranslation,
    submitReading,
    retypeReading,
    advanceFromCorrect,
    advanceFromCardComplete,
    dismissError,
  };
}
