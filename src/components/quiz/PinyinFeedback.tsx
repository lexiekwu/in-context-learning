"use client";

import { useCallback, useState } from "react";
import type { CheckPinyinResponse } from "@/types";
import { cn } from "@/lib/cn";

interface PinyinFeedbackProps {
  result: CheckPinyinResponse;
  userPinyin: string;
  targetWord: string;
  /** Called when user taps/clicks the correct state (auto-advance) */
  onContinue: () => void;
  /** Called when user retypes pinyin; returns true if matched */
  onRetypeSuccess: (input: string) => boolean;
}

export function PinyinFeedback({
  result,
  userPinyin,
  targetWord,
  onContinue,
  onRetypeSuccess,
}: PinyinFeedbackProps) {
  const [retypeValue, setRetypeValue] = useState("");
  const [retypeHint, setRetypeHint] = useState(false);

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
        <div className="flex items-center gap-3">
          <span className="text-lg text-green-600 dark:text-green-400">
            &#10003;
          </span>
          <div>
            <p className="font-mono font-medium text-green-800 dark:text-green-300">
              {userPinyin}
            </p>
            <p className="text-sm text-green-700 dark:text-green-400">
              Correct!
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
        <div className="flex items-center gap-3">
          <span className="text-lg text-red-600 dark:text-red-400">
            &#10007;
          </span>
          <div>
            <p className="font-mono font-medium text-red-800 dark:text-red-300">
              {userPinyin}
            </p>
            <p className="text-sm text-red-700 dark:text-red-400">
              Not quite.
            </p>
          </div>
        </div>
      </div>

      {/* Correct pinyin */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Correct pinyin for {targetWord}:
        </p>
        <p className="mt-1 font-mono text-lg text-zinc-900 dark:text-zinc-100">
          {result.expectedPinyin}
        </p>
      </div>

      {/* Retype prompt */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Retype the correct pinyin:
        </label>
        <input
          type="text"
          value={retypeValue}
          onChange={(e) => setRetypeValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRetypeSubmit()}
          autoFocus
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            "w-full rounded-lg border border-zinc-300 px-4 py-3 font-mono text-base text-zinc-900 outline-none transition-colors",
            "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
            "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400",
          )}
        />
        {retypeHint && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Try again &mdash; type: {result.expectedPinyin}
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
