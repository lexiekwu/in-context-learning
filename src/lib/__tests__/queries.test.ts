import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the db module before importing anything that uses it
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    flashcard: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    reviewLog: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    studySession: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  getSessionCardIds,
  countNewCardsReviewedToday,
  computeStreak,
  getTodayReviewStats,
  countDueCards,
  getNextDueCard,
} from "@/lib/db/queries";

// Cast to access mock methods
const mockDb = db as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>;
  flashcard: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  reviewLog: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
  };
  studySession: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getSessionCardIds
// ---------------------------------------------------------------------------

describe("getSessionCardIds", () => {
  it("returns correct IDs from review logs", async () => {
    mockDb.reviewLog.findMany.mockResolvedValue([
      { flashcardId: "card-1" },
      { flashcardId: "card-2" },
      { flashcardId: "card-3" },
    ]);

    const result = await getSessionCardIds("session-abc");

    expect(result).toEqual(["card-1", "card-2", "card-3"]);
    expect(mockDb.reviewLog.findMany).toHaveBeenCalledWith({
      where: { sessionId: "session-abc" },
      select: { flashcardId: true },
    });
  });

  it("returns empty array when no cards reviewed in session", async () => {
    mockDb.reviewLog.findMany.mockResolvedValue([]);

    const result = await getSessionCardIds("session-empty");

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// countNewCardsReviewedToday
// ---------------------------------------------------------------------------

describe("countNewCardsReviewedToday", () => {
  it("filters by today's date and priorState=NEW", async () => {
    mockDb.reviewLog.count.mockResolvedValue(5);

    const result = await countNewCardsReviewedToday("user-1");

    expect(result).toBe(5);
    expect(mockDb.reviewLog.count).toHaveBeenCalledTimes(1);

    // Verify the where clause shape
    const callArgs = mockDb.reviewLog.count.mock.calls[0][0];
    expect(callArgs.where.userId).toBe("user-1");
    expect(callArgs.where.priorState).toBe("NEW");
    // reviewedAt should have a gte filter with a Date at midnight UTC
    expect(callArgs.where.reviewedAt).toBeDefined();
    expect(callArgs.where.reviewedAt.gte).toBeInstanceOf(Date);

    // The gte date should be midnight UTC of today
    const gteDate = callArgs.where.reviewedAt.gte as Date;
    expect(gteDate.getUTCHours()).toBe(0);
    expect(gteDate.getUTCMinutes()).toBe(0);
    expect(gteDate.getUTCSeconds()).toBe(0);
    expect(gteDate.getUTCMilliseconds()).toBe(0);
  });

  it("returns 0 when no new cards reviewed today", async () => {
    mockDb.reviewLog.count.mockResolvedValue(0);

    const result = await countNewCardsReviewedToday("user-1");

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeStreak
// ---------------------------------------------------------------------------

describe("computeStreak", () => {
  it("returns 0 when no review data", async () => {
    mockDb.$queryRaw.mockResolvedValue([]);

    const result = await computeStreak("user-1");

    expect(result).toBe(0);
  });

  it("counts consecutive days including today", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

    mockDb.$queryRaw.mockResolvedValue([
      { reviewed_date: today },
      { reviewed_date: yesterday },
      { reviewed_date: twoDaysAgo },
    ]);

    const result = await computeStreak("user-1");

    expect(result).toBe(3);
  });

  it("counts consecutive days starting from yesterday", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

    // No review today, but yesterday and day before
    mockDb.$queryRaw.mockResolvedValue([
      { reviewed_date: yesterday },
      { reviewed_date: twoDaysAgo },
    ]);

    const result = await computeStreak("user-1");

    expect(result).toBe(2);
  });

  it("returns 0 when there is a gap (most recent review is 3+ days ago)", async () => {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

    mockDb.$queryRaw.mockResolvedValue([
      { reviewed_date: threeDaysAgo },
    ]);

    const result = await computeStreak("user-1");

    expect(result).toBe(0);
  });

  it("breaks streak at a gap in consecutive days", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    // Skip a day
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

    mockDb.$queryRaw.mockResolvedValue([
      { reviewed_date: today },
      { reviewed_date: yesterday },
      { reviewed_date: threeDaysAgo }, // gap: 2 days ago is missing
    ]);

    const result = await computeStreak("user-1");

    expect(result).toBe(2); // today + yesterday, then gap
  });

  it("handles multiple reviews on the same day (deduplicates)", async () => {
    const today = new Date();

    mockDb.$queryRaw.mockResolvedValue([
      { reviewed_date: today },
    ]);

    const result = await computeStreak("user-1");

    expect(result).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getTodayReviewStats
// ---------------------------------------------------------------------------

describe("getTodayReviewStats", () => {
  it("returns correct aggregated stats", async () => {
    // Now uses parallel queries: logs (translation/reading), and count of new (priorState NEW)
    mockDb.reviewLog.count.mockResolvedValueOnce(2); // newCardsStudied

    mockDb.reviewLog.findMany.mockResolvedValue([
      { translationCorrect: true, sentenceCorrect: true, readingCorrect: true }, // 2 + 2 = 4 points (max 4)
      { translationCorrect: true, sentenceCorrect: false, readingCorrect: true }, // 1 + 2 = 3 points (max 4)
      { translationCorrect: false, sentenceCorrect: false, readingCorrect: true }, // 0 + 2 = 2 points (max 4)
      { translationCorrect: true, sentenceCorrect: false, readingCorrect: false }, // 1 + 0 = 1 point (max 4)
      { translationCorrect: false, sentenceCorrect: false, readingCorrect: false }, // 0 + 0 = 0 points (max 4)
    ]);

    const result = await getTodayReviewStats("user-1");

    expect(result.reviewedToday).toBe(5);
    expect(result.correctToday).toBe(10);
    expect(result.maxPossibleToday).toBe(20);
    expect(result.newCardsStudied).toBe(2);
    expect(result.accuracy).toBe(0.5);
  });

  it("returns zeros when no reviews today", async () => {
    mockDb.reviewLog.count.mockResolvedValueOnce(0);
    mockDb.reviewLog.findMany.mockResolvedValue([]);

    const result = await getTodayReviewStats("user-1");

    expect(result.reviewedToday).toBe(0);
    expect(result.correctToday).toBe(0);
    expect(result.newCardsStudied).toBe(0);
    expect(result.accuracy).toBe(0);
  });

  it("filters by today's date", async () => {
    mockDb.reviewLog.count.mockResolvedValueOnce(0);
    mockDb.reviewLog.findMany.mockResolvedValue([]);

    await getTodayReviewStats("user-1");

    const callArgs = mockDb.reviewLog.count.mock.calls[0][0];
    expect(callArgs.where.userId).toBe("user-1");
    const gteDate = callArgs.where.reviewedAt.gte as Date;
    expect(gteDate.getUTCHours()).toBe(0);
    expect(gteDate.getUTCMinutes()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countDueCards
// ---------------------------------------------------------------------------

describe("countDueCards", () => {
  it("counts non-NEW cards that are due", async () => {
    mockDb.flashcard.count.mockResolvedValue(42);

    const result = await countDueCards("user-1");

    expect(result).toBe(42);
    const callArgs = mockDb.flashcard.count.mock.calls[0][0];
    expect(callArgs.where.userId).toBe("user-1");
    expect(callArgs.where.state).toEqual({ not: "NEW" });
    expect(callArgs.where.due.lte).toBeInstanceOf(Date);
  });

  it("returns 0 when no cards are due", async () => {
    mockDb.flashcard.count.mockResolvedValue(0);

    const result = await countDueCards("user-1");

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getNextDueCard
// ---------------------------------------------------------------------------

describe("getNextDueCard", () => {
  const now = new Date();
  const pastDue = new Date(now.getTime() - 60000);

  beforeEach(() => {
    // Default: no session cards reviewed
    mockDb.reviewLog.findMany.mockResolvedValue([]);
    // Default: no new cards reviewed today (countNewCardsReviewedToday)
    mockDb.reviewLog.count.mockResolvedValue(0);
    // Default: no last NEW review found (countReviewsSinceLastNew)
    mockDb.reviewLog.findFirst.mockResolvedValue(null);
  });

  it("returns learning card first (priority 1)", async () => {
    const learningCard = {
      id: "card-learning",
      state: "LEARNING",
      due: pastDue,
    };

    // getSessionCardIds
    mockDb.reviewLog.findMany.mockResolvedValueOnce([]);
    // countNewCardsReviewedToday
    mockDb.reviewLog.count.mockResolvedValueOnce(0);

    // Parallel queries: learningCard, reviewCard, reviewsSinceLastNew
    mockDb.flashcard.findFirst
      .mockResolvedValueOnce(learningCard)  // learning card
      .mockResolvedValueOnce(null);         // review card
    mockDb.reviewLog.findFirst.mockResolvedValueOnce(null); // no last NEW review
    mockDb.reviewLog.count.mockResolvedValueOnce(0); // reviews since last new

    // countRemainingCards queries
    mockDb.flashcard.count
      .mockResolvedValueOnce(5) // due count
      .mockResolvedValueOnce(3); // new count

    const result = await getNextDueCard("user-1", "session-1");

    expect(result.card).toBeDefined();
    expect(result.card!.id).toBe("card-learning");
  });

  it("returns null when no cards available", async () => {
    // getSessionCardIds
    mockDb.reviewLog.findMany.mockResolvedValueOnce([]);
    // countNewCardsReviewedToday
    mockDb.reviewLog.count.mockResolvedValueOnce(0);

    // Parallel queries: no learning, no review card
    mockDb.flashcard.findFirst
      .mockResolvedValueOnce(null)  // learning card
      .mockResolvedValueOnce(null)  // review card
      .mockResolvedValueOnce(null)  // new card (priority 3)
      .mockResolvedValueOnce(null); // nextDueCard fallback

    // countReviewsSinceLastNew: no last NEW review, then count all
    mockDb.reviewLog.findFirst.mockResolvedValueOnce(null);
    mockDb.reviewLog.count.mockResolvedValueOnce(0);

    const result = await getNextDueCard("user-1", "session-1");

    expect(result.card).toBeNull();
    expect(result.cardsRemaining).toBe(0);
  });

  it("excludes extra IDs when provided", async () => {
    // getSessionCardIds
    mockDb.reviewLog.findMany.mockReset();
    mockDb.reviewLog.findMany
      .mockResolvedValueOnce([{ flashcardId: "card-a" }]);

    // countNewCardsReviewedToday
    mockDb.reviewLog.count.mockResolvedValueOnce(0);

    // Parallel queries: no learning, no review
    mockDb.flashcard.findFirst
      .mockResolvedValueOnce(null)  // learning
      .mockResolvedValueOnce(null)  // review
      .mockResolvedValueOnce(null)  // new card (priority 3)
      .mockResolvedValueOnce(null); // nextDueCard

    mockDb.reviewLog.findFirst.mockResolvedValueOnce(null);
    mockDb.reviewLog.count.mockResolvedValueOnce(0);

    await getNextDueCard("user-1", "session-1", ["card-b"]);

    // The learning card query (first findFirst call) should exclude both card-a and card-b
    const learningQuery = mockDb.flashcard.findFirst.mock.calls[0][0];
    expect(learningQuery.where.id.notIn).toContain("card-a");
    expect(learningQuery.where.id.notIn).toContain("card-b");
  });
});
