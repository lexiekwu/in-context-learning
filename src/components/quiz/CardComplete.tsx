"use client";

import { useEffect, useRef } from "react";
import type { FlashcardScheduleResponse } from "@/types";

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
  // Guard: ignore Enter events briefly after mount to prevent the Enter key
  // from the previous input (retype pinyin/translation) from immediately advancing.
  const readyRef = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => { readyRef.current = true; }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && readyRef.current) {
        e.preventDefault();
        onNextCard();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNextCard]);

  return (
    <div className="w-full space-y-4">
      {/* Result badge — matches TranslationFeedback/PinyinFeedback styling */}
      <div
        className={
          wasCorrect
            ? "flex items-center gap-3 rounded-lg border border-green-800 bg-green-900/20 p-4"
            : "flex items-center gap-3 rounded-lg border border-red-800 bg-red-900/20 p-4"
        }
      >
        <span className={`text-lg ${wasCorrect ? "text-green-400" : "text-red-400"}`}>
          {wasCorrect ? "\u2713" : "\u2717"}
        </span>
        <p className={`font-medium ${wasCorrect ? "text-green-300" : "text-red-300"}`}>
          {wasCorrect ? "Card marked Good" : "Card marked Again"}
        </p>
      </div>

      {/* Schedule info (skeleton while loading, real data when available) */}
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-4 sm:flex-row sm:items-center sm:gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            Next Review
          </p>
          {scheduleResult ? (
            <p className="text-lg font-semibold text-zinc-100">
              {formatNextDue(scheduleResult.nextDue)}
            </p>
          ) : (
            <div className="mt-1 h-6 w-20 animate-pulse rounded bg-zinc-700" />
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            State
          </p>
          {scheduleResult ? (
            <p className="text-lg font-semibold text-zinc-100">
              {scheduleResult.state}
            </p>
          ) : (
            <div className="mt-1 h-6 w-16 animate-pulse rounded bg-zinc-700" />
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            Reps
          </p>
          {scheduleResult ? (
            <p className="text-lg font-semibold text-zinc-100">
              {scheduleResult.reps}
            </p>
          ) : (
            <div className="mt-1 h-6 w-10 animate-pulse rounded bg-zinc-700" />
          )}
        </div>
      </div>

      {/* Next card button */}
      <button
        type="button"
        onClick={onNextCard}
        className="min-h-11 w-full rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
      >
        Next Card &rarr;
      </button>

      <p className="text-xs text-zinc-500">
        Press Enter for next card
      </p>
    </div>
  );
}
