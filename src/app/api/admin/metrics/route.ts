import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { errorResponse, unauthorizedError } from "@/lib/errors";

const ADMIN_EMAILS = ["lexiekwu@gmail.com"];

/**
 * GET /api/admin/metrics
 *
 * Internal admin dashboard data. Only accessible to whitelisted emails.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      throw unauthorizedError();
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    // Core DB queries (parallel)
    const [
      totalUsers,
      usersByStatus,
      usersLast7d,
      usersLast30d,
      totalFlashcards,
      totalReviewLogs,
      totalSessions,
      reviewsLast7d,
      reviewsLast30d,
      sessionsLast7d,
      sessionsLast30d,
      activeUsersLast7d,
      activeUsersLast30d,
      cardsByState,
      recentUsers,
      dailyReviews,
    ] = await Promise.all([
      db.user.count(),
      db.user.groupBy({ by: ["subscriptionStatus"], _count: { _all: true } }),
      db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.flashcard.count(),
      db.reviewLog.count(),
      db.studySession.count(),
      db.reviewLog.count({ where: { reviewedAt: { gte: sevenDaysAgo } } }),
      db.reviewLog.count({ where: { reviewedAt: { gte: thirtyDaysAgo } } }),
      db.studySession.count({ where: { startedAt: { gte: sevenDaysAgo } } }),
      db.studySession.count({ where: { startedAt: { gte: thirtyDaysAgo } } }),
      db.reviewLog.findMany({
        where: { reviewedAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      db.reviewLog.findMany({
        where: { reviewedAt: { gte: thirtyDaysAgo } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      db.flashcard.groupBy({ by: ["state"], _count: { _all: true } }),
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionStatus: true,
          createdAt: true,
          _count: { select: { flashcards: true, reviewLogs: true } },
        },
      }),
      db.$queryRaw<Array<{ day: string; reviews: bigint; correct: bigint }>>`
        SELECT
          TO_CHAR("reviewedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
          COUNT(*)::bigint AS reviews,
          COUNT(*) FILTER (WHERE "overallRating" = 'GOOD')::bigint AS correct
        FROM "ReviewLog"
        WHERE "reviewedAt" >= ${thirtyDaysAgo}
        GROUP BY day
        ORDER BY day
      `,
    ]);

    // LLM queries (separate try/catch — may fail if Prisma client is stale)
    let llmData = {
      total: { calls: 0, promptTokens: 0, completionTokens: 0 },
      last7d: { calls: 0, promptTokens: 0, completionTokens: 0 },
      last30d: { calls: 0, promptTokens: 0, completionTokens: 0 },
      byPurpose: [] as Array<{
        purpose: string;
        calls: number;
        promptTokens: number;
        completionTokens: number;
        avgDurationMs: number;
      }>,
      daily: [] as Array<{
        day: string;
        calls: number;
        promptTokens: number;
        completionTokens: number;
      }>,
    };

    try {
      const [llmTotals, llmLast7d, llmLast30d, llmByPurpose, dailyLlm] =
        await Promise.all([
          db.llmCall.aggregate({
            _sum: { promptTokens: true, completionTokens: true },
            _count: { _all: true },
          }),
          db.llmCall.aggregate({
            where: { calledAt: { gte: sevenDaysAgo } },
            _sum: { promptTokens: true, completionTokens: true },
            _count: { _all: true },
          }),
          db.llmCall.aggregate({
            where: { calledAt: { gte: thirtyDaysAgo } },
            _sum: { promptTokens: true, completionTokens: true },
            _count: { _all: true },
          }),
          db.llmCall.groupBy({
            by: ["purpose"],
            _sum: { promptTokens: true, completionTokens: true },
            _count: { _all: true },
            _avg: { durationMs: true },
          }),
          db.$queryRaw<
            Array<{
              day: string;
              calls: bigint;
              prompt_tokens: bigint;
              completion_tokens: bigint;
            }>
          >`
            SELECT
              TO_CHAR("calledAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
              COUNT(*)::bigint AS calls,
              COALESCE(SUM("promptTokens"), 0)::bigint AS prompt_tokens,
              COALESCE(SUM("completionTokens"), 0)::bigint AS completion_tokens
            FROM "LlmCall"
            WHERE "calledAt" >= ${thirtyDaysAgo}
            GROUP BY day
            ORDER BY day
          `,
        ]);

      llmData = {
        total: {
          calls: llmTotals._count._all,
          promptTokens: llmTotals._sum.promptTokens ?? 0,
          completionTokens: llmTotals._sum.completionTokens ?? 0,
        },
        last7d: {
          calls: llmLast7d._count._all,
          promptTokens: llmLast7d._sum.promptTokens ?? 0,
          completionTokens: llmLast7d._sum.completionTokens ?? 0,
        },
        last30d: {
          calls: llmLast30d._count._all,
          promptTokens: llmLast30d._sum.promptTokens ?? 0,
          completionTokens: llmLast30d._sum.completionTokens ?? 0,
        },
        byPurpose: llmByPurpose.map((g) => ({
          purpose: g.purpose,
          calls: g._count._all,
          promptTokens: g._sum.promptTokens ?? 0,
          completionTokens: g._sum.completionTokens ?? 0,
          avgDurationMs: Math.round(g._avg.durationMs ?? 0),
        })),
        daily: dailyLlm.map((d) => ({
          day: d.day,
          calls: Number(d.calls),
          promptTokens: Number(d.prompt_tokens),
          completionTokens: Number(d.completion_tokens),
        })),
      };
    } catch (e) {
      console.warn("[admin/metrics] LLM queries failed (restart dev server to pick up new Prisma client):", e);
    }

    // Stripe revenue (separate try/catch)
    let revenue = {
      last30d: 0,
      last7d: 0,
      total: 0,
      recentCharges: [] as Array<{
        amount: number;
        currency: string;
        status: string;
        created: string;
        customerEmail: string | null;
      }>,
    };

    try {
      const invoices = await getStripe().invoices.list({
        limit: 100,
        status: "paid",
        created: {
          gte: Math.floor((now.getTime() - 90 * 86_400_000) / 1000),
        },
      });

      const sevenDaysAgoTs = Math.floor(sevenDaysAgo.getTime() / 1000);
      const thirtyDaysAgoTs = Math.floor(thirtyDaysAgo.getTime() / 1000);

      let total = 0;
      let last30d = 0;
      let last7d = 0;

      for (const inv of invoices.data) {
        const amount = inv.amount_paid / 100;
        total += amount;
        if (inv.created >= thirtyDaysAgoTs) last30d += amount;
        if (inv.created >= sevenDaysAgoTs) last7d += amount;
      }

      revenue = {
        total,
        last30d,
        last7d,
        recentCharges: invoices.data.slice(0, 10).map((inv) => ({
          amount: inv.amount_paid / 100,
          currency: inv.currency,
          status: inv.status ?? "unknown",
          created: new Date(inv.created * 1000).toISOString(),
          customerEmail: inv.customer_email,
        })),
      };
    } catch {
      // Stripe not configured or API error — leave defaults
    }

    // Build response
    const statusMap: Record<string, number> = {};
    for (const g of usersByStatus) {
      statusMap[g.subscriptionStatus] = g._count._all;
    }

    const stateMap: Record<string, number> = {};
    for (const g of cardsByState) {
      stateMap[g.state] = g._count._all;
    }

    return NextResponse.json({
      users: {
        total: totalUsers,
        newLast7d: usersLast7d,
        newLast30d: usersLast30d,
        activeLast7d: activeUsersLast7d.length,
        activeLast30d: activeUsersLast30d.length,
        byStatus: statusMap,
      },
      content: {
        totalFlashcards,
        totalReviewLogs,
        totalSessions,
        cardsByState: stateMap,
      },
      activity: {
        reviewsLast7d,
        reviewsLast30d,
        sessionsLast7d,
        sessionsLast30d,
      },
      dailyReviews: dailyReviews.map((d) => ({
        day: d.day,
        reviews: Number(d.reviews),
        correct: Number(d.correct),
      })),
      recentUsers: recentUsers.map((u) => ({
        email: u.email,
        name: u.name,
        status: u.subscriptionStatus,
        createdAt: u.createdAt.toISOString(),
        flashcards: u._count.flashcards,
        reviews: u._count.reviewLogs,
      })),
      llm: llmData,
      revenue,
    });
  } catch (error) {
    console.error("[admin/metrics] Error:", error);
    return errorResponse(error);
  }
}
