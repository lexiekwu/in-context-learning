import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Paths that do NOT require authentication.
 * - /api/auth/* — handled by Auth.js itself
 * - /api/billing/webhook — authenticated via Stripe signature, not session
 */
const PUBLIC_API_PATHS = ["/api/auth", "/api/billing/webhook"];

/**
 * Per-user rate limiter via Upstash Redis.
 * Initialized only when Upstash credentials are present (production).
 * When absent (local dev), rate limiting is gracefully skipped.
 */
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        analytics: true,
      })
    : null;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Edge Middleware for API route protection.
 *
 * 1. Validates Auth.js JWT session on all /api/* routes
 *    (except public paths listed above).
 * 2. Rate limiting placeholder — will integrate @upstash/ratelimit
 *    once Upstash Redis credentials are configured.
 */
export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allow public API paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for a valid session (auth() adds req.auth)
  if (!req.auth?.user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
          details: null,
        },
      },
      { status: 401 }
    );
  }

  // Per-user rate limiting (active when Upstash Redis is configured)
  if (ratelimit && req.auth.user.id) {
    const { success, reset } = await ratelimit.limit(req.auth.user.id);
    if (!success) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests.",
            details: null,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      );
    }
  }

  return NextResponse.next();
});

/**
 * Matcher: run middleware on API routes and auth callback routes.
 * Excludes static assets, _next internals, and favicon.
 */
export const config = {
  matcher: ["/api/:path*"],
};
