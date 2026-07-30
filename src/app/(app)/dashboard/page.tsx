"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { MetricsHistoryEntry } from "@/types";
import { getUserLanguageSettings, type LanguageDisplay } from "@/lib/api";
import StarterPacks from "@/components/dashboard/StarterPacks";

type HistoryPeriod = "7d" | "30d" | "90d";

interface DashboardStats {
  cardsDueToday: number;
  currentStreak: number;
  last7DaysAccuracy: number;
  totalCards: number;
  cardsByState: Record<string, number>;
  todayReviewed: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("30d");
  const [historyData, setHistoryData] = useState<MetricsHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [langDisplay, setLangDisplay] = useState<LanguageDisplay | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>("zh");

  useEffect(() => {
    getUserLanguageSettings().then((s) => {
      setLangDisplay(s.language);
      setTargetLanguage(s.targetLanguage);
    }).catch(() => {});
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics/overview");
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    async function fetchHistory() {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/metrics/history?period=${historyPeriod}`);
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setHistoryData(json.data);
      } catch {
        /* ignore */
      } finally {
        setHistoryLoading(false);
      }
    }
    fetchHistory();
  }, [historyPeriod]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="mb-8 text-2xl font-bold text-zinc-50">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="mb-8 text-2xl font-bold text-zinc-50">Dashboard</h1>
        <div className="rounded-xl border border-red-800 bg-red-950 px-6 py-4 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  const accuracy = stats?.last7DaysAccuracy ?? 0;
  const accuracyColor =
    accuracy >= 80
      ? "text-emerald-400"
      : accuracy >= 60
        ? "text-yellow-400"
        : "text-red-400";

  const dueToday = stats?.cardsDueToday ?? 0;
  const streak = stats?.currentStreak ?? 0;
  const totalCards = stats?.totalCards ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-2xl font-bold text-zinc-50">Dashboard</h1>

      {totalCards === 0 ? (
        <>
          {/* Welcome Banner */}
          <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-1 text-lg font-semibold text-zinc-50">
              Welcome to In Context Flashcards!
            </h2>
            <p className="mb-5 text-sm text-zinc-400">
              Here&apos;s how it works:
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
                <div className="mb-2 text-2xl">📝</div>
                <h3 className="text-sm font-semibold text-zinc-50">
                  Add Cards
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Build your vocabulary with {langDisplay?.name ?? "new"} words. Use AI to auto-fill
                  {langDisplay?.isPhonetic ? " meanings" : ` ${langDisplay?.readingSystemName?.toLowerCase() ?? "readings"} and meanings`}.
                </p>
              </div>
              <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
                <div className="mb-2 text-2xl">🧠</div>
                <h3 className="text-sm font-semibold text-zinc-50">
                  Practice Daily
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Quiz yourself with AI-generated sentences. Translate them{langDisplay?.isPhonetic ? "" : ` and type ${langDisplay?.readingSystemName?.toLowerCase() ?? "readings"}`}.
                </p>
              </div>
              <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
                <div className="mb-2 text-2xl">📈</div>
                <h3 className="text-sm font-semibold text-zinc-50">
                  Track Progress
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Spaced repetition schedules reviews at the optimal time for
                  long-term memory.
                </p>
              </div>
            </div>
          </div>

          {/* Starter Packs */}
          <div className="mb-8">
            <StarterPacks language={targetLanguage} onCardsAdded={fetchStats} />
          </div>
        </>
      ) : (
        /* Stat Cards */
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Due Today */}
          <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div>
              <p className="text-sm font-medium text-zinc-400">Due Today</p>
              <p className="mt-1 text-3xl font-bold text-zinc-50">{dueToday}</p>
            </div>
            {dueToday > 0 && (
              <Link
                href="/quiz"
                className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                Start Quiz
              </Link>
            )}
            {dueToday === 0 && (
              <p className="mt-3 text-sm text-zinc-500">All caught up!</p>
            )}
          </div>

          {/* Streak */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">Streak</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-3xl font-bold text-zinc-50">{streak}</p>
              <span className="text-lg text-orange-400" aria-label="flame">
                🔥
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {streak === 1 ? "day" : "days"} in a row
            </p>
          </div>

          {/* 7-Day Accuracy */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">7-Day Accuracy</p>
            <p className={`mt-1 text-3xl font-bold ${accuracyColor}`}>
              {stats?.todayReviewed === 0 && accuracy === 0
                ? "--"
                : `${Math.round(accuracy)}%`}
            </p>
            <p className="mt-1 text-sm text-zinc-500">last 7 days</p>
          </div>

          {/* Total Cards */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">Total Cards</p>
            <p className="mt-1 text-3xl font-bold text-zinc-50">{totalCards}</p>
            {stats?.cardsByState && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                {stats.cardsByState.NEW !== undefined && (
                  <span>New: {stats.cardsByState.NEW}</span>
                )}
                {stats.cardsByState.LEARNING !== undefined && (
                  <span>Learning: {stats.cardsByState.LEARNING}</span>
                )}
                {stats.cardsByState.REVIEW !== undefined && (
                  <span>Review: {stats.cardsByState.REVIEW}</span>
                )}
                {stats.cardsByState.RELEARNING !== undefined && (
                  <span>Relearn: {stats.cardsByState.RELEARNING}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cards by State Bar */}
      {stats?.cardsByState && totalCards > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">
            Cards by State
          </h2>
          <CardStateBar cardsByState={stats.cardsByState} total={totalCards} />
        </div>
      )}

      {/* Review History */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-400">Review History</h2>
          <select
            value={historyPeriod}
            onChange={(e) =>
              setHistoryPeriod(e.target.value as HistoryPeriod)
            }
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        </div>
        {historyLoading ? (
          <div className="h-48 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
        ) : (
          <ReviewHistoryChart data={historyData} period={historyPeriod} />
        )}
      </div>
    </div>
  );
}

function CardStateBar({
  cardsByState,
  total,
}: {
  cardsByState: Record<string, number>;
  total: number;
}) {
  const segments = [
    { key: "NEW", label: "New", color: "bg-sky-500" },
    { key: "LEARNING", label: "Learning", color: "bg-amber-500" },
    { key: "REVIEW", label: "Review", color: "bg-emerald-500" },
    { key: "RELEARNING", label: "Relearn", color: "bg-rose-500" },
  ];

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        {segments.map(({ key, color }) => {
          const count = cardsByState[key] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={key}
              className={`${color} transition-all`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        {segments.map(({ key, label, color }) => {
          const count = cardsByState[key] ?? 0;
          if (count === 0) return null;
          return (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
              {label} ({count})
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ReviewHistoryChart({
  data,
  period,
}: {
  data: MetricsHistoryEntry[];
  period: HistoryPeriod;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-500">
        No review data yet
      </div>
    );
  }

  const maxReviewed = Math.max(...data.map((d) => d.cardsReviewed), 1);

  // Show date label every Nth bar
  const labelInterval = period === "7d" ? 1 : period === "30d" ? 7 : 14;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      {/* Legend */}
      <div className="mb-4 flex gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Correct
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" />
          Incorrect
        </span>
      </div>

      {/* Chart area */}
      <div className="relative flex h-40 items-stretch gap-px">
        {data.map((entry, i) => {
          const totalHeight =
            maxReviewed > 0 ? (entry.cardsReviewed / maxReviewed) * 100 : 0;
          const correctHeight =
            entry.cardsReviewed > 0
              ? (entry.cardsCorrect / entry.cardsReviewed) * totalHeight
              : 0;
          const incorrectHeight = totalHeight - correctHeight;

          return (
            <div
              key={entry.date}
              className="group relative flex flex-1 flex-col items-stretch justify-end"
              style={{ minWidth: 0 }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip */}
              {hoveredIndex === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 shadow-lg">
                  <div className="font-medium">{entry.date}</div>
                  <div className="mt-0.5 text-zinc-400">
                    {entry.cardsReviewed} reviewed &middot;{" "}
                    {entry.cardsCorrect} pts
                  </div>
                  <div className="text-zinc-400">
                    {entry.accuracy}% accuracy &middot;{" "}
                    {entry.newCardsStudied} new
                  </div>
                  {entry.timeSpentMinutes > 0 && (
                    <div className="text-zinc-400">
                      {entry.timeSpentMinutes} min
                    </div>
                  )}
                </div>
              )}

              {/* Stacked bar */}
              {entry.cardsReviewed > 0 ? (
                <div
                  className="flex w-full flex-col overflow-hidden rounded-t-sm"
                  style={{ height: `${totalHeight}%` }}
                >
                  <div
                    className="w-full bg-rose-500 transition-colors group-hover:bg-rose-400"
                    style={{
                      height:
                        incorrectHeight > 0
                          ? `${(incorrectHeight / totalHeight) * 100}%`
                          : "0%",
                    }}
                  />
                  <div
                    className="w-full flex-1 bg-emerald-500 transition-colors group-hover:bg-emerald-400"
                  />
                </div>
              ) : (
                <div className="h-px w-full bg-zinc-800" />
              )}
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div className="mt-2 flex gap-px">
        {data.map((entry, i) => {
          const showLabel = i % labelInterval === 0 || i === data.length - 1;
          return (
            <div
              key={entry.date}
              className="flex-1 text-center text-[10px] text-zinc-500"
              style={{ minWidth: 0 }}
            >
              {showLabel
                ? `${parseInt(entry.date.slice(5, 7))}/${parseInt(entry.date.slice(8, 10))}`
                : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
