import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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
 * Uses `getToken` from next-auth/jwt instead of the full `auth()` wrapper
 * to avoid pulling Prisma (Node.js-only) into the Edge Runtime bundle.
 *
 * 1. Validates Auth.js JWT session on all /api/* routes
 *    (except public paths listed above).
 * 2. Rate limiting is handled per-route in Node.js runtime
 *    (not in Edge middleware) to avoid Node.js module issues.
 */
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allow public API paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Decode JWT without importing Prisma.
  // secureCookie must be true on HTTPS so getToken looks for the
  // __Secure-authjs.session-token cookie (not the plain one).
  const secureCookie = req.nextUrl.protocol === "https:";
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie });

  if (!token?.userId) {
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
}

/**
 * Matcher: run middleware on API routes and auth callback routes.
 * Excludes static assets, _next internals, and favicon.
 */
export const config = {
  matcher: ["/api/:path*"],
};
