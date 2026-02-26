import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables are available when vi.mock factories run
// ---------------------------------------------------------------------------

const {
  mockAuth,
  mockDbFlashcard,
  mockDbStudySession,
  mockDbReviewLog,
  mockDbUser,
  mockScheduleCard,
  mockGetTodayReviewStats,
  mockComputeStreak,
  mockCountDueCards,
  mockGetNextDueCard,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDbFlashcard: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockDbStudySession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  mockDbReviewLog: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  mockDbUser: {
    findUniqueOrThrow: vi.fn(),
  },
  mockScheduleCard: vi.fn(() => ({
    due: new Date("2026-03-01T00:00:00Z"),
    stability: 5.0,
    difficulty: 0.3,
    elapsed_days: 1,
    scheduled_days: 10,
    reps: 1,
    lapses: 0,
    state: "LEARNING",
    lastReview: new Date("2026-02-19T00:00:00Z"),
  })),
  mockGetTodayReviewStats: vi.fn(() =>
    Promise.resolve({
      reviewedToday: 10,
      correctToday: 8,
      newCardsStudied: 3,
      accuracy: 0.8,
    })
  ),
  mockComputeStreak: vi.fn(() => Promise.resolve(5)),
  mockCountDueCards: vi.fn(() => Promise.resolve(12)),
  mockGetNextDueCard: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    flashcard: mockDbFlashcard,
    studySession: mockDbStudySession,
    reviewLog: mockDbReviewLog,
    user: mockDbUser,
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/fsrs", () => ({
  scheduleCard: mockScheduleCard,
}));

vi.mock("@/lib/db/queries", () => ({
  getTodayReviewStats: mockGetTodayReviewStats,
  computeStreak: mockComputeStreak,
  countDueCards: mockCountDueCards,
  getNextDueCard: mockGetNextDueCard,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { POST as startPost } from "@/app/api/quiz/start/route";
import { POST as checkReadingPost } from "@/app/api/quiz/check-reading/route";
import { POST as submitResultPost } from "@/app/api/quiz/submit-result/route";
import { GET as todayStatsGet } from "@/app/api/quiz/today-stats/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = "user-123";
const TEST_SESSION_ID = "aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee";
const TEST_FLASHCARD_ID = "11111111-2222-3333-8444-555555555555";

function authenticatedSession() {
  mockAuth.mockResolvedValue({
    user: { id: TEST_USER_ID, email: "test@test.com", name: "Test User" },
  });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

function makeRequest(url: string, body?: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/quiz/start
// ---------------------------------------------------------------------------

describe("POST /api/quiz/start", () => {
  it("creates a session and returns sessionId", async () => {
    authenticatedSession();
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      subscriptionStatus: "TRIAL",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const now = new Date("2026-02-19T10:00:00Z");
    mockDbStudySession.create.mockResolvedValue({
      id: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      startedAt: now,
      endedAt: null,
      cardsReviewed: 0,
      cardsCorrect: 0,
    });

    const res = await startPost();
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.sessionId).toBe(TEST_SESSION_ID);
    expect(json.startedAt).toBe(now.toISOString());
    expect(mockDbStudySession.create).toHaveBeenCalledWith({
      data: { userId: TEST_USER_ID },
    });
  });

  it("rejects unauthenticated request with 401", async () => {
    unauthenticatedSession();

    const res = await startPost();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// POST /api/quiz/check-reading
// ---------------------------------------------------------------------------

describe("POST /api/quiz/check-reading", () => {
  it("returns correct: true for matching reading", async () => {
    authenticatedSession();
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      targetLanguage: "zh",
    });
    mockDbFlashcard.findFirst.mockResolvedValue({
      id: TEST_FLASHCARD_ID,
      pinyin: "ni3hao3",
      userId: TEST_USER_ID,
    });

    const req = makeRequest("http://localhost/api/quiz/check-reading", {
      flashcardId: TEST_FLASHCARD_ID,
      userReading: "ni3hao3",
    });

    const res = await checkReadingPost(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.correct).toBe(true);
    expect(json.correctReading).toBe("ni3hao3");
  });

  it("returns correct: false for incorrect reading", async () => {
    authenticatedSession();
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      targetLanguage: "zh",
    });
    mockDbFlashcard.findFirst.mockResolvedValue({
      id: TEST_FLASHCARD_ID,
      pinyin: "ni3hao3",
      userId: TEST_USER_ID,
    });

    const req = makeRequest("http://localhost/api/quiz/check-reading", {
      flashcardId: TEST_FLASHCARD_ID,
      userReading: "ni2hao3",
    });

    const res = await checkReadingPost(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.correct).toBe(false);
  });

  it("returns 400 for invalid flashcardId", async () => {
    authenticatedSession();
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      targetLanguage: "zh",
    });

    const req = makeRequest("http://localhost/api/quiz/check-reading", {
      flashcardId: "not-a-uuid",
      userReading: "ni3hao3",
    });

    const res = await checkReadingPost(req as never);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for phonetic language", async () => {
    authenticatedSession();
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      targetLanguage: "es",
    });

    const req = makeRequest("http://localhost/api/quiz/check-reading", {
      flashcardId: TEST_FLASHCARD_ID,
      userReading: "hola",
    });

    const res = await checkReadingPost(req as never);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("INVALID_OPERATION");
  });

  it("returns 404 when flashcard not found", async () => {
    authenticatedSession();
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      targetLanguage: "zh",
    });
    mockDbFlashcard.findFirst.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/quiz/check-reading", {
      flashcardId: TEST_FLASHCARD_ID,
      userReading: "ni3hao3",
    });

    const res = await checkReadingPost(req as never);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// POST /api/quiz/submit-result
