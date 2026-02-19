"use client";

import { useCallback, useRef, useState } from "react";
import * as api from "@/lib/api";
import type {
  NextCardResponse,
  GenerateSentenceResponse,
  CheckTranslationResponse,
  CheckPinyinResponse,
  FlashcardScheduleResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Quiz States — matches the spec state machine
// ---------------------------------------------------------------------------
export type QuizState =
  | "SESSION_START"
  | "CARD_START"
  | "SHOW_SENTENCE"
  | "AWAITING_TRANSLATION"
  | "CHECKING_TRANSLATION"
  | "TRANSLATION_CORRECT"
  | "TRANSLATION_INCORRECT"
  | "RETYPING_TRANSLATION"
  | "PINYIN_INPUT"
  | "VERIFY_PINYIN"
  | "PINYIN_CORRECT"
  | "PINYIN_INCORRECT"
  | "RETYPING_PINYIN"
  | "CARD_RESULT"
  | "CARD_COMPLETE"
  | "SESSION_SUMMARY";

// ---------------------------------------------------------------------------
// Session-level stats (client-side tracking)
// ---------------------------------------------------------------------------
export interface SessionStats {
  cardsReviewed: number;
  cardsCorrect: number;
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
  pinyinResult: CheckPinyinResponse | null;
  userTranslation: string;
  userPinyin: string;
  scheduleResult: FlashcardScheduleResponse | null;
  currentCardCorrect: boolean;
  responseStartTime: number; // ms timestamp when sentence was shown
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------
export interface QuizStateMachine {
  state: QuizState;
  sessionId: string | null;
  card: CurrentCardData | null;
  stats: SessionStats;
  error: string | null;
  sessionStartTime: number | null;

  // Actions
  startSession: () => Promise<void>;
  loadNextCard: () => Promise<void>;
  submitTranslation: (translation: string) => Promise<void>;
  retypeTranslation: (translation: string) => boolean;
  submitPinyin: (pinyin: string) => Promise<void>;
  retypePinyin: (pinyin: string) => boolean;
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
// Hook implementation
// ---------------------------------------------------------------------------
export function useQuizStateMachine(): QuizStateMachine {
  const [state, setState] = useState<QuizState>("SESSION_START");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [card, setCard] = useState<CurrentCardData | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    cardsReviewed: 0,
    cardsCorrect: 0,
    currentStreak: 0,
    longestStreak: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Ref to avoid stale closures in auto-advance timers
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // startSession
  // -------------------------------------------------------------------------
  const startSession = useCallback(async () => {
    try {
      setError(null);
      setState("SESSION_START");
      const res = await api.startSession();
      setSessionId(res.sessionId);
      setSessionStartTime(Date.now());
      setStats({
        cardsReviewed: 0,
        cardsCorrect: 0,
        currentStreak: 0,
        longestStreak: 0,
      });
      // Immediately try to load first card
      setState("CARD_START");
      const nextCard = await api.getNextCard(res.sessionId);
      if (!nextCard.flashcard) {
        setState("SESSION_SUMMARY");
        return;
      }
      // Generate sentence
      const sentenceRes = await api.generateSentence(nextCard.flashcard.id);
      setCard({
        flashcard: nextCard.flashcard,
        sentence: sentenceRes,
        translationResult: null,
        pinyinResult: null,
        userTranslation: "",
        userPinyin: "",
        scheduleResult: null,
        currentCardCorrect: true,
        responseStartTime: Date.now(),
      });
      setState("AWAITING_TRANSLATION");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start session",
      );
    }
  }, []);

  // -------------------------------------------------------------------------
  // loadNextCard
  // -------------------------------------------------------------------------
  const loadNextCard = useCallback(async () => {
    if (!sessionId) return;
    try {
      clearAutoAdvance();
      setError(null);
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
        pinyinResult: null,
        userTranslation: "",
        userPinyin: "",
        scheduleResult: null,
        currentCardCorrect: true,
        responseStartTime: Date.now(),
      });
      setState("AWAITING_TRANSLATION");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load next card",
      );
    }
  }, [sessionId, clearAutoAdvance]);

  // -------------------------------------------------------------------------
  // submitTranslation
  // -------------------------------------------------------------------------
  const submitTranslation = useCallback(
    async (translation: string) => {
      if (!card?.sentence) return;
      const trimmed = translation.trim();
      if (!trimmed) return;

      // Check if user typed Chinese instead of English
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
          setState("TRANSLATION_CORRECT");
          // Auto-advance after 800ms
          autoAdvanceTimer.current = setTimeout(() => {
            setState("PINYIN_INPUT");
          }, 800);
        } else {
          setState("TRANSLATION_INCORRECT");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to check translation",
        );
        setState("AWAITING_TRANSLATION");
      }
    },
    [card],
  );

  // -------------------------------------------------------------------------
  // retypeTranslation — case-insensitive match against stored englishMeaning
  // -------------------------------------------------------------------------
  const retypeTranslation = useCallback(
    (translation: string): boolean => {
      if (!card) return false;
      setState("RETYPING_TRANSLATION");
      const trimmed = translation.trim().toLowerCase();
      const expected = card.flashcard.englishMeaning.trim().toLowerCase();
      if (trimmed === expected) {
        setState("PINYIN_INPUT");
        return true;
      }
      return false;
    },
    [card],
  );

  // -------------------------------------------------------------------------
  // submitPinyin
  // -------------------------------------------------------------------------
  const submitPinyin = useCallback(
    async (pinyin: string) => {
      if (!card) return;
      const trimmed = pinyin.trim();
      if (!trimmed) return;

      // Check for tone-marked pinyin (soft rejection)
      if (TONE_MARK_REGEX.test(trimmed)) {
        setError(
          "Please use numbered tones instead of tone marks. For example, type ni3hao3 instead of nihao.",
        );
        return;
      }

      // Check for English (no digits and no tone marks = likely English)
      if (!/\d/.test(trimmed) && !TONE_MARK_REGEX.test(trimmed)) {
        setError(
          "Please type the pinyin with tone numbers. For example: ni3hao3",
        );
        return;
      }

      try {
        setError(null);
        setState("VERIFY_PINYIN");
        setCard((prev) => (prev ? { ...prev, userPinyin: trimmed } : prev));

        const result = await api.checkPinyin(card.flashcard.id, trimmed);

        setCard((prev) =>
          prev
            ? {
                ...prev,
                pinyinResult: result,
                currentCardCorrect: prev.currentCardCorrect && result.correct,
              }
            : prev,
        );

        if (result.correct) {
          setState("PINYIN_CORRECT");
          // Auto-advance after 800ms to CARD_RESULT
          autoAdvanceTimer.current = setTimeout(() => {
            submitCardResult(true);
          }, 800);
        } else {
          setState("PINYIN_INCORRECT");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to check pinyin",
        );
        setState("PINYIN_INPUT");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card],
  );

  // -------------------------------------------------------------------------
  // retypePinyin — normalized string match
  // -------------------------------------------------------------------------
  const retypePinyin = useCallback(
    (pinyin: string): boolean => {
      if (!card?.pinyinResult) return false;
      setState("RETYPING_PINYIN");
      const normalize = (s: string) =>
        s.trim().toLowerCase().replace(/[\s\-']/g, "");
      const userNorm = normalize(pinyin);
      const expectedNorm = normalize(card.pinyinResult.expectedPinyin);
      if (userNorm === expectedNorm) {
        submitCardResult(false);
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
  // Use a ref for card to avoid stale closures in submitCardResult
  const cardRef = useRef(card);
  cardRef.current = card;

  const submitCardResult = useCallback(
    async (fromCorrectPinyin: boolean) => {
      const currentCard = cardRef.current;
      if (!currentCard || !sessionId || !currentCard.sentence) return;
      try {
        setState("CARD_RESULT");
        const isCorrect = fromCorrectPinyin
          ? currentCard.currentCardCorrect
          : false; // if retyping pinyin, the pinyin was wrong

        // Determine the actual currentCardCorrect — need to check latest state
        const cardCorrect = isCorrect && currentCard.currentCardCorrect;
        const rating = cardCorrect ? "GOOD" : "AGAIN";

        const responseTimeMs = Date.now() - currentCard.responseStartTime;

        const result = await api.submitResult({
          sessionId,
          flashcardId: currentCard.flashcard.id,
          rating: rating as "GOOD" | "AGAIN",
          generatedSentence: currentCard.sentence.sentence,
          userTranslation: currentCard.userTranslation || "no translation",
          correctTranslation: currentCard.sentence.translation,
          translationCorrect: currentCard.translationResult?.correct ?? false,
          userPinyin: currentCard.userPinyin || "unknown",
          pinyinCorrect: currentCard.pinyinResult?.correct ?? false,
          responseTimeMs,
        });

        // The API returns { updatedCard, sessionStats } — map to scheduleResult
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

        setStats((prev) => {
          const newReviewed = prev.cardsReviewed + 1;
          const newCorrect = prev.cardsCorrect + (cardCorrect ? 1 : 0);
          const newStreak = cardCorrect ? prev.currentStreak + 1 : 0;
          const newLongest = Math.max(prev.longestStreak, newStreak);
          return {
            cardsReviewed: newReviewed,
            cardsCorrect: newCorrect,
            currentStreak: newStreak,
            longestStreak: newLongest,
          };
        });

        setState("CARD_COMPLETE");

        // Auto-advance after 2 seconds
        autoAdvanceTimer.current = setTimeout(() => {
          loadNextCard();
        }, 2000);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to submit result",
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, loadNextCard],
  );

  // -------------------------------------------------------------------------
  // advanceFromCorrect — user taps/clicks during auto-advance states
  // -------------------------------------------------------------------------
  const advanceFromCorrect = useCallback(() => {
    clearAutoAdvance();
    if (state === "TRANSLATION_CORRECT") {
      setState("PINYIN_INPUT");
    } else if (state === "PINYIN_CORRECT") {
      submitCardResult(true);
    }
  }, [state, clearAutoAdvance, submitCardResult]);

  // -------------------------------------------------------------------------
  // advanceFromCardComplete — user clicks "Next Card"
  // -------------------------------------------------------------------------
  const advanceFromCardComplete = useCallback(() => {
    clearAutoAdvance();
    loadNextCard();
  }, [clearAutoAdvance, loadNextCard]);

  // -------------------------------------------------------------------------
  // dismissError
  // -------------------------------------------------------------------------
  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    state,
    sessionId,
    card,
    stats,
    error,
    sessionStartTime,
    startSession,
    loadNextCard,
    submitTranslation,
    retypeTranslation,
    submitPinyin,
    retypePinyin,
    advanceFromCorrect,
    advanceFromCardComplete,
    dismissError,
  };
}
