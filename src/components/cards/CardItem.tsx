"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { FlashcardResponse, CardState } from "@/types";
import { updateFlashcard, deleteFlashcard, ApiError } from "@/lib/api";

// ---------------------------------------------------------------------------
// State badge styling
// ---------------------------------------------------------------------------

const STATE_STYLES: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  LEARNING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  REVIEW:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  RELEARNING:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function StateBadge({ state }: { state: CardState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        STATE_STYLES[state as string] ?? "bg-zinc-100 text-zinc-700",
      )}
    >
      {state as string}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Relative date helper
// ---------------------------------------------------------------------------

function formatDue(isoDate: string): string {
  const due = new Date(isoDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays}d`;
}

// ---------------------------------------------------------------------------
// CardItem component
// ---------------------------------------------------------------------------

interface CardItemProps {
  card: FlashcardResponse;
  onUpdated: (card: FlashcardResponse) => void;
  onDeleted: (id: string) => void;
}

export default function CardItem({ card, onUpdated, onDeleted }: CardItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [editWord, setEditWord] = useState(card.word);
  const [editPinyin, setEditPinyin] = useState(card.pinyin);
  const [editMeaning, setEditMeaning] = useState(card.englishMeaning);

  function startEdit() {
    setEditWord(card.word);
    setEditPinyin(card.pinyin);
    setEditMeaning(card.englishMeaning);
    setEditing(true);
    setError(null);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateFlashcard(card.id, {
        word: editWord,
        pinyin: editPinyin,
        englishMeaning: editMeaning,
      });
      onUpdated(result.flashcard);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);
    try {
      await deleteFlashcard(card.id);
      onDeleted(card.id);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Failed to delete flashcard.",
      );
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => {
          if (!editing) setExpanded(!expanded);
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left sm:gap-4"
      >
        {/* Word */}
        <span className="min-w-0 shrink-0 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {card.word}
        </span>

        {/* Pinyin + meaning */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
            {card.pinyin}
          </p>
          <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
            {card.englishMeaning}
          </p>
        </div>

        {/* State badge + due date */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StateBadge state={card.state} />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {formatDue(card.due)}
          </span>
        </div>

        {/* Chevron */}
        <svg
          className={cn(
            "h-4 w-4 shrink-0 text-zinc-400 transition-transform",
            expanded && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800">
          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </p>
          )}

          {editing ? (
            /* ---------- EDIT MODE ---------- */
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Word
                </label>
                <input
                  type="text"
                  value={editWord}
                  onChange={(e) => setEditWord(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Pinyin
                </label>
                <input
                  type="text"
                  value={editPinyin}
                  onChange={(e) => setEditPinyin(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  English Meaning
                </label>
                <input
                  type="text"
                  value={editMeaning}
                  onChange={(e) => setEditMeaning(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ---------- VIEW MODE ---------- */
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500">
                    State
                  </span>
                  <div className="mt-0.5">
                    <StateBadge state={card.state} />
                  </div>
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500">Reps</span>
                  <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                    {card.reps}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500">
                    Lapses
                  </span>
                  <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                    {card.lapses}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500">Due</span>
                  <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                    {new Date(card.due).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400 dark:text-zinc-500">
                    Created
                  </span>
                  <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                    {new Date(card.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {card.exampleSentence && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-zinc-400 dark:text-zinc-500">
                      Example
                    </span>
                    <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                      {card.exampleSentence}
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600 dark:text-red-400">
                      Delete this card?
                    </span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {saving ? "Deleting..." : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={saving}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
