import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables are available when vi.mock factories run
// ---------------------------------------------------------------------------

const { mockAuth, mockDbFlashcard, mockDbReviewLog, mockDbStudySession } = vi.hoisted(() => ({
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
  mockDbReviewLog: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  mockDbStudySession: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    flashcard: mockDbFlashcard,
    reviewLog: mockDbReviewLog,
    studySession: mockDbStudySession,
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET as getFlashcards, POST as createFlashcard } from "@/app/api/flashcards/route";
import { PUT as updateFlashcard, DELETE as deleteFlashcard } from "@/app/api/flashcards/[id]/route";
import { POST as quickSavePost } from "@/app/api/flashcards/quick-save/route";
import { GET as exportGet } from "@/app/api/flashcards/export/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = "user-123";
const TEST_CARD_ID = "11111111-2222-3333-8444-555555555555";
const NOW = new Date("2026-02-19T10:00:00Z");

function authenticatedSession() {
  mockAuth.mockResolvedValue({
    user: { id: TEST_USER_ID, email: "test@test.com", name: "Test User" },
  });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

function makePostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePutRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(url: string): NextRequest {
  return new NextRequest(new URL(url), {
    method: "DELETE",
  });
}

function mockFlashcard(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_CARD_ID,
    userId: TEST_USER_ID,
    word: "你好",
    pinyin: "ni3hao3",
    englishMeaning: "hello",
    exampleSentence: null,
    state: "NEW" as const,
    due: NOW,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/flashcards
// ---------------------------------------------------------------------------

describe("GET /api/flashcards", () => {
  it("returns paginated results", async () => {
    authenticatedSession();

    const cards = [mockFlashcard(), mockFlashcard({ id: "22222222-3333-4444-5555-666666666666", word: "谢谢" })];

    mockDbFlashcard.count.mockResolvedValue(2);
    mockDbFlashcard.findMany.mockResolvedValue(cards);

    const req = makeGetRequest("http://localhost/api/flashcards?limit=20");
    const res = await getFlashcards(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.flashcards).toHaveLength(2);
    expect(json.totalCount).toBe(2);
    expect(json.hasMore).toBe(false);
    expect(json.nextCursor).toBeNull();
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const req = makeGetRequest("http://localhost/api/flashcards");
    const res = await getFlashcards(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// POST /api/flashcards
// ---------------------------------------------------------------------------

describe("POST /api/flashcards", () => {
  it("creates a card and returns 201", async () => {
    authenticatedSession();

    mockDbFlashcard.findUnique.mockResolvedValue(null); // no duplicate
    mockDbFlashcard.create.mockResolvedValue(mockFlashcard());

    const req = makePostRequest("http://localhost/api/flashcards", {
      word: "你好",
      pinyin: "ni3hao3",
      englishMeaning: "hello",
    });

    const res = await createFlashcard(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.card).toBeDefined();
    expect(json.card.word).toBe("你好");
    expect(json.card.pinyin).toBe("ni3hao3");
    expect(json.card.englishMeaning).toBe("hello");
  });

  it("returns 409 for duplicate word", async () => {
    authenticatedSession();

    mockDbFlashcard.findUnique.mockResolvedValue(mockFlashcard()); // duplicate exists

    const req = makePostRequest("http://localhost/api/flashcards", {
      word: "你好",
      pinyin: "ni3hao3",
      englishMeaning: "hello",
    });

    const res = await createFlashcard(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error.code).toBe("DUPLICATE");
  });

  it("returns 400 for missing required fields", async () => {
    authenticatedSession();

    const req = makePostRequest("http://localhost/api/flashcards", {
      word: "你好",
      // Missing pinyin and englishMeaning
    });

    const res = await createFlashcard(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/flashcards/[id]
// ---------------------------------------------------------------------------

describe("PUT /api/flashcards/[id]", () => {
  it("updates a card successfully", async () => {
    authenticatedSession();

    const existing = mockFlashcard();
    mockDbFlashcard.findFirst.mockResolvedValue(existing);

    const updated = mockFlashcard({ englishMeaning: "hello (greeting)" });
    mockDbFlashcard.update.mockResolvedValue(updated);

    const req = makePutRequest(`http://localhost/api/flashcards/${TEST_CARD_ID}`, {
      englishMeaning: "hello (greeting)",
    });

    const params = Promise.resolve({ id: TEST_CARD_ID });
    const res = await updateFlashcard(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.card).toBeDefined();
    expect(json.card.englishMeaning).toBe("hello (greeting)");
  });

  it("returns 404 for non-existent card", async () => {
    authenticatedSession();
    mockDbFlashcard.findFirst.mockResolvedValue(null);

    const req = makePutRequest(`http://localhost/api/flashcards/${TEST_CARD_ID}`, {
      englishMeaning: "updated meaning",
    });

    const params = Promise.resolve({ id: TEST_CARD_ID });
    const res = await updateFlashcard(req, { params });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for empty update body", async () => {
    authenticatedSession();

    const req = makePutRequest(`http://localhost/api/flashcards/${TEST_CARD_ID}`, {});

    const params = Promise.resolve({ id: TEST_CARD_ID });
    const res = await updateFlashcard(req, { params });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/flashcards/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/flashcards/[id]", () => {
  it("deletes a card successfully", async () => {
    authenticatedSession();

    mockDbFlashcard.findFirst.mockResolvedValue(mockFlashcard());
    mockDbFlashcard.delete.mockResolvedValue(mockFlashcard());

    const req = makeDeleteRequest(`http://localhost/api/flashcards/${TEST_CARD_ID}`);
    const params = Promise.resolve({ id: TEST_CARD_ID });
    const res = await deleteFlashcard(req, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockDbFlashcard.delete).toHaveBeenCalledWith({ where: { id: TEST_CARD_ID } });
  });

  it("returns 404 for non-existent card", async () => {
    authenticatedSession();
    mockDbFlashcard.findFirst.mockResolvedValue(null);

    const req = makeDeleteRequest(`http://localhost/api/flashcards/${TEST_CARD_ID}`);
    const params = Promise.resolve({ id: TEST_CARD_ID });
    const res = await deleteFlashcard(req, { params });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// POST /api/flashcards/quick-save
// ---------------------------------------------------------------------------

describe("POST /api/flashcards/quick-save", () => {
  it("new card returns isDuplicate=false with status 201", async () => {
    authenticatedSession();

    mockDbFlashcard.findUnique.mockResolvedValue(null); // no duplicate
    mockDbFlashcard.create.mockResolvedValue(mockFlashcard());

    const req = makePostRequest("http://localhost/api/flashcards/quick-save", {
      word: "你好",
      pinyin: "ni3hao3",
      englishMeaning: "hello",
    });

    const res = await quickSavePost(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.isDuplicate).toBe(false);
    expect(json.card).toBeDefined();
    expect(json.card.word).toBe("你好");
  });

  it("existing card returns isDuplicate=true with status 200", async () => {
    authenticatedSession();

    mockDbFlashcard.findUnique.mockResolvedValue(mockFlashcard()); // duplicate exists

    const req = makePostRequest("http://localhost/api/flashcards/quick-save", {
      word: "你好",
      pinyin: "ni3hao3",
      englishMeaning: "hello",
    });

    const res = await quickSavePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isDuplicate).toBe(true);
    expect(json.card).toBeDefined();
  });

  it("returns 400 for missing required fields", async () => {
    authenticatedSession();

    const req = makePostRequest("http://localhost/api/flashcards/quick-save", {
      word: "你好",
      // missing pinyin and englishMeaning
    });

    const res = await quickSavePost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------
// GET /api/flashcards/export
// ---------------------------------------------------------------------------

describe("GET /api/flashcards/export", () => {
  it("returns JSON download with Content-Disposition header", async () => {
    authenticatedSession();

    const cards = [
      mockFlashcard(),
      mockFlashcard({ id: "22222222-3333-4444-5555-666666666666", word: "谢谢" }),
    ];
    mockDbFlashcard.findMany.mockResolvedValue(cards);

    const req = makeGetRequest("http://localhost/api/flashcards/export");
    const res = await exportGet(req);
    const json = JSON.parse(await res.text());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("flashcards-export.json");
    expect(json.totalCards).toBe(2);
    expect(json.cards).toHaveLength(2);
    expect(json.exportedAt).toBeDefined();
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const req = makeGetRequest("http://localhost/api/flashcards/export");
    const res = await exportGet(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});
