import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  errorResponse,
  unauthorizedError,
} from "@/lib/errors";
import {
  getTodayReviewStats,
  computeStreak,
  countDueCards,
} from "@/lib/db/queries";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/quiz/today-stats
 *
 * Aggregates today's review statistics from ReviewLog records.
 * Also computes the current streak from consecutive study days.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }

    const userId = session.user.id;

    const limited = await checkRateLimit("quiz", userId);
    if (limited) return limited;

    // Run queries in parallel
    const [todayStats, streak, dueToday, nextDueCard] = await Promise.all([
      getTodayReviewStats(userId),
      computeStreak(userId),
      countDueCards(userId),
      // Find the earliest upcoming due card (for cards not yet due)
      db.flashcard.findFirst({
        where: {
          userId,
          due: { gt: new Date() },
          state: { not: "NEW" },
        },
        orderBy: { due: "asc" },
        select: { due: true },
      }),
    ]);

    return NextResponse.json({
      dueToday,
      reviewedToday: todayStats.reviewedToday,
      newToday: todayStats.newCardsStudied,
      correctToday: todayStats.correctToday,
      streak,
      accuracy: todayStats.accuracy,
      nextDueAt: nextDueCard?.due?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
