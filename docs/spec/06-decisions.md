# 06 — Assumptions & Open Decisions

This document gathers every decision made during spec writing that warrants your review. For each: the assumption made, the rationale, alternatives considered, and what changes if you decide differently.

---

## Product Decisions

### P1: "Easy" button after correct review?

**Assumed: No.** The quiz uses a binary pass/fail system — the app determines the outcome automatically (LLM grades translation, server checks pinyin). There is no user-facing difficulty button.

**Rationale:** Eliminates decision fatigue and prevents users from over-spacing cards by hitting "Easy." Repeated Good ratings naturally lengthen intervals.

**Alternative:** Add an optional "Easy" button (FSRS rating 4) for advanced users. Would require a settings toggle and a new state in the quiz flow.

**If changed:** Update `03-srs-algorithm.md` rating mapping, `01-quiz-flow.md` state machine (add `EASY_PROMPT` state after `PINYIN_CORRECT`), and the `Rating` enum in `02-data-model.md`.

Lexie answer: agree ✅ ✅
---

### P2: Free trial vs freemium vs paywall?

**Assumed: 7-day free trial with full access, then subscription required.**

**Rationale:** Free trial lets users experience the core value (LLM-powered quiz) before committing. Pure freemium (limited free tier) would still incur LLM costs. Hard paywall would reduce top-of-funnel.

**Alternatives:**
- Freemium: 5 free reviews/day, unlimited on paid. Lower conversion friction but ongoing LLM cost for free users.
- Hard paywall: Sign up → pay immediately. Highest revenue per user but worst acquisition.

**If changed:** Update `00-overview.md` assumptions, `02-data-model.md` subscription status enum, and billing middleware logic.

Lexie answer: agree ✅
---

### P3: Subscription pricing?

**Decided: $4.99/mo or $39.99/yr (~33% annual discount).**

**Rationale:** Aggressive pricing to maximize adoption. LLM cost is ~$3.06/user/month at 100 cards/day, leaving ~39% gross margin on LLM alone — tight but viable if cost optimizations (context caching, batch API) are pursued. Annual plan encourages commitment.

**Trade-off:** At 61% LLM cost ratio, there's limited room for infrastructure + payment processing before breaking even. Cost optimization levers (context caching at 10% input price, batch API at 50% discount for non-interactive calls) become essential, not optional.

**Alternatives:** $7.99/mo (healthier ~62% margin), $9.99/mo (~69% margin), usage-based pricing.

**If changed:** Update Stripe price IDs in `02-data-model.md` billing endpoints and `04-llm-integration.md` margin analysis.


---

### P4: Lapsed subscription behavior?

**Decided: View-only mode with data export.** Users can see their flashcard list and export all flashcard data, but cannot start quiz sessions or create cards via AI.

**Implementation:** Added `GET /api/flashcards/export` endpoint that returns all cards as downloadable JSON (including FSRS state for migration to other apps). Explicitly exempt from subscription gating — lapsed/cancelled users can access `GET /api/flashcards`, `GET /api/flashcards/export`.

**Files updated:** `02-data-model.md` (new export endpoint, updated subscription enforcement note).

Lexie answer: roughly agree, just let them access whatever flashcards flow already exists to download all your flashcards data. That should exist for paying users already. ✅ Applied
---

### P5: Daily card limits?

**Decided: 20 new cards/day (hard cap), 1000 review cards/day (soft cap — user can choose to continue).**

**Rationale:** 20 new cards/day prevents overwhelming beginners. 1000 reviews is very generous — almost no users will hit it — but provides a safety net against runaway LLM costs. Soft cap on reviews respects motivated learners.

**Alternatives:** 200 reviews/day (more conservative), no limits, configurable per user.

**If changed:** Update `03-srs-algorithm.md` Section 5, `02-data-model.md` next-card logic.

Lexie answer: use 1000. ✅ Applied
---

### P6: Simplified character support?

**Decided: Support both traditional and simplified characters from launch.**

**Implementation:** Added `CharacterSet` enum (`TRADITIONAL` | `SIMPLIFIED`) and `characterSet` field (default `TRADITIONAL`) to User model. All LLM prompts are parameterized with `{{characterSet}}` to generate content in the user's preferred character set. Settings UI includes a toggle.

**Files updated:** `02-data-model.md` (enum + User field), `04-llm-integration.md` (all 3 prompts parameterized), `01-quiz-flow.md`, `05-tech-architecture.md`, `00-overview.md` (removed from out-of-scope).

Lexie answer: support from the beginning. ✅ Applied
---

### P7: Fixed session length vs open-ended?

**Decided: Open-ended with no "End Session" button. Stats save as-you-go.**

