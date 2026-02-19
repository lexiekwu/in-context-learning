# 07 — Agent Team

This document defines the AI coding agents that will build the Mandarin flashcard app. Each agent owns a domain, follows specific spec docs, and produces concrete deliverables. The team is coordinated by an Orchestrator agent.

---

## Team Overview

| Agent | Domain | Active Phases | Primary Specs |
|-------|--------|---------------|---------------|
| **Orchestrator** | Scaffolding, coordination, code review, CI/CD | 1, 2, 3, 4 | 00, 05, 06 |
| **Data Layer** | Prisma schema, DB migrations, seed data | 1 | 02, 03 |
| **Auth** | Auth.js, Google OAuth, session middleware, subscription gating | 1, 3 | 02, 05 |
| **Quiz Engine** | FSRS integration, card selection, quiz API routes, pinyin verification | 2 | 01, 02, 03 |
| **LLM Integration** | Poe API client, 3 LLM call types, Zod validation, caching, prefetching | 2 | 04 |
| **Frontend** | Quiz UI state machine, flashcard CRUD UI, metrics dashboard, responsive/mobile | 2, 3, 4 | 01, 05 |
| **Billing** | Stripe checkout, webhooks, subscription status, view-only mode, data export | 3 | 02, 05 |
| **QA** | Test strategy, unit/integration/E2E tests, edge case verification | 2, 3, 4 | 01, 06 |
| **Security Expert** | Security review of all commits, vulnerability scanning, credential hygiene | 1, 2, 3, 4 | 02, 04, 05 |

---

## Agent Charters

### 1. Orchestrator

**Mission:** Scaffold the project, coordinate agent handoffs, enforce code quality, and deliver the production deployment pipeline.

**Owns:**
- Project scaffolding: `npx create-next-app`, Tailwind + shadcn/ui setup, Prisma init, folder structure
- `package.json` dependencies and scripts
- `tsconfig.json`, ESLint, Prettier configuration
- Environment variable schema (`.env.example`) and validation (`zod` env parser)
- CI/CD pipeline (GitHub Actions or Vercel preview deploys)
- Global error handling (`app/error.tsx`, `app/not-found.tsx`)
- Shared utilities: `lib/errors.ts` (error format from 02), `lib/env.ts`
- Code review of all agent PRs for consistency, security, and adherence to spec

**Spec references:** `00-overview.md` (build sequencing, tech stack), `05-tech-architecture.md` (stack table, architecture diagram), `06-decisions.md` (known minor issues for build phase)

**Dependencies:** None — starts first.

**Deliverables:**
- [ ] Next.js 14+ App Router project with Tailwind + shadcn/ui
- [ ] Prisma configured with Supabase connection string
- [ ] Auth.js skeleton (configured in Phase 1, completed by Auth agent)
- [ ] Folder structure: `app/`, `lib/`, `prisma/`, `components/`, `types/`
- [ ] `.env.example` with all required variables documented
- [ ] Consistent error response utility matching `02-data-model.md` error format
- [ ] CI pipeline: lint, typecheck, test on PR

**Phase activity:**
- **Phase 1:** Full scaffolding, dependency setup
- **Phase 2:** Review Quiz Engine + LLM Integration PRs, add global error boundaries
- **Phase 3:** Review Billing + Frontend PRs
- **Phase 4:** Production hardening — retry logic, logging (Sentry), monitoring (Vercel Analytics), performance optimization

---

### 2. Data Layer

**Mission:** Implement the Prisma schema, run migrations, create seed data, and provide typed database utilities.

**Owns:**
- `prisma/schema.prisma` — all models, enums, indexes, relations exactly as specified in `02-data-model.md`
- `prisma/migrations/` — initial migration
- `prisma/seed.ts` — seed script with sample user, flashcards, and review logs for development
- `lib/db.ts` — singleton Prisma client (serverless-safe)
- `lib/db/queries.ts` — reusable query helpers (e.g., `getCardsDue`, `getTodayStats`, `countReviewsSinceLastNew`)

**Spec references:** `02-data-model.md` (full schema, enums, indexes, relations), `03-srs-algorithm.md` (FSRS state columns, card selection algorithm)

**Dependencies:** Orchestrator (project scaffolding, Prisma init)

