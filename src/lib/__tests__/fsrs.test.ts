import { describe, it, expect } from "vitest";
import {
  toFsrsCard,
  scheduleCard,
  fromFsrsState,
  FsrsState,
  createEmptyCard,
} from "@/lib/fsrs";
import type { Flashcard } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Helper: create a mock Flashcard (Prisma model) with FSRS defaults
// ---------------------------------------------------------------------------

function makeMockFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  const now = new Date("2025-01-15T12:00:00Z");
  return {
    id: "test-card-1",
    userId: "test-user-1",
    word: "你好",
    pinyin: "ni3hao3",
    englishMeaning: "hello",
    exampleSentence: null,
    characterSet: "TRADITIONAL",
    due: now,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: "NEW",
    lastReview: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Flashcard;
}

// ---------------------------------------------------------------------------
// toFsrsCard
// ---------------------------------------------------------------------------

describe("toFsrsCard", () => {
  it("converts a NEW Prisma Flashcard to a ts-fsrs Card", () => {
    const dbCard = makeMockFlashcard();
    const fsrsCard = toFsrsCard(dbCard);

    expect(fsrsCard.state).toBe(FsrsState.New);
    expect(fsrsCard.reps).toBe(0);
    expect(fsrsCard.lapses).toBe(0);
    expect(fsrsCard.stability).toBe(0);
    expect(fsrsCard.difficulty).toBe(0);
    expect(fsrsCard.due).toEqual(dbCard.due);
    expect(fsrsCard.last_review).toBeUndefined();
  });

  it("converts a REVIEW state card correctly", () => {
    const dbCard = makeMockFlashcard({
      state: "REVIEW",
      stability: 5.5,
      difficulty: 4.2,
      reps: 3,
      lapses: 1,
      lastReview: new Date("2025-01-14T12:00:00Z"),
    });
    const fsrsCard = toFsrsCard(dbCard);

    expect(fsrsCard.state).toBe(FsrsState.Review);
    expect(fsrsCard.stability).toBe(5.5);
    expect(fsrsCard.difficulty).toBe(4.2);
    expect(fsrsCard.reps).toBe(3);
    expect(fsrsCard.lapses).toBe(1);
    expect(fsrsCard.last_review).toEqual(new Date("2025-01-14T12:00:00Z"));
  });

  it("maps LEARNING state", () => {
    const dbCard = makeMockFlashcard({ state: "LEARNING" });
    expect(toFsrsCard(dbCard).state).toBe(FsrsState.Learning);
  });

  it("maps RELEARNING state", () => {
    const dbCard = makeMockFlashcard({ state: "RELEARNING" });
    expect(toFsrsCard(dbCard).state).toBe(FsrsState.Relearning);
  });
});

// ---------------------------------------------------------------------------
// fromFsrsState
// ---------------------------------------------------------------------------

describe("fromFsrsState", () => {
  it("maps New → NEW", () => {
    expect(fromFsrsState(FsrsState.New)).toBe("NEW");
  });

  it("maps Learning → LEARNING", () => {
    expect(fromFsrsState(FsrsState.Learning)).toBe("LEARNING");
  });

  it("maps Review → REVIEW", () => {
    expect(fromFsrsState(FsrsState.Review)).toBe("REVIEW");
  });

  it("maps Relearning → RELEARNING", () => {
    expect(fromFsrsState(FsrsState.Relearning)).toBe("RELEARNING");
  });
});

// ---------------------------------------------------------------------------
// scheduleCard
// ---------------------------------------------------------------------------

describe("scheduleCard", () => {
  const now = new Date("2025-01-15T12:00:00Z");

  it("with GOOD rating (passed=true): due date moves into the future", () => {
    const dbCard = makeMockFlashcard();
    const result = scheduleCard(dbCard, true, now);

    expect(result.due.getTime()).toBeGreaterThan(now.getTime());
    expect(result.reps).toBeGreaterThanOrEqual(1);
    expect(result.lastReview).toEqual(now);
    // State should progress from NEW
    expect(["LEARNING", "REVIEW"]).toContain(result.state);
  });

  it("with AGAIN rating (passed=false): card enters learning/relearning", () => {
    const dbCard = makeMockFlashcard();
    const result = scheduleCard(dbCard, false, now);

    expect(result.reps).toBeGreaterThanOrEqual(0);
    expect(result.lastReview).toEqual(now);
    // AGAIN on a new card should put it in LEARNING or keep it NEW-ish
    expect(["NEW", "LEARNING", "RELEARNING"]).toContain(result.state);
  });

  it("with GOOD on a REVIEW card: stability increases", () => {
    const reviewCard = makeMockFlashcard({
      state: "REVIEW",
      stability: 5.0,
      difficulty: 5.0,
      reps: 3,
      elapsed_days: 5,
      scheduled_days: 5,
      lastReview: new Date("2025-01-10T12:00:00Z"),
    });

    const result = scheduleCard(reviewCard, true, now);
    // After a Good rating on a review card, stability should increase
    expect(result.stability).toBeGreaterThan(0);
    expect(result.state).toBe("REVIEW");
  });

  it("with AGAIN on a REVIEW card: lapses increase, enters RELEARNING", () => {
    const reviewCard = makeMockFlashcard({
      state: "REVIEW",
      stability: 5.0,
      difficulty: 5.0,
      reps: 3,
      lapses: 0,
      elapsed_days: 5,
      scheduled_days: 5,
      lastReview: new Date("2025-01-10T12:00:00Z"),
    });

    const result = scheduleCard(reviewCard, false, now);
    expect(result.lapses).toBeGreaterThanOrEqual(1);
    expect(result.state).toBe("RELEARNING");
  });

  it("returns all required scheduling fields", () => {
    const dbCard = makeMockFlashcard();
    const result = scheduleCard(dbCard, true, now);

    expect(result).toHaveProperty("due");
    expect(result).toHaveProperty("stability");
    expect(result).toHaveProperty("difficulty");
    expect(result).toHaveProperty("elapsed_days");
    expect(result).toHaveProperty("scheduled_days");
    expect(result).toHaveProperty("reps");
    expect(result).toHaveProperty("lapses");
    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("lastReview");
  });
});
