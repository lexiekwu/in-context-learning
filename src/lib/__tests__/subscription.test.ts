import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbUser } = vi.hoisted(() => ({
  mockDbUser: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { user: mockDbUser },
}));

import { checkSubscriptionAccess } from "@/lib/subscription";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkSubscriptionAccess", () => {
  it("returns allowed=true for ACTIVE subscription", async () => {
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      subscriptionStatus: "ACTIVE",
      trialEndsAt: null,
    });

    const result = await checkSubscriptionAccess("user-1");

    expect(result.allowed).toBe(true);
    expect(result.status).toBe("ACTIVE");
    expect(result.daysRemaining).toBeNull();
  });

  it("returns allowed=true for active TRIAL with days remaining", async () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      subscriptionStatus: "TRIAL",
      trialEndsAt: futureDate,
    });

    const result = await checkSubscriptionAccess("user-1");

    expect(result.allowed).toBe(true);
    expect(result.status).toBe("TRIAL");
    expect(result.daysRemaining).toBeGreaterThanOrEqual(3);
    expect(result.trialEndsAt).toBe(futureDate);
  });

  it("auto-flips expired TRIAL to LAPSED", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      subscriptionStatus: "TRIAL",
      trialEndsAt: pastDate,
    });
    mockDbUser.update.mockResolvedValue({});

    const result = await checkSubscriptionAccess("user-1");

    expect(result.allowed).toBe(false);
    expect(result.status).toBe("LAPSED");
    expect(result.daysRemaining).toBe(0);
    expect(mockDbUser.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { subscriptionStatus: "LAPSED" },
    });
  });

  it("auto-flips TRIAL to LAPSED when trialEndsAt is null", async () => {
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      subscriptionStatus: "TRIAL",
      trialEndsAt: null,
    });
    mockDbUser.update.mockResolvedValue({});

    const result = await checkSubscriptionAccess("user-1");

    expect(result.allowed).toBe(false);
    expect(result.status).toBe("LAPSED");
  });

  it("returns allowed=false for LAPSED status", async () => {
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      subscriptionStatus: "LAPSED",
      trialEndsAt: null,
    });

    const result = await checkSubscriptionAccess("user-1");

    expect(result.allowed).toBe(false);
    expect(result.status).toBe("LAPSED");
    expect(result.daysRemaining).toBeNull();
  });

  it("returns allowed=false for CANCELLED status", async () => {
    mockDbUser.findUniqueOrThrow.mockResolvedValue({
      subscriptionStatus: "CANCELLED",
      trialEndsAt: null,
    });

    const result = await checkSubscriptionAccess("user-1");

    expect(result.allowed).toBe(false);
    expect(result.status).toBe("CANCELLED");
    expect(result.daysRemaining).toBeNull();
  });
});
