"use client";

import { useCallback, useRef, useState } from "react";
import type { CheckTranslationResponse } from "@/types";
import { cn } from "@/lib/cn";

interface TranslationFeedbackProps {
  result: CheckTranslationResponse;
  userTranslation: string;
  targetWord: string;
  targetMeaning: string;
  /** Called when the correct state auto-advances or user clicks */
  onContinue: () => void;
  /** Called when the user successfully retypes the correct meaning */
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
        className="w-full cursor-pointer rounded-lg border border-green-200 bg-green-50 p-4 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:hover:bg-green-900/30"
        onClick={onContinue}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onContinue()}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg text-green-600 dark:text-green-400">
            &#10003;
          </span>
          <div>
            <p className="font-medium text-green-800 dark:text-green-300">
              {userTranslation}
            </p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              {result.explanation}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-green-600 dark:text-green-500">
          Tap to continue
        </p>
      </div>
    );
  }

  // Incorrect
  return (
    <div className="w-full space-y-4">
      {/* User's incorrect answer */}
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg text-red-600 dark:text-red-400">
            &#10007;
          </span>
          <div>
            <p className="font-medium text-red-800 dark:text-red-300">
              {userTranslation}
            </p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              {result.explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Correct answer */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Correct translation:
        </p>
        <p className="mt-1 text-base text-zinc-900 dark:text-zinc-100">
          {result.suggestedTranslation}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold">{targetWord}</span> means &ldquo;
          {targetMeaning}&rdquo;
        </p>
      </div>

      {/* Retype prompt */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
            "w-full rounded-lg border border-zinc-300 px-4 py-3 text-base text-zinc-900 outline-none transition-colors",
            "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
            "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400",
          )}
        />
        {retypeHint && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
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
            "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
            "disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500",
            "dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400",
          )}
        >
          Confirm &amp; Continue
        </button>
      </div>
    </div>
  );
}
