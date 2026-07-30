import { db } from "@/lib/db";
import type { Flashcard } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns midnight (00:00:00.000) of the current day in UTC. */
function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

// ---------------------------------------------------------------------------
// Card selection queries
// ---------------------------------------------------------------------------

/**
 * Get the next due card for a user, following the priority order from
 * 03-srs-algorithm.md Section 4:
 *
 *  1. Learning/Relearning cards that are due (ordered by due ASC)
 *  2. Overdue Review cards (ordered by due ASC = most overdue first)
 *  3. New cards (interleaved 1:5 with reviews)
 *
 * Cards already reviewed in the current session are excluded.
 */
export async function getNextDueCard(
  userId: string,
  sessionId: string,
  extraExcludeIds: string[] = [],
  language?: string,
): Promise<{
  card: Flashcard | null;
  cardsRemaining: number;
  newCardsRemaining: number;
  nextDueAt: Date | null;
}> {
  const now = new Date();
  const todayStart = startOfTodayUTC();

  // Get session cards and today's new card count in parallel
  const [reviewedIds, newCardsStudiedToday] = await Promise.all([
    getSessionCardIds(sessionId),
    countNewCardsReviewedToday(userId),
  ]);
  const sessionCardIds = extraExcludeIds.length > 0
    ? [...new Set([...reviewedIds, ...extraExcludeIds])]
    : reviewedIds;

  const newCardLimit = 20;
  const newCardsRemaining = Math.max(
    0,
    newCardLimit - newCardsStudiedToday
  );

  // Language filter — only quiz cards in the user's active language
  const langFilter = language ? { language } : {};

  // Fetch priority 1 (learning) and priority 2 (review) candidates in parallel
  // Use take: 1 since we only need the top card from each category
  const [learningCard, reviewCard, reviewsSinceLastNew] = await Promise.all([
    db.flashcard.findFirst({
      where: {
        userId,
        ...langFilter,
        due: { lte: now },
        state: { in: ["LEARNING", "RELEARNING"] },
        id: { notIn: sessionCardIds },
      },
      orderBy: { due: "asc" },
    }),
    db.flashcard.findFirst({
      where: {
        userId,
        ...langFilter,
        due: { lte: now },
        state: "REVIEW",
        id: { notIn: sessionCardIds },
      },
      orderBy: { due: "asc" },
    }),
    countReviewsSinceLastNew(userId, todayStart),
  ]);

  // Select the card based on priority, then compute remaining count once at the end
  let selectedCard: Flashcard | null = null;

  // Priority 1: Learning/Relearning cards that are due
  if (learningCard) {
    selectedCard = learningCard;
  }

  // Priority 2 (with interleaving): Check if we should show a new card
  // Interleave 1 new card after every 5 review cards
  if (
    !selectedCard &&
    reviewsSinceLastNew >= 5 &&
    newCardsRemaining > 0
  ) {
    selectedCard = await db.flashcard.findFirst({
      where: {
        userId,
        ...langFilter,
        state: "NEW",
        id: { notIn: sessionCardIds },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  // Priority 2 continued: Overdue review cards
  if (!selectedCard && reviewCard) {
    selectedCard = reviewCard;
  }

  // Priority 3: New cards (if under daily limit)
  if (!selectedCard && newCardsRemaining > 0) {
    selectedCard = await db.flashcard.findFirst({
      where: {
        userId,
        ...langFilter,
        state: "NEW",
        id: { notIn: sessionCardIds },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  // Compute remaining count once for the selected card
  if (selectedCard) {
    const remaining = await countRemainingCards(
      userId,
      sessionCardIds,
      newCardsRemaining,
      language
    );
    return {
      card: selectedCard,
      cardsRemaining: remaining,
      newCardsRemaining,
      nextDueAt: null,
    };
  }

  // No cards available — find the next due date
  const nextDueCard = await db.flashcard.findFirst({
    where: {
      userId,
      ...langFilter,
      state: { not: "NEW" },
      id: { notIn: sessionCardIds },
    },
    orderBy: { due: "asc" },
    select: { due: true },
  });

  return {
    card: null,
    cardsRemaining: 0,
    newCardsRemaining,
    nextDueAt: nextDueCard?.due ?? null,
  };
}

// ---------------------------------------------------------------------------
// Today stats
// ---------------------------------------------------------------------------

export interface TodayReviewStats {
  reviewedToday: number;
  correctToday: number;
  newCardsStudied: number;
  accuracy: number;
  maxPossibleToday: number;
}

/**
 * Aggregate today's review data from ReviewLog records.
 * Uses count queries instead of fetching all records.
 */
export async function getTodayReviewStats(
  userId: string
): Promise<TodayReviewStats> {
  const todayStart = startOfTodayUTC();
  const baseWhere = { userId, reviewedAt: { gte: todayStart } };

  const [logs, newCardsStudied] = await Promise.all([
    db.reviewLog.findMany({
      where: baseWhere,
      select: {
        translationCorrect: true,
        sentenceCorrect: true,
        readingCorrect: true,
      },
    }),
    db.reviewLog.count({ where: { ...baseWhere, priorState: "NEW" } }),
  ]);

  const reviewedToday = logs.length;

  const correctToday = logs.reduce((acc, log) => {
    const translationPts = log.translationCorrect
      ? (log.sentenceCorrect ? 2 : 1)
      : 0;
    const readingPts = log.readingCorrect ? 2 : 0;
    return acc + translationPts + readingPts;
  }, 0);

  const maxPossibleToday = logs.reduce((acc, log) => {
    return acc + (log.readingCorrect !== null ? 4 : 2);
  }, 0);

  const accuracy = maxPossibleToday > 0 ? correctToday / maxPossibleToday : 0;

  return { reviewedToday, correctToday, newCardsStudied, accuracy, maxPossibleToday };
}

// ---------------------------------------------------------------------------
// New card limit tracking
// ---------------------------------------------------------------------------

/**
 * Count how many new cards the user has reviewed today.
 * A "new card review" is a ReviewLog where priorState = NEW.
 */
export async function countNewCardsReviewedToday(
  userId: string
): Promise<number> {
  const todayStart = startOfTodayUTC();

  const count = await db.reviewLog.count({
    where: {
      userId,
      reviewedAt: { gte: todayStart },
      priorState: "NEW",
    },
  });

  return count;
}

// ---------------------------------------------------------------------------
// Session card tracking
// ---------------------------------------------------------------------------

/**
 * Get the flashcard IDs already reviewed in this session.
 */
export async function getSessionCardIds(
  sessionId: string
): Promise<string[]> {
  const logs = await db.reviewLog.findMany({
    where: { sessionId },
    select: { flashcardId: true },
  });

  return logs.map((l) => l.flashcardId);
}

// ---------------------------------------------------------------------------
// Streak calculation
// ---------------------------------------------------------------------------

/**
 * Compute the user's current study streak.
 * A streak day is any calendar day (UTC) where at least 1 review was logged.
 * The streak counts consecutive days going backward from today.
 */
export async function computeStreak(userId: string): Promise<number> {
  const todayStart = startOfTodayUTC();

  // Get distinct review dates (UTC day) ordered descending
  // We look back up to 365 days to find the streak
  const yearAgo = new Date(todayStart);
  yearAgo.setUTCDate(yearAgo.getUTCDate() - 365);

  const reviews = await db.$queryRaw<Array<{ reviewed_date: string | Date }>>`
    SELECT DISTINCT DATE_TRUNC('day', "reviewedAt") AS reviewed_date
    FROM "ReviewLog"
    WHERE "userId" = ${userId}::uuid
      AND "reviewedAt" >= ${yearAgo}
    ORDER BY reviewed_date DESC
  `;

  if (reviews.length === 0) return 0;

  // Collect unique dates as YYYY-MM-DD strings
  const uniqueDates = new Set<string>();
  for (const r of reviews) {
    const d = new Date(r.reviewed_date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    uniqueDates.add(key);
  }

  // Sort descending
  const sortedDates = [...uniqueDates].sort().reverse();

  // Check if today or yesterday is the most recent date
  const todayKey = `${todayStart.getUTCFullYear()}-${String(todayStart.getUTCMonth() + 1).padStart(2, "0")}-${String(todayStart.getUTCDate()).padStart(2, "0")}`;
  const yesterday = new Date(todayStart);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;

  // Streak only counts if the most recent review is today or yesterday
  if (sortedDates[0] !== todayKey && sortedDates[0] !== yesterdayKey) {
    return 0;
  }

  // Count consecutive days
  let streak = 0;
  let expectedDate = new Date(todayStart);

  // If the most recent review is yesterday (not today), start from yesterday
  if (sortedDates[0] !== todayKey) {
    expectedDate = yesterday;
  }

  for (const dateStr of sortedDates) {
    const expectedKey = `${expectedDate.getUTCFullYear()}-${String(expectedDate.getUTCMonth() + 1).padStart(2, "0")}-${String(expectedDate.getUTCDate()).padStart(2, "0")}`;
    if (dateStr === expectedKey) {
      streak++;
      expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
    } else if (dateStr < expectedKey) {
      // There's a gap — streak broken
      break;
    }
    // If dateStr > expectedKey, skip (duplicate in sorted list shouldn't happen with Set)
  }

  return streak;
}

// ---------------------------------------------------------------------------
// Due card count
// ---------------------------------------------------------------------------

/**
 * Count cards currently due for the user.
 */
export async function countDueCards(userId: string, language?: string): Promise<number> {
  const now = new Date();
  const langFilter = language ? { language } : {};
  return db.flashcard.count({
    where: {
      userId,
      ...langFilter,
      due: { lte: now },
      state: { not: "NEW" },
    },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Count reviews since the last new card was studied today.
 * Used for the 1:5 interleaving ratio.
 * Optimized: find the most recent NEW review, then count reviews after it.
 */
async function countReviewsSinceLastNew(
  userId: string,
  todayStart: Date
): Promise<number> {
  // Find the most recent NEW card review today
  const lastNewReview = await db.reviewLog.findFirst({
    where: {
      userId,
      reviewedAt: { gte: todayStart },
      priorState: "NEW",
    },
    orderBy: { reviewedAt: "desc" },
    select: { reviewedAt: true },
  });

  if (!lastNewReview) {
    // No new cards studied today — count all reviews today
    return db.reviewLog.count({
      where: {
        userId,
        reviewedAt: { gte: todayStart },
      },
    });
  }

  // Count reviews after the last new card review
  return db.reviewLog.count({
    where: {
      userId,
      reviewedAt: { gt: lastNewReview.reviewedAt },
    },
  });
}

/**
 * Estimate total remaining cards for the session (due + new available).
 */
async function countRemainingCards(
  userId: string,
  excludeIds: string[],
  newCardsRemaining: number,
  language?: string
): Promise<number> {
  const now = new Date();
  const langFilter = language ? { language } : {};

  const [dueCount, newAvailable] = await Promise.all([
    db.flashcard.count({
      where: {
        userId,
        ...langFilter,
        due: { lte: now },
        state: { not: "NEW" },
        id: { notIn: excludeIds },
      },
    }),
    db.flashcard.count({
      where: {
        userId,
        ...langFilter,
        state: "NEW",
        id: { notIn: excludeIds },
      },
    }),
  ]);

  return dueCount + Math.min(newAvailable, newCardsRemaining);
}
