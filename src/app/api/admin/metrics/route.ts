import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { errorResponse, unauthorizedError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "lexiekwu@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * GET /api/admin/metrics
 *
 * Internal admin dashboard data. Only accessible to whitelisted emails.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
      throw unauthorizedError();
    }

    const limited = await checkRateLimit("billing", session.user.id!);
    if (limited) return limited;

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

    // Approximate per-token pricing (USD per 1M tokens) for Gemini 2.5 Flash via Poe
    const PRICING: Record<string, { input: number; output: number }> = {
      "Gemini-2.5-Flash": { input: 0.15, output: 0.60 },
      "Gemini-2.5-Pro": { input: 1.25, output: 10.0 },
    };
    const DEFAULT_PRICING = { input: 0.15, output: 0.60 };

    function estimateCost(promptTokens: number, completionTokens: number, model?: string) {
      const p = (model && PRICING[model]) || DEFAULT_PRICING;
      return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
    }

    // LLM queries (separate try/catch — may fail if Prisma client is stale)
    let llmData = {
      total: { calls: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0 },
      last7d: { calls: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0 },
      last30d: { calls: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0 },
      byPurpose: [] as Array<{
        purpose: string;
        calls: number;
        promptTokens: number;
        completionTokens: number;
        avgDurationMs: number;
        estimatedCost: number;
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
          estimatedCost: estimateCost(
            llmTotals._sum.promptTokens ?? 0,
            llmTotals._sum.completionTokens ?? 0,
          ),
        },
        last7d: {
          calls: llmLast7d._count._all,
          promptTokens: llmLast7d._sum.promptTokens ?? 0,
          completionTokens: llmLast7d._sum.completionTokens ?? 0,
          estimatedCost: estimateCost(
            llmLast7d._sum.promptTokens ?? 0,
            llmLast7d._sum.completionTokens ?? 0,
          ),
        },
        last30d: {
          calls: llmLast30d._count._all,
          promptTokens: llmLast30d._sum.promptTokens ?? 0,
          completionTokens: llmLast30d._sum.completionTokens ?? 0,
          estimatedCost: estimateCost(
            llmLast30d._sum.promptTokens ?? 0,
            llmLast30d._sum.completionTokens ?? 0,
          ),
        },
        byPurpose: llmByPurpose.map((g) => ({
          purpose: g.purpose,
          calls: g._count._all,
          promptTokens: g._sum.promptTokens ?? 0,
          completionTokens: g._sum.completionTokens ?? 0,
          avgDurationMs: Math.round(g._avg.durationMs ?? 0),
          estimatedCost: estimateCost(
            g._sum.promptTokens ?? 0,
            g._sum.completionTokens ?? 0,
          ),
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

    // PM-critical metrics (separate try/catch)
    const retention = { dauMau: 0, churnRate: 0 };
    const learning = { graduationRate: 0, lapseRate: 0 };
    const quizPerformance = {
      accuracyByState: [] as Array<{ state: string; total: number; correct: number; accuracy: number }>,
      avgResponseTimeMs: 0,
    };
    const featureAdoption = {
      languageDistribution: [] as Array<{ language: string; count: number }>,
    };
    const growthFunnel = {
      signupToFirstCard: 0,
      firstCardToFirstQuiz: 0,
      day7Retention: 0,
    };

    try {
      const oneDayAgo = new Date(now);
      oneDayAgo.setUTCDate(oneDayAgo.getUTCDate() - 1);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
      const eightDaysAgo = new Date(now);
      eightDaysAgo.setUTCDate(eightDaysAgo.getUTCDate() - 8);
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setUTCDate(sixDaysAgo.getUTCDate() - 6);

      const [
        dauUsers,
        mauUsers,
        activeLastMonth,
        activePriorMonth,
        reviewCards,
        totalCardsCount,
        totalLapses,
        totalReviewCount,
        accuracyByStateRaw,
        avgResponseTime,
        langDistribution,
        usersWithCards,
        usersWithCardsAndReviews,
        totalUsersCount,
        usersSignedUpBefore8d,
        day7RetainedUsers,
      ] = await Promise.all([
        // DAU: distinct users who reviewed in last 1 day
        db.reviewLog.findMany({
          where: { reviewedAt: { gte: oneDayAgo } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        // MAU: distinct users who reviewed in last 30 days
        db.reviewLog.findMany({
          where: { reviewedAt: { gte: thirtyDaysAgo } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        // Users active in last 30 days (for churn)
        db.reviewLog.findMany({
          where: { reviewedAt: { gte: thirtyDaysAgo } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        // Users active 30-60 days ago
        db.reviewLog.findMany({
          where: { reviewedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        // Cards in REVIEW state (graduation)
        db.flashcard.count({ where: { state: "REVIEW" } }),
        // Total cards
        db.flashcard.count(),
        // Total lapses
        db.flashcard.aggregate({ _sum: { lapses: true } }),
        // Total review logs (for lapse rate)
        db.reviewLog.count(),
        // Accuracy by card state
        db.$queryRaw<Array<{ state: string; total: bigint; correct: bigint }>>`
          SELECT
            f."state"::text AS state,
            COUNT(*)::bigint AS total,
            COUNT(*) FILTER (WHERE r."overallRating" = 'GOOD')::bigint AS correct
          FROM "ReviewLog" r
          JOIN "Flashcard" f ON f."id" = r."flashcardId"
          GROUP BY f."state"
        `,
        // Avg response time (last 30 days)
        db.$queryRaw<Array<{ avg_ms: number }>>`
          SELECT COALESCE(AVG("responseTimeMs"), 0)::float AS avg_ms
          FROM "ReviewLog"
          WHERE "reviewedAt" >= ${thirtyDaysAgo}
            AND "responseTimeMs" IS NOT NULL
        `,
        // Language distribution
        db.$queryRaw<Array<{ language: string; count: bigint }>>`
          SELECT u."targetLanguage" AS language, COUNT(f."id")::bigint AS count
          FROM "Flashcard" f
          JOIN "User" u ON u."id" = f."userId"
          GROUP BY u."targetLanguage"
          ORDER BY count DESC
        `,
        // Users with at least 1 flashcard
        db.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT "userId")::bigint AS count
          FROM "Flashcard"
        `,
        // Users with at least 1 review who also have cards
        db.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT r."userId")::bigint AS count
          FROM "ReviewLog" r
          WHERE EXISTS (SELECT 1 FROM "Flashcard" f WHERE f."userId" = r."userId")
        `,
        // Total users (for funnel)
        db.user.count(),
        // Users who signed up 8+ days ago (for day 7 retention denominator)
        db.user.count({ where: { createdAt: { lte: eightDaysAgo } } }),
        // Users who signed up 8+ days ago AND had a review in days 6-8 after signup
        db.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(DISTINCT u."id")::bigint AS count
          FROM "User" u
          WHERE u."createdAt" <= ${eightDaysAgo}
            AND EXISTS (
              SELECT 1 FROM "ReviewLog" r
              WHERE r."userId" = u."id"
                AND r."reviewedAt" >= u."createdAt" + interval '6 days'
                AND r."reviewedAt" <= u."createdAt" + interval '8 days'
            )
        `,
      ]);

      // Retention
      const mauCount = mauUsers.length;
      const dauCount = dauUsers.length;
      retention.dauMau = mauCount > 0 ? dauCount / mauCount : 0;

      const activeLastMonthIds = new Set(activeLastMonth.map((u) => u.userId));
      const priorMonthIds = activePriorMonth.map((u) => u.userId);
      const churned = priorMonthIds.filter((id) => !activeLastMonthIds.has(id));
      retention.churnRate = priorMonthIds.length > 0 ? churned.length / priorMonthIds.length : 0;

      // Learning effectiveness
      learning.graduationRate = totalCardsCount > 0 ? reviewCards / totalCardsCount : 0;
      learning.lapseRate = totalReviewCount > 0 ? (totalLapses._sum.lapses ?? 0) / totalReviewCount : 0;

      // Quiz performance
      quizPerformance.accuracyByState = accuracyByStateRaw.map((r) => ({
        state: r.state,
        total: Number(r.total),
        correct: Number(r.correct),
        accuracy: Number(r.total) > 0 ? Number(r.correct) / Number(r.total) : 0,
      }));
      quizPerformance.avgResponseTimeMs = Math.round(avgResponseTime[0]?.avg_ms ?? 0);

      // Feature adoption
      featureAdoption.languageDistribution = langDistribution.map((r) => ({
        language: r.language,
        count: Number(r.count),
      }));

      // Growth funnel
      const usersWithCardsCount = Number(usersWithCards[0]?.count ?? 0);
      const usersWithReviewsCount = Number(usersWithCardsAndReviews[0]?.count ?? 0);
      growthFunnel.signupToFirstCard = totalUsersCount > 0 ? usersWithCardsCount / totalUsersCount : 0;
      growthFunnel.firstCardToFirstQuiz = usersWithCardsCount > 0 ? usersWithReviewsCount / usersWithCardsCount : 0;
      const day7RetainedCount = Number(day7RetainedUsers[0]?.count ?? 0);
      growthFunnel.day7Retention = usersSignedUpBefore8d > 0 ? day7RetainedCount / usersSignedUpBefore8d : 0;
    } catch (e) {
      console.warn("[admin/metrics] PM metrics queries failed:", e);
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
      retention,
      learning,
      quizPerformance,
      featureAdoption,
      growthFunnel,
    });
  } catch (error) {
    console.error("[admin/metrics] Error:", error);
    return errorResponse(error);
  }
}
