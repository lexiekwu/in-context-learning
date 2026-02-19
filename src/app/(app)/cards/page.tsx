"use client";

import { useCallback, useEffect, useState } from "react";
import type { CardState, FlashcardResponse } from "@/types";
import { getFlashcards, type GetFlashcardsParams } from "@/lib/api";
import CardSearch from "@/components/cards/CardSearch";
import CardStateFilter from "@/components/cards/CardStateFilter";
import CardItem from "@/components/cards/CardItem";
import CreateCardDialog from "@/components/cards/CreateCardDialog";

type SortOption = "due_asc" | "created_desc" | "word_asc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "due_asc", label: "Due date" },
  { value: "word_asc", label: "Alphabetical" },
  { value: "created_desc", label: "Recently created" },
];

export default function CardsPage() {
  // Filter / sort state
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<CardState[]>([]);
  const [sort, setSort] = useState<SortOption>("due_asc");

  // Data state
  const [cards, setCards] = useState<FlashcardResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch cards (resets on filter/sort changes)
  // ---------------------------------------------------------------------------
  const fetchCards = useCallback(
    async (cursor?: string) => {
      const isLoadMore = !!cursor;
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params: GetFlashcardsParams = {
          search: search || undefined,
          state: stateFilter.length > 0 ? stateFilter : undefined,
          sort,
          limit: 20,
          cursor,
        };
        const result = await getFlashcards(params);

        if (isLoadMore) {
          setCards((prev) => [...prev, ...result.flashcards]);
        } else {
          setCards(result.flashcards);
        }
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
        setTotalCount(result.totalCount);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to load flashcards.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, stateFilter, sort],
  );

  // Refetch when filters change
  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleCardUpdated(updated: FlashcardResponse) {
    setCards((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );
  }

  function handleCardDeleted(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setTotalCount((prev) => prev - 1);
  }

  function handleCardCreated(card: FlashcardResponse) {
    // Prepend to list so user sees it immediately
    setCards((prev) => [card, ...prev]);
    setTotalCount((prev) => prev + 1);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">
            Flashcards
          </h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-zinc-400">
              {totalCount} card{totalCount !== 1 ? "s" : ""} total
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New Card
        </button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <CardSearch value={search} onChange={setSearch} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardStateFilter selected={stateFilter} onChange={setStateFilter} />
          <div className="flex items-center gap-2">
            <label
              htmlFor="sort-select"
              className="text-xs font-medium text-zinc-400"
            >
              Sort by
            </label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[68px] animate-pulse rounded-lg border border-zinc-800 bg-zinc-800/50"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && cards.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 px-6 py-16">
          <div className="mb-3 text-4xl">&#x5B57;</div>
          <h2 className="text-lg font-semibold text-zinc-200">
            {search || stateFilter.length > 0
              ? "No matching flashcards"
              : "No flashcards yet"}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {search || stateFilter.length > 0
              ? "Try adjusting your search or filters."
              : "Create your first card to start learning!"}
          </p>
          {!search && stateFilter.length === 0 && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Create your first card
            </button>
          )}
        </div>
      )}

      {/* Card list */}
      {!loading && cards.length > 0 && (
        <div className="space-y-2">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onUpdated={handleCardUpdated}
              onDeleted={handleCardDeleted}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => {
              if (nextCursor) fetchCards(nextCursor);
            }}
            disabled={loadingMore}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {/* Create card dialog */}
      <CreateCardDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCardCreated}
      />
    </div>
  );
}
