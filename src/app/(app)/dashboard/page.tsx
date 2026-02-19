"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    async function fetchStats() {
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
    }
    fetchStats();
  }, []);

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

      {/* Stat Cards */}
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

      {/* CTA Buttons */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/quiz"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Start Quiz
        </Link>
        <Link
          href="/cards"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          Manage Cards
        </Link>
      </div>

      {/* Cards by State Bar */}
      {stats?.cardsByState && totalCards > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">
            Cards by State
          </h2>
          <CardStateBar cardsByState={stats.cardsByState} total={totalCards} />
        </div>
      )}
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
