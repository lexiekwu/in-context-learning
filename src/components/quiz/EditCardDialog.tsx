"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { updateFlashcard, getUserLanguageSettings, ApiError } from "@/lib/api";
import type { LanguageDisplay } from "@/lib/api";
import type { FlashcardResponse } from "@/types";

interface EditCardDialogProps {
  card: {
    id: string;
    word: string;
    reading?: string | null;
    englishMeaning: string;
  };
  open: boolean;
  onClose: () => void;
  onUpdated: (card: FlashcardResponse) => void;
}

export default function EditCardDialog({
  card,
  open,
  onClose,
  onUpdated,
}: EditCardDialogProps) {
  const [word, setWord] = useState(card.word);
  const [pinyin, setPinyin] = useState(card.reading ?? "");
  const [meaning, setMeaning] = useState(card.englishMeaning);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [langDisplay, setLangDisplay] = useState<LanguageDisplay | null>(null);

  useEffect(() => {
    getUserLanguageSettings()
      .then((s) => setLangDisplay(s.language))
      .catch(() => {});
  }, []);

  // Update local state if the card prop changes
  useEffect(() => {
    setWord(card.word);
    setPinyin(card.reading ?? "");
    setMeaning(card.englishMeaning);
  }, [card]);

  const isPhonetic = langDisplay?.isPhonetic ?? false;

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleUpdate() {
    if (!word.trim() || (!isPhonetic && !pinyin.trim()) || !meaning.trim()) {
      setError("All required fields must be filled.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await updateFlashcard(card.id, {
        word: word.trim(),
        pinyin: isPhonetic ? undefined : pinyin.trim(),
        englishMeaning: meaning.trim(),
      });
      onUpdated(result.flashcard);
      handleClose();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Failed to update card.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative mx-4 w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Edit Flashcard
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="space-y-4">
            {/* Word */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Word <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Reading (hidden for phonetic languages) */}
            {!isPhonetic && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {langDisplay?.readingSystemName ?? "Reading"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pinyin}
                  onChange={(e) => setPinyin(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* English Meaning */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                English Meaning <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-md border border-zinc-700 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={loading}
                className="flex-1 rounded-md bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
