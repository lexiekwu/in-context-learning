"use client";

import { useCallback, useRef, useState } from "react";
import type { WordBreakdownEntry } from "@/types";
import { cn } from "@/lib/cn";

interface QuizCardProps {
  sentence: string;
  wordBreakdown: WordBreakdownEntry[];
  /** Whether the target word tooltip should be suppressed (during active quiz) */
  suppressTargetTooltip?: boolean;
}

interface TooltipState {
  word: WordBreakdownEntry;
  x: number;
  y: number;
}

export function QuizCard({
  sentence,
  wordBreakdown,
  suppressTargetTooltip = true,
}: QuizCardProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(
    (entry: WordBreakdownEntry, e: React.MouseEvent) => {
      if (entry.isTarget && suppressTargetTooltip) return;
      clearHoverTimeout();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      hoverTimeout.current = setTimeout(() => {
        setTooltip({
          word: entry,
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }, 300);
    },
    [suppressTargetTooltip, clearHoverTimeout],
  );

  const handleMouseLeave = useCallback(() => {
    clearHoverTimeout();
    // Delay dismissal so user can move to tooltip
    hoverTimeout.current = setTimeout(() => {
      setTooltip(null);
    }, 200);
  }, [clearHoverTimeout]);

  // Long-press for mobile
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(
    (entry: WordBreakdownEntry, e: React.TouchEvent) => {
      if (entry.isTarget && suppressTargetTooltip) return;
      const touch = e.touches[0];
      longPressTimeout.current = setTimeout(() => {
        setTooltip({
          word: entry,
          x: touch.clientX,
          y: touch.clientY - 10,
        });
      }, 500);
    },
    [suppressTargetTooltip],
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  }, []);

  // Dismiss tooltip on outside tap
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (tooltip && !(e.target as HTMLElement).closest("[data-word-entry]")) {
        setTooltip(null);
      }
    },
    [tooltip],
  );

  // Build rendered words from the breakdown
  // If breakdown is available, render word-by-word. Otherwise, render raw sentence.
  const renderSentence = () => {
    if (!wordBreakdown.length) {
      return (
        <p className="text-xl leading-relaxed text-zinc-900 sm:text-2xl dark:text-zinc-100">
          {sentence}
        </p>
      );
    }

    return (
      <p className="text-xl leading-relaxed sm:text-2xl">
        {wordBreakdown.map((entry, i) => (
          <span
            key={`${entry.word}-${i}`}
            data-word-entry
            className={cn(
              "cursor-default transition-colors",
              entry.isTarget
                ? "rounded bg-amber-100 px-1 font-bold text-amber-900 underline decoration-amber-400 decoration-2 underline-offset-4 sm:font-semibold sm:no-underline dark:bg-amber-900/30 dark:text-amber-200"
                : "text-zinc-900 hover:text-blue-700 dark:text-zinc-100 dark:hover:text-blue-300",
              !entry.isTarget && "cursor-pointer",
            )}
            onMouseEnter={(e) => handleMouseEnter(entry, e)}
            onMouseLeave={handleMouseLeave}
            onTouchStart={(e) => handleTouchStart(entry, e)}
            onTouchEnd={handleTouchEnd}
          >
            {entry.word}
          </span>
        ))}
      </p>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full px-4 py-6 sm:px-8"
      onClick={handleContainerClick}
    >
      {/* Sentence */}
      <div className="text-left sm:text-center">{renderSentence()}</div>

      {/* Hint text */}
      <p className="mt-3 text-xs text-zinc-400 sm:text-center dark:text-zinc-500">
        {typeof window !== "undefined" && "ontouchstart" in window
          ? "Tap and hold any word for pinyin + meaning"
          : "Hover over any word for pinyin + meaning"}
      </p>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            maxWidth: "80vw",
          }}
          onMouseEnter={clearHoverTimeout}
          onMouseLeave={handleMouseLeave}
        >
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {tooltip.word.word}
          </p>
          <p className="font-mono text-sm text-blue-600 dark:text-blue-400">
            {tooltip.word.pinyin}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {tooltip.word.meaning}
          </p>
        </div>
      )}
    </div>
  );
}
