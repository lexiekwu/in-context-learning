import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the db module before importing anything that uses it
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    flashcard: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    reviewLog: {
      findMany: vi.fn(),
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
  flashcard: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  reviewLog: {
    findMany: ReturnType<typeof vi.fn>;
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
    mockDb.reviewLog.findMany.mockResolvedValue([]);

    const result = await computeStreak("user-1");

    expect(result).toBe(0);
  });

  it("counts consecutive days including today", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

    mockDb.reviewLog.findMany.mockResolvedValue([
      { reviewedAt: today },
      { reviewedAt: yesterday },
      { reviewedAt: twoDaysAgo },
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
    mockDb.reviewLog.findMany.mockResolvedValue([
      { reviewedAt: yesterday },
      { reviewedAt: twoDaysAgo },
    ]);

    const result = await computeStreak("user-1");

    expect(result).toBe(2);
  });

  it("returns 0 when there is a gap (most recent review is 3+ days ago)", async () => {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

    mockDb.reviewLog.findMany.mockResolvedValue([
      { reviewedAt: threeDaysAgo },
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

    mockDb.reviewLog.findMany.mockResolvedValue([
      { reviewedAt: today },
      { reviewedAt: yesterday },
      { reviewedAt: threeDaysAgo }, // gap: 2 days ago is missing
    ]);

    const result = await computeStreak("user-1");

    expect(result).toBe(2); // today + yesterday, then gap
  });

  it("handles multiple reviews on the same day (deduplicates)", async () => {
    const today = new Date();

    mockDb.reviewLog.findMany.mockResolvedValue([
      { reviewedAt: new Date(today) },
      { reviewedAt: new Date(today) },
      { reviewedAt: new Date(today) },
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
    mockDb.reviewLog.findMany.mockResolvedValue([
      { overallRating: "GOOD", priorState: "NEW" },
      { overallRating: "GOOD", priorState: "REVIEW" },
      { overallRating: "AGAIN", priorState: "REVIEW" },
      { overallRating: "GOOD", priorState: "NEW" },
    ]);

    const result = await getTodayReviewStats("user-1");

    expect(result.reviewedToday).toBe(4);
    expect(result.correctToday).toBe(3);
    expect(result.newCardsStudied).toBe(2);
    expect(result.accuracy).toBe(0.75);
  });

  it("returns zeros when no reviews today", async () => {
    mockDb.reviewLog.findMany.mockResolvedValue([]);

    const result = await getTodayReviewStats("user-1");

    expect(result.reviewedToday).toBe(0);
    expect(result.correctToday).toBe(0);
    expect(result.newCardsStudied).toBe(0);
    expect(result.accuracy).toBe(0);
  });

  it("filters by today's date", async () => {
    mockDb.reviewLog.findMany.mockResolvedValue([]);

    await getTodayReviewStats("user-1");

    const callArgs = mockDb.reviewLog.findMany.mock.calls[0][0];
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
    // Default: no new cards reviewed today
    mockDb.reviewLog.count.mockResolvedValue(0);
  });

  it("returns learning card first (priority 1)", async () => {
    const learningCard = {
      id: "card-learning",
      state: "LEARNING",
      due: pastDue,
    };
    // getTodayReviewStats (called internally)
    mockDb.reviewLog.findMany
      .mockResolvedValueOnce([]) // getSessionCardIds
      .mockResolvedValueOnce([]) // getTodayReviewStats
      .mockResolvedValueOnce([]); // countReviewsSinceLastNew (not reached)

    // Learning cards query
    mockDb.flashcard.findMany.mockResolvedValueOnce([learningCard]);
    // countRemainingCards queries
    mockDb.flashcard.count
      .mockResolvedValueOnce(5) // due count
      .mockResolvedValueOnce(3); // new count

    const result = await getNextDueCard("user-1", "session-1");

    expect(result.card).toBeDefined();
    expect(result.card!.id).toBe("card-learning");
  });

  it("returns null when no cards available", async () => {
    mockDb.reviewLog.findMany
      .mockResolvedValueOnce([]) // getSessionCardIds
      .mockResolvedValueOnce([]) // getTodayReviewStats
      .mockResolvedValueOnce([]); // countReviewsSinceLastNew

    // No learning, review, or new cards
    mockDb.flashcard.findMany
      .mockResolvedValueOnce([]) // learning cards
      .mockResolvedValueOnce([]) // review cards
      .mockResolvedValueOnce([]); // new cards (interleave)

    mockDb.flashcard.findFirst.mockResolvedValue(null); // no next due

    const result = await getNextDueCard("user-1", "session-1");

    expect(result.card).toBeNull();
    expect(result.cardsRemaining).toBe(0);
  });

  it("excludes extra IDs when provided", async () => {
    // Override the default for getSessionCardIds
    mockDb.reviewLog.findMany.mockReset();
    mockDb.reviewLog.findMany
      .mockResolvedValueOnce([{ flashcardId: "card-a" }]) // getSessionCardIds
      .mockResolvedValueOnce([]) // getTodayReviewStats
      .mockResolvedValueOnce([]); // countReviewsSinceLastNew

    mockDb.flashcard.findMany
      .mockResolvedValueOnce([]) // learning
      .mockResolvedValueOnce([]) // review
      .mockResolvedValueOnce([]); // new (interleave)

    mockDb.flashcard.findFirst.mockResolvedValue(null);

    await getNextDueCard("user-1", "session-1", ["card-b"]);

    // The learning cards query should exclude both card-a and card-b
    const learningQuery = mockDb.flashcard.findMany.mock.calls[0][0];
    expect(learningQuery.where.id.notIn).toContain("card-a");
    expect(learningQuery.where.id.notIn).toContain("card-b");
  });
});
