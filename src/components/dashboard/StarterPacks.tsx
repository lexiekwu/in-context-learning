"use client";

import { useState } from "react";
import { starterPacksByLanguage } from "@/lib/starter-packs";
import type { StarterPack } from "@/lib/starter-packs";

interface StarterPacksProps {
  language?: string;
  onCardsAdded: () => void;
}

export default function StarterPacks({ language = "zh", onCardsAdded }: StarterPacksProps) {
  const [packStates, setPackStates] = useState<
    Record<string, "idle" | "loading" | "done" | "error">
  >({});
  const [createdCounts, setCreatedCounts] = useState<Record<string, number>>(
    {}
  );

  const packs = starterPacksByLanguage[language] ?? [];

  async function addPack(pack: StarterPack) {
    setPackStates((prev) => ({ ...prev, [pack.id]: "loading" }));
    try {
      const res = await fetch("/api/flashcards/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: pack.cards, language }),
      });
      if (!res.ok) {
        throw new Error("Failed to add pack");
      }
      const data = await res.json();
      setCreatedCounts((prev) => ({ ...prev, [pack.id]: data.created }));
      setPackStates((prev) => ({ ...prev, [pack.id]: "done" }));
      onCardsAdded();
    } catch {
      setPackStates((prev) => ({ ...prev, [pack.id]: "error" }));
    }
  }

  if (packs.length === 0) {
    return (
      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-50">
          Get Started with a Starter Pack
        </h2>
        <p className="mb-4 text-sm text-zinc-400">
          Starter packs coming soon for this language!
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-zinc-50">
        Get Started with a Starter Pack
      </h2>
      <p className="mb-4 text-sm text-zinc-400">
        Add a curated set of cards to start practicing right away.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {packs.map((pack) => {
          const state = packStates[pack.id] ?? "idle";
          return (
            <div
              key={pack.id}
              className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="mb-3 text-3xl">{pack.emoji}</div>
              <h3 className="text-base font-semibold text-zinc-50">
                {pack.name}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                {pack.cards.length} cards
              </p>
              <p className="mt-2 flex-1 text-sm text-zinc-400">
                {pack.description}
              </p>
              <div className="mt-4">
                {state === "idle" && (
                  <button
                    onClick={() => addPack(pack)}
                    className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                  >
                    Add Pack
                  </button>
                )}
                {state === "loading" && (
                  <button
                    disabled
                    className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400"
                  >
                    Adding...
                  </button>
                )}
                {state === "done" && (
                  <div className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-medium text-emerald-400">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {createdCounts[pack.id]} cards added
                  </div>
                )}
                {state === "error" && (
                  <button
                    onClick={() => addPack(pack)}
                    className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-red-950 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900"
                  >
                    Failed — Retry
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
