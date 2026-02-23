import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetToken } = vi.hoisted(() => ({
  mockGetToken: vi.fn(),
}));

vi.mock("next-auth/jwt", () => ({
  getToken: mockGetToken,
}));

// Must mock next/server since we're in a Node test environment
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return actual;
});

import middleware from "@/middleware";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-secret-that-is-at-least-32-chars";
});

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

describe("middleware", () => {
  it("passes through non-API routes", async () => {
    const req = makeRequest("http://localhost:3000/dashboard");
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("passes through /api/auth paths without checking token", async () => {
    const req = makeRequest("http://localhost:3000/api/auth/session");
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("passes through /api/billing/webhook without checking token", async () => {
    const req = makeRequest("http://localhost:3000/api/billing/webhook");
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("returns 401 when getToken returns null", async () => {
    mockGetToken.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/flashcards");
    const res = await middleware(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token has no userId", async () => {
    mockGetToken.mockResolvedValue({ email: "test@test.com" });

    const req = makeRequest("http://localhost:3000/api/flashcards");
    const res = await middleware(req);

    expect(res.status).toBe(401);
  });

  it("passes through when token has valid userId", async () => {
    mockGetToken.mockResolvedValue({ userId: "user-123" });

    const req = makeRequest("http://localhost:3000/api/flashcards");
    const res = await middleware(req);

    expect(res.status).toBe(200);
  });

  it("passes secureCookie=false for HTTP requests", async () => {
    mockGetToken.mockResolvedValue({ userId: "user-123" });

    const req = makeRequest("http://localhost:3000/api/flashcards");
    await middleware(req);

    expect(mockGetToken).toHaveBeenCalledWith(
      expect.objectContaining({ secureCookie: false })
    );
  });

  it("passes secureCookie=true for HTTPS requests", async () => {
    mockGetToken.mockResolvedValue({ userId: "user-123" });

    const req = makeRequest("https://example.com/api/flashcards");
    await middleware(req);

    expect(mockGetToken).toHaveBeenCalledWith(
      expect.objectContaining({ secureCookie: true })
    );
  });
});