**Deliverables:**
- [ ] Prisma schema with all 4 models: `User`, `Flashcard`, `ReviewLog`, `StudySession`
- [ ] All 4 enums: `SubscriptionStatus`, `CharacterSet`, `CardState`, `Rating`
- [ ] All indexes from spec: `(userId, due)`, `(userId, word)` unique, `(userId, reviewedAt)`, `(flashcardId, reviewedAt)`, `(sessionId)`, `(userId, startedAt)`, `(stripeCustomerId)`
- [ ] Seed script with ≥10 flashcards across all 4 card states
- [ ] Singleton Prisma client with Supabase pooled connection (`?pgbouncer=true`)
- [ ] Query helpers for card selection algorithm (Section 4 of `03-srs-algorithm.md`)

**Phase activity:**
- **Phase 1:** All deliverables

---

### 3. Auth

**Mission:** Implement Google OAuth via Auth.js, session middleware, and subscription-aware access control.

**Owns:**
- `app/api/auth/[...nextauth]/route.ts` — Auth.js route handler
- `lib/auth.ts` — Auth.js configuration (Google provider, JWT strategy, callbacks)
- `middleware.ts` — Edge Middleware for session validation, rate limiting, subscription checks
- Login/logout UI components
- User profile settings page (character set toggle: traditional/simplified)

**Spec references:** `02-data-model.md` (auth endpoints, subscription enforcement rules, `canAccessQuiz` logic), `05-tech-architecture.md` (JWT strategy, session management, Edge Middleware)

**Dependencies:** Orchestrator (scaffolding), Data Layer (User model)

**Deliverables:**
- [ ] Auth.js with Google OAuth provider, JWT strategy
- [ ] JWT contains `userId`, `email`, `name` — subscription status is NOT in JWT
- [ ] Edge Middleware: validates session on all `/api/*` routes (except `/api/auth/*` and `/api/billing/webhook`)
- [ ] Subscription gating: `/api/quiz/*` returns 403 `SUBSCRIPTION_REQUIRED` for lapsed/cancelled users
- [ ] `GET /api/flashcards` and `GET /api/flashcards/export` remain accessible to lapsed users
- [ ] Rate limiting via `@upstash/ratelimit` per the limits in `02-data-model.md`
- [ ] Character set settings toggle (updates `User.characterSet`)

**Phase activity:**
- **Phase 1:** Google OAuth, JWT, basic middleware
- **Phase 3:** Subscription gating middleware (after Billing agent sets up Stripe status updates)

---

### 4. Quiz Engine

**Mission:** Implement the FSRS-powered card selection, quiz API routes, and pinyin verification — the core learning loop backend.

**Owns:**
- `lib/fsrs.ts` — FSRS scheduler initialization with config from `03-srs-algorithm.md` Section 6
- `lib/fsrs.ts` — `toFsrsCard()` / `scheduleCard()` conversion helpers (Section 7)
- `app/api/quiz/start/route.ts` — `POST /api/quiz/start`
- `app/api/quiz/next-card/route.ts` — `GET /api/quiz/next-card` with full card selection algorithm
- `app/api/quiz/check-pinyin/route.ts` — `POST /api/quiz/check-pinyin`
- `app/api/quiz/submit-result/route.ts` — `POST /api/quiz/submit-result`
- `app/api/quiz/today-stats/route.ts` — `GET /api/quiz/today-stats`
- `lib/pinyin.ts` — Pinyin normalization and verification (Section 3 of `01-quiz-flow.md`)

**Spec references:** `01-quiz-flow.md` (state machine, pinyin verification rules, edge cases), `02-data-model.md` (quiz API endpoints, request/response shapes), `03-srs-algorithm.md` (FSRS config, binary rating mapping, card selection algorithm, daily limits)

**Dependencies:** Orchestrator (scaffolding), Data Layer (schema, query helpers), Auth (middleware protecting quiz routes)

**Deliverables:**
- [ ] FSRS scheduler with parameters: `request_retention=0.9`, `maximum_interval=365`, `enable_fuzz=true`, `enable_short_term=true`
- [ ] Card selection with priority ordering: Learning/Relearning → overdue Review → New (interleaved 1:5)
- [ ] Daily limits: 20 new cards/day (hard), 1000 reviews/day (soft)
- [ ] Session-scoped dedup: exclude cards already reviewed in current session
- [ ] Pinyin normalization: lowercase, strip whitespace/hyphens/apostrophes, tone-mark rejection with soft error
- [ ] Submit-result: FSRS `repeat()` → update Flashcard + create ReviewLog + increment StudySession counters
- [ ] Today-stats: aggregate from ReviewLog, compute streak from StudySession records

