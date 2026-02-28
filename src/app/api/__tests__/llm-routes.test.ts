import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockDbFlashcard,
  mockDbReviewLog,
  mockDbUser,
  mockCallLLM,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDbFlashcard: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  mockDbReviewLog: {
    findFirst: vi.fn(),
  },
  mockDbUser: {
    findUniqueOrThrow: vi.fn(),
  },
  mockCallLLM: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  db: {
    flashcard: mockDbFlashcard,
    reviewLog: mockDbReviewLog,
    user: mockDbUser,
  },
}));
vi.mock("@/lib/llm/call", () => ({ callLLM: mockCallLLM }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(() => null) }));
vi.mock("@/lib/subscription", () => ({
  checkSubscriptionAccess: vi.fn(() => ({ allowed: true, status: "TRIAL", daysRemaining: 14, trialEndsAt: null })),
}));

import { POST as generateSentencePost } from "@/app/api/quiz/generate-sentence/route";
import { POST as checkTranslationPost } from "@/app/api/quiz/check-translation/route";
import { POST as aiCreatePost } from "@/app/api/flashcards/ai-create/route";
import { NextRequest } from "next/server";

const TEST_USER_ID = "user-123";
const TEST_FLASHCARD_ID = "11111111-2222-3333-8444-555555555555";

