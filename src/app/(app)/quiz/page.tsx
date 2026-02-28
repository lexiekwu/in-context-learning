"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuizStateMachine } from "@/hooks/useQuizStateMachine";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { QuizCard } from "@/components/quiz/QuizCard";
import { TranslationInput } from "@/components/quiz/TranslationInput";
import { TranslationFeedback } from "@/components/quiz/TranslationFeedback";
import { ReadingInput } from "@/components/quiz/ReadingInput";
import { ReadingFeedback } from "@/components/quiz/ReadingFeedback";
import { CardComplete } from "@/components/quiz/CardComplete";
import { SessionSummary } from "@/components/quiz/SessionSummary";
import { LoadingSkeleton } from "@/components/quiz/LoadingSkeleton";
import * as api from "@/lib/api";
import type { WordBreakdownEntry } from "@/types";
import type { DailyStats } from "@/hooks/useQuizStateMachine";

export default function QuizPage() {
  const [langSettings, setLangSettings] = useState<api.UserLanguageSettings | null>(null);

  useEffect(() => {
    api.getUserLanguageSettings().then(setLangSettings).catch(() => {});
  }, []);

  const isPhonetic = langSettings?.language.isPhonetic ?? false;

  const quiz = useQuizStateMachine({ isPhonetic });

  const { state: quizState, advanceFromCorrect, advanceFromCardComplete } = quiz;
  const handleSwipeLeft = useCallback(() => {
    if (quizState === "TRANSLATION_CORRECT") {
      advanceFromCorrect();
    } else if (quizState === "CARD_COMPLETE") {
      advanceFromCardComplete();
    }
  }, [quizState, advanceFromCorrect, advanceFromCardComplete]);

  const swipeRef = useSwipeGesture({ onSwipeLeft: handleSwipeLeft });

  const handleSaveWord = useCallback(
    async (entry: WordBreakdownEntry): Promise<{ alreadyExists: boolean }> => {
      const result = await api.quickSave({
        word: entry.word,
        pinyin: entry.pinyin,
        englishMeaning: entry.meaning,
      });
      return { alreadyExists: !!(result as unknown as { isDuplicate: boolean }).isDuplicate };
    },
    [],
  );

  // -------------------------------------------------------------------
  // Subscription blocked — paywall
  // -------------------------------------------------------------------
  if (quiz.subscriptionBlocked) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-zinc-100">
            {langSettings?.language.name ?? "Language"} Quiz
          </h1>
          <div className="mt-8 rounded-xl border border-red-800 bg-red-900/20 p-6">
            <p className="text-base text-red-200">
              Your trial has expired. Subscribe to continue learning.
            </p>
            <a
              href="/settings"
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Subscribe
            </a>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // SESSION_SUMMARY — all cards reviewed for today
  // -------------------------------------------------------------------
  if (quiz.state === "SESSION_SUMMARY") {
    return (
      <div className="flex flex-1 flex-col">
        <QuizStatsBar dailyStats={quiz.dailyStats} />
        <div className="flex flex-1 items-center justify-center">
          <SessionSummary dailyStats={quiz.dailyStats} />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------
  if (quiz.state === "CARD_START") {
    return (
      <div className="flex flex-1 flex-col">
        <QuizStatsBar dailyStats={quiz.dailyStats} />
        <div className="flex flex-1 items-center justify-center px-4">
          <LoadingSkeleton
            message="Generating sentence..."
            showSlowWarning
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Main quiz flow — card is loaded
  // -------------------------------------------------------------------
  const card = quiz.card;
  if (!card || !card.sentence) {
    return (
      <div className="flex flex-1 flex-col">
        <QuizStatsBar dailyStats={quiz.dailyStats} />
        <div className="flex flex-1 items-center justify-center px-4">
          <LoadingSkeleton message="Loading..." />
        </div>
      </div>
    );
  }

  const isCheckingTranslation = quiz.state === "CHECKING_TRANSLATION";
  const isVerifyingReading = quiz.state === "VERIFY_READING";
  const showTranslationFeedback =
    quiz.state === "TRANSLATION_CORRECT" ||
    quiz.state === "TRANSLATION_INCORRECT" ||
    quiz.state === "RETYPING_TRANSLATION";
  const showReadingInput =
    quiz.state === "READING_INPUT" ||
    quiz.state === "VERIFY_READING";
  const showReadingFeedback =
    quiz.state === "READING_CORRECT" ||
    quiz.state === "READING_INCORRECT" ||
    quiz.state === "RETYPING_READING";
  const showCardComplete = quiz.state === "CARD_COMPLETE";

  const showTranslationResult =
    showTranslationFeedback ||
    showReadingInput ||
    showReadingFeedback ||
    showCardComplete;
  const showReadingResult =
    showReadingFeedback || showCardComplete;

  return (
    <div ref={swipeRef} className="flex flex-1 flex-col">
      <QuizStatsBar dailyStats={quiz.dailyStats} />

      {/* Error toast */}
      {quiz.error && (
        <div className="mx-4 mt-2 flex items-center justify-between rounded-lg border border-red-800 bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-300">
            {quiz.error}
          </p>
          <button
            type="button"
            onClick={quiz.dismissError}
            className="ml-4 text-sm font-medium text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        {/* Sentence display */}
        <QuizCard
          sentence={card.sentence.sentence}
          wordBreakdown={card.sentence.wordBreakdown}
          targetWord={card.flashcard.word}
          suppressTargetTooltip={!showCardComplete}
          onSaveWord={handleSaveWord}
        />

        {/* Divider */}
        <div className="mx-4 mb-4 border-t border-zinc-700 sm:mx-8" />

        <div className="space-y-4 px-4 sm:px-8">
          {/* Translation input */}
          {(quiz.state === "AWAITING_TRANSLATION" ||
            isCheckingTranslation) && (
            <TranslationInput
              onSubmit={quiz.submitTranslation}
              isLoading={isCheckingTranslation}
              disabled={isCheckingTranslation}
            />
          )}

          {/* Translation feedback */}
          {showTranslationResult && card.translationResult && (
            <TranslationFeedback
              result={card.translationResult}
              userTranslation={card.userTranslation}
              targetWord={card.flashcard.word}
              targetMeaning={card.flashcard.englishMeaning}
              sentenceTranslation={card.sentence?.translation ?? ""}
              onContinue={quiz.advanceFromCorrect}
              onRetypeSuccess={quiz.retypeTranslation}
              readonly={!showTranslationFeedback}
            />
          )}

          {/* Reading input (hidden for phonetic languages) */}
          {!quiz.isPhonetic && showReadingInput && (
            <ReadingInput
              targetWord={card.flashcard.word}
              onSubmit={quiz.submitReading}
              isLoading={isVerifyingReading}
              disabled={isVerifyingReading}
              readingSystemName={langSettings?.language.readingSystemName ?? undefined}
              placeholder={langSettings?.language.readingPlaceholder ?? undefined}
              instructions={langSettings?.language.readingInstructions ?? undefined}
            />
          )}

          {/* Reading feedback (hidden for phonetic languages) */}
          {!quiz.isPhonetic && showReadingResult && card.readingResult && (
            <ReadingFeedback
              result={card.readingResult}
              userReading={card.userReading}
              targetWord={card.flashcard.word}
              onContinue={quiz.advanceFromCorrect}
              onRetypeSuccess={quiz.retypeReading}
              readonly={!showReadingFeedback}
              readingSystemName={langSettings?.language.readingSystemName ?? undefined}
            />
          )}

          {/* Card complete */}
          {showCardComplete && (
            <CardComplete
              scheduleResult={card.scheduleResult}
              wasCorrect={card.currentCardCorrect}
              onNextCard={quiz.advanceFromCardComplete}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats bar — shows daily progress
// ---------------------------------------------------------------------------

function QuizStatsBar({ dailyStats }: { dailyStats: DailyStats }) {
  const accuracy =
    dailyStats.reviewed > 0
      ? Math.round((dailyStats.correct / dailyStats.reviewed) * 100)
      : 0;

  return (
    <div className="flex w-full items-center justify-between border-b border-zinc-800 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-300">
          Today: {dailyStats.reviewed}
        </span>
        {dailyStats.reviewed > 0 && (
          <span className="text-xs text-zinc-400">
            {accuracy}% accuracy
          </span>
        )}
      </div>

      {dailyStats.currentStreak > 1 && (
        <div className="text-sm font-medium text-amber-400">
          Streak: {dailyStats.currentStreak}
        </div>
      )}
    </div>
  );
}