Sessions continue until the user runs out of due cards or simply navigates away. There is no explicit "End Session" button. All progress is saved after each card review (via `submit-result`), so nothing is lost if the user closes the app mid-session. Card counts and stats are day-based, not session-based. The "All caught up!" summary screen only appears when the review queue is empty.

**Files updated:** `01-quiz-flow.md` (state machine, tracking variables), `02-data-model.md` (replaced `end-session` with `today-stats`), `05-tech-architecture.md` (wireframes, request flow).

Lexie answer: mostly agreed, but make sure there isn't an "end session" button. Users should be able to come and go as they please from the session. If you're counting cards completed, that should just be based on the day. Any stats should save as-you-go ✅ Applied
---

### P8: Accept tone-marked pinyin?

**Assumed: No. Numbered format only (ni3hao3).** Tone-marked input (nǐhǎo) shows a soft error suggesting numbered format — does not count as incorrect.

**Rationale:** Numbered pinyin is unambiguous, works on all keyboards, and avoids IME complexity. Tone marks require special keyboard input that most learners don't have configured.

**Alternative:** Accept both formats and normalize internally.

**If changed:** Update pinyin normalization in `01-quiz-flow.md` Section 3 and the `check-pinyin` endpoint.

Lexie answer: agree ✅
---

## Technical Decisions

### T1: LLM provider?

**Decided: Google Gemini API (first-party, `@google/genai` SDK) → Gemini 2.5 Flash (primary), Gemini 2.5 Pro (fallback for translation checking if quality issues arise).**

**Rationale:** Direct first-party access to Gemini models. Native structured JSON output via `responseMimeType: "application/json"`, eliminating the need for prompt-based JSON coaxing and reducing malformed-output retries. Clean per-token pricing with no gateway markup. Gemini 2.5 Flash has strong multilingual/Chinese capabilities.

**Previously:** Originally went through the Poe API (OpenAI-compatible gateway at `https://api.poe.com/v1`) using the `openai` npm package. Migrated off in April 2026 to remove the gateway layer, unlock native JSON mode, and simplify billing.

**Cost:** Gemini 2.5 Flash is $0.30 / 1M input tokens and $2.50 / 1M output tokens at the ≤200K context tier.

**Alternatives:** OpenAI API, Claude API, Vertex AI (same Gemini models, GCP-project-scoped billing).

**If changed:** Update `04-llm-integration.md` SDK setup, cost analysis, and error handling.

Lexie answer: agree ✅
---

### T2: Database host?

**Assumed: Supabase (managed PostgreSQL).**

**Rationale:** Free tier for development, built-in connection pooling (PgBouncer), managed backups, and a dashboard. Good fit for serverless (Vercel).

**Alternatives:** Neon (serverless Postgres, branching), Railway, PlanetScale (MySQL), self-hosted.

**If changed:** Update `05-tech-architecture.md` stack table and connection pooling notes. Prisma ORM remains the same regardless.

Lexie answer: agree ✅
---

### T3: Hosting?

**Assumed: Vercel.**

**Rationale:** Zero-config Next.js deployment, edge middleware for auth/rate limiting, preview deploys, analytics built in.

**Alternatives:** AWS (Amplify or ECS), Fly.io, Railway, Cloudflare Pages.

**If changed:** Update `05-tech-architecture.md` architecture diagram and deployment notes.

Lexie answer: agree ✅
---

### T4: FSRS state storage?

**Assumed: Persisted directly on the Flashcard row (not a separate table).**

**Rationale:** One card = one scheduling state. Atomic updates. Simple queries (`WHERE due <= now()`). No join needed.

**Alternative:** Separate `FsrsState` table (one-to-one). Cleaner separation but adds a join to every scheduling query.

**If changed:** Add FsrsState model to `02-data-model.md`, update card selection queries and submit-result logic.

Lexie answer: agree ✅
---

### T5: Chinese word segmentation approach?

**Assumed: LLM-side.** The LLM segments the sentence into words as part of the `wordBreakdown` field in sentence generation.

**Rationale:** The LLM already produces the sentence, so asking it to also segment is natural and avoids a separate NLP library. GPT-4o-mini handles Chinese segmentation well.

**Alternative:** Client-side or server-side library (e.g., `jieba` for Python, or a WASM port). More reliable segmentation but adds complexity.

**If changed:** Add a segmentation step between sentence generation and the API response in `02-data-model.md`.

Lexie answer: agree ✅
---

### T6: Session management?

**Assumed: JWT via Auth.js.** User ID and email embedded in JWT. Subscription status checked against DB on quiz endpoints (not embedded in JWT).