**Phase activity:**
- **Phase 2:** All deliverables

---

### 5. LLM Integration

**Mission:** Build the Poe API client, implement all 3 LLM call types with Zod validation, and add caching/prefetching for latency mitigation.

**Owns:**
- `lib/llm/client.ts` — Poe API client (OpenAI SDK with `baseURL: "https://api.poe.com/v1"`)
- `lib/llm/call.ts` — Generic `callLLM<T>()` with retry, timeout (10s), code-fence stripping, Zod validation
- `lib/llm/schemas.ts` — All 3 Zod schemas: `SentenceGenerationResponse`, `TranslationCheckResponse`, `AICardCreationResponse`, `WordBreakdownItem`
- `lib/llm/prompts.ts` — System messages and user message templates for all 3 call types
- `lib/llm/sanitize.ts` — `sanitizeForPrompt()` for prompt injection prevention
- `app/api/quiz/generate-sentence/route.ts` — `POST /api/quiz/generate-sentence`
- `app/api/quiz/check-translation/route.ts` — `POST /api/quiz/check-translation`
- `app/api/flashcards/ai-create/route.ts` — `POST /api/flashcards/ai-create`
- Same-day sentence caching (read/write `ReviewLog.sentenceResponseJson`)
- Prefetching logic for next card's sentence
- LLM call logging (userId, callType, model, tokens, latency, success)

**Spec references:** `04-llm-integration.md` (authoritative — full prompts, Zod schemas, config, error handling, caching, security, cost model)

**Dependencies:** Orchestrator (scaffolding), Data Layer (ReviewLog for caching, Flashcard for card lookup), Auth (middleware protecting LLM endpoints)

**Deliverables:**
- [ ] Poe API client using `openai` npm package with custom `baseURL`
- [ ] `callLLM<T>()` generic function: retry (1 retry), 10s timeout, code-fence stripping, Zod parse
- [ ] All 3 Zod schemas copied verbatim from `04-llm-integration.md` Section 5
- [ ] All 3 prompt templates copied verbatim from `04-llm-integration.md` Section 1
- [ ] Sentence generation: derives `userLevel` from card count (<300/300-1500/>1500), `characterSet` from user profile
- [ ] Translation checking: resolves `targetWord` and `targetMeaning` from flashcardId
- [ ] AI card creation: auto-detects `inputLanguage` (CJK → chinese, ASCII → english)
- [ ] Same-day sentence caching via `ReviewLog.sentenceResponseJson`
- [ ] Prefetch next card's sentence during current card review
- [ ] Error handling per the table in `04-llm-integration.md` Section 3 (timeout, malformed JSON, rate limit, 401, network, content filter, points exhausted)
- [ ] `sanitizeForPrompt()`: strip code fences, flatten newlines, remove braces, truncate to 500 chars
- [ ] LLM call logging with all fields from Section 7

**Phase activity:**
- **Phase 2:** All deliverables

---

### 6. Frontend

**Mission:** Build all user-facing UI: quiz state machine, flashcard management, metrics dashboard, and responsive mobile layout.

**Owns:**
- `app/(quiz)/` — Quiz page and state machine UI
  - Sentence display with target word highlighting (`<mark>` tags)
  - Translation input + submission
  - Pinyin input + submission
  - Correct/incorrect feedback states
  - Retyping flows (translation and pinyin)
  - Card complete + auto-advance
  - Session summary ("All caught up!")
  - Loading skeletons during LLM calls
  - Hover tooltips (desktop) and long-press tooltips (mobile) with save button
  - Idle timeout (4-min warning, 5-min pause)
  - `localStorage` session persistence for page refresh recovery
  - Browser back-button interception
- `app/(cards)/` — Flashcard management page
  - Card list with cursor-based pagination, search, state filter chips, sort
  - Inline edit / delete with confirmation
  - AI card creation modal (input → Generate with AI → review → save)
  - Quick-save integration (from quiz tooltip)
- `app/(dashboard)/` — Metrics dashboard
  - 4 stat cards: Due Today, Streak, 7-Day Accuracy, Total Cards
  - Cards-by-state stacked bar
  - Reviews + accuracy chart (7d/30d/90d/all)
- `app/(settings)/` — User settings (character set toggle, account info)
- `app/(billing)/` — Subscription status, upgrade CTA, Stripe redirect
- `components/` — Shared UI components (via shadcn/ui)
- Responsive layout per breakpoints in `05-tech-architecture.md`: mobile-first, touch targets ≥44px, virtual keyboard handling

