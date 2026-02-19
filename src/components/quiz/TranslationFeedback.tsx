"use client";

import { useCallback, useRef, useState } from "react";
import type { CheckTranslationResponse } from "@/types";
import { cn } from "@/lib/cn";

interface TranslationFeedbackProps {
  result: CheckTranslationResponse;
  userTranslation: string;
  targetWord: string;
  targetMeaning: string;
  onContinue: () => void;
  onRetypeSuccess: (input: string) => boolean;
}

export function TranslationFeedback({
  result,
  userTranslation,
  targetWord,
  targetMeaning,
  onContinue,
  onRetypeSuccess,
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
        className="w-full cursor-pointer rounded-lg border border-green-800 bg-green-900/20 p-4 transition-colors hover:bg-green-900/30"
        onClick={onContinue}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onContinue()}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg text-green-400">&#10003;</span>
          <p className="font-medium text-green-300">Correct</p>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          <span className="font-semibold text-zinc-300">{targetWord}</span> &mdash; {targetMeaning}
        </p>
        <p className="mt-2 text-xs text-green-500">
          Tap to continue
        </p>
      </div>
    );
  }

  // Incorrect
  return (
    <div className="w-full space-y-4">
      {/* User's incorrect answer */}
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
        <div className="flex items-center gap-3">
          <span className="text-lg text-red-400">&#10007;</span>
          <p className="font-medium text-red-300">Incorrect</p>
        </div>
      </div>

      {/* Target word meaning */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <p className="text-sm text-zinc-400">
          <span className="font-semibold">{targetWord}</span> means &ldquo;{targetMeaning}&rdquo;
        </p>
      </div>

      {/* Retype prompt */}
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
    </div>
  );
}
