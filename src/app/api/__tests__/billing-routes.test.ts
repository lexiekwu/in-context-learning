import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockDbUser,
  mockCheckSubscriptionAccess,
  mockStripe,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDbUser: {
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mockCheckSubscriptionAccess: vi.fn(),
  mockStripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ db: { user: mockDbUser } }));
vi.mock("@/lib/subscription", () => ({
  checkSubscriptionAccess: mockCheckSubscriptionAccess,
}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => mockStripe }));
vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
    STRIPE_SECRET_KEY: "sk_test_key",
    STRIPE_MONTHLY_PRICE_ID: "price_test",
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(() => null) }));

import { GET as billingStatusGet } from "@/app/api/billing/status/route";
import { POST as webhookPost } from "@/app/api/billing/webhook/route";
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
// GET /api/billing/status
// ---------------------------------------------------------------------------

describe("GET /api/billing/status", () => {
  it("returns subscription status for authenticated user", async () => {
    authenticatedSession();
    const trialEnd = new Date("2026-03-01T00:00:00Z");
    mockCheckSubscriptionAccess.mockResolvedValue({
      allowed: true,
      status: "TRIAL",
      daysRemaining: 5,
      trialEndsAt: trialEnd,
    });

    const res = await billingStatusGet();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("TRIAL");
    expect(json.canAccessQuiz).toBe(true);
    expect(json.daysRemaining).toBe(5);
    expect(json.trialEndsAt).toBe(trialEnd.toISOString());
  });

  it("returns 401 for unauthenticated request", async () => {
    unauthenticatedSession();

    const res = await billingStatusGet();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/webhook
// ---------------------------------------------------------------------------

describe("POST /api/billing/webhook", () => {
  it("handles checkout.session.completed event", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: TEST_USER_ID },
          customer: "cus_test_123",
          subscription: "sub_test_123",
        },
      },
    });
    mockDbUser.update.mockResolvedValue({});

    const req = new NextRequest(new URL("http://localhost/api/billing/webhook"), {
      method: "POST",
      headers: { "stripe-signature": "test_sig" },
      body: "test_body",
    });

    const res = await webhookPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockDbUser.update).toHaveBeenCalledWith({
      where: { id: TEST_USER_ID },
      data: {
        subscriptionStatus: "ACTIVE",
        stripeCustomerId: "cus_test_123",
        stripeSubscriptionId: "sub_test_123",
      },
    });
  });

  it("handles invoice.paid event", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "invoice.paid",
      data: { object: { customer: "cus_test_123" } },
    });
    mockDbUser.updateMany.mockResolvedValue({ count: 1 });

    const req = new NextRequest(new URL("http://localhost/api/billing/webhook"), {
      method: "POST",
      headers: { "stripe-signature": "test_sig" },
      body: "test_body",
    });

    const res = await webhookPost(req);

    expect(res.status).toBe(200);
    expect(mockDbUser.updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_test_123" },
      data: { subscriptionStatus: "ACTIVE" },
    });
  });

  it("handles invoice.payment_failed event", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_test_123" } },
    });
    mockDbUser.updateMany.mockResolvedValue({ count: 1 });

    const req = new NextRequest(new URL("http://localhost/api/billing/webhook"), {
      method: "POST",
      headers: { "stripe-signature": "test_sig" },
      body: "test_body",
    });

    const res = await webhookPost(req);

    expect(res.status).toBe(200);
    expect(mockDbUser.updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_test_123" },
      data: { subscriptionStatus: "LAPSED" },
    });
  });

  it("handles customer.subscription.deleted event", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_test_123" } },
    });
    mockDbUser.updateMany.mockResolvedValue({ count: 1 });

    const req = new NextRequest(new URL("http://localhost/api/billing/webhook"), {
      method: "POST",
      headers: { "stripe-signature": "test_sig" },
      body: "test_body",
    });

    const res = await webhookPost(req);

    expect(res.status).toBe(200);
    expect(mockDbUser.updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_test_123" },
      data: { subscriptionStatus: "CANCELLED" },
    });
  });

  it("returns 400 for missing stripe-signature", async () => {
    const req = new NextRequest(new URL("http://localhost/api/billing/webhook"), {
      method: "POST",
      body: "test_body",
    });

    const res = await webhookPost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Missing signature");
  });

  it("returns 400 for invalid signature", async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const req = new NextRequest(new URL("http://localhost/api/billing/webhook"), {
      method: "POST",
      headers: { "stripe-signature": "bad_sig" },
      body: "test_body",
    });

    const res = await webhookPost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Invalid signature");
  });
});
