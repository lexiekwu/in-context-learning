import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Paths that do NOT require authentication.
 * - /api/auth/* — handled by Auth.js itself
 * - /api/billing/webhook — authenticated via Stripe signature, not session
 */
const PUBLIC_API_PATHS = ["/api/auth", "/api/billing/webhook"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Edge Middleware for API route protection.
 *
 * 1. Validates Auth.js JWT session on all /api/* routes
 *    (except public paths listed above).
 * 2. Rate limiting is handled per-route in Node.js runtime
 *    (not in Edge middleware) to avoid Node.js module issues.
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

  return NextResponse.next();
});

/**
 * Matcher: run middleware on API routes and auth callback routes.
 * Excludes static assets, _next internals, and favicon.
 */
export const config = {
  matcher: ["/api/:path*"],
};
