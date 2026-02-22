# Project Status — In Context Flashcards

**Last updated:** 2026-02-22

## Summary

Phases 1–5 are complete. The app has a full quiz loop with instant transitions, flashcard management with AI-fill, a user dashboard with metrics, an internal admin dashboard (usage, revenue, LLM spend), Stripe billing with trial enforcement, and production infrastructure (rate limiting, logging, CI/CD, security headers). Vercel deployment config is ready but not yet connected.

---

## Phase 1 — Foundation ✅ Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Prisma schema (User, Flashcard, ReviewLog, StudySession) | ✅ | All models, enums, indexes |
| Google OAuth (Auth.js v5) | ✅ | JWT strategy |
| Flashcard CRUD API | ✅ | List, create, update, delete, export |
| Flashcard management UI | ✅ | Search, filter by state, sort, create/edit/delete |
| Quick-save API | ✅ | For tooltip save flow |
| User settings API | ✅ | Character set preference (traditional/simplified) |

## Phase 2 — Core Quiz ✅ Substantially Complete

| Feature | Status | Notes |
|---------|--------|-------|
| FSRS-5 integration (ts-fsrs) | ✅ | Card scheduling, state transitions |
| Quiz state machine (13 states) | ✅ | `useQuizStateMachine` hook, auto-starts on page load |
| Quiz API (8 endpoints) | ✅ | start, next-card, next-card-with-sentence, generate-sentence, check-translation, check-pinyin, submit-result, today-stats |
| LLM sentence generation | ✅ | Poe API → Gemini-2.5-Flash, Zod validation, retry logic |
| LLM translation grading | ✅ | Lenient grading with explanation + suggested translation |
| Pinyin verification | ✅ | Server-side normalized matching, tone-mark rejection |
| Quiz UI components | ✅ | QuizCard, TranslationInput/Feedback, PinyinInput/Feedback, CardComplete, SessionSummary |
| Dashboard | ✅ | Due cards, streak, accuracy, total cards, daily chart |
| Metrics overview API | ✅ | Cards by state, streak, accuracy |
| Next-card pre-fetching | ✅ | Prefetch during CARD_COMPLETE phase, eliminates 3-5s wait |
| Hover-to-save tooltips | ✅ | Double-click (desktop), Save button (mobile), "Already saved" badge, hint for first 3 tooltips |
| AI card creation | ✅ | API response shape fixed, fully wired to CreateCardDialog UI |
| Metrics history API + charts | ✅ | `/api/metrics/history` with 7d/30d/90d/all, CSS bar chart on dashboard |

## Phase 3 — Polish & Monetization ✅ Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Stripe billing (checkout, portal, webhooks) | ✅ | 4 billing routes, Stripe SDK singleton, setup script |
| Trial period + view-only mode | ✅ | Lazy trial expiry, quiz route gate (403), paywall on /quiz |
| Subscription banner | ✅ | Trial countdown + lapsed banner in app layout |
| Settings subscription section | ✅ | Status display, manage/subscribe buttons |
| AI card creation bug fix | ✅ | Fixed field name mismatch (`input` → `word`) |

## Phase 4 — Production Hardening ✅ Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Rate limiting (Upstash Redis) | ✅ | 4 tiers (quiz/flashcard/aiCreate/billing), 18 route handlers, no-op when Redis absent |
| Structured logging (Pino) | ✅ | JSON in prod, pino-pretty in dev, replaced console.warn/error |
| Session recovery (localStorage) | 🔄 Removed | Replaced by auto-start quiz flow with daily card counting |
| Mobile swipe gestures | ✅ | `useSwipeGesture` hook, swipe-left advances quiz |
| CI/CD (GitHub Actions) | ✅ | Lint → Prisma generate → typecheck → Vitest, ~1m13s |
| Security headers | ✅ | HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| Vercel config | ✅ | `vercel.json`, `.vercelignore`, Google avatar remote patterns |
| Security review | ✅ | All HIGH/MEDIUM issues fixed |

## Phase 5 — UX Polish & Admin ✅ Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Rename to "In Context Flashcards" | ✅ | Layout, landing, navbar, signin, Stripe product |
| Internal admin dashboard | ✅ | `/admin` gated to admin email, users/funnel/activity/revenue/LLM metrics |
| LLM usage tracking | ✅ | `LlmCall` model, fire-and-forget logging from all 4 call sites |
| Admin revenue section | ✅ | Stripe invoice aggregation (7d/30d/total), recent charges table |
| Admin LLM spend section | ✅ | By-purpose breakdown, daily token chart, totals |
| Card creation: AI-fill sparkle buttons | ✅ | Single form with inline sparkle icons, replaces tab UI |
| Dashboard: remove CTA buttons | ✅ | Removed redundant "Start Quiz" / "Manage Cards" row |
| Quiz: auto-start, no session management | ✅ | Goes straight to first card on page load, daily card counting |
| Quiz: instant transitions | ✅ | Removed all artificial delays (translation→pinyin, card result) |
| Quiz: consistent feedback styling | ✅ | Green ✓ / Red ✗ across translation, pinyin, and card result |
| Quiz: daily stats bar | ✅ | Shows "Today: N" with accuracy, replaces session timer |
| Custom favicon | ✅ | SVG "字" on indigo background |

## Remaining: Vercel Deployment (Not Yet Connected)

To finish deployment:

1. **Import repo at [vercel.com/new](https://vercel.com/new)** — select `lexiekwu/in-context-learning`
2. **Set environment variables** in Vercel dashboard (all from `.env`):
   - `DATABASE_URL`, `DIRECT_URL` (Supabase connection strings)
   - `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_URL` → set to the Vercel production URL (e.g. `https://ichinglingo.vercel.app`)
   - `NEXT_PUBLIC_APP_URL` → same as NEXTAUTH_URL
   - `POE_API_KEY` (for LLM features)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID` (for billing)
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (for rate limiting — optional, degrades gracefully)
3. **Update Stripe webhook endpoint** to point to `https://<vercel-url>/api/billing/webhook`
4. **Update Google OAuth redirect URI** in Google Cloud Console to include `https://<vercel-url>/api/auth/callback/google`
5. **Note:** Free Hobby plan is sufficient. Serverless function timeout is 10s on free tier — LLM calls may occasionally approach this limit.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **DB:** Supabase PostgreSQL via Prisma 7 + driver adapters
- **Auth:** Auth.js v5, Google OAuth, JWT
- **SRS:** ts-fsrs (FSRS-5)
- **LLM:** Poe API (OpenAI-compatible) → Gemini-2.5-Flash
- **Styling:** Tailwind CSS (dark-only, indigo accent)
- **Testing:** Vitest 3
- **Rate Limiting:** Upstash Redis (optional)
- **Logging:** Pino
- **CI/CD:** GitHub Actions
- **Billing:** Stripe (checkout, portal, webhooks)
- **Deployment:** Vercel (config ready, not yet connected)

## Known Issues

- Vercel not yet connected (config ready, needs import + env vars)
- Demo account has stale data from testing
- Free tier 10s function timeout may be tight for LLM calls
- LLM spend in admin dashboard requires dev server restart after migration (Prisma client caching)
