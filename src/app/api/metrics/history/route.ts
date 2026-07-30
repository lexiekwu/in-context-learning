import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  errorResponse,
  unauthorizedError,
  validationError,
} from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import type { MetricsHistoryEntry, MetricsHistoryResponse } from "@/types";

const VALID_PERIODS = ["7d", "30d", "90d", "all"] as const;
type Period = (typeof VALID_PERIODS)[number];

function periodToDays(period: Period): number | null {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
      return null;
  }
}

/**
 * GET /api/metrics/history?period=30d
 *
 * Returns daily time-series data for review history charts.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }

    const userId = session.user.id;

    const limited = await checkRateLimit("flashcard", userId);
    if (limited) return limited;

    // Parse and validate period param
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period") ?? "30d";

    if (!VALID_PERIODS.includes(periodParam as Period)) {
      throw validationError(
        `Invalid period. Must be one of: ${VALID_PERIODS.join(", ")}`
      );
    }

    const period = periodParam as Period;
    const days = periodToDays(period);

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    if (days !== null) {
      startDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - days + 1
        )
      );
    } else {
      // For "all", find the user's earliest review
      const earliest = await db.reviewLog.findFirst({
        where: { userId },
        orderBy: { reviewedAt: "asc" },
        select: { reviewedAt: true },
      });
      startDate = earliest
        ? new Date(
            Date.UTC(
              earliest.reviewedAt.getUTCFullYear(),
              earliest.reviewedAt.getUTCMonth(),
              earliest.reviewedAt.getUTCDate()
            )
          )
        : new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
          );
    }

    const endDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    // Query review logs and study sessions in parallel
    const [reviewLogs, studySessions] = await Promise.all([
      db.reviewLog.findMany({
        where: {
          userId,
          reviewedAt: { gte: startDate, lte: endDate },
        },
        select: {
          reviewedAt: true,
          translationCorrect: true,
          sentenceCorrect: true,
          readingCorrect: true,
          priorState: true,
        },
      }),
      db.studySession.findMany({
        where: {
          userId,
          startedAt: { gte: startDate, lte: endDate },
        },
        select: {
          startedAt: true,
          endedAt: true,
        },
      }),
    ]);

    // Group review logs by date
    const reviewsByDate = new Map<
      string,
      { total: number; correct: number; maxPossible: number; newCards: number }
    >();

    for (const log of reviewLogs) {
      const dateKey = log.reviewedAt.toISOString().slice(0, 10);
      const entry = reviewsByDate.get(dateKey) ?? {
        total: 0,
        correct: 0,
        maxPossible: 0,
        newCards: 0,
      };
      const lookedAt = 1;
      const translationPts = log.translationCorrect
        ? (log.sentenceCorrect ? 2 : 1)
        : 0;
      const readingPts = log.readingCorrect ? 2 : 0;
      const correct = translationPts + readingPts;
      const maxPts = log.readingCorrect !== null ? 4 : 2;

      entry.total += lookedAt;
      entry.correct += correct;
      entry.maxPossible += maxPts;
      if (log.priorState === "NEW") {
        entry.newCards++;
      }
      reviewsByDate.set(dateKey, entry);
    }

    // Group study session time by date
    const timeByDate = new Map<string, number>();

    for (const session of studySessions) {
      if (!session.endedAt) continue;
      const dateKey = session.startedAt.toISOString().slice(0, 10);
      const durationMs =
        session.endedAt.getTime() - session.startedAt.getTime();
      const durationMin = Math.max(0, durationMs / 60000);
      timeByDate.set(dateKey, (timeByDate.get(dateKey) ?? 0) + durationMin);
    }

    // Build continuous daily entries
    const data: MetricsHistoryEntry[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const reviews = reviewsByDate.get(dateKey);
      const timeSpent = timeByDate.get(dateKey) ?? 0;

      data.push({
        date: dateKey,
        cardsReviewed: reviews?.total ?? 0,
        cardsCorrect: reviews?.correct ?? 0,
        accuracy:
          reviews && reviews.maxPossible > 0
            ? Math.round((reviews.correct / reviews.maxPossible) * 1000) / 10
            : 0,
        newCardsStudied: reviews?.newCards ?? 0,
        timeSpentMinutes: Math.round(timeSpent * 10) / 10,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const response: MetricsHistoryResponse = { period, data };
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
