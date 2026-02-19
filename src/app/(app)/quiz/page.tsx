"use client";

import { useQuizStateMachine } from "@/hooks/useQuizStateMachine";
import { QuizCard } from "@/components/quiz/QuizCard";
import { TranslationInput } from "@/components/quiz/TranslationInput";
import { TranslationFeedback } from "@/components/quiz/TranslationFeedback";
import { PinyinInput } from "@/components/quiz/PinyinInput";
import { PinyinFeedback } from "@/components/quiz/PinyinFeedback";
import { CardComplete } from "@/components/quiz/CardComplete";
import { SessionSummary } from "@/components/quiz/SessionSummary";
import { LoadingSkeleton } from "@/components/quiz/LoadingSkeleton";

export default function QuizPage() {
  const quiz = useQuizStateMachine();

  // -------------------------------------------------------------------
  // SESSION_START — landing screen with "Start Quiz" button
  // -------------------------------------------------------------------
  if (quiz.state === "SESSION_START" && !quiz.sessionId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-zinc-100">
            Mandarin Quiz
          </h1>
          <p className="mt-2 text-zinc-400">
            Review your flashcards with in-context sentences
          </p>
          <button
            type="button"
            onClick={quiz.startSession}
            className="mt-8 min-h-11 w-full rounded-lg bg-indigo-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
          >
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // SESSION_SUMMARY — all cards reviewed
  // -------------------------------------------------------------------
  if (quiz.state === "SESSION_SUMMARY") {
    return (
      <div className="flex flex-1 flex-col">
        {/* Stats bar */}
        <QuizStatsBar stats={quiz.stats} sessionStartTime={quiz.sessionStartTime} />
        <div className="flex flex-1 items-center justify-center">
          <SessionSummary
            stats={quiz.stats}
            sessionStartTime={quiz.sessionStartTime}
            onReviewAgain={quiz.startSession}
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // CARD_START / loading states
  // -------------------------------------------------------------------
  if (
    quiz.state === "SESSION_START" ||
    quiz.state === "CARD_START"
  ) {
    return (
      <div className="flex flex-1 flex-col">
        <QuizStatsBar stats={quiz.stats} sessionStartTime={quiz.sessionStartTime} />
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
        <QuizStatsBar stats={quiz.stats} sessionStartTime={quiz.sessionStartTime} />
        <div className="flex flex-1 items-center justify-center px-4">
          <LoadingSkeleton message="Loading..." />
        </div>
      </div>
    );
  }

  const isCheckingTranslation = quiz.state === "CHECKING_TRANSLATION";
  const isVerifyingPinyin = quiz.state === "VERIFY_PINYIN";
  const showTranslationFeedback =
    quiz.state === "TRANSLATION_CORRECT" ||
    quiz.state === "TRANSLATION_INCORRECT" ||
    quiz.state === "RETYPING_TRANSLATION";
  const showPinyinInput =
    quiz.state === "PINYIN_INPUT" ||
    quiz.state === "VERIFY_PINYIN";
  const showPinyinFeedback =
    quiz.state === "PINYIN_CORRECT" ||
    quiz.state === "PINYIN_INCORRECT" ||
    quiz.state === "RETYPING_PINYIN";
  const showCardComplete =
    quiz.state === "CARD_RESULT" || quiz.state === "CARD_COMPLETE";

  // Keep showing result cards even after moving to later phases
  const showTranslationResult =
    showTranslationFeedback ||
    showPinyinInput ||
    showPinyinFeedback ||
    showCardComplete;
  const showPinyinResult =
    showPinyinFeedback || showCardComplete;

  return (
    <div className="flex flex-1 flex-col">
      <QuizStatsBar stats={quiz.stats} sessionStartTime={quiz.sessionStartTime} />

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
        {/* Chinese sentence display — always visible during quiz */}
        <QuizCard
          sentence={card.sentence.sentence}
          wordBreakdown={card.sentence.wordBreakdown}
          targetWord={card.flashcard.word}
          suppressTargetTooltip={!showCardComplete}
        />

        {/* Divider */}
        <div className="mx-4 mb-4 border-t border-zinc-700 sm:mx-8" />

        {/* --- Translation phase --- */}
        <div className="space-y-4 px-4 sm:px-8">
          {/* Translation input — AWAITING_TRANSLATION */}
          {(quiz.state === "AWAITING_TRANSLATION" ||
            isCheckingTranslation) && (
            <TranslationInput
              onSubmit={quiz.submitTranslation}
              isLoading={isCheckingTranslation}
              disabled={isCheckingTranslation}
            />
          )}

          {/* Translation feedback — persists through pinyin + card complete phases */}
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

          {/* --- Pinyin phase --- */}
          {showPinyinInput && (
            <PinyinInput
              targetWord={card.flashcard.word}
              onSubmit={quiz.submitPinyin}
              isLoading={isVerifyingPinyin}
              disabled={isVerifyingPinyin}
            />
          )}

          {showPinyinResult && card.pinyinResult && (
            <PinyinFeedback
              result={card.pinyinResult}
              userPinyin={card.userPinyin}
              targetWord={card.flashcard.word}
              onContinue={quiz.advanceFromCorrect}
              onRetypeSuccess={quiz.retypePinyin}
              readonly={!showPinyinFeedback}
            />
          )}

          {/* --- Card complete --- */}
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
// Inline stats bar (replaces the removed QuizHeader — slimmer, no nav)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import type { SessionStats } from "@/hooks/useQuizStateMachine";

function QuizStatsBar({
  stats,
  sessionStartTime,
}: {
  stats: SessionStats;
  sessionStartTime: number | null;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - sessionStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  const accuracy =
    stats.cardsReviewed > 0
      ? Math.round((stats.cardsCorrect / stats.cardsReviewed) * 100)
      : 0;

  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="flex w-full items-center justify-between border-b border-zinc-800 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-300">
          Cards: {stats.cardsReviewed}
        </span>
        {stats.cardsReviewed > 0 && (
          <span className="text-xs text-zinc-400">
            {accuracy}% accuracy
          </span>
        )}
      </div>

      {stats.currentStreak > 1 && (
        <div className="text-sm font-medium text-amber-400">
          Streak: {stats.currentStreak}
        </div>
      )}

      <div className="font-mono text-sm text-zinc-400">
        {sessionStartTime ? timeStr : "--:--"}
      </div>
    </div>
  );
}
