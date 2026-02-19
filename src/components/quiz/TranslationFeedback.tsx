"use client";

import { useCallback, useRef, useState } from "react";
import type { CheckTranslationResponse } from "@/types";
import { cn } from "@/lib/cn";

interface TranslationFeedbackProps {
  result: CheckTranslationResponse;
  userTranslation: string;
  targetWord: string;
  targetMeaning: string;
  sentenceTranslation: string;
  onContinue: () => void;
  onRetypeSuccess: (input: string) => boolean;
  /** When true, show only the result card without interactive elements */
  readonly?: boolean;
}

export function TranslationFeedback({
  result,
  userTranslation,
  targetWord,
  targetMeaning,
  sentenceTranslation,
  onContinue,
  onRetypeSuccess,
  readonly: isReadonly = false,
}: TranslationFeedbackProps) {
  const [retypeValue, setRetypeValue] = useState("");
  const [retypeHint, setRetypeHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRetypeSubmit = useCallback(() => {
    const success = onRetypeSuccess(retypeValue);
    if (!success) {
      setRetypeHint(true);
      setTimeout(() => setRetypeHint(false), 3000);
    }
  }, [retypeValue, onRetypeSuccess]);

  if (result.correct) {
    return (
      <div
        className={cn(
          "w-full rounded-lg border border-green-800 bg-green-900/20 p-4",
          !isReadonly && "cursor-pointer transition-colors hover:bg-green-900/30",
        )}
        onClick={!isReadonly ? onContinue : undefined}
        role={!isReadonly ? "button" : undefined}
        tabIndex={!isReadonly ? 0 : undefined}
        onKeyDown={!isReadonly ? (e) => e.key === "Enter" && onContinue() : undefined}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg text-green-400">&#10003;</span>
          <p className="font-medium text-green-300">Correct</p>
        </div>
        <div className="mt-2 space-y-1 text-sm">
          <p className="text-zinc-300">{sentenceTranslation}</p>
          <p className="text-zinc-400">
            <span className="font-semibold text-zinc-300">{targetWord}</span> &mdash; {targetMeaning}
          </p>
        </div>
      </div>
    );
  }

  // Incorrect
  return (
    <div className="w-full space-y-4">
      {/* Incorrect banner + info */}
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-lg text-red-400">&#10007;</span>
          <p className="font-medium text-red-300">Incorrect</p>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-zinc-300">{sentenceTranslation}</p>
          <p className="text-zinc-400">
            <span className="font-semibold text-zinc-300">{targetWord}</span> &mdash; {targetMeaning}
          </p>
        </div>
      </div>

      {/* Retype prompt — only in active feedback phase */}
      {!isReadonly && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Type the correct meaning of {targetWord}:
          </label>
          <input
            ref={inputRef}
            type="text"
            value={retypeValue}
            onChange={(e) => setRetypeValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRetypeSubmit()}
            autoFocus
            inputMode="text"
            lang="en"
            autoCorrect="off"
            spellCheck={false}
            className={cn(
              "w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none transition-colors",
              "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
            )}
          />
          {retypeHint && (
            <p className="text-sm text-amber-400">
              Try again &mdash; type: {targetMeaning}
            </p>
          )}
          <button
            type="button"
            onClick={handleRetypeSubmit}
            disabled={!retypeValue.trim()}
            className={cn(
              "min-h-11 w-full rounded-lg px-6 py-3 text-base font-medium text-white transition-colors",
              "sm:w-auto",
              "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700",
              "disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400",
            )}
          >
            Confirm &amp; Continue
          </button>
        </div>
      )}
    </div>
  );
}
