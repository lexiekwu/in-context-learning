"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";

interface ReadingInputProps {
  targetWord: string;
  onSubmit: (reading: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** Name of the reading system, shown in labels (default: "Pinyin") */
  readingSystemName?: string;
  /** Placeholder text for the input field (default: "e.g. xue2xi2") */
  placeholder?: string;
  /** Instructional hint shown below the input (default: pinyin tone-number format hint) */
  instructions?: string;
}

export function ReadingInput({
  targetWord,
  onSubmit,
  isLoading = false,
  disabled = false,
  readingSystemName = "Pinyin",
  placeholder = "e.g. xue2xi2",
  instructions = "Format: use numbered tones (e.g. xue2xi2, not xu\u00E9x\u00ED)",
}: ReadingInputProps) {
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const readingLower = readingSystemName.toLowerCase();

  return (
    <div className="w-full space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Type the {readingLower} for{" "}
        <span className="text-lg font-bold text-amber-300">
          {targetWord}
        </span>
        :
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        autoFocus
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          "w-full rounded-lg border bg-zinc-900 px-4 py-3 font-mono text-base text-zinc-100 outline-none transition-colors",
          "placeholder:text-zinc-500",
          "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
          flashRed
            ? "border-red-400 ring-2 ring-red-400/20"
            : "border-zinc-600",
          (disabled || isLoading) && "cursor-not-allowed opacity-60",
        )}
      />
      <p className="text-xs text-zinc-400">
        {instructions}
      </p>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || isLoading || !value.trim()}
        className={cn(
          "min-h-11 w-full rounded-lg px-6 py-3 text-base font-medium text-white transition-colors",
          "sm:w-auto",
          "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700",
          "disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400",
        )}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Checking...
          </span>
        ) : (
          `Submit ${readingSystemName}`
        )}
      </button>
    </div>
  );
}

export default ReadingInput;
