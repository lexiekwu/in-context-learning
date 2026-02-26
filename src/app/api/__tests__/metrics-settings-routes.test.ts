import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockDbFlashcard,
  mockDbReviewLog,
  mockDbStudySession,
  mockDbUser,
  mockGetTodayReviewStats,
  mockComputeStreak,
  mockCountDueCards,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDbFlashcard: {
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  mockDbReviewLog: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  mockDbStudySession: {
    findMany: vi.fn(),
  },
  mockDbUser: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
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
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  db: {
    flashcard: mockDbFlashcard,
    reviewLog: mockDbReviewLog,
    studySession: mockDbStudySession,
    user: mockDbUser,
  },
}));
vi.mock("@/lib/db/queries", () => ({
  getTodayReviewStats: mockGetTodayReviewStats,
  computeStreak: mockComputeStreak,
  countDueCards: mockCountDueCards,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => null),
}));

import { GET as overviewGet } from "@/app/api/metrics/overview/route";
import { GET as historyGet } from "@/app/api/metrics/history/route";
import { GET as settingsGet, PUT as settingsPut } from "@/app/api/user/settings/route";
import { NextRequest } from "next/server";

const TEST_USER_ID = "user-123";

function authenticatedSession() {
  mockAuth.mockResolvedValue({
    user: { id: TEST_USER_ID, email: "test@test.com", name: "Test User" },
  });
}

function unauthenticatedSession() {
  mockAuth.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/metrics/overview
// ---------------------------------------------------------------------------

describe("GET /api/metrics/overview", () => {
  it("returns dashboard stats for authenticated user", async () => {
    authenticatedSession();
    mockDbFlashcard.count.mockResolvedValue(100);
    mockDbFlashcard.groupBy.mockResolvedValue([
      { state: "NEW", _count: { _all: 20 } },
      { state: "REVIEW", _count: { _all: 80 } },
    ]);
    mockDbReviewLog.findMany.mockResolvedValue([
      { overallRating: "GOOD" },
      { overallRating: "GOOD" },
      { overallRating: "AGAIN" },
    ]);

    const res = await overviewGet();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.cardsDueToday).toBe(12);
    expect(json.currentStreak).toBe(5);
    expect(json.totalCards).toBe(100);
    expect(json.cardsByState).toEqual({ NEW: 20, REVIEW: 80 });
    expect(json.todayReviewed).toBe(10);
    expect(typeof json.last7DaysAccuracy).toBe("number");
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const res = await overviewGet();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// GET /api/metrics/history
// ---------------------------------------------------------------------------

describe("GET /api/metrics/history", () => {
  it("returns time-series data for default 30d period", async () => {
    authenticatedSession();
    mockDbReviewLog.findMany.mockResolvedValue([]);
    mockDbStudySession.findMany.mockResolvedValue([]);

    const req = new NextRequest(new URL("http://localhost/api/metrics/history"));
    const res = await historyGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.period).toBe("30d");
    expect(Array.isArray(json.data)).toBe(true);
    // 30d period should produce ~31 entries (today + 30 days back)
    expect(json.data.length).toBeGreaterThanOrEqual(30);
  });

  it("returns 400 for invalid period", async () => {
    authenticatedSession();

    const req = new NextRequest(
      new URL("http://localhost/api/metrics/history?period=invalid")
    );
    const res = await historyGet(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const req = new NextRequest(new URL("http://localhost/api/metrics/history"));
    const res = await historyGet(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// GET /api/user/settings
// ---------------------------------------------------------------------------

describe("GET /api/user/settings", () => {
  it("returns user's language settings", async () => {
    authenticatedSession();
    mockDbUser.findUnique.mockResolvedValue({ targetLanguage: "zh", languageVariant: "TRADITIONAL" });

    const res = await settingsGet();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.targetLanguage).toBe("zh");
    expect(json.languageVariant).toBe("TRADITIONAL");
  });

  it("returns 404 when user not found", async () => {
    authenticatedSession();
    mockDbUser.findUnique.mockResolvedValue(null);

    const res = await settingsGet();
    const json = await res.json();

    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const res = await settingsGet();
    const json = await res.json();

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/user/settings
// ---------------------------------------------------------------------------

describe("PUT /api/user/settings", () => {
  it("updates targetLanguage to Japanese", async () => {
    authenticatedSession();
    mockDbUser.update.mockResolvedValue({ targetLanguage: "ja", languageVariant: null });

    const req = new Request("http://localhost/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: "ja" }),
    });

    const res = await settingsPut(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.targetLanguage).toBe("ja");
    expect(mockDbUser.update).toHaveBeenCalledWith({
      where: { id: TEST_USER_ID },
      data: { targetLanguage: "ja" },
      select: { targetLanguage: true, languageVariant: true },
    });
  });

  it("returns 400 for invalid characterSet value", async () => {
    authenticatedSession();

    const req = new Request("http://localhost/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterSet: "INVALID" }),
    });

    const res = await settingsPut(req);
    const json = await res.json();

    expect(res.status).toBe(400);
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const req = new Request("http://localhost/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterSet: "TRADITIONAL" }),
    });

    const res = await settingsPut(req);
    const json = await res.json();

    expect(res.status).toBe(401);
  });
});
