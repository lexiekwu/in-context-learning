# Production Readiness Checklist

**Last updated:** 2026-02-28
**Status:** Draft for PM review

This document catalogs everything needed to take the flashcard app from development to production-ready for real users. Each item includes priority, type, and rationale.

**Priority key:**
- **P0** -- Must complete before any real user touches the app
- **P1** -- Should complete before launch; risk is manageable short-term
- **P2** -- Do soon after launch; improves quality of life but not a blocker

**Type key:**
- **Code** -- Requires changes to the codebase
- **Config** -- Environment variable, dashboard setting, or service configuration
- **External** -- Action taken outside the codebase (Google Console, Stripe Dashboard, DNS, etc.)

---

## 1. Security

The recent security review addressed prompt injection sanitization, CSP headers, input validation, and IDOR protections. The High and Medium severity items from that review are being fixed in parallel. The items below cover remaining or adjacent security concerns.

### 1.1 Google OAuth consent screen -- move from "Testing" to "Published"
| Priority | Type | Status |
|----------|------|--------|
| **P0** | External | Not started |

**Why:** While the OAuth consent screen is in "Testing" mode, only manually-added test users (max 100) can sign in. Real users will see an error. Publishing the consent screen requires Google verification if requesting sensitive scopes.

**Action:**
1. Go to Google Cloud Console > APIs & Services > OAuth consent screen.
2. Verify the app name, logo, support email, and privacy policy URL (`/privacy`) are set.
3. Click "Publish App." If the app only requests `email`, `profile`, and `openid` scopes, verification may be instant. If broader scopes are requested, Google manual review takes 2-6 weeks.
4. After publishing, remove any test-user restrictions.

### 1.2 Domain verification with Google
| Priority | Type | Status |
|----------|------|--------|
| **P0** | External | Not started |

**Why:** Google requires domain ownership verification before the OAuth consent screen can reference a production domain. Without it, the consent screen will show a scary "This app isn't verified" warning.

**Action:**
1. Add and verify the production domain in Google Search Console.
2. Link the verified domain in the OAuth consent screen configuration.

### 1.3 Rotate AUTH_SECRET for production
| Priority | Type | Status |
|----------|------|--------|
| **P0** | Config | Not started |

**Why:** The current `AUTH_SECRET` was generated during development. A compromised secret allows JWT forgery, giving attackers access to any user account. Production must use a fresh, high-entropy secret that has never appeared in logs, `.env` files committed to git, or chat messages.

**Action:**
1. Generate a new secret: `openssl rand -base64 32`.
2. Set it as `AUTH_SECRET` in the Vercel production environment variables.
3. Do NOT reuse the development value.

### 1.4 Enforce HTTPS-only cookies in production
| Priority | Type | Status |
|----------|------|--------|
| **P0** | Code (verify) | Likely already handled |

**Why:** Auth.js session cookies must be `Secure` (HTTPS-only) in production to prevent session hijacking over HTTP. The middleware already reads `secureCookie` from the protocol (`src/middleware.ts` line 43), and Vercel serves over HTTPS by default. However, this should be explicitly verified after deployment.

**Action:**
1. After first production deploy, inspect the `Set-Cookie` header on the auth callback response.
2. Confirm the cookie name is `__Secure-authjs.session-token` (not the plain `authjs.session-token`).
3. Confirm `Secure` and `HttpOnly` flags are present.

### 1.5 CSP header -- tighten `unsafe-inline` and `unsafe-eval`
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Not started |

**Why:** The current CSP in `next.config.ts` allows `'unsafe-inline'` and `'unsafe-eval'` for scripts. This weakens XSS protection. Next.js requires `unsafe-inline` for its inline styles, but `unsafe-eval` can likely be removed. If nonce-based CSP is feasible with the current Next.js version, that would be stronger.

**Action:**
1. Test the app with `'unsafe-eval'` removed from `script-src`.
2. If Next.js dev tooling breaks in development only, conditionally add it for `NODE_ENV=development`.
3. Investigate Next.js nonce support for inline scripts.

### 1.6 Admin endpoint hardening
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Partially done |

