import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockDbFlashcard,
  mockDbStudySession,
  mockDbReviewLog,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDbFlashcard: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  mockDbStudySession: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockDbReviewLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    flashcard: mockDbFlashcard,
    studySession: mockDbStudySession,
    reviewLog: mockDbReviewLog,
    $transaction: (calls: any) => Promise.all(calls),
  },
}));

vi.mock("@/lib/fsrs", () => ({
  scheduleCard: vi.fn(() => ({})),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => null),
}));

import { POST as submitResultPost } from "@/app/api/quiz/submit-result/route";

const TEST_USER_ID = "user-123";
const TEST_SESSION_ID = "aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee";
const TEST_FLASHCARD_ID = "11111111-2222-3333-8444-555555555555";

describe("POST /api/quiz/submit-result fractional accuracy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID },
    });
    mockDbStudySession.findUnique.mockResolvedValue({
      userId: TEST_USER_ID,
    });
    mockDbFlashcard.findFirst.mockResolvedValue({
      id: TEST_FLASHCARD_ID,
      userId: TEST_USER_ID,
      state: "NEW",
    });
    mockDbFlashcard.update.mockResolvedValue({
      state: "LEARNING",
      due: new Date("2026-03-01T00:00:00Z"),
      stability: 5.0,
      difficulty: 0.3,
    });
    mockDbReviewLog.create.mockResolvedValue({});
    mockDbStudySession.update.mockResolvedValue({
      cardsReviewed: 1,
      cardsCorrect: 0.5,
    });
  });

  it("submits 1.0 points for partial correctness (translation only)", async () => {
    const body = {
      sessionId: TEST_SESSION_ID,
      flashcardId: TEST_FLASHCARD_ID,
      generatedSentence: "你好",
      userTranslation: "Hello",
      correctTranslation: "Hello",
      translationCorrect: true,
      userReading: "ni3hao3",
      readingCorrect: false, // Partial correctness
      overallRating: "AGAIN",
    };

    const req = new Request("http://localhost/api/quiz/submit-result", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await submitResultPost(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    
    // Check the increment value in the mock call
    const sessionUpdateCall = mockDbStudySession.update.mock.calls[0][0];
    expect(sessionUpdateCall.data.cardsReviewed.increment).toBe(2);
    expect(sessionUpdateCall.data.cardsCorrect.increment).toBe(1.0);
  });

  it("submits 1.0 points for partial correctness (reading only)", async () => {
    const body = {
      sessionId: TEST_SESSION_ID,
      flashcardId: TEST_FLASHCARD_ID,
      generatedSentence: "你好",
      userTranslation: "Hi",
      correctTranslation: "Hello",
      translationCorrect: false,
      userReading: "ni3hao3",
      readingCorrect: true, // Partial correctness
      overallRating: "AGAIN",
    };

    const req = new Request("http://localhost/api/quiz/submit-result", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await submitResultPost(req as never);
    
    const sessionUpdateCall = mockDbStudySession.update.mock.calls[0][0];
    expect(sessionUpdateCall.data.cardsReviewed.increment).toBe(2);
    expect(sessionUpdateCall.data.cardsCorrect.increment).toBe(1.0);
  });
});
