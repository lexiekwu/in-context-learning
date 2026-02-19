"use client";

import type { FlashcardScheduleResponse } from "@/types";
import { cn } from "@/lib/cn";

interface CardCompleteProps {
  scheduleResult: FlashcardScheduleResponse | null;
  wasCorrect: boolean;
  onNextCard: () => void;
}

function formatNextDue(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMs / 3_600_000);
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Now";
  if (diffMinutes < 60) return `${diffMinutes} min`;
  if (diffHours < 24) return `${diffHours} hr`;
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 30) return `${diffDays} days`;
  return date.toLocaleDateString();
}

export function CardComplete({
  scheduleResult,
  wasCorrect,
  onNextCard,
}: CardCompleteProps) {
  return (
    <div className="w-full space-y-4">
      {/* Result badge */}
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg p-3 text-sm font-medium",
          wasCorrect
            ? "bg-green-900/20 text-green-300"
            : "bg-amber-900/20 text-amber-300",
        )}
      >
        {wasCorrect ? (
          <>
            <span>&#10003;</span> Card marked as <strong>Good</strong>
          </>
        ) : (
          <>
            <span>&#8635;</span> Card marked as <strong>Again</strong> &mdash;
            you&apos;ll see it sooner
          </>
        )}
      </div>

      {/* Schedule info */}
      {scheduleResult && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-around">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-zinc-400">
              Next Review
            </p>
            <p className="text-lg font-semibold text-zinc-100">
              {formatNextDue(scheduleResult.nextDue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-zinc-400">
              State
            </p>
            <p className="text-lg font-semibold text-zinc-100">
              {scheduleResult.state}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-zinc-400">
              Reps
            </p>
            <p className="text-lg font-semibold text-zinc-100">
              {scheduleResult.reps}
            </p>
          </div>
        </div>
      )}

      {/* Next card button */}
      <button
        type="button"
        onClick={onNextCard}
        className="min-h-11 w-full rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
      >
        Next Card &rarr;
      </button>

      <p className="text-center text-xs text-zinc-500">
        Auto-advancing in 2 seconds...
      </p>
    </div>
  );
}