function authenticatedSession() {
  mockAuth.mockResolvedValue({
    user: { id: TEST_USER_ID, email: "test@test.com", name: "Test User" },
  });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

function makePost(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockFlashcard = {
  id: TEST_FLASHCARD_ID,
  userId: TEST_USER_ID,
  word: "你好",
  pinyin: "ni3hao3",
  englishMeaning: "hello",
  state: "NEW",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.POE_API_KEY = "test-poe-key";
});

// ---------------------------------------------------------------------------
// POST /api/quiz/generate-sentence
// ---------------------------------------------------------------------------

describe("POST /api/quiz/generate-sentence", () => {
  it("returns LLM-generated sentence on success", async () => {
    authenticatedSession();
    mockDbFlashcard.findFirst.mockResolvedValue(mockFlashcard);
    mockDbReviewLog.findFirst.mockResolvedValue(null); // no cached sentence
    mockDbUser.findUniqueOrThrow.mockResolvedValue({ characterSet: "TRADITIONAL" });
    mockCallLLM.mockResolvedValue({
      sentence: "他說你好。",
      sentenceWithHighlight: "他說<mark>你好</mark>。",
      translation: "He said hello.",
      wordBreakdown: [
        { word: "他", pinyin: "ta1", meaning: "he" },
        { word: "說", pinyin: "shuo1", meaning: "to say" },
        { word: "你好", pinyin: "ni3hao3", meaning: "hello" },
      ],
    });

    const req = makePost("http://localhost/api/quiz/generate-sentence", {
      flashcardId: TEST_FLASHCARD_ID,
    });

    const res = await generateSentencePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sentence).toContain("你好");
    expect(json.wordBreakdown).toHaveLength(3);
    expect(mockCallLLM).toHaveBeenCalled();
  });

  it("returns cached sentence when available", async () => {
    authenticatedSession();
    mockDbFlashcard.findFirst.mockResolvedValue(mockFlashcard);
    mockDbReviewLog.findFirst.mockResolvedValue({
      sentenceResponseJson: JSON.stringify({
        sentence: "你好世界",
        sentenceWithHighlight: "<mark>你好</mark>世界",
        translation: "Hello world",
        wordBreakdown: [
          { word: "你好", pinyin: "ni3hao3", meaning: "hello" },
          { word: "世界", pinyin: "shi4jie4", meaning: "world" },
        ],
      }),
    });

    const req = makePost("http://localhost/api/quiz/generate-sentence", {
      flashcardId: TEST_FLASHCARD_ID,
    });

    const res = await generateSentencePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sentence).toBe("你好世界");
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const req = makePost("http://localhost/api/quiz/generate-sentence", {
      flashcardId: TEST_FLASHCARD_ID,
    });

    const res = await generateSentencePost(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for invalid flashcardId", async () => {
    authenticatedSession();

    const req = makePost("http://localhost/api/quiz/generate-sentence", {
      flashcardId: "not-a-uuid",
    });

    const res = await generateSentencePost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when flashcard not found", async () => {
    authenticatedSession();
    mockDbFlashcard.findFirst.mockResolvedValue(null);

    const req = makePost("http://localhost/api/quiz/generate-sentence", {
      flashcardId: TEST_FLASHCARD_ID,
    });

    const res = await generateSentencePost(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// POST /api/quiz/check-translation
// ---------------------------------------------------------------------------

describe("POST /api/quiz/check-translation", () => {
  it("returns correct: true from LLM", async () => {
    authenticatedSession();
    mockDbFlashcard.findFirst.mockResolvedValue(mockFlashcard);
    mockCallLLM.mockResolvedValue({ correct: true });

    const req = makePost("http://localhost/api/quiz/check-translation", {
      flashcardId: TEST_FLASHCARD_ID,
      generatedSentence: "他說你好。",
      userTranslation: "He said hello.",
    });

    const res = await checkTranslationPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.correct).toBe(true);
  });

  it("returns correct: false from LLM", async () => {
    authenticatedSession();
    mockDbFlashcard.findFirst.mockResolvedValue(mockFlashcard);
    mockCallLLM.mockResolvedValue({ correct: false });

    const req = makePost("http://localhost/api/quiz/check-translation", {
      flashcardId: TEST_FLASHCARD_ID,
      generatedSentence: "他說你好。",
      userTranslation: "He ate rice.",
    });

    const res = await checkTranslationPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.correct).toBe(false);
  });

  it("returns 400 for missing required fields", async () => {
    authenticatedSession();

    const req = makePost("http://localhost/api/quiz/check-translation", {
      flashcardId: TEST_FLASHCARD_ID,
      // missing generatedSentence and userTranslation
    });

    const res = await checkTranslationPost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when flashcard not found", async () => {
    authenticatedSession();
    mockDbFlashcard.findFirst.mockResolvedValue(null);

    const req = makePost("http://localhost/api/quiz/check-translation", {
      flashcardId: TEST_FLASHCARD_ID,
      generatedSentence: "test",
      userTranslation: "test",
    });

    const res = await checkTranslationPost(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// POST /api/flashcards/ai-create
// ---------------------------------------------------------------------------

describe("POST /api/flashcards/ai-create", () => {
  it("returns card suggestion for English input", async () => {
    authenticatedSession();
    mockDbUser.findUniqueOrThrow.mockResolvedValue({ characterSet: "TRADITIONAL" });
    mockCallLLM.mockResolvedValue({
      word: "快樂",
      pinyin: "kuai4le4",
      meaning: "happy",
      exampleSentence: "他很快樂。",
      exampleTranslation: "He is very happy.",
    });
    mockDbFlashcard.findFirst.mockResolvedValue(null); // not duplicate

    const req = makePost("http://localhost/api/flashcards/ai-create", {
      word: "happy",
    });

    const res = await aiCreatePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestion.word).toBe("快樂");
    expect(json.suggestion.pinyin).toBe("kuai4le4");
    expect(json.isDuplicate).toBe(false);
  });

  it("flags duplicate when word already exists", async () => {
    authenticatedSession();
    mockDbUser.findUniqueOrThrow.mockResolvedValue({ characterSet: "TRADITIONAL" });
    mockCallLLM.mockResolvedValue({
      word: "你好",
      pinyin: "ni3hao3",
      meaning: "hello",
      exampleSentence: "你好嗎？",
      exampleTranslation: "How are you?",
    });
    mockDbFlashcard.findFirst.mockResolvedValue(mockFlashcard); // duplicate exists

    const req = makePost("http://localhost/api/flashcards/ai-create", {
      word: "你好",
    });

    const res = await aiCreatePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isDuplicate).toBe(true);
  });

  it("returns 400 for empty word", async () => {
    authenticatedSession();

    const req = makePost("http://localhost/api/flashcards/ai-create", {
      word: "",
    });

    const res = await aiCreatePost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const req = makePost("http://localhost/api/flashcards/ai-create", {
      word: "hello",
    });

    const res = await aiCreatePost(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});
