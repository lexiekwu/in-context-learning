"use client";

import { useEffect, useState } from "react";

interface LlmPeriod {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

interface AdminMetrics {
  users: {
    total: number;
    newLast7d: number;
    newLast30d: number;
    activeLast7d: number;
    activeLast30d: number;
    byStatus: Record<string, number>;
  };
  content: {
    totalFlashcards: number;
    totalReviewLogs: number;
    totalSessions: number;
    cardsByState: Record<string, number>;
  };
  activity: {
    reviewsLast7d: number;
    reviewsLast30d: number;
    sessionsLast7d: number;
    sessionsLast30d: number;
  };
  dailyReviews: Array<{ day: string; reviews: number; correct: number }>;
  recentUsers: Array<{
    email: string;
    name: string;
    status: string;
    createdAt: string;
    flashcards: number;
    reviews: number;
  }>;
  llm: {
    total: LlmPeriod;
    last7d: LlmPeriod;
    last30d: LlmPeriod;
    byPurpose: Array<{
      purpose: string;
      calls: number;
      promptTokens: number;
      completionTokens: number;
      avgDurationMs: number;
      estimatedCost: number;
    }>;
    daily: Array<{
      day: string;
      calls: number;
      promptTokens: number;
      completionTokens: number;
    }>;
  };
  revenue: {
    total: number;
    last30d: number;
    last7d: number;
    recentCharges: Array<{
      amount: number;
      currency: string;
      status: string;
      created: string;
      customerEmail: string | null;
    }>;
  };
  retention: {
    dauMau: number;
    churnRate: number;
  };
  learning: {
    graduationRate: number;
    lapseRate: number;
  };
  quizPerformance: {
    accuracyByState: Array<{
      state: string;
      total: number;
      correct: number;
      accuracy: number;
    }>;
    avgResponseTimeMs: number;
  };
  featureAdoption: {
    languageDistribution: Array<{ language: string; count: number }>;
  };
  growthFunnel: {
    signupToFirstCard: number;
    firstCardToFirstQuiz: number;
    day7Retention: number;
  };
}

export default function AdminPage() {
  const [data, setData] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/metrics")
      .then((res) => {
        if (res.status === 401) throw new Error("Unauthorized");
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <h1 className="mb-8 text-2xl font-bold text-zinc-50">Admin</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <h1 className="mb-8 text-2xl font-bold text-zinc-50">Admin</h1>
        <div className="rounded-xl border border-red-800 bg-red-950 px-6 py-4 text-sm text-red-300">
          {error === "Unauthorized"
            ? "You don't have access to this page."
            : error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    users, content, activity, dailyReviews, recentUsers, llm, revenue,
    retention, learning, quizPerformance, featureAdoption, growthFunnel,
  } = data;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="mb-8 text-2xl font-bold text-zinc-50">Admin Dashboard</h1>

      {/* Users Section */}
      <Section title="Users">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Users" value={users.total} />
          <StatCard label="Active (7d)" value={users.activeLast7d} />
          <StatCard label="Active (30d)" value={users.activeLast30d} />
          <StatCard
            label="New (30d)"
            value={users.newLast30d}
            sub={`${users.newLast7d} this week`}
          />
        </div>
      </Section>

      {/* Conversion Funnel */}
      <Section title="Conversion Funnel">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Trial"
            value={users.byStatus.TRIAL ?? 0}
            color="text-sky-400"
          />
          <StatCard
            label="Active"
            value={users.byStatus.ACTIVE ?? 0}
            color="text-emerald-400"
          />
          <StatCard
            label="Lapsed"
            value={users.byStatus.LAPSED ?? 0}
            color="text-amber-400"
          />
          <StatCard
            label="Cancelled"
            value={users.byStatus.CANCELLED ?? 0}
            color="text-red-400"
          />
        </div>
        {users.total > 0 && (
          <FunnelBar
            segments={[
              {
                label: "Trial",
                count: users.byStatus.TRIAL ?? 0,
                color: "bg-sky-500",
              },
              {
                label: "Active",
                count: users.byStatus.ACTIVE ?? 0,
                color: "bg-emerald-500",
              },
              {
                label: "Lapsed",
                count: users.byStatus.LAPSED ?? 0,
                color: "bg-amber-500",
              },
              {
                label: "Cancelled",
                count: users.byStatus.CANCELLED ?? 0,
                color: "bg-red-500",
              },
            ]}
            total={users.total}
          />
        )}
      </Section>

      {/* Activity */}
      <Section title="Activity">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Reviews (7d)" value={activity.reviewsLast7d} />
          <StatCard label="Reviews (30d)" value={activity.reviewsLast30d} />
          <StatCard label="Sessions (7d)" value={activity.sessionsLast7d} />
          <StatCard label="Sessions (30d)" value={activity.sessionsLast30d} />
        </div>
      </Section>

      {/* Retention */}
      <Section title="Retention">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="DAU/MAU Ratio"
            value={`${(retention.dauMau * 100).toFixed(1)}%`}
            color="text-sky-400"
          />
          <StatCard
            label="Churn Rate"
            value={`${(retention.churnRate * 100).toFixed(1)}%`}
            color={retention.churnRate > 0.1 ? "text-red-400" : "text-emerald-400"}
          />
        </div>
      </Section>

      {/* Learning Effectiveness */}
      <Section title="Learning Effectiveness">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Graduation Rate"
            value={`${(learning.graduationRate * 100).toFixed(1)}%`}
            sub="Cards in REVIEW / total cards"
            color="text-emerald-400"
          />
          <StatCard
            label="Lapse Rate"
            value={`${(learning.lapseRate * 100).toFixed(1)}%`}
            sub="Total lapses / total reviews"
            color={learning.lapseRate > 0.2 ? "text-amber-400" : "text-zinc-50"}
          />
        </div>
      </Section>

      {/* Quiz Performance */}
      <Section title="Quiz Performance">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Avg Response Time"
            value={`${(quizPerformance.avgResponseTimeMs / 1000).toFixed(1)}s`}
            sub="Last 30 days"
          />
        </div>
        {quizPerformance.accuracyByState.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Card State</th>
                  <th className="px-4 py-3 text-right">Total Reviews</th>
                  <th className="px-4 py-3 text-right">Correct</th>
                  <th className="px-4 py-3 text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {quizPerformance.accuracyByState.map((row) => (
                  <tr key={row.state} className="text-zinc-300">
                    <td className="px-4 py-3 font-medium text-zinc-100">{row.state}</td>
                    <td className="px-4 py-3 text-right">{row.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{row.correct.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">
                      {(row.accuracy * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Feature Adoption */}
      <Section title="Feature Adoption">
        {featureAdoption.languageDistribution.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3 text-right">Flashcards</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {featureAdoption.languageDistribution.map((row) => (
                  <tr key={row.language} className="text-zinc-300">
                    <td className="px-4 py-3 font-medium text-zinc-100">{row.language}</td>
                    <td className="px-4 py-3 text-right">{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Growth Funnel */}
      <Section title="Growth Funnel">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Signup → First Card"
            value={`${(growthFunnel.signupToFirstCard * 100).toFixed(1)}%`}
            color="text-sky-400"
          />
          <StatCard
            label="First Card → First Quiz"
            value={`${(growthFunnel.firstCardToFirstQuiz * 100).toFixed(1)}%`}
            color="text-indigo-400"
          />
          <StatCard
            label="Day 7 Retention"
            value={`${(growthFunnel.day7Retention * 100).toFixed(1)}%`}
            color="text-emerald-400"
          />
        </div>
      </Section>

      {/* Revenue */}
      <Section title="Revenue">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Revenue"
            value={`$${revenue.total.toFixed(2)}`}
            color="text-emerald-400"
          />
          <StatCard
            label="Last 30 Days"
            value={`$${revenue.last30d.toFixed(2)}`}
          />
          <StatCard
            label="Last 7 Days"
            value={`$${revenue.last7d.toFixed(2)}`}
          />
        </div>
        {revenue.recentCharges.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {revenue.recentCharges.map((c, i) => (
                  <tr key={i} className="text-zinc-300">
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(c.created).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{c.customerEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-100">
                      ${c.amount.toFixed(2)} {c.currency.toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status.toUpperCase()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* LLM Spend */}
      <Section title="LLM Spend">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Est. Total Cost"
            value={`$${llm.total.estimatedCost.toFixed(4)}`}
            sub={`${llm.total.calls} calls · ${((llm.total.promptTokens + llm.total.completionTokens) / 1000).toFixed(1)}k tokens`}
            color="text-emerald-400"
          />
          <StatCard
            label="Est. Cost (7d)"
            value={`$${llm.last7d.estimatedCost.toFixed(4)}`}
            sub={`${llm.last7d.calls} calls · ${((llm.last7d.promptTokens + llm.last7d.completionTokens) / 1000).toFixed(1)}k tokens`}
          />
          <StatCard
            label="Est. Cost (30d)"
            value={`$${llm.last30d.estimatedCost.toFixed(4)}`}
            sub={`${llm.last30d.calls} calls · ${((llm.last30d.promptTokens + llm.last30d.completionTokens) / 1000).toFixed(1)}k tokens`}
          />
          <StatCard
            label="Avg Tokens/Call"
            value={
              llm.total.calls > 0
                ? Math.round(
                    (llm.total.promptTokens + llm.total.completionTokens) /
                      llm.total.calls,
                  )
                : 0
            }
            sub={`${llm.total.promptTokens > 0 ? Math.round(llm.total.completionTokens / llm.total.calls) : 0} completion`}
          />
        </div>

        {/* By purpose breakdown */}
        {llm.byPurpose.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3 text-right">Calls</th>
                  <th className="px-4 py-3 text-right">Prompt Tokens</th>
                  <th className="px-4 py-3 text-right">Completion Tokens</th>
                  <th className="px-4 py-3 text-right">Est. Cost</th>
                  <th className="px-4 py-3 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {llm.byPurpose.map((p) => (
                  <tr key={p.purpose} className="text-zinc-300">
                    <td className="px-4 py-3 font-medium text-zinc-100">
                      {p.purpose}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.calls.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.promptTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.completionTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400">
                      ${p.estimatedCost.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {p.avgDurationMs > 0
                        ? `${(p.avgDurationMs / 1000).toFixed(1)}s`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Daily LLM chart */}
        {llm.daily.length > 0 && (
          <div className="mt-4">
            <DailyTokenChart data={llm.daily} />
          </div>
        )}
      </Section>

      {/* Daily Reviews Chart */}
      {dailyReviews.length > 0 && (
        <Section title="Daily Reviews (30d)">
          <DailyChart data={dailyReviews} />
        </Section>
      )}

      {/* Content */}
      <Section title="Content">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Flashcards" value={content.totalFlashcards} />
          <StatCard label="Total Reviews" value={content.totalReviewLogs} />
          <StatCard label="Total Sessions" value={content.totalSessions} />
          <StatCard
            label="Cards by State"
            value=""
            sub={Object.entries(content.cardsByState)
              .map(([s, n]) => `${s}: ${n}`)
              .join(" / ")}
          />
        </div>
      </Section>

      {/* Recent Users */}
      <Section title="Recent Users">
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Cards</th>
                <th className="px-4 py-3 text-right">Reviews</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {recentUsers.map((u) => (
                <tr key={u.email} className="text-zinc-300">
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-right">{u.flashcards}</td>
                  <td className="px-4 py-3 text-right">{u.reviews}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm font-medium text-zinc-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color ?? "text-zinc-50"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    TRIAL: "bg-sky-900/50 text-sky-300",
    ACTIVE: "bg-emerald-900/50 text-emerald-300",
    LAPSED: "bg-amber-900/50 text-amber-300",
    CANCELLED: "bg-red-900/50 text-red-300",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-zinc-800 text-zinc-400"}`}
    >
      {status}
    </span>
  );
}

function FunnelBar({
  segments,
  total,
}: {
  segments: Array<{ label: string; count: number; color: string }>;
  total: number;
}) {
  return (
    <div className="mt-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        {segments.map(({ label, count, color }) => {
          if (count === 0) return null;
          return (
            <div
              key={label}
              className={`${color} transition-all`}
              style={{ width: `${(count / total) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        {segments.map(({ label, count, color }) => {
          if (count === 0) return null;
          return (
            <span key={label} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`}
              />
              {label} ({count})
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DailyTokenChart({
  data,
}: {
  data: Array<{
    day: string;
    calls: number;
    promptTokens: number;
    completionTokens: number;
  }>;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxTokens = Math.max(
    ...data.map((d) => d.promptTokens + d.completionTokens),
    1,
  );

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500" />
          Prompt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />
          Completion
        </span>
      </div>
      <div className="relative flex h-40 items-stretch gap-px">
        {data.map((entry, i) => {
          const total = entry.promptTokens + entry.completionTokens;
          const totalHeight = (total / maxTokens) * 100;
          const promptPct = total > 0 ? entry.promptTokens / total : 0;

          return (
            <div
              key={entry.day}
              className="group relative flex flex-1 flex-col items-stretch justify-end"
              style={{ minWidth: 0 }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {hoveredIndex === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 shadow-lg">
                  <div className="font-medium">{entry.day}</div>
                  <div className="text-zinc-400">
                    {entry.calls} calls &middot;{" "}
                    {(total / 1000).toFixed(1)}k tokens
                  </div>
                </div>
              )}
              {total > 0 ? (
                <div
                  className="flex w-full flex-col overflow-hidden rounded-t-sm"
                  style={{ height: `${totalHeight}%` }}
                >
                  <div
                    className="w-full bg-violet-500 transition-colors group-hover:bg-violet-400"
                    style={{
                      height: `${(1 - promptPct) * 100}%`,
                    }}
                  />
                  <div className="w-full flex-1 bg-indigo-500 transition-colors group-hover:bg-indigo-400" />
                </div>
              ) : (
                <div className="h-px w-full bg-zinc-800" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-px">
        {data.map((entry, i) => {
          const showLabel = i % 7 === 0 || i === data.length - 1;
          return (
            <div
              key={entry.day}
              className="flex-1 text-center text-[10px] text-zinc-500"
              style={{ minWidth: 0 }}
            >
              {showLabel
                ? `${parseInt(entry.day.slice(5, 7))}/${parseInt(entry.day.slice(8, 10))}`
                : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyChart({
  data,
}: {
  data: Array<{ day: string; reviews: number; correct: number }>;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxReviews = Math.max(...data.map((d) => d.reviews), 1);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
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
      <div className="relative flex h-40 items-stretch gap-px">
        {data.map((entry, i) => {
          const totalHeight = (entry.reviews / maxReviews) * 100;
          const correctPct =
            entry.reviews > 0 ? entry.correct / entry.reviews : 0;
          const correctHeight = correctPct * totalHeight;
          const incorrectHeight = totalHeight - correctHeight;

          return (
            <div
              key={entry.day}
              className="group relative flex flex-1 flex-col items-stretch justify-end"
              style={{ minWidth: 0 }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {hoveredIndex === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 shadow-lg">
                  <div className="font-medium">{entry.day}</div>
                  <div className="text-zinc-400">
                    {entry.reviews} reviews &middot; {entry.correct} correct
                  </div>
                </div>
              )}
              {entry.reviews > 0 ? (
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
                  <div className="w-full flex-1 bg-emerald-500 transition-colors group-hover:bg-emerald-400" />
                </div>
              ) : (
                <div className="h-px w-full bg-zinc-800" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-px">
        {data.map((entry, i) => {
          const showLabel = i % 7 === 0 || i === data.length - 1;
          return (
            <div
              key={entry.day}
              className="flex-1 text-center text-[10px] text-zinc-500"
              style={{ minWidth: 0 }}
            >
              {showLabel
                ? `${parseInt(entry.day.slice(5, 7))}/${parseInt(entry.day.slice(8, 10))}`
                : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
