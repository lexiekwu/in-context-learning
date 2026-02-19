"use client";

import { useCallback, useRef, useState } from "react";
import type { WordBreakdownEntry } from "@/types";
import { cn } from "@/lib/cn";

interface QuizCardProps {
  sentence: string;
  wordBreakdown: WordBreakdownEntry[];
  targetWord?: string;
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
  targetWord,
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
    hoverTimeout.current = setTimeout(() => {
      setTooltip(null);
    }, 200);
  }, [clearHoverTimeout]);

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

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (tooltip && !(e.target as HTMLElement).closest("[data-word-entry]")) {
        setTooltip(null);
      }
    },
    [tooltip],
  );

  const renderSentence = () => {
    if (!wordBreakdown.length) {
      return (
        <p className="text-xl leading-relaxed text-zinc-100 sm:text-2xl">
          {sentence}
        </p>
      );
    }

    return (
      <p className="text-xl leading-relaxed sm:text-2xl">
        {wordBreakdown.map((entry, i) => {
          const isTarget = entry.isTarget || (targetWord != null && entry.word === targetWord);
          return (
          <span
            key={`${entry.word}-${i}`}
            data-word-entry
            className={cn(
              "cursor-default transition-colors",
              isTarget
                ? "font-bold text-zinc-50 underline decoration-amber-400 decoration-2 underline-offset-4"
                : "text-zinc-100 hover:text-indigo-300",
              !isTarget && "cursor-pointer",
            )}
            onMouseEnter={(e) => handleMouseEnter({ ...entry, isTarget }, e)}
            onMouseLeave={handleMouseLeave}
            onTouchStart={(e) => handleTouchStart({ ...entry, isTarget }, e)}
            onTouchEnd={handleTouchEnd}
          >
            {entry.word}
          </span>
          );
        })}
      </p>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full px-4 py-6 sm:px-8"
      onClick={handleContainerClick}
    >
      <div className="text-left sm:text-center">{renderSentence()}</div>

      <p className="mt-3 text-xs text-zinc-500 sm:text-center">
        {typeof window !== "undefined" && "ontouchstart" in window
          ? "Tap and hold any word for pinyin + meaning"
          : "Hover over any word for pinyin + meaning"}
      </p>

      {tooltip && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            maxWidth: "80vw",
          }}
          onMouseEnter={clearHoverTimeout}
          onMouseLeave={handleMouseLeave}
        >
          <p className="text-lg font-semibold text-zinc-100">
            {tooltip.word.word}
          </p>
          <p className="font-mono text-sm text-indigo-400">
            {tooltip.word.pinyin}
          </p>
          <p className="text-sm text-zinc-400">
            {tooltip.word.meaning}
          </p>
        </div>
      )}
    </div>
  );
}