**Rationale:** Serverless-friendly (no DB lookup for auth). Subscription status changes asynchronously via Stripe webhooks, so it must be checked live.

**Alternative:** Database sessions (Auth.js supports both). More revocable but requires a DB lookup on every request.

**If changed:** Update Auth.js config and `05-tech-architecture.md` session management section.

Lexie answer: agree ✅
---

### T7: Pre-generate sentences vs on-the-fly?

**Assumed: On-the-fly.** Sentences are generated when a card is selected for review, with prefetching of the next card's sentence.

**Rationale:** Avoids batch processing complexity and storage for pre-generated sentences. Prefetching hides latency for all but the first card in a session.

**Alternative:** Nightly batch job generates sentences for all cards due tomorrow. Eliminates runtime latency but increases storage and LLM cost (generates sentences for cards the user may not review).

**If changed:** Add a batch job, sentence storage table, and update the quiz flow to read from cache first.

Lexie answer: agree ✅
---

## Cross-Review Findings (Applied)

The following issues were found by cross-review agents and **have been fixed** in the spec files:

| # | Issue | Fix Applied |
|---|-------|-------------|
| 1 | `wordBreakdown` vs `sentenceWords` naming inconsistency | Standardized to `wordBreakdown` in `02-data-model.md`; server adds `isTarget` flag |
| 2 | `translation` field missing from generate-sentence API response | Added to `02-data-model.md` |
| 3 | Translation check response field names diverged (feedback/explanation, score/targetWordUsedCorrectly) | Aligned `02-data-model.md` to match `04-llm-integration.md` Zod schema |
| 4 | LLM endpoint paths inconsistent (`/api/llm/*` vs `/api/quiz/*`) | Fixed `04-llm-integration.md` to use canonical paths from `02-data-model.md` |
| 5 | `priorState` missing from ReviewLog (needed for daily new-card limit) | Added to `02-data-model.md` |
| 6 | `sentenceResponseJson` missing from ReviewLog (needed for same-day caching) | Added to `02-data-model.md` |
| 7 | `userLevel` derivation said "median difficulty" but meant card count | Fixed in `04-llm-integration.md` |
| 8 | Retyping translation step said "LLM-evaluated" but no LLM call was defined | Changed to simple string match in `01-quiz-flow.md` |
| 9 | Pinyin verification said "client-side" but API endpoint existed | Updated `01-quiz-flow.md` to say "server-side via API" |
| 10 | "First attempt" nuance missing from SRS rating mapping | Added to `03-srs-algorithm.md` |
| 11 | Prompt summaries in `05-tech-architecture.md` contradicted full prompts | Replaced with cross-reference to `04-llm-integration.md` |
| 12 | Subscription status in JWT becomes stale after Stripe webhook | Removed from JWT; quiz endpoints check DB directly (`05-tech-architecture.md`) |
| 13 | Streaming JSON not directly displayable character-by-character | Changed to non-streaming with prefetch strategy (`04-llm-integration.md`) |
| 14 | Pinyin Zod regex rejected valid neutral-tone omissions | Updated regex to allow optional tone numbers (`04-llm-integration.md`) |
| 15 | Next-card logic in API spec was oversimplified vs SRS algorithm | Updated `02-data-model.md` to reference full algorithm with priority ordering |

---

## Known Minor Issues (Deferred to Build Phase)

These are noted but not worth fixing in the spec — address during implementation:

1. **No onboarding flow for zero-card users.** The state machine handles "no cards due" but not "no cards at all." Add an empty-state screen during build.
2. **No manual card creation wireframe.** The AI creation flow is wireframed; a simple manual form should be added during UI implementation.
3. **`longestStreak` not persisted on User model.** Currently only tracked client-side per session. Add a column during build if the metrics dashboard needs all-time streak.
4. **Cost model doesn't account for free trial users.** The margin analysis assumes all users are paid. Blended cost is higher during trial-heavy periods.
5. **`maximum-scale=1` in viewport meta is an accessibility concern.** Use `font-size: 16px` on inputs instead to prevent iOS Safari zoom.
6. **Timer shown in quiz wireframe but not specified in state machine.** Implement as a simple cosmetic stopwatch during build.
7. **Card deletion during active quiz session.** Handle `404` from `submit-result` gracefully (skip card, advance to next).
8. **FSRS difficulty default of 0 is outside documented 1–10 range.** Use `ts-fsrs createEmptyCard()` for initialization, not raw DB defaults.
9. **`source_sentence` in hover-to-save data maps to `exampleSentence` on Flashcard.** Clarify during build.
10. **`last_review` (snake_case) in SRS doc vs `lastReview` (camelCase) in Prisma.** Use Prisma's `@map("last_review")` if needed.
