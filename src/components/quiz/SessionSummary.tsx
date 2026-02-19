"use client";

import type { SessionStats } from "@/hooks/useQuizStateMachine";
import { cn } from "@/lib/cn";

interface SessionSummaryProps {
  stats: SessionStats;
  sessionStartTime: number | null;
  onReviewAgain: () => void;
}

function formatDuration(startMs: number | null): string {
  if (!startMs) return "--";
  const diffMs = Date.now() - startMs;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "< 1 min";
  return `${minutes} min`;
}

export function SessionSummary({
  stats,
  sessionStartTime,
  onReviewAgain,
}: SessionSummaryProps) {
  const accuracy =
    stats.cardsReviewed > 0
      ? Math.round((stats.cardsCorrect / stats.cardsReviewed) * 100)
      : 0;

  return (
    <div className="flex w-full flex-col items-center px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {/* Title */}
        <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          All caught up!
        </h2>
        <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No more cards due for review
        </p>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-zinc-50 p-4 text-center dark:bg-zinc-800">
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.cardsReviewed}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Reviewed
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-4 text-center dark:bg-zinc-800">
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.cardsCorrect}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Correct
            </p>
          </div>
        </div>

        {/* Accuracy bar */}
        <div className="mt-6">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Accuracy</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {accuracy}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                accuracy >= 80
                  ? "bg-green-500"
                  : accuracy >= 60
                    ? "bg-amber-500"
                    : "bg-red-500",
              )}
              style={{ width: `${accuracy}%` }}
            />
          </div>
        </div>

        {/* Additional stats */}
        <div className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <div className="flex justify-between">
            <span>Duration</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {formatDuration(sessionStartTime)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Longest streak</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {stats.longestStreak}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onReviewAgain}
            className={cn(
              "min-h-11 flex-1 rounded-lg px-6 py-3 text-base font-medium text-white transition-colors",
              "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
              "dark:bg-blue-500 dark:hover:bg-blue-600",
            )}
          >
            Review Again
          </button>
          <a
            href="/"
            className={cn(
              "min-h-11 flex flex-1 items-center justify-center rounded-lg border border-zinc-300 px-6 py-3 text-base font-medium text-zinc-700 transition-colors",
              "hover:bg-zinc-50 active:bg-zinc-100",
              "dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
