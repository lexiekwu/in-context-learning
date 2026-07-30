"use client";

import type { DailyStats } from "@/hooks/useQuizStateMachine";
import { cn } from "@/lib/cn";

interface SessionSummaryProps {
  dailyStats: DailyStats;
}

export function SessionSummary({ dailyStats }: SessionSummaryProps) {
  const accuracy =
    dailyStats.maxPossible > 0
      ? Math.round((dailyStats.correct / dailyStats.maxPossible) * 100)
      : dailyStats.reviewed > 0
        ? Math.round((dailyStats.correct / (dailyStats.reviewed * 4)) * 100)
        : 0;

  return (
    <div className="flex w-full flex-col items-center px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-sm">
        {/* Title */}
        <h2 className="text-center text-2xl font-bold text-zinc-100">
          All caught up!
        </h2>
        <p className="mt-1 text-center text-sm text-zinc-400">
          No more cards due for review
        </p>

        {/* Stats grid */}
        {dailyStats.reviewed > 0 && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-zinc-800 p-4 text-center">
                <p className="text-3xl font-bold text-zinc-100">
                  {dailyStats.reviewed}
                </p>
                <p className="text-sm text-zinc-400">
                  Reviewed today
                </p>
              </div>
              <div className="rounded-lg bg-zinc-800 p-4 text-center">
                <p className="text-3xl font-bold text-zinc-100">
                  {dailyStats.correct}
                </p>
                <p className="text-sm text-zinc-400">
                  Points Scored
                </p>
              </div>
            </div>

            {/* Accuracy bar */}
            <div className="mt-6">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-zinc-400">Accuracy</span>
                <span className="font-medium text-zinc-100">
                  {accuracy}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-700">
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

            {/* Streak */}
            {dailyStats.longestStreak > 1 && (
              <div className="mt-4 flex justify-between text-sm text-zinc-400">
                <span>Longest streak</span>
                <span className="font-medium text-zinc-100">
                  {dailyStats.longestStreak}
                </span>
              </div>
            )}
          </>
        )}

        {/* Action */}
        <div className="mt-6">
          <a
            href="/dashboard"
            className="flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
