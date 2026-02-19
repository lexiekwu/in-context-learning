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
