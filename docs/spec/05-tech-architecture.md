# 05 — Technical Architecture

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 14+ (App Router) | Full-stack React with server components, API routes, and middleware. Eliminates need for separate backend. |
| Styling | Tailwind CSS + shadcn/ui | Utility-first CSS with pre-built accessible components. Fast iteration, consistent design tokens. |
| Database | PostgreSQL (Supabase) | Relational model fits FSRS state + review logs well. Supabase provides managed Postgres with connection pooling, backups, and a dashboard. |
| ORM | Prisma | Type-safe database client generated from schema. Declarative migrations. Excellent TypeScript DX. |
| Auth | Auth.js (NextAuth v5) | Built-in Google OAuth provider, JWT sessions, middleware integration. Battle-tested in Next.js ecosystem. |
| SRS | ts-fsrs | TypeScript implementation of the FSRS-5 algorithm. Handles all scheduling math: `repeat(card, rating)` returns new state + next due date. |
| AI | Poe API → Gemini 2.5 Flash | OpenAI-compatible API gateway (`https://api.poe.com/v1`). Uses `openai` npm package. Points-based pricing. Underlying model: Gemini 2.5 Flash (Poe bot name: `Gemini-2.5-Flash`). |
| Payments | Stripe | Checkout Sessions for payment, Customer Portal for self-service, Webhooks for event-driven status updates. |
| Hosting | Vercel | Zero-config Next.js deployment. Serverless functions, edge middleware, global CDN, preview deploys. |
| Monitoring | Vercel Analytics + Sentry | Vercel for Web Vitals and usage metrics. Sentry for error tracking, performance traces, and alerting. |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            BROWSER                                   │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  ┌────────────┐  │
│  │  Quiz View   │  │ Card Manager │  │  Metrics  │  │  Billing   │  │
│  │  (React SC)  │  │  (React SC)  │  │ (React SC)│  │ (React SC) │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  └─────┬──────┘  │
│         │                 │                │              │          │
│         └─────────┬───────┴────────┬───────┘              │          │
│                   │                │                      │          │
│              fetch/SWR        fetch/SWR              Stripe.js       │
└───────────────────┼────────────────┼──────────────────────┼──────────┘
                    │                │                      │
                    ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        VERCEL EDGE NETWORK                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Edge Middleware                                                │  │
