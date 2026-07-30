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
import EditCardDialog from "@/components/quiz/EditCardDialog";
import * as api from "@/lib/api";
import type { WordBreakdownEntry } from "@/types";
import type { DailyStats } from "@/hooks/useQuizStateMachine";

export default function QuizPage() {
  const [langSettings, setLangSettings] = useState<api.UserLanguageSettings | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    api.getUserLanguageSettings().then(setLangSettings).catch(() => {});
  }, []);

  const isPhonetic = langSettings?.language.isPhonetic ?? false;

  const quiz = useQuizStateMachine({ isPhonetic });

  const {
    state: quizState,
    advanceFromCorrect,
    advanceFromCardComplete,
    updateCurrentCard,
    deleteCurrentCard,
  } = quiz;
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
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          {quiz.error ? (
            <div className="w-full max-w-md text-center">
              <div className="rounded-xl border border-red-800 bg-red-900/20 p-6">
                <p className="text-base text-red-200 mb-4">
                  {quiz.error}
                </p>
                <button
                  onClick={() => quiz.loadNextCard()}
                  className="inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-500 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <LoadingSkeleton
              message="Generating sentence..."
              showSlowWarning
            />
          )}
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
        {/* Actions bar (Edit/Delete) */}
        <div className="mb-2 flex items-center justify-end gap-2 px-4 sm:px-8">
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            title="Edit card"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Are you sure you want to delete this card?")) {
                deleteCurrentCard();
              }
            }}
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400"
            title="Delete card"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>

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

      {/* Edit Dialog */}
      {card && (
        <EditCardDialog
          open={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          card={{
            id: card.flashcard.id,
            word: card.flashcard.word,
            reading: card.flashcard.pinyin,
            englishMeaning: card.flashcard.englishMeaning,
          }}
          onUpdated={(updated) => {
            updateCurrentCard({
              word: updated.word,
              pinyin: updated.pinyin,
              englishMeaning: updated.englishMeaning,
            });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats bar — shows daily progress
// ---------------------------------------------------------------------------

function QuizStatsBar({ dailyStats }: { dailyStats: DailyStats }) {
  const accuracy =
    dailyStats.maxPossible > 0
      ? Math.round((dailyStats.correct / dailyStats.maxPossible) * 100)
      : dailyStats.reviewed > 0
        ? Math.round((dailyStats.correct / (dailyStats.reviewed * 4)) * 100)
        : 0;

  return (
    <div className="flex w-full items-center justify-between border-b border-zinc-800 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-300">
          Today: {dailyStats.correct} pts
        </span>
        {dailyStats.reviewed > 0 && (
          <span className="text-xs text-zinc-400">
            ({dailyStats.reviewed} reviewed, {accuracy}% accuracy)
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
