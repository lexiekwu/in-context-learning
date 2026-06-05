import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  errorResponse,
  unauthorizedError,
} from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getTodayReviewStats,
  computeStreak,
  countDueCards,
} from "@/lib/db/queries";

/**
 * GET /api/metrics/overview
 *
 * Returns dashboard-level stats: cards by state, due today,
 * streak, accuracy, and today's review count.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }

    const userId = session.user.id;

    const limited = await checkRateLimit("flashcard", userId);
    if (limited) return limited;

    // Run all queries in parallel
    const [todayStats, streak, dueToday, totalCards, cardsByStateRaw] =
      await Promise.all([
        getTodayReviewStats(userId),
        computeStreak(userId),
        countDueCards(userId),
        db.flashcard.count({ where: { userId } }),
        db.flashcard.groupBy({
          by: ["state"],
          where: { userId },
          _count: { _all: true },
        }),
      ]);

    // Convert groupBy result to Record<string, number>
    const cardsByState: Record<string, number> = {};
    for (const group of cardsByStateRaw) {
      cardsByState[group.state] = group._count._all;
    }

    // 7-day accuracy: fetch review logs from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const recentReviews = await db.reviewLog.findMany({
      where: {
        userId,
        reviewedAt: { gte: sevenDaysAgo },
      },
      select: { translationCorrect: true, readingCorrect: true },
    });

    let totalLookedAt = 0;
    let totalCorrect = 0;
    for (const r of recentReviews) {
      totalLookedAt += 1;
      totalCorrect +=
        r.readingCorrect !== null
          ? (r.translationCorrect ? 0.5 : 0) + (r.readingCorrect ? 0.5 : 0)
          : (r.translationCorrect ? 1.0 : 0);
    }

    const last7DaysAccuracy =
      totalLookedAt > 0
        ? (totalCorrect / totalLookedAt) * 100
        : 0;

    return NextResponse.json({
      cardsDueToday: dueToday,
      currentStreak: streak,
      last7DaysAccuracy,
      totalCards,
      cardsByState,
      todayReviewed: todayStats.reviewedToday,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
