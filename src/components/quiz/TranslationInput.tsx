"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface TranslationInputProps {
  onSubmit: (translation: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function TranslationInput({
  onSubmit,
  isLoading = false,
  disabled = false,
}: TranslationInputProps) {
  const [value, setValue] = useState("");
  const [flashRed, setFlashRed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setFlashRed(true);
      setTimeout(() => setFlashRed(false), 600);
      return;
    }
    onSubmit(trimmed);
  }, [value, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Do not auto-submit on Enter for translation (spec: user may want to review)
      // But allow Shift+Enter for newline, and Enter to submit
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="w-full space-y-3">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your English translation here..."
        disabled={disabled || isLoading}
        autoFocus
        rows={2}
        inputMode="text"
        lang="en"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          "w-full resize-none rounded-lg border px-4 py-3 text-base text-zinc-900 outline-none transition-colors",
          "placeholder:text-zinc-400",
          "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
          "dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400",
          flashRed
            ? "border-red-400 ring-2 ring-red-400/20"
            : "border-zinc-300 dark:border-zinc-600",
          (disabled || isLoading) && "cursor-not-allowed opacity-60",
        )}
      />
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
          "Submit Translation"
        )}
      </button>
    </div>
  );
}
