"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { createFlashcard, aiCreateCard, getUserLanguageSettings, ApiError } from "@/lib/api";
import type { LanguageDisplay } from "@/lib/api";
import type { FlashcardResponse } from "@/types";

interface CreateCardDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (card: FlashcardResponse) => void;
}

export default function CreateCardDialog({
  open,
  onClose,
  onCreated,
}: CreateCardDialogProps) {
  const [word, setWord] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [meaning, setMeaning] = useState("");

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [langDisplay, setLangDisplay] = useState<LanguageDisplay | null>(null);

  useEffect(() => {
    getUserLanguageSettings().then((s) => setLangDisplay(s.language)).catch(() => {});
  }, []);

  const isPhonetic = langDisplay?.isPhonetic ?? false;

  function resetForm() {
    setWord("");
    setPinyin("");
    setMeaning("");
    setError(null);
    setLoading(false);
    setAiLoading(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleCreate() {
    if (!word.trim() || (!isPhonetic && !pinyin.trim()) || !meaning.trim()) {
      setError("All required fields must be filled.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await createFlashcard({
        word: word.trim(),
        pinyin: isPhonetic ? undefined : pinyin.trim(),
        englishMeaning: meaning.trim(),
      });
      onCreated(result.flashcard);
      handleClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("A card with this word already exists.");
      } else {
        setError(
          e instanceof ApiError ? e.message : "Failed to create card.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAiFill(input: string) {
    if (!input.trim()) return;
    setAiLoading(true);
    setError(null);
    try {
      const result = await aiCreateCard({ word: input.trim() });
      const s = result.suggestion;
      setWord(s.word);
      setPinyin(s.pinyin);
      setMeaning(s.englishMeaning);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "AI fill failed. Try again.",
      );
    } finally {
      setAiLoading(false);
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
            Create Flashcard
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

          <div className="space-y-3">
            {/* Word */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Word <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder={`e.g. ${langDisplay?.exampleWord ?? "word"}`}
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <AiFillButton
                  onClick={() => handleAiFill(word)}
                  disabled={!word.trim() || aiLoading}
                  loading={aiLoading}
                  title={`AI-fill ${isPhonetic ? "meaning" : (langDisplay?.readingSystemName?.toLowerCase() ?? "reading") + " and meaning"} from this word`}
                />
              </div>
            </div>

            {/* Pinyin / Reading (hidden for phonetic languages) */}
            {!isPhonetic && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {langDisplay?.readingSystemName ?? "Reading"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pinyin}
                  onChange={(e) => setPinyin(e.target.value)}
                  placeholder={langDisplay?.readingPlaceholder ?? "e.g. reading"}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* English Meaning */}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                English Meaning <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder={`e.g. ${langDisplay?.exampleMeaning ?? "meaning"}`}
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <AiFillButton
                  onClick={() => handleAiFill(meaning)}
                  disabled={!meaning.trim() || aiLoading}
                  loading={aiLoading}
                  title={`AI-fill word${isPhonetic ? "" : " and " + (langDisplay?.readingSystemName?.toLowerCase() ?? "reading")} from this English meaning`}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || aiLoading}
              className="w-full rounded-md bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Card"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiFillButton({
  onClick,
  disabled,
  loading,
  title,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-700 transition-colors",
        "hover:bg-zinc-700 hover:text-indigo-400",
        "disabled:cursor-not-allowed disabled:opacity-40",
        loading ? "text-indigo-400" : "text-zinc-400",
      )}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      )}
    </button>
  );
}
