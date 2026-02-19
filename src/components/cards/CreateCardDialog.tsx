"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { createFlashcard, aiCreateCard, ApiError } from "@/lib/api";
import type { FlashcardResponse } from "@/types";

type Tab = "manual" | "ai";

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
  const [tab, setTab] = useState<Tab>("manual");

  // Manual form
  const [word, setWord] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [meaning, setMeaning] = useState("");

  // AI form
  const [aiInput, setAiInput] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<{
    word: string;
    pinyin: string;
    englishMeaning: string;
    exampleSentence: string;
  } | null>(null);
  const [aiWord, setAiWord] = useState("");
  const [aiPinyin, setAiPinyin] = useState("");
  const [aiMeaning, setAiMeaning] = useState("");
  const [aiExample, setAiExample] = useState("");

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setWord("");
    setPinyin("");
    setMeaning("");
    setAiInput("");
    setAiSuggestion(null);
    setAiWord("");
    setAiPinyin("");
    setAiMeaning("");
    setAiExample("");
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // ---- Manual creation ----
  async function handleManualCreate() {
    if (!word.trim() || !pinyin.trim() || !meaning.trim()) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await createFlashcard({
        word: word.trim(),
        pinyin: pinyin.trim(),
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

  // ---- AI generation ----
  async function handleAiGenerate() {
    if (!aiInput.trim()) {
      setError("Enter a word or phrase to generate a card.");
      return;
    }
    setLoading(true);
    setError(null);
    setAiSuggestion(null);
    try {
      const result = await aiCreateCard({ word: aiInput.trim() });
      const s = result.suggestion;
      setAiSuggestion(s);
      setAiWord(s.word);
      setAiPinyin(s.pinyin);
      setAiMeaning(s.englishMeaning);
      setAiExample(s.exampleSentence);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "AI generation failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAiSave() {
    if (!aiWord.trim() || !aiPinyin.trim() || !aiMeaning.trim()) {
      setError("Word, pinyin, and meaning are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await createFlashcard({
        word: aiWord.trim(),
        pinyin: aiPinyin.trim(),
        englishMeaning: aiMeaning.trim(),
        exampleSentence: aiExample.trim() || undefined,
      });
      onCreated(result.flashcard);
      handleClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("A card with this word already exists.");
      } else {
        setError(
          e instanceof ApiError ? e.message : "Failed to save card.",
        );
      }
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

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => {
              setTab("manual");
              setError(null);
            }}
            className={cn(
              "flex-1 py-2.5 text-center text-sm font-medium transition-colors",
              tab === "manual"
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300",
            )}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("ai");
              setError(null);
            }}
            className={cn(
              "flex-1 py-2.5 text-center text-sm font-medium transition-colors",
              tab === "ai"
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300",
            )}
          >
            AI Generate
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </p>
          )}

          {tab === "manual" ? (
            /* ---------- Manual Tab ---------- */
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Word <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder="e.g. 學習"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Pinyin <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pinyin}
                  onChange={(e) => setPinyin(e.target.value)}
                  placeholder="e.g. xue2xi2"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  English Meaning <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="e.g. to study / to learn"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <button
                type="button"
                onClick={handleManualCreate}
                disabled={loading}
                className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Card"}
              </button>
            </div>
          ) : (
            /* ---------- AI Tab ---------- */
            <div className="space-y-3">
              {!aiSuggestion ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Enter a Chinese word or phrase
                    </label>
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="e.g. 圖書館"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !loading) handleAiGenerate();
                      }}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={loading}
                    className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
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
                        Generating...
                      </span>
                    ) : (
                      "Generate with AI"
                    )}
                  </button>
                </>
              ) : (
                /* AI result preview (editable) */
                <>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    AI-generated card (edit before saving)
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Word
                    </label>
                    <input
                      type="text"
                      value={aiWord}
                      onChange={(e) => setAiWord(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Pinyin
                    </label>
                    <input
                      type="text"
                      value={aiPinyin}
                      onChange={(e) => setAiPinyin(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      English Meaning
                    </label>
                    <input
                      type="text"
                      value={aiMeaning}
                      onChange={(e) => setAiMeaning(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Example Sentence
                    </label>
                    <input
                      type="text"
                      value={aiExample}
                      onChange={(e) => setAiExample(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAiSave}
                      disabled={loading}
                      className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? "Saving..." : "Save Card"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAiSuggestion(null);
                        setError(null);
                      }}
                      disabled={loading}
                      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Back
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
