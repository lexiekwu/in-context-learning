"use client";

import { useQuizStateMachine } from "@/hooks/useQuizStateMachine";
import { QuizHeader } from "@/components/quiz/QuizHeader";
import { QuizCard } from "@/components/quiz/QuizCard";
import { TranslationInput } from "@/components/quiz/TranslationInput";
import { TranslationFeedback } from "@/components/quiz/TranslationFeedback";
import { PinyinInput } from "@/components/quiz/PinyinInput";
import { PinyinFeedback } from "@/components/quiz/PinyinFeedback";
import { CardComplete } from "@/components/quiz/CardComplete";
import { SessionSummary } from "@/components/quiz/SessionSummary";
import { LoadingSkeleton } from "@/components/quiz/LoadingSkeleton";
import { cn } from "@/lib/cn";

export default function QuizPage() {
  const quiz = useQuizStateMachine();

  // -------------------------------------------------------------------
  // SESSION_START — landing screen with "Start Quiz" button
  // -------------------------------------------------------------------
  if (quiz.state === "SESSION_START" && !quiz.sessionId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Mandarin Quiz
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Review your flashcards with in-context sentences
          </p>
          <button
            type="button"
            onClick={quiz.startSession}
            className={cn(
              "mt-8 min-h-11 w-full rounded-lg px-8 py-4 text-lg font-semibold text-white transition-colors",
              "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
              "dark:bg-blue-500 dark:hover:bg-blue-600",
            )}
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
      <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
        <QuizHeader
          stats={quiz.stats}
          sessionStartTime={quiz.sessionStartTime}
        />
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
      <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
        <QuizHeader
          stats={quiz.stats}
          sessionStartTime={quiz.sessionStartTime}
        />
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
      <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
        <QuizHeader
          stats={quiz.stats}
          sessionStartTime={quiz.sessionStartTime}
        />
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

  // Determine which phase we're in for the translation status indicator
  const translationDone =
    showPinyinInput ||
    showPinyinFeedback ||
    showCardComplete ||
    quiz.state === "CARD_RESULT";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <QuizHeader
        stats={quiz.stats}
        sessionStartTime={quiz.sessionStartTime}
      />

      {/* Error toast */}
      {quiz.error && (
        <div className="mx-4 mt-2 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">
            {quiz.error}
          </p>
          <button
            type="button"
            onClick={quiz.dismissError}
            className="ml-4 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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
          suppressTargetTooltip={!showCardComplete}
        />

        {/* Target word indicator */}
        <div className="mb-4 px-4 sm:px-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Target word:{" "}
            <span className="font-bold text-amber-700 dark:text-amber-300">
              {card.flashcard.word}
            </span>
          </p>
        </div>

        {/* Divider */}
        <div className="mx-4 mb-4 border-t border-zinc-200 sm:mx-8 dark:border-zinc-700" />

        {/* --- Translation phase --- */}
        <div className="space-y-4 px-4 sm:px-8">
          {/* Translation status when we've moved past it */}
          {translationDone && card.translationResult && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg p-3 text-sm",
                card.translationResult.correct
                  ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
              )}
            >
              <span>
                {card.translationResult.correct ? "\u2713" : "\u2717"}
              </span>
              <span>
                Translation:{" "}
                {card.translationResult.correct ? "Correct" : "Incorrect"}
              </span>
            </div>
          )}

          {/* Translation input — AWAITING_TRANSLATION */}
          {(quiz.state === "AWAITING_TRANSLATION" ||
            isCheckingTranslation) && (
            <TranslationInput
              onSubmit={quiz.submitTranslation}
              isLoading={isCheckingTranslation}
              disabled={isCheckingTranslation}
            />
          )}

          {/* Translation feedback */}
          {showTranslationFeedback && card.translationResult && (
            <TranslationFeedback
              result={card.translationResult}
              userTranslation={card.userTranslation}
              targetWord={card.flashcard.word}
              targetMeaning={card.flashcard.englishMeaning}
              onContinue={quiz.advanceFromCorrect}
              onRetypeSuccess={quiz.retypeTranslation}
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

          {showPinyinFeedback && card.pinyinResult && (
            <PinyinFeedback
              result={card.pinyinResult}
              userPinyin={card.userPinyin}
              targetWord={card.flashcard.word}
              onContinue={quiz.advanceFromCorrect}
              onRetypeSuccess={quiz.retypePinyin}
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