**Spec references:** `01-quiz-flow.md` (state machine, hover-to-save, mobile adaptations, edge cases), `05-tech-architecture.md` (wireframes, breakpoints, touch targets, virtual keyboard handling, mobile layout)

**Dependencies:**
- Quiz Engine (quiz API routes) and LLM Integration (generate-sentence, check-translation) for quiz UI
- Data Layer (flashcard CRUD endpoints) for card management
- Auth (session, login/logout) for protected pages
- Billing (subscription status, checkout redirect) for billing UI

**Deliverables:**
- [ ] Quiz state machine with all 14 states from `01-quiz-flow.md`
- [ ] Client-side tracking variables: `currentCardCorrect`, `cardsReviewed`, `cardsCorrect`, `currentStreak`, `longestStreak`
- [ ] Hover-to-save: desktop (hover + double-click) and mobile (long-press + save button)
- [ ] Target word non-hoverable during quiz, hoverable after `CARD_COMPLETE`
- [ ] Loading skeleton during LLM calls, "Taking longer than usual..." after 3s
- [ ] Flashcard list: pagination, search, state filter, sort, edit, delete
- [ ] AI card creation: input → generate → editable preview → save (duplicate warning)
- [ ] Metrics dashboard with 4 stat cards + charts
- [ ] Responsive layout at all 4 breakpoints (sm/md/lg/xl)
- [ ] Mobile: touch targets ≥44px, virtual keyboard scroll, swipe left on card complete
- [ ] `localStorage` session recovery on page refresh
- [ ] Browser back-button interception with confirmation dialog
- [ ] Idle timeout (4-min warning banner, 5-min auto-pause)
- [ ] Offline banner with auto-retry on reconnect

**Phase activity:**
- **Phase 2:** Quiz UI, flashcard CRUD UI
- **Phase 3:** Hover-to-save tooltips, AI card creation, metrics dashboard, billing UI
- **Phase 4:** Responsive/mobile polish, performance optimization (code splitting, dynamic imports for Stripe.js + chart library)

---

### 7. Billing

**Mission:** Implement Stripe integration for subscriptions, webhook-driven status updates, and view-only mode for lapsed users.

