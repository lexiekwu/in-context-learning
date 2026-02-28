import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !url.startsWith("https://")) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("Rate limiting is disabled: UPSTASH_REDIS_REST_URL/TOKEN not configured");
    }
    return null;
  }
  try {
    return new Redis({ url, token });
  } catch (err) {
    logger.error({ err }, "Failed to initialize Upstash Redis client");
    return null;
  }
}

const redis = createRedis();

const tiers = {
  quiz: { requests: 30, window: "1 m" as const },
  flashcard: { requests: 60, window: "1 m" as const },
  aiCreate: { requests: 10, window: "1 m" as const },
  billing: { requests: 10, window: "1 m" as const },
};

type Tier = keyof typeof tiers;

// ---------------------------------------------------------------------------
// In-memory fallback rate limiter (used when Redis is not configured)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS: Record<Tier, number> = {
  quiz: 60_000,
  flashcard: 60_000,
  aiCreate: 60_000,
  billing: 60_000,
};

function checkMemoryRateLimit(tier: Tier, userId: string): { success: boolean; retryAfter: number } {
  const key = `${tier}:${userId}`;
  const now = Date.now();
  const entry = memoryStore.get(key);
  const windowMs = WINDOW_MS[tier];
  const maxRequests = tiers[tier].requests;

  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, retryAfter: 0 };
  }

  if (entry.count < maxRequests) {
    entry.count++;
    return { success: true, retryAfter: 0 };
  }

  return { success: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
}

// Periodically clean up expired entries (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (now >= entry.resetAt) memoryStore.delete(key);
    }
  }, 5 * 60_000).unref?.();
}

// ---------------------------------------------------------------------------
// Redis-backed limiters (preferred)
// ---------------------------------------------------------------------------

const limiters: Record<Tier, Ratelimit | null> = Object.fromEntries(
  Object.entries(tiers).map(([key, { requests, window }]) => [
    key,
    redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(requests, window),
          prefix: `icl:${key}`,
        })
      : null,
  ]),
) as Record<Tier, Ratelimit | null>;

export async function checkRateLimit(
  tier: Tier,
  userId: string,
): Promise<NextResponse | null> {
  const limiter = limiters[tier];

  // Use Redis limiter if available, otherwise fall back to in-memory
  if (limiter) {
    const { success, reset } = await limiter.limit(userId);
    if (success) return null;

    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again shortly.",
          details: { retryAfter },
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  // In-memory fallback
  const { success, retryAfter } = checkMemoryRateLimit(tier, userId);
  if (success) return null;

  return NextResponse.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again shortly.",
        details: { retryAfter },
      },
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}
