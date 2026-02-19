"use client";

import { useCallback, useState } from "react";
import type { CheckPinyinResponse } from "@/types";
import { cn } from "@/lib/cn";

interface PinyinFeedbackProps {
  result: CheckPinyinResponse;
  userPinyin: string;
  targetWord: string;
  onContinue: () => void;
  onRetypeSuccess: (input: string) => boolean;
  /** When true, show only the result card without interactive elements */
  readonly?: boolean;
}

export function PinyinFeedback({
  result,
  userPinyin,
  targetWord,
  onContinue,
  onRetypeSuccess,
  readonly: isReadonly = false,
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
        className="w-full rounded-lg border border-green-800 bg-green-900/20 p-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg text-green-400">&#10003;</span>
          <div>
            <p className="font-medium text-green-300">Pinyin correct</p>
            <p className="font-mono text-sm text-green-400">
              {userPinyin}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Incorrect
  return (
    <div className="w-full space-y-4">
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-lg text-red-400">&#10007;</span>
          <p className="font-medium text-red-300">Pinyin incorrect</p>
        </div>
        <p className="text-sm text-zinc-400">
          Correct pinyin for {targetWord}:
          <span className="ml-2 font-mono text-base text-zinc-100">
            {result.expectedPinyin}
          </span>
        </p>
      </div>

      {/* Retype prompt — only in active feedback phase */}
      {!isReadonly && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
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
              "w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-3 font-mono text-base text-zinc-100 outline-none transition-colors",
              "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
            )}
          />
          {retypeHint && (
            <p className="text-sm text-amber-400">
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