│  │  • Auth.js session validation (JWT verify)                     │  │
│  │  • Rate limiting (@upstash/ratelimit)                          │  │
│  │  • Subscription status check (from JWT claims)                 │  │
│  └────────────────────────────────┬───────────────────────────────┘  │
│                               │                                      │
│  ┌────────────────────────────▼───────────────────────────────────┐  │
│  │  Next.js API Routes (Serverless Functions)                     │  │
│  │                                                                │  │
│  │  /api/auth/*        → Auth.js handlers (Google OAuth)          │  │
│  │  /api/quiz/*        → Quiz engine (FSRS + LLM orchestration)  │  │
│  │  /api/flashcards/*  → CRUD + AI card creation                 │  │
│  │  /api/metrics/*     → Aggregation queries                     │  │
│  │  /api/billing/*     → Stripe integration                      │  │
│  └──────┬──────────────────────┬──────────────────────┬──────────┘  │
│         │                      │                      │              │
└─────────┼──────────────────────┼──────────────────────┼──────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Supabase        │  │  Poe API         │  │  Stripe API      │
│  (PostgreSQL)    │  │  (poe.com/v1)    │  │                  │
│                  │  │                  │  │  • Checkout      │
│  • Users         │  │  → Gemini 2.5    │  │  • Webhooks      │
│  • Flashcards    │  │    Flash         │  │  • Portal        │
│  • ReviewLogs    │  │  • Sentence gen  │  │  • Subscriptions │
│  • StudySessions │  │  • Translation   │  │                  │
│                  │  │    checking      │  │                  │
│  Connection via  │  │  • Card creation │  │  Via REST API +  │
│  Prisma (pooled) │  │  Via openai npm  │  │  stripe npm SDK  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Request Flow: Quiz Review

```
1. User clicks "Start Session"
   Browser → POST /api/quiz/start → DB: create StudySession → return sessionId

2. Fetch next card
   Browser → GET /api/quiz/next-card → DB: query due cards (FSRS) → return card

3. Generate sentence
   Browser → POST /api/quiz/generate-sentence → Poe API (Gemini 2.5 Flash): generate sentence → return sentence + word breakdown

4. User types translation, submits
   Browser → POST /api/quiz/check-translation → Poe API (Gemini 2.5 Flash): grade translation → return correct/incorrect + feedback

5. User types pinyin, submits
   Browser → POST /api/quiz/check-pinyin → Server: string comparison → return correct/incorrect

6. Submit final result
   Browser → POST /api/quiz/submit-result → ts-fsrs: compute new state → DB: update card + create ReviewLog

7. Repeat steps 2-6 until no cards due or user navigates away
   (Stats are saved as-you-go — each submit-result persists progress.
    There is no explicit "end session" action. Users simply leave when done.
    When no cards are due, the quiz shows "All caught up!" with today's stats.)
```

---

## Text-Based UI Wireframes

### 1. Quiz Screen — Sentence Display

```
┌──────────────────────────────────────────────────────────────┐
│  ←  Session: 8/23 cards                           ⏱ 12:34   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│         他  每天  都  在  圖書館  [學習]  中文 。              │
│                                                              │
│     (hover any word for pinyin + meaning)                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Translate the sentence to English...                  │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                    [ Submit Translation ]                     │
│                                                              │
│  Target word: 學習                                           │
│  Cards remaining: 15  ·  New: 3  ·  Review: 12              │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Notes:
- [學習] is visually highlighted (bold, underline, or accent color)
  to indicate the target word.
- All other words are hoverable/tappable for tooltips.
- Progress counter at top shows cards reviewed today.
- Timer is optional, tracks current session duration.
- No "End Session" button — user navigates away when done.
```

### 2. Correct State — Translation Feedback

```
┌──────────────────────────────────────────────────────────────┐
│  ←  Session: 8/23 cards                           ⏱ 12:34   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│         他  每天  都  在  圖書館  [學習]  中文 。              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ✓ He studies Chinese at the library every day.        │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │  Correct! Your translation captures the full meaning.  │  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                              │
│  Now type the pinyin for 學習:                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  (numbered format, e.g. xue2xi2)                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                      [ Submit Pinyin ]                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Notes:
- Green background/border on the translation input to indicate success.
- Feedback text from LLM displayed in a subtle card.
- Pinyin input appears immediately after translation is graded.
- Format hint inside the input field.
```

### 3. Incorrect State — Translation Feedback

```
┌──────────────────────────────────────────────────────────────┐
│  ←  Session: 8/23 cards                           ⏱ 13:05   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│         他  每天  都  在  圖書館  [學習]  中文 。              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ✗ He reads Chinese books at the library every day.    │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │  Not quite. '學習' means 'to study/learn', not 'to     │  │
│  │  read'. The sentence says he studies Chinese.           │  │
│  │                                                         │  │
│  │  Correct: "He studies Chinese at the library every      │  │
│  │  day."                                                  │  │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                              │
│  Type the correct translation:                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                      [ Confirm & Continue ]                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Notes:
- Red background/border on the translation input to indicate failure.
- Correct answer shown in the feedback area.
- User must retype the correct translation to reinforce learning.
- After retyping, proceeds to pinyin step (same as correct flow).
- This card will be rated AGAIN — FSRS schedules it sooner.
```

### 4. Pinyin Input Step

```
┌──────────────────────────────────────────────────────────────┐
│  ←  Session: 8/23 cards                           ⏱ 13:20   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│         他  每天  都  在  圖書館  [學習]  中文 。              │
│                                                              │
│  Translation: ✓ Correct                                      │
│                                                              │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  Type the pinyin for 學習:                                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  xue2xi2                                               │  │
│  └────────────────────────────────────────────────────────┘  │
│  Format: use numbered tones (e.g. xue2xi2, not xuéxí)       │
│                                                              │
│                      [ Submit Pinyin ]                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  ✓ Correct! xue2xi2                                 │     │
│  │              [ Next Card → ]                        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Notes:
- Pinyin input is always the second step, after translation.
- Format hint below the input explains numbered tone convention.
- On correct: green confirmation, then "Next Card" button.
- On incorrect: show expected pinyin, require retype (same
  pattern as incorrect translation).
- Auto-focus on the input field.
```

### 5. Word Tooltip (Hover/Tap)

```
       他  每天  都  在  圖書館  [學習]  中文 。
                           │
                           ▼
                    ┌──────────────┐
                    │  圖書館       │
                    │  tu2shu1guan3│
                    │  library     │
                    │              │
                    │  [ + Save ]  │
                    └──────────────┘

Notes:
- Triggered by hover (desktop) or tap (mobile).
- Shows: character, pinyin (numbered), English meaning.
- "Save" button calls POST /api/flashcards/quick-save.
- If card already exists for this word, show "Already saved ✓"
  instead of the Save button.
- Tooltip auto-dismisses on mouse leave or tap elsewhere.
- Positioned above or below the word depending on viewport space.
- Does NOT appear on the target word (which is already being tested).
```

### 6. Flashcard Management

```
┌──────────────────────────────────────────────────────────────┐
│  My Flashcards (247)                        [ + Add Card ]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 🔍  Search cards...                                  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Filter: [All ▾]  [New]  [Learning]  [Review]  [Relearning] │
│  Sort:   [Due date ▾]                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  學習        xue2xi2        to study / to learn      │    │
│  │  State: Review  ·  Due: Today  ·  Reps: 5           │    │
│  │                               [ Edit ] [ Delete ]    │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  圖書館      tu2shu1guan3   library                  │    │
│  │  State: New  ·  Due: Now  ·  Reps: 0                │    │
│  │                               [ Edit ] [ Delete ]    │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  每天        mei3tian1      every day                │    │
│  │  State: Review  ·  Due: Jan 18  ·  Reps: 8          │    │
│  │                               [ Edit ] [ Delete ]    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│              [ ← Previous ]  Page 1 of 13  [ Next → ]        │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Notes:
- Search filters across word, pinyin, and English meaning.
- State filter chips — clicking one filters; clicking again deselects.
- Each card row shows: word, pinyin, meaning, state, due date, reps.
- Edit opens an inline form or modal with editable fields.
- Delete shows a confirmation dialog.
- Cursor-based pagination rendered as Previous/Next buttons.
- "+ Add Card" opens the AI Card Creation screen.
```

### 7. AI Card Creation

```
┌──────────────────────────────────────────────────────────────┐
│  Create Flashcard                                    [ × ]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Enter a word or phrase:                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  圖書館                                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                    [ Generate with AI ✦ ]                     │
│                                                              │
│  ── AI Suggestion ──────────────────────────────────────     │
│                                                              │
│  Word:      ┌──────────────────────────────────────┐         │
│             │ 圖書館                                │         │
│             └──────────────────────────────────────┘         │
│                                                              │
│  Pinyin:    ┌──────────────────────────────────────┐         │
│             │ tu2shu1guan3                          │         │
│             └──────────────────────────────────────┘         │
│                                                              │
│  Meaning:   ┌──────────────────────────────────────┐         │
│             │ library                               │         │
│             └──────────────────────────────────────┘         │
│                                                              │
│  Example:   ┌──────────────────────────────────────┐         │
│             │ 我每個週末都會去圖書館借書。           │         │
│             └──────────────────────────────────────┘         │
│                                                              │
│  All fields are editable. Adjust before saving.              │
│                                                              │
│              [ Cancel ]              [ Save Card ]            │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Notes:
- User types a word (Chinese characters) and clicks "Generate with AI".
- Loading spinner while LLM generates (< 3s target).
- All four fields are pre-filled but editable.
- User reviews and adjusts, then clicks "Save Card".
- "Save Card" calls POST /api/flashcards.
- If the word already exists, show a warning: "You already have
  a card for 圖書館" with option to view existing card.
```

### 8. Metrics Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard                                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │    23    │  │    12    │  │   82%    │  │   247    │    │
│  │ Due Today│  │  Streak  │  │ Accuracy │  │  Total   │    │
│  │          │  │   days   │  │  (7-day) │  │  Cards   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  Cards by State                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░ │    │
│  │ ■ New (52)  ■ Learning (18)  ■ Review (170)  ■ RL(7)│    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Reviews & Accuracy (30 days)        Period: [30d ▾]         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  40 ┤                                                │    │
│  │     │    ▄                     ▄▄                    │    │
│  │  30 ┤   ██  ▄▄    ▄   ▄▄▄   ████  ▄                │    │
│  │     │  ███ ████  ██  █████  █████ ██▄               │    │
│  │  20 ┤ ████ ████ ███ ██████ ██████ ████              │    │
│  │     │ ████ ████ ███ ██████ ██████ ████   ▄          │    │
│  │  10 ┤ ████ ████ ███ ██████ ██████ ████  ██          │    │
│  │     │ ████ ████ ███ ██████ ██████ ████ ███          │    │
│  │   0 ┼────────────────────────────────────────        │    │
│  │      Jan 1                          Jan 15           │    │
│  │                                                      │    │
│  │  ── Cards reviewed   - - Accuracy %                  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  [ Start Studying → ]                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Notes:
- Four stat cards at top: Due Today, Streak, 7-Day Accuracy, Total Cards.
- Horizontal stacked bar shows card distribution by state.
- Line/bar chart: bars = cards reviewed per day, line = accuracy %.
- Period selector: 7d, 30d, 90d, All.
- "Start Studying" CTA at bottom links to quiz.
- Data from GET /api/metrics/overview and GET /api/metrics/history.
```

### 9. Session Summary

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │               Session Complete!                      │    │
│  │                                                      │    │
│  │        ┌──────────┐    ┌──────────┐                  │    │
│  │        │    18    │    │    14    │                  │    │
│  │        │ Reviewed │    │ Correct  │                  │    │
│  │        └──────────┘    └──────────┘                  │    │
│  │                                                      │    │
│  │             Accuracy: 77.8%                          │    │
│  │             Duration: 12 min                         │    │
│  │                                                      │    │
│  │  ┌──────────────────────────────────────────────┐    │    │
│  │  │  ████████████████████████░░░░░░░░ 78%        │    │    │
│  │  └──────────────────────────────────────────────┘    │    │
│  │                                                      │    │
│  │  Cards due tomorrow: 21                              │    │
│  │  Current streak: 12 days                             │    │
│  │                                                      │    │
│  │           [ Review Again ]   [ Dashboard ]            │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Notes:
- Rendered as a centered modal/overlay on top of the quiz screen.
- Shows: cards reviewed, cards correct, accuracy %, duration.
- Visual accuracy bar (green fill).
- Forward-looking: cards due tomorrow, current streak.
- This screen only appears when no cards are due ("All caught up!").
- There is no "End Session" button — users simply navigate away at any time.
- Stats are saved as-you-go (each card result is persisted immediately).
- "Review Again" starts a new session (if more cards became due).
- "Dashboard" returns to the metrics dashboard.
```

---

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| LLM sentence generation | < 3s | Non-streaming via Poe API; show loading skeleton. Use Gemini 2.5 Flash. Prefetch next card's sentence. Cache sentences per card for re-reviews within same day. |
| LLM translation check | < 2s | Non-streaming via Poe API. Gemini 2.5 Flash. Concise system prompt. |
| Page load (LCP) | < 1.5s | Server components for initial render. No client-side data fetching for above-the-fold content. Static shell + streaming. |
| API responses (non-LLM) | < 200ms | Prisma query optimization. Database indexes on hot paths. Connection pooling via Supabase. |
| Database queries | < 50ms | Composite indexes on `(userId, due)` and `(userId, reviewedAt)`. Avoid N+1 queries. Use `select` to limit returned columns. |
| Time to Interactive (TTI) | < 2s | Minimal client-side JS. shadcn components are server-renderable. Code-split quiz vs. management views. |
| Bundle size (JS) | < 150KB gzipped | Tree-shake unused shadcn components. Dynamic imports for Stripe.js and chart library. |

### LLM Latency Mitigation

1. **Loading indicators:** Show a skeleton/spinner immediately when an LLM call starts. The sentence display area shows a pulsing placeholder.
2. **Prefetching:** When the user is reviewing a card, prefetch the next card's sentence in the background via a queued request to the Poe API.
3. **Caching:** If a user sees the same card again on the same day (e.g., after an AGAIN rating), reuse the previously generated sentence rather than calling the LLM again.
4. **Timeout & retry:** 10s timeout on Poe API calls. One automatic retry on timeout. After second failure, show error with "Try Again" button.

---

## Mobile Responsiveness

### Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| `sm` | 640px+ | Single column, larger touch targets, full-width inputs |
| `md` | 768px+ | Side padding increases. Card list shows 2-column grid. |
| `lg` | 1024px+ | Max-width container (800px). Dashboard stats in a row. |
| `xl` | 1280px+ | No further changes (app content is capped at comfortable reading width). |

### Mobile-First Layout (< 640px)

```
Quiz Screen (mobile):
┌────────────────────────┐
│ ← Session 8/23  ⏱12:34│
├────────────────────────┤
│                        │
│  他 每天 都 在          │
│  圖書館 [學習] 中文。   │
│                        │
│  (tap any word for     │
│   pinyin + meaning)    │
│                        │
│ ┌────────────────────┐ │
│ │ Translate...       │ │
│ │                    │ │
│ │                    │ │
│ └────────────────────┘ │
│                        │
│   [ Submit Translation]│
│                        │
│ Due: 15 · New: 3       │
└────────────────────────┘
```

### Touch Targets

- All interactive elements (buttons, links, card rows) have a minimum tap target of **44px x 44px** (Apple HIG / WCAG 2.5.5).
- Buttons use `min-h-11` (44px) in Tailwind.
- Card list rows have `py-3` padding minimum for comfortable tapping.
- Tooltip "Save" button is large enough to tap without accidentally dismissing the tooltip.

### Virtual Keyboard Handling

- **Translation input:** When focused on mobile, the viewport scrolls so the input and submit button remain visible above the keyboard. Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` on focus.
- **Pinyin input:** Same scroll behavior. The format hint ("numbered tones, e.g. xue2xi2") remains visible.
- **Input mode:** Translation input uses `inputMode="text"`. Pinyin input uses `inputMode="text"` (not `latin` — users need digits for tone numbers).
- **Auto-submit:** No auto-submit on Enter for translation (user may want to review). Enter on pinyin input submits.
- **Viewport meta:** `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">` to prevent zoom on input focus (iOS Safari).

### Responsive Adjustments by Screen

| Screen | Mobile (< 640px) | Desktop (768px+) |
|--------|-------------------|-------------------|
| Quiz | Full-width sentence, stacked layout, larger input | Centered card layout, more whitespace |
| Flashcard list | Single column cards, swipe-to-delete | Table-like rows with inline actions |
| Metrics | Stats stacked 2x2, chart full-width | Stats in a row, chart with more detail |
| Card creation | Full-screen modal | Centered modal (480px wide) |
| Session summary | Full-screen overlay | Centered modal |
| Tooltip | Appears below word, full-width on very small screens | Floating popover positioned near word |

---

## Key Technical Decisions

### FSRS Integration

The `ts-fsrs` library provides:
- `createEmptyCard()` — initializes FSRS state for a new flashcard.
- `repeat(card, now)` — given current card state, returns scheduling options for each possible rating.
- We use a simplified two-rating system: `AGAIN` (forgot) and `GOOD` (remembered). This maps to FSRS ratings 1 and 3 respectively.

**Why two ratings instead of four?** The app's quiz has a binary outcome: the user's translation and pinyin are either correct or not. There's no subjective "Hard" vs. "Easy" distinction. Two ratings reduce decision fatigue and match the objective grading model.

### Character Set Support

The app supports both traditional (繁體字) and simplified (简体字) characters, controlled by a per-user `characterSet` preference (default: `TRADITIONAL`). The character set is passed to all LLM prompts so generated sentences match the user's preference. A settings toggle allows users to switch at any time. See `02-data-model.md` for the `CharacterSet` enum and `04-llm-integration.md` for how prompts are parameterized.

FSRS state is stored directly on the Flashcard row (not in a separate table) because:
- One card = one scheduling state. No need for a join.
- Atomic updates: card content and scheduling state update together.
- Simpler queries for the scheduler (`WHERE due <= now()`).

### Session Management

Auth.js uses **JWT strategy** (not database sessions) because:
- Serverless-friendly: no database lookup on every request.
- JWT is verified in Edge Middleware (fast, no cold start).
- User ID, email, and name are embedded in the JWT. Subscription status is **not** embedded (it can change asynchronously via Stripe webhooks).
- Quiz endpoints (`/api/quiz/*`) check `subscriptionStatus` against the database on every request to ensure lapsed users are blocked immediately.
- Trade-off: one extra DB lookup per quiz API call. Acceptable — the FSRS card query already hits the DB.

### LLM Prompt Design

Three LLM call types, each with full prompt templates, Zod validation schemas, and configuration. **See `04-llm-integration.md` for the authoritative prompt templates** — do not implement from these summaries.

- **Sentence generation:** Generates a natural Chinese sentence containing the target word, with a word-by-word breakdown. Non-streaming `json_object` mode. Temperature 0.7.
- **Translation checking:** Evaluates whether the user's English translation captures the sentence meaning, with emphasis on the target word. Returns boolean `correct` (LLM-determined, not score-threshold). Temperature 0.3.
- **AI card creation:** Given a Chinese or English word, returns traditional characters, numbered pinyin, meaning, and an example sentence. Temperature 0.5.

All calls go through the Poe API (OpenAI-compatible, `openai` npm package). Since Poe does not support structured JSON output (`response_format`), JSON formatting is enforced via prompts and all responses are validated server-side with Zod schemas before returning to the client. A code-fence stripping step handles occasional markdown wrapping.

### Database Connection Pooling

Supabase provides PgBouncer for connection pooling. Prisma connects via the pooled connection string (`?pgbouncer=true`). This is critical for serverless because:
- Each Vercel function invocation creates a new Prisma client instance.
- Without pooling, concurrent requests would exhaust Postgres connection limits.
- Supabase's pooler handles connection reuse transparently.

### Stripe Integration Pattern

```
User clicks "Subscribe"
  → Client calls POST /api/billing/create-checkout
  → Server creates Stripe Checkout Session (with userId in metadata)
  → Server returns checkout URL
  → Client redirects to Stripe Checkout

User completes payment on Stripe
  → Stripe sends checkout.session.completed webhook
  → Server verifies webhook signature
  → Server reads userId from session metadata
  → Server updates User.subscriptionStatus = ACTIVE
  → Server stores stripeSubscriptionId

Recurring billing
  → Stripe sends invoice.paid → keep ACTIVE
  → Stripe sends invoice.payment_failed → set LAPSED
  → Stripe sends customer.subscription.deleted → set CANCELLED
```

Lapsed users retain read access to their flashcard list but cannot start quiz sessions. This is enforced by middleware checking `subscriptionStatus` on `/api/quiz/*` endpoints.