**Owns:**
- `app/api/billing/create-checkout/route.ts` — `POST /api/billing/create-checkout`
- `app/api/billing/webhook/route.ts` — `POST /api/billing/webhook`
- `app/api/billing/portal/route.ts` — `GET /api/billing/portal`
- `app/api/billing/status/route.ts` — `GET /api/billing/status`
- `lib/stripe.ts` — Stripe SDK client, price IDs, webhook signature verification
- `app/api/flashcards/export/route.ts` — `GET /api/flashcards/export` (available to all users including lapsed)
- Stripe product/price configuration ($4.99/mo, $39.99/yr)
- Webhook event handling: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`

**Spec references:** `02-data-model.md` (billing endpoints, webhook events, subscription enforcement, export endpoint), `05-tech-architecture.md` (Stripe integration pattern)

**Dependencies:** Orchestrator (scaffolding), Data Layer (User model with subscription fields), Auth (middleware — Billing provides the subscription status that Auth middleware checks)

**Deliverables:**
- [ ] Stripe Checkout Session creation with `userId` in metadata
- [ ] Webhook handler with signature verification for all 5 event types
- [ ] `subscriptionStatus` updates: TRIAL → ACTIVE (on payment), ACTIVE → LAPSED (on payment failure), ACTIVE → CANCELLED (on deletion)
- [ ] `stripeCustomerId` and `stripeSubscriptionId` stored on User
- [ ] Customer Portal redirect for self-service billing management
- [ ] `/api/billing/status` returning `canAccessQuiz` boolean
- [ ] `/api/flashcards/export` — full card export as downloadable JSON (not subscription-gated)
- [ ] Trial logic: 7-day trial from signup, `trialEndsAt` check

**Phase activity:**
- **Phase 3:** All deliverables

---

### 8. QA

**Mission:** Define the test strategy, write unit/integration/E2E tests, and verify edge cases from the spec.

**Owns:**
- Test infrastructure setup (Jest or Vitest for unit/integration, Playwright for E2E)
- `__tests__/` or co-located `.test.ts` files
- Unit tests for pure logic: FSRS helpers, pinyin normalization, sanitizeForPrompt, card selection algorithm
- Integration tests for API routes: quiz flow, flashcard CRUD, billing webhooks
- E2E tests for critical user journeys: sign in → create card → quiz → submit result
- Edge case verification from `01-quiz-flow.md` Section 4 and `06-decisions.md` known issues
- Test fixtures and mocks (Poe API mock, Stripe webhook mock, Prisma test database)

**Spec references:** `01-quiz-flow.md` (edge case table — 13 scenarios), `06-decisions.md` (known minor issues to verify during build)

**Dependencies:** All other agents (tests are written against their code)

**Deliverables:**
- [ ] Test infrastructure: Vitest + Playwright configured in CI
- [ ] Unit tests for `lib/pinyin.ts`: all examples from `01-quiz-flow.md` Section 3.5
- [ ] Unit tests for `lib/fsrs.ts`: `toFsrsCard()`, `scheduleCard()` with Good and Again ratings
- [ ] Unit tests for `lib/llm/sanitize.ts`: code fence stripping, length truncation
- [ ] Unit tests for card selection algorithm: priority ordering, daily limits, interleaving
- [ ] Integration tests for quiz API routes: start → next-card → generate-sentence → check-translation → check-pinyin → submit-result → today-stats
- [ ] Integration tests for flashcard CRUD: create, read (with pagination/filter/search), update, delete, ai-create, quick-save, export
- [ ] Integration tests for billing webhooks: all 5 event types update `subscriptionStatus` correctly
- [ ] E2E test: full quiz flow (sign in → start session → review card → submit → session summary)
- [ ] Edge case tests from `01-quiz-flow.md` Section 4:
  - LLM timeout during sentence generation (skip card)
  - LLM timeout during translation checking (fallback to string similarity)
  - Malformed LLM JSON (retry + fallback)
  - Empty translation submission (blocked client-side)
  - Chinese text in translation input (soft rejection)
  - English text in pinyin input (soft rejection)
  - Tone-marked pinyin input (soft rejection, not counted as incorrect)
  - Page refresh mid-quiz (localStorage recovery)
  - Idle timeout (5-min auto-pause)
- [ ] Poe API mock for deterministic LLM responses in tests
- [ ] Stripe webhook mock with signature generation

**Phase activity:**
- **Phase 2:** Unit tests for Quiz Engine + LLM Integration, integration tests for quiz API
- **Phase 3:** Integration tests for billing, flashcard CRUD tests
- **Phase 4:** E2E tests, edge case regression suite, performance benchmarks

---

### 9. Security Expert

**Mission:** Review every outgoing commit for security vulnerabilities, credential leaks, and adherence to secure coding practices before code leaves the local repository.

**Owns:**
- Pre-commit security review gate — all commits must pass her review before being pushed
- `.gitignore` and `.env.example` hygiene — ensure secrets never enter version control
- OWASP Top 10 scanning across all API routes (injection, XSS, CSRF, broken auth, etc.)
- Prompt injection prevention review for all LLM-facing code (`lib/llm/sanitize.ts`, prompt templates)
- Input validation audit — all user-facing endpoints validate and sanitize inputs via Zod
- Stripe webhook signature verification — ensure `constructEvent()` is used correctly
- Auth.js configuration review — JWT secret strength, callback security, CSRF protection
- Rate limiting verification — confirm `@upstash/ratelimit` is applied to all public endpoints
- Dependency audit — flag known CVEs in `package.json` dependencies

**Spec references:** `02-data-model.md` (auth endpoints, error format, rate limits), `04-llm-integration.md` (sanitizeForPrompt, prompt injection prevention), `05-tech-architecture.md` (JWT strategy, Edge Middleware, Stripe webhook verification)

**Dependencies:** None — reviews output from all other agents.

**Deliverables:**
- [ ] Pre-commit review checklist applied to every commit:
  - No hardcoded secrets, API keys, or connection strings (must use `process.env`)
  - No `.env` files staged (only `.env.example` with placeholder values)
  - All user inputs validated with Zod before use
  - All database queries use Prisma (no raw SQL without parameterization)
  - All LLM inputs pass through `sanitizeForPrompt()`
  - No `dangerouslySetInnerHTML` without explicit sanitization
  - All API routes behind auth middleware (except public routes)
  - Stripe webhooks verify signatures before processing
  - No `eval()`, `Function()`, or dynamic code execution
  - Rate limiting applied to all authenticated endpoints
- [ ] Security review sign-off on each phase gate before merge
- [ ] Dependency audit report at project start and before production deploy
- [ ] Credential rotation checklist for production deployment

**Phase activity:**
- **Phase 1:** Review scaffolding, auth config, DB connection strings, `.gitignore` completeness
- **Phase 2:** Review quiz API routes for injection, LLM code for prompt injection, pinyin verification for ReDoS
- **Phase 3:** Review Stripe integration for webhook spoofing, subscription bypass, export endpoint for data leakage
- **Phase 4:** Final security audit, dependency CVE check, production environment review

---

## Dependency Graph

```
Phase 1                    Phase 2                        Phase 3              Phase 4
────────                   ────────                       ────────             ────────

