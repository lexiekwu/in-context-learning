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
  if (!limiter) return null;

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