// ---------------------------------------------------------------------------

describe("POST /api/quiz/submit-result", () => {
  const validBody = {
    sessionId: TEST_SESSION_ID,
    flashcardId: TEST_FLASHCARD_ID,
    generatedSentence: "你好世界",
    userTranslation: "Hello world",
    correctTranslation: "Hello world",
    translationCorrect: true,
    userReading: "ni3hao3",
    readingCorrect: true,
    overallRating: "GOOD",
    responseTimeMs: 5000,
  };

  it("valid submission updates card and creates review log", async () => {
    authenticatedSession();

    mockDbStudySession.findUnique.mockResolvedValue({
      userId: TEST_USER_ID,
    });

    const mockFlashcard = {
      id: TEST_FLASHCARD_ID,
      userId: TEST_USER_ID,
      word: "你好",
      pinyin: "ni3hao3",
      englishMeaning: "hello",
      state: "NEW",
      due: new Date(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      lastReview: null,
    };

    mockDbFlashcard.findFirst.mockResolvedValue(mockFlashcard);

    const updatedCard = {
      ...mockFlashcard,
      state: "LEARNING",
      due: new Date("2026-03-01T00:00:00Z"),
      stability: 5.0,
      difficulty: 0.3,
    };

    const updatedSession = {
      id: TEST_SESSION_ID,
      cardsReviewed: 1,
      cardsCorrect: 1,
    };

    (db as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction.mockResolvedValue([
      updatedCard,
      {}, // review log
      updatedSession,
    ]);

    const req = makeRequest("http://localhost/api/quiz/submit-result", validBody);
    const res = await submitResultPost(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.updatedCard).toBeDefined();
    expect(json.updatedCard.state).toBe("LEARNING");
    expect(json.sessionStats.cardsReviewed).toBe(1);
    expect(json.sessionStats.cardsCorrect).toBe(1);
  });

  it("returns 400 for missing required fields", async () => {
    authenticatedSession();

    const req = makeRequest("http://localhost/api/quiz/submit-result", {
      sessionId: TEST_SESSION_ID,
      // Missing flashcardId and other required fields
    });

    const res = await submitResultPost(req as never);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const req = makeRequest("http://localhost/api/quiz/submit-result", validBody);
    const res = await submitResultPost(req as never);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// GET /api/quiz/today-stats
// ---------------------------------------------------------------------------

describe("GET /api/quiz/today-stats", () => {
  it("returns stats shape with expected fields", async () => {
    authenticatedSession();

    // Mock the findFirst for next due card
    mockDbFlashcard.findFirst.mockResolvedValue({
      due: new Date("2026-02-20T08:00:00Z"),
    });

    const res = await todayStatsGet();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("dueToday");
    expect(json).toHaveProperty("reviewedToday");
    expect(json).toHaveProperty("newToday");
    expect(json).toHaveProperty("correctToday");
    expect(json).toHaveProperty("streak");
    expect(json).toHaveProperty("accuracy");
    expect(json).toHaveProperty("nextDueAt");
    expect(typeof json.dueToday).toBe("number");
    expect(typeof json.reviewedToday).toBe("number");
    expect(typeof json.streak).toBe("number");
    expect(typeof json.accuracy).toBe("number");
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const res = await todayStatsGet();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});