Orchestrator ──┐
               │
               ├──► Data Layer ──┐
               │                 │
               ├──► Auth ────────┼──► Quiz Engine ──┐
               │                 │                  │
               │                 ├──► LLM Integration┼──► Frontend (quiz) ──► Frontend (polish)
               │                 │                  │
               │                 │                  ├──► QA (unit/integ) ──► QA (E2E)
               │                 │                  │
               │                 └──────────────────┼──► Billing ──► Auth (sub gating)
               │                                    │
               └────────────────────────────────────┘
```

**Critical path:** Orchestrator → Data Layer → Quiz Engine + LLM Integration → Frontend (quiz UI)

**No cycles.** Every dependency arrow points forward in time. Auth has work in both Phase 1 (basic OAuth) and Phase 3 (subscription gating), but the Phase 3 work depends on Billing, not the other way around.

---

## Ownership Boundaries

### API Route Ownership

| Route Group | Owner | Notes |
|-------------|-------|-------|
| `/api/auth/*` | Auth | Auth.js managed routes |
| `/api/quiz/start` | Quiz Engine | |
| `/api/quiz/next-card` | Quiz Engine | |
| `/api/quiz/generate-sentence` | LLM Integration | Calls Poe API |
| `/api/quiz/check-translation` | LLM Integration | Calls Poe API |
| `/api/quiz/check-pinyin` | Quiz Engine | Server-side string comparison, no LLM |
| `/api/quiz/submit-result` | Quiz Engine | FSRS scheduling |
| `/api/quiz/today-stats` | Quiz Engine | Aggregation query |
| `/api/flashcards` (CRUD) | Quiz Engine | GET, POST, PUT, DELETE |
| `/api/flashcards/ai-create` | LLM Integration | Calls Poe API |
| `/api/flashcards/quick-save` | LLM Integration | May call Poe API |
| `/api/flashcards/export` | Billing | Not subscription-gated |
| `/api/metrics/*` | Frontend | Aggregation queries, co-owned with dashboard UI |
| `/api/billing/*` | Billing | Stripe integration |

### UI Screen Ownership

| Screen | Owner | Phase |
|--------|-------|-------|
| Login / sign-in | Auth | 1 |
| Quiz (all states) | Frontend | 2 |
| Flashcard list + edit/delete | Frontend | 2 |
| AI card creation modal | Frontend | 3 |
| Hover-to-save tooltip | Frontend | 3 |
| Metrics dashboard | Frontend | 3 |
| Settings (character set) | Auth | 1 |
| Billing / subscription | Frontend | 3 |
| Session summary | Frontend | 2 |

---

## Coordination Model

1. **Sequential phase gates.** Phases 1 → 2 → 3 → 4. An agent's Phase N work must be merged before dependent agents start Phase N+1 work.

2. **Parallel within phases.** Within a phase, independent agents work concurrently. In Phase 2, Quiz Engine and LLM Integration can develop in parallel — they integrate through shared types and API contracts defined in `02-data-model.md`.

3. **Shared types as contracts.** `types/` directory contains TypeScript types derived from the Prisma schema and API response shapes. All agents import from here — no agent defines its own version of shared types.

4. **Orchestrator reviews all PRs.** Every agent's PR is reviewed by the Orchestrator for: spec compliance, error handling consistency, TypeScript strictness, and naming conventions.

5. **Security Expert reviews all outgoing commits.** Before any commit is pushed to the remote repository, the Security Expert performs a security review. This is a hard gate — no code leaves the local environment without her sign-off. She checks for credential leaks, injection vulnerabilities, prompt injection vectors, missing input validation, and OWASP compliance.

6. **Spec is source of truth.** If an agent encounters ambiguity, the resolution order is: (1) the relevant spec doc, (2) `06-decisions.md`, (3) ask the user. Agents do not invent behavior not covered by the spec.
