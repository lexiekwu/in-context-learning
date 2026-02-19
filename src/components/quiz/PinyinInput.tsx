"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";

interface PinyinInputProps {
  targetWord: string;
  onSubmit: (pinyin: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PinyinInput({
  targetWord,
  onSubmit,
  isLoading = false,
  disabled = false,
}: PinyinInputProps) {
  const [value, setValue] = useState("");
  const [flashRed, setFlashRed] = useState(false);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setFlashRed(true);
      setTimeout(() => setFlashRed(false), 600);
      return;
    }
    onSubmit(trimmed);
  }, [value, onSubmit]);

  // Enter submits for pinyin (per spec)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="w-full space-y-3">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Type the pinyin for{" "}
        <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
          {targetWord}
        </span>
        :
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. xue2xi2"
        disabled={disabled || isLoading}
        autoFocus
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          "w-full rounded-lg border px-4 py-3 font-mono text-base text-zinc-900 outline-none transition-colors",
          "placeholder:text-zinc-400",
          "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
          "dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400",
          flashRed
            ? "border-red-400 ring-2 ring-red-400/20"
            : "border-zinc-300 dark:border-zinc-600",
          (disabled || isLoading) && "cursor-not-allowed opacity-60",
        )}
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Format: use numbered tones (e.g. xue2xi2, not xue&#769;xi&#769;)
      </p>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || isLoading || !value.trim()}
        className={cn(
          "min-h-11 w-full rounded-lg px-6 py-3 text-base font-medium text-white transition-colors",
          "sm:w-auto",
          "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
          "disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500",
          "dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400",
        )}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Checking...
          </span>
        ) : (
          "Submit Pinyin"
        )}
      </button>
    </div>
  );
}