**Why:** The admin metrics endpoint (`/api/admin/metrics`) uses a hardcoded email allowlist (`ADMIN_EMAILS = ["lexiekwu@gmail.com"]`). This works but is fragile. The email check happens after middleware auth, so it is protected, but the admin list should be externalized.

**Action:**
1. Move `ADMIN_EMAILS` to an environment variable (e.g., `ADMIN_EMAILS=a@b.com,c@d.com`).
2. Parse and validate at startup via `env.ts`.

### 1.7 Stripe webhook signature verification -- confirm production endpoint
| Priority | Type | Status |
|----------|------|--------|
| **P0** | Config | Not started |

**Why:** The webhook route (`/api/billing/webhook`) correctly verifies Stripe signatures using `STRIPE_WEBHOOK_SECRET`. But this secret is per-endpoint. When the production webhook URL changes (new domain), a new webhook endpoint must be registered in Stripe and a new signing secret generated.

**Action:**
1. In the Stripe Dashboard, create a production webhook endpoint pointing to `https://yourdomain.com/api/billing/webhook`.
2. Subscribe to events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`.
3. Copy the new signing secret to `STRIPE_WEBHOOK_SECRET` in Vercel production env vars.

### 1.8 Rate limiting must be enabled in production
| Priority | Type | Status |
|----------|------|--------|
| **P0** | Config | Not started |

**Why:** Rate limiting via Upstash Redis is currently optional -- if the env vars are missing, all rate limits are silently disabled (`src/lib/rate-limit.ts` lines 10-11). In production, this must be active to prevent abuse of LLM endpoints (which cost money per call) and brute-force attacks.

**Action:**
1. Create a production Upstash Redis instance.
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel.
3. Consider making these required (not optional) in `env.ts` when `NODE_ENV=production`.

---

## 2. Infrastructure & Deployment

### 2.1 Set all production environment variables in Vercel
| Priority | Type | Status |
|----------|------|--------|
| **P0** | Config | Not started |

**Why:** The app validates env vars at startup via Zod (`src/lib/env.ts`). Missing vars will crash the app on deploy. Several vars are currently optional in the schema but must be present for production functionality.

**Required production env vars:**
| Variable | Required for | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | Everything | Supabase pooled connection string |
| `DIRECT_URL` | Prisma migrations | Direct connection (non-pooled) |
| `AUTH_SECRET` | Auth | Fresh production secret (see 1.3) |
| `GOOGLE_CLIENT_ID` | Auth | Production OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | Auth | Production OAuth credentials |
| `NEXTAUTH_URL` | Auth | Production URL (e.g., `https://yourdomain.com`) |
| `POE_API_KEY` | LLM features | Required for quiz to function |
| `STRIPE_SECRET_KEY` | Billing | Production key (starts with `sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Billing | Production webhook signing secret |
| `STRIPE_MONTHLY_PRICE_ID` | Billing | Price ID from production Stripe product |
| `UPSTASH_REDIS_REST_URL` | Rate limiting | Production Redis instance |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting | Production Redis token |
| `NEXT_PUBLIC_APP_URL` | Checkout redirects | Production URL |
| `NODE_ENV` | Runtime | `production` (set automatically by Vercel) |

**Action:** Create a Vercel project, set all variables in the Production environment scope.

### 2.2 Production Stripe keys (switch from test to live)
| Priority | Type | Status |
|----------|------|--------|
| **P0** | Config + External | Not started |

**Why:** The `.env.example` shows `sk_test_*` keys. Test mode charges are fake. Production must use live keys from the Stripe Dashboard.

**Action:**
1. In Stripe Dashboard, toggle to "Live mode."
2. Create a production product and price (monthly subscription).
3. Copy `sk_live_*` secret key and the live price ID to Vercel env vars.
4. Register the production webhook endpoint (see 1.7).

### 2.3 Custom domain setup
| Priority | Type | Status |
|----------|------|--------|
| **P1** | External | Not started |

**Why:** The app currently runs on a `*.vercel.app` subdomain. A custom domain improves trust, is required for Google OAuth consent screen verification, and is needed for cookie security (public suffix list issues with `.vercel.app`).

**Action:**
1. Purchase/configure a domain.
2. Add it to the Vercel project (Settings > Domains).
3. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to the new domain.
4. Update Google OAuth authorized redirect URIs.
5. Update Stripe webhook endpoint URL.

### 2.4 Database backups and point-in-time recovery
| Priority | Type | Status |
|----------|------|--------|
| **P1** | External | Likely available |

**Why:** Supabase provides daily backups on the Free tier and point-in-time recovery (PITR) on Pro+. User flashcard data is irreplaceable. Verify that backups are enabled and test a restore.

**Action:**
1. Confirm Supabase plan tier and backup frequency in the dashboard.
2. If on Free tier, consider upgrading to Pro for PITR.
3. Test a backup restore on a staging database.

### 2.5 Database connection pooling verification
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Config | Likely correct |

**Why:** The `DATABASE_URL` in `.env.example` uses `?pgbouncer=true&connection_limit=1`, which is correct for Supabase + Prisma in serverless. The `@prisma/adapter-pg` driver adapter is used in `src/lib/db.ts`. Verify this works under concurrent load.

**Action:**
1. Confirm the production `DATABASE_URL` includes `?pgbouncer=true`.
2. Verify the Supabase pooler mode is set to "Transaction" (required for Prisma).
3. Run a basic load test (10 concurrent users) and check for connection errors.

### 2.6 Vercel function timeout and memory
| Priority | Type | Status |
|----------|------|--------|
| **P2** | Config | Not started |

**Why:** LLM calls have a 30-second timeout (`src/lib/llm/call.ts` line 115). Vercel Hobby plan has a 10-second function timeout. The Pro plan allows up to 300 seconds. The quiz route chains multiple LLM calls (sentence generation + translation check), so total latency can exceed 10 seconds.

**Action:**
1. If on Vercel Hobby plan, upgrade to Pro for longer function timeouts.
2. Alternatively, set per-route `maxDuration` in the route files for LLM-heavy endpoints.

---

## 3. Billing & Payments

### 3.1 Create production Stripe product and price
| Priority | Type | Status |
|----------|------|--------|
| **P0** | External | Not started |

**Why:** `STRIPE_MONTHLY_PRICE_ID` is required for the checkout flow (`src/app/api/billing/create-checkout/route.ts` line 20). No price ID means billing returns a 503 error.

**Action:**
1. In Stripe Dashboard (live mode), create a product (e.g., "Pro Subscription").
2. Add a recurring monthly price.
3. Set the price ID as `STRIPE_MONTHLY_PRICE_ID` in Vercel env vars.

### 3.2 Handle `customer.subscription.updated` webhook event
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Not started |

**Why:** The webhook handler (`src/app/api/billing/webhook/route.ts`) handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, and `customer.subscription.deleted`. It does NOT handle `customer.subscription.updated`, which fires when a subscription changes state (e.g., past_due, paused, or reactivated from the customer portal). This could lead to stale subscription status.

**Action:**
1. Add a `customer.subscription.updated` case to the webhook handler.
2. Map Stripe subscription statuses (`active`, `past_due`, `canceled`, `unpaid`) to the app's `SubscriptionStatus` enum.

### 3.3 Trial expiration behavior -- verify edge cases
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code (verify) | Partially handled |

**Why:** Trial expiration is handled lazily in `checkSubscriptionAccess()` (`src/lib/subscription.ts` lines 26-38): when a TRIAL user's `trialEndsAt` is past, the status is flipped to LAPSED. This works but has edge cases:
- If a TRIAL user never makes another request after expiration, their status remains TRIAL in the DB (cosmetic issue for admin metrics).
- There is no email notification when the trial is about to expire or has expired.

**Action:**
1. (P1) Add a daily cron job (Vercel Cron) to flip expired TRIAL users to LAPSED.
2. (P2) Send email notifications at 1 day remaining and at expiration.

### 3.4 Prevent double subscriptions
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Not started |

**Why:** If an ACTIVE user clicks "Subscribe" again, the checkout flow creates a new Stripe subscription without checking the current status. This could result in double billing.

**Action:**
1. In `create-checkout/route.ts`, check if `user.subscriptionStatus === "ACTIVE"` and return an error/redirect if so.
2. Alternatively, check if the Stripe customer already has an active subscription.

### 3.5 Stripe Customer Portal configuration
| Priority | Type | Status |
|----------|------|--------|
| **P1** | External | Not started |

**Why:** The `create-portal` route creates Stripe Customer Portal sessions. The portal's appearance, allowed actions (cancel, update payment), and branding must be configured in the Stripe Dashboard.

**Action:**
1. In Stripe Dashboard > Settings > Customer Portal, configure allowed actions.
2. Add business name, logo, and colors.
3. Decide whether users can cancel immediately or at end of billing period.

---

## 4. Monitoring & Observability

### 4.1 Error tracking (Sentry or equivalent)
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code + Config | Not started |

**Why:** The tech architecture spec (05-tech-architecture.md) mentions Sentry, but it is not integrated in the codebase. Currently, errors are logged via pino (`src/lib/logger.ts`) which writes to stdout. In Vercel, stdout logs are ephemeral (retained ~1 hour on Hobby, 3 days on Pro). Without Sentry, production errors will go unnoticed.

**Action:**
1. Install `@sentry/nextjs`.
2. Configure with `sentry.server.config.ts` and `sentry.client.config.ts`.
3. Set `SENTRY_DSN` in Vercel env vars.
4. Add source maps upload to the build step.

### 4.2 LLM cost monitoring and alerts
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code + External | Partially done |

**Why:** LLM calls are logged to the `LlmCall` table with token counts and duration (`src/lib/llm/call.ts` lines 256-279). The admin dashboard shows estimated costs. But there is no alerting if costs spike (e.g., a bug causes infinite LLM retries, or a user abuses the API).

**Action:**
1. Set up a Poe API spending alert/cap if available.
2. Add a daily cost check to the admin metrics that alerts (email or Slack) if the daily LLM spend exceeds a threshold.
3. Consider a per-user daily LLM call limit (currently only rate-limited per minute).

### 4.3 Uptime monitoring
| Priority | Type | Status |
|----------|------|--------|
| **P2** | External | Not started |

**Why:** Vercel has basic availability monitoring, but external uptime monitoring (e.g., BetterUptime, Checkly, or UptimeRobot) provides faster alerting and status pages for users.

**Action:**
1. Set up an external monitor pinging the app's health endpoint (or the landing page).
2. Configure alerting (email/SMS) on downtime.

### 4.4 Structured logging in production
| Priority | Type | Status |
|----------|------|--------|
| **P2** | Config | Not started |

**Why:** Pino outputs structured JSON in production (no pretty-printing), which is correct. However, Vercel's log retention is limited. For long-term log analysis, consider piping logs to a log aggregation service.

**Action:**
1. If needed, integrate Vercel Log Drain to forward logs to Datadog, Axiom, or similar.
2. This is lower priority if Sentry is capturing errors.

---

## 5. Performance

### 5.1 Verify database indexes cover hot query paths
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code (verify) | Mostly done |

**Why:** The Prisma schema defines indexes on the key query paths:
- `Flashcard: @@index([userId, language, due])` -- covers the card selection query.
- `ReviewLog: @@index([userId, reviewedAt])` and `@@index([flashcardId, reviewedAt])` -- covers stats queries.
- `StudySession: @@index([userId, startedAt])` -- covers session lookups.
- `User: @@index([stripeCustomerId])` -- covers webhook customer lookups.

These appear correct. Verify under real load with `EXPLAIN ANALYZE` on the most common queries.

**Action:**
1. After initial production usage, run `EXPLAIN ANALYZE` on the `getNextDueCard` query.
2. Check if the `Flashcard` index on `[userId, language, due]` is actually being used.
3. Add indexes if Supabase's query performance dashboard shows slow queries.

### 5.2 N+1 query check in card selection
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code (verify) | Needs review |

**Why:** The `getNextDueCard` function in `src/lib/db/queries.ts` makes multiple sequential DB queries (get session card IDs, get today stats, get learning cards, get review cards, get new cards, count remaining). In the worst case, this is 6+ DB round-trips per "next card" request. While each query is indexed, the cumulative latency could exceed the 200ms target.

**Action:**
1. Profile the `/api/quiz/next-card` endpoint under realistic conditions.
2. If latency exceeds 200ms, consider combining queries using raw SQL or restructuring.
3. The `countRemainingCards` call happens on every card fetch and could be deferred or cached.

### 5.3 LLM call latency -- sentence prefetching
| Priority | Type | Status |
|----------|------|--------|
| **P2** | Code | Not implemented |

**Why:** The spec mentions prefetching the next card's sentence while the user reviews the current card. This is not yet implemented. LLM calls take 1-5 seconds, so prefetching would significantly improve perceived performance.

**Action:**
1. After the current card is displayed, trigger a background fetch for the next card + sentence.
2. Cache the prefetched sentence client-side.
3. This is a UX improvement, not a blocker.

---

## 6. User Experience

### 6.1 Custom error pages (404, 500)
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Not started |

**Why:** Next.js shows default error pages that look broken and erode user trust. Custom `not-found.tsx` and `error.tsx` pages should match the app's visual design and provide helpful navigation.

**Action:**
1. Create `src/app/not-found.tsx` with a branded 404 page.
2. Create `src/app/error.tsx` with a branded error page and "Go home" button.

### 6.2 Email notifications
| Priority | Type | Status |
|----------|------|--------|
| **P2** | Code + External | Not started |

**Why:** Currently, the app sends no emails. Useful email touchpoints include:
- Welcome email after first sign-in.
- Trial expiring (1 day warning).
- Trial expired.
- Subscription payment failed.

**Action:**
1. Choose a transactional email provider (Resend, Postmark, SendGrid).
2. Implement email sending in the relevant webhook handlers and cron jobs.

### 6.3 Loading states for billing operations
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code (verify) | Partially done |

**Why:** The checkout and portal redirects involve API calls that take 1-3 seconds. If the "Subscribe" button doesn't show a loading state, users may click multiple times and create duplicate checkout sessions.

**Action:**
1. Verify that the settings page disables the subscribe button and shows a spinner during the checkout API call.
2. Add debouncing or a loading flag to prevent double-clicks.

### 6.4 Mobile responsiveness audit
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Needs testing |

**Why:** The spec outlines responsive breakpoints and touch targets. Verify that the quiz, card management, and settings pages work correctly on mobile devices (especially iPhone Safari, which has viewport quirks with virtual keyboards).

**Action:**
1. Test all critical flows on an iPhone (Safari) and Android (Chrome).
2. Pay special attention to the quiz translation input and pinyin input focus behavior.
3. Verify the PWA manifest (`public/manifest.json`) and service worker (`public/sw.js`) work correctly for "Add to Home Screen."

---

## 7. Legal & Compliance

### 7.1 Privacy policy -- verify accuracy and completeness
| Priority | Type | Status |
|----------|------|--------|
| **P0** | Code (verify) | Done but needs review |

**Why:** A privacy policy exists at `/privacy` (`src/app/privacy/page.tsx`). It lists the correct third-party services (Google OAuth, Stripe, Poe/Gemini, Supabase, Upstash, Vercel) and describes data collection accurately. However, it needs review for:
- Contact email is a personal Gmail address -- consider a business email.
- No mention of cookies (Auth.js uses session cookies).
- No mention of analytics (Vercel Analytics mentioned in tech spec but not in privacy policy).
- "Data Retention" section says data is deleted on account deletion, but there is no self-service account deletion feature yet.

**Action:**
1. Add a cookies section to the privacy policy.
2. If Vercel Analytics is enabled, disclose it.
3. Consider whether a cookie consent banner is needed (depends on target market).

### 7.2 Terms of Service
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code + External | Not started |

**Why:** There is no Terms of Service page. A ToS is recommended for any paid service to define acceptable use, liability limitations, and subscription terms.

**Action:**
1. Draft a ToS (can use a template generator for initial draft).
2. Create `/terms` page.
3. Link from the sign-in page and footer.

### 7.3 Account deletion / data export
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Partially done |

**Why:** The privacy policy promises data deletion on request ("contact us"). The flashcard export API exists (`/api/flashcards/export`). However, there is no self-service account deletion flow. GDPR requires data erasure within 30 days of request.

**Action:**
1. Add a "Delete my account" button in Settings that:
   - Cancels any active Stripe subscription.
   - Deletes the User record (cascading delete handles flashcards, review logs, sessions via `onDelete: Cascade`).
2. Consider a "Download my data" button that exports all user data as JSON.

### 7.4 Cookie consent banner (if targeting EU)
| Priority | Type | Status |
|----------|------|--------|
| **P2** | Code | Not started |

**Why:** If the app targets EU users, GDPR/ePrivacy requires consent for non-essential cookies. Auth.js session cookies are "strictly necessary" and exempt, but Vercel Analytics cookies (if enabled) require consent.

**Action:**
1. Determine target market. If US-only initially, this can be deferred.
2. If EU users are expected, add a cookie consent banner.

---

## 8. Testing

### 8.1 Current test coverage assessment
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Partial |

**Why:** The codebase has 15 test files covering:
- Unit tests: `fsrs`, `pinyin`, `sanitize`, `errors`, `env`, `prompts`, `subscription`, `llm-call`
- Route tests: `flashcard-routes`, `quiz-routes`, `billing-routes`, `metrics-settings-routes`, `llm-routes`
- Middleware test

This is solid for a pre-launch app. Gaps include:
- No E2E tests (no Playwright config found).
- No integration test that actually hits the Stripe webhook endpoint with a realistic payload.
- No test for the full quiz flow (start session -> get card -> generate sentence -> check translation -> submit result).

### 8.2 E2E tests for critical user flows
| Priority | Type | Status |
|----------|------|--------|
| **P2** | Code | Not started |

**Why:** E2E tests catch integration issues that unit tests miss (e.g., client/server mismatch, auth flow breakage, UI regressions).

**Action:**
1. Set up Playwright.
2. Write E2E tests for: sign-in flow, create flashcard, take a quiz (mock LLM), subscribe (use Stripe test mode).

### 8.3 Load testing for LLM endpoints
| Priority | Type | Status |
|----------|------|--------|
| **P2** | External | Not started |

**Why:** The LLM endpoints (`/api/quiz/generate-sentence`, `/api/quiz/check-translation`) are the slowest and most expensive paths. Under concurrent load, they may hit Poe API rate limits, Vercel function concurrency limits, or database connection exhaustion.

**Action:**
1. Use a simple load testing tool (k6, Artillery) to simulate 10-20 concurrent quiz sessions.
2. Monitor: function duration, Poe API error rates, DB connection count, rate limit hits.

### 8.4 Stripe webhook integration test
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Not started |

**Why:** The billing webhook is critical infrastructure. A bug here means users pay but don't get access. The existing `billing-routes.test.ts` likely mocks the webhook verification. A true integration test would use Stripe's test webhook CLI.

**Action:**
1. Use `stripe trigger checkout.session.completed` to send a real test webhook.
2. Verify the database is updated correctly.
3. Add this to the pre-deploy checklist.

---

## 9. Content & Data

### 9.1 Starter pack quality review across languages
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code | Partially done |

**Why:** Starter packs exist for 6 languages (zh, ja, ko, es, fr, de). The remaining 14 supported languages show a "coming soon" message. The packs themselves should be reviewed by native speakers for accuracy -- especially the CJK readings.

**Action:**
1. Add starter packs for the remaining supported languages (or at least the most popular: pt, it, ru, ar).
2. Have a native speaker verify each existing pack.
3. For non-CJK languages, verify that empty `reading` fields are handled gracefully in the UI.

### 9.2 LLM prompt quality across languages
| Priority | Type | Status |
|----------|------|--------|
| **P1** | Code (verify) | Needs testing |

**Why:** The LLM prompts were originally designed for Chinese and have been generalized for multi-language support. Each language config (`src/lib/languages/*.ts`) provides language-specific instructions. However, the actual LLM output quality for all 20 languages has likely not been verified.

**Action:**
1. For each supported language, run through 3-5 quiz cycles and verify:
   - Sentence generation produces natural sentences.
   - Translation checking is appropriately lenient/strict.
   - AI card creation returns correct readings (where applicable).
2. Pay special attention to Arabic (RTL), Thai (no spaces between words), and Hindi (Devanagari).
3. Document any languages where quality is too low and consider disabling them until improved.

### 9.3 Database seeding for demo/staging
| Priority | Type | Status |
|----------|------|--------|
| **P2** | Code | Exists |

**Why:** `prisma/seed.ts` exists for database seeding. Verify it creates realistic demo data suitable for staging demos and development.

**Action:**
1. Review the seed script and ensure it creates a demo user with flashcards in various states (NEW, LEARNING, REVIEW) and some review history.
2. This is useful for demos and onboarding new developers.

---

## 10. Google OAuth Specific

### 10.1 Production OAuth credentials
| Priority | Type | Status |
|----------|------|--------|
| **P0** | External | Not started |

**Why:** Development OAuth credentials are typically configured with `http://localhost:3000` as the authorized redirect URI. Production needs its own set of credentials (or the existing ones need the production domain added).

**Action:**
1. In Google Cloud Console > Credentials, either:
   - Create a new OAuth 2.0 Client ID for production, OR
   - Add the production domain's redirect URI to the existing client.
2. Authorized redirect URI should be: `https://yourdomain.com/api/auth/callback/google`.
3. Authorized JavaScript origin: `https://yourdomain.com`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel env vars.

### 10.2 OAuth consent screen branding
| Priority | Type | Status |
|----------|------|--------|
| **P1** | External | Not started |

**Why:** The OAuth consent screen is what users see when signing in. It should display the app's name, logo, and link to the privacy policy. An unbranded consent screen looks suspicious.

**Action:**
1. Upload the app logo to the OAuth consent screen.
2. Set the application name.
3. Add the privacy policy URL: `https://yourdomain.com/privacy`.
4. Add the terms of service URL (once created): `https://yourdomain.com/terms`.

### 10.3 Scope minimization
| Priority | Type | Status |
|----------|------|--------|
| **P0** | Code (verify) | Likely correct |

**Why:** The Google OAuth provider in `src/lib/auth.ts` uses the default Auth.js Google provider, which requests `openid`, `email`, and `profile` scopes. These are non-sensitive and should not trigger extended verification. Verify no additional scopes are being requested.

**Action:**
1. Confirm the provider configuration does not add extra scopes.
2. Check the Google OAuth consent screen scope configuration in the Cloud Console.

---

## Summary: Priority Overview

### P0 -- Must do before launch (9 items)
1. Google OAuth consent screen -- publish (1.1)
2. Google domain verification (1.2)
3. Rotate AUTH_SECRET (1.3)
4. Stripe webhook for production domain (1.7)
5. Enable rate limiting in production (1.8)
6. Set all production env vars (2.1)
7. Production Stripe keys + price (2.2, 3.1)
8. Privacy policy review (7.1)
9. Production OAuth credentials + redirect URIs (10.1, 10.3)

### P1 -- Should do before launch (16 items)
1. Tighten CSP headers (1.5)
2. Admin email externalization (1.6)
3. Custom domain (2.3)
4. Database backups verification (2.4)
5. Connection pooling verification (2.5)
6. Handle `subscription.updated` webhook (3.2)
7. Trial expiration cron job (3.3)
8. Prevent double subscriptions (3.4)
9. Stripe Customer Portal config (3.5)
10. Sentry error tracking (4.1)
11. LLM cost alerts (4.2)
12. Database index verification (5.1)
13. N+1 query audit (5.2)
14. Custom error pages (6.1)
15. Mobile responsiveness audit (6.4)
16. Terms of Service (7.2)
17. Account deletion (7.3)
18. Starter pack quality (9.1)
19. LLM prompt quality across languages (9.2)
20. OAuth consent screen branding (10.2)
21. Stripe webhook integration test (8.4)
22. Loading states for billing (6.3)

### P2 -- Do soon after launch (8 items)
1. Vercel function timeout (2.6)
2. Uptime monitoring (4.3)
3. Log aggregation (4.4)
4. Sentence prefetching (5.3)
5. Email notifications (6.2)
6. Cookie consent (7.4)
7. E2E tests (8.2)
8. Load testing (8.3)
9. Database seeding (9.3)
