"use client";

import { useEffect, useState } from "react";
import type { SessionStats } from "@/hooks/useQuizStateMachine";

interface QuizHeaderProps {
  stats: SessionStats;
  sessionStartTime: number | null;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function QuizHeader({ stats, sessionStartTime }: QuizHeaderProps) {
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

  return (
    <header className="flex w-full items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
      {/* Left: card count */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cards: {stats.cardsReviewed}
        </span>
        {stats.cardsReviewed > 0 && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {accuracy}% accuracy
          </span>
        )}
      </div>

      {/* Center: streak */}
      {stats.currentStreak > 1 && (
        <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Streak: {stats.currentStreak}
        </div>
      )}

      {/* Right: timer */}
      <div className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
        {sessionStartTime ? formatTime(elapsed) : "--:--"}
      </div>
    </header>
  );
}
