# 02 — Data Model & API Specification

## Entity-Relationship Diagram

```
┌──────────────────┐
│      User         │
│──────────────────│
│ id (PK)           │
│ email (UQ)        │
│ googleId (UQ)     │
│ subscriptionStatus│
│ stripeCustomerId  │
│ ...               │
└──────┬───────────┘
       │
       │ 1:N
       ├──────────────────────────────────┐
       │                                  │
       ▼                                  ▼
┌──────────────────┐           ┌──────────────────┐
│   Flashcard       │           │  StudySession     │
│──────────────────│           │──────────────────│
│ id (PK)           │           │ id (PK)           │
│ userId (FK→User)  │           │ userId (FK→User)  │
│ word              │           │ startedAt         │
│ pinyin            │           │ endedAt           │
│ englishMeaning    │           │ cardsReviewed     │
│ exampleSentence   │           │ cardsCorrect      │
│ [FSRS columns]    │           └────────┬─────────┘
│ state (enum)      │                    │
└──────┬───────────┘                    │
       │                                 │
       │ 1:N                             │ 1:N
       │                                 │
       ▼                                 │
┌──────────────────┐                    │
│   ReviewLog       │◄───────────────────┘
│──────────────────│
│ id (PK)           │
│ flashcardId (FK)  │
│ userId (FK→User)  │
│ sessionId (FK)    │
│ generatedSentence │
│ userTranslation   │
│ correctTranslation│
│ translationCorrect│
│ userPinyin        │
│ pinyinCorrect     │
│ overallRating     │
│ reviewedAt        │
└──────────────────┘

Relationships:
  User        1 ──── N  Flashcard       (a user owns many flashcards)
  User        1 ──── N  StudySession    (a user has many study sessions)
  User        1 ──── N  ReviewLog       (denormalized FK for fast queries)
  Flashcard   1 ──── N  ReviewLog       (each card has many reviews)
  StudySession 1 ──── N  ReviewLog      (each session contains many reviews)
```

---

## Full Schema (Prisma)

### Enums

```prisma
enum SubscriptionStatus {
  TRIAL
  ACTIVE
  LAPSED
  CANCELLED
}

enum CharacterSet {
  TRADITIONAL
  SIMPLIFIED
}

enum CardState {
  NEW
  LEARNING
  REVIEW
  RELEARNING
}

enum Rating {
  AGAIN
  GOOD
}
```

### User

| Column             | Type               | Constraints                          |
|--------------------|--------------------|--------------------------------------|
| id                 | UUID               | PK, default `gen_random_uuid()`      |
| email              | String             | NOT NULL, UNIQUE                     |
| name               | String             | NOT NULL                             |
| avatarUrl          | String?            | Nullable                             |
| googleId           | String             | NOT NULL, UNIQUE                     |
| characterSet       | CharacterSet       | NOT NULL, default `TRADITIONAL`      |
| subscriptionStatus | SubscriptionStatus | NOT NULL, default `TRIAL`            |
| trialEndsAt        | DateTime           | NOT NULL, default `now() + 7 days`   |
| stripeCustomerId   | String?            | Nullable, UNIQUE                     |
| stripeSubscriptionId | String?          | Nullable                             |
| createdAt          | DateTime           | NOT NULL, default `now()`            |
| updatedAt          | DateTime           | NOT NULL, `@updatedAt`               |

**Indexes:**
- `@@unique([googleId])` — OAuth lookup
- `@@unique([email])` — email lookup
- `@@index([stripeCustomerId])` — Stripe webhook lookup

```prisma
model User {
  id                   String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email                String             @unique
  name                 String
  avatarUrl            String?
  googleId             String             @unique
  characterSet         CharacterSet       @default(TRADITIONAL)
  subscriptionStatus   SubscriptionStatus @default(TRIAL)
  trialEndsAt          DateTime           @default(dbgenerated("now() + interval '7 days'"))
  stripeCustomerId     String?            @unique
  stripeSubscriptionId String?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  flashcards    Flashcard[]
  reviewLogs    ReviewLog[]
  studySessions StudySession[]

  @@index([stripeCustomerId])
}
```

### Flashcard

| Column          | Type      | Constraints                                    |
|-----------------|-----------|------------------------------------------------|
| id              | UUID      | PK, default `gen_random_uuid()`                |
| userId          | UUID      | FK → User, NOT NULL, ON DELETE CASCADE         |
| word            | String    | NOT NULL (traditional Chinese characters)      |
| pinyin          | String    | NOT NULL (numbered format, e.g. `ni3hao3`)     |
| englishMeaning  | String    | NOT NULL                                       |
| exampleSentence | String?   | Nullable, user-provided example                |
| difficulty      | Float     | NOT NULL, default `0` (FSRS)                   |
| stability       | Float     | NOT NULL, default `0` (FSRS)                   |
| due             | DateTime  | NOT NULL, default `now()` (FSRS)               |
| elapsed_days    | Int       | NOT NULL, default `0` (FSRS)                   |
| scheduled_days  | Int       | NOT NULL, default `0` (FSRS)                   |
| reps            | Int       | NOT NULL, default `0` (FSRS)                   |
| lapses          | Int       | NOT NULL, default `0` (FSRS)                   |
| state           | CardState | NOT NULL, default `NEW` (FSRS)                 |
| lastReview      | DateTime? | Nullable (FSRS, null until first review)       |
| createdAt       | DateTime  | NOT NULL, default `now()`                      |
| updatedAt       | DateTime  | NOT NULL, `@updatedAt`                         |

**Indexes:**
- `@@index([userId, due])` — scheduling queries: "get cards due for user X before time Y"
- `@@unique([userId, word])` — prevent duplicate cards per user

```prisma
model Flashcard {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId          String    @db.Uuid
  word            String
  pinyin          String
  englishMeaning  String
  exampleSentence String?
  difficulty      Float     @default(0)
  stability       Float     @default(0)
  due             DateTime  @default(now())
  elapsed_days    Int       @default(0)
  scheduled_days  Int       @default(0)
  reps            Int       @default(0)
  lapses          Int       @default(0)
  state           CardState @default(NEW)
  lastReview      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  reviewLogs ReviewLog[]

  @@unique([userId, word])
  @@index([userId, due])
}
```

### ReviewLog

| Column             | Type     | Constraints                              |
|--------------------|----------|------------------------------------------|
| id                 | UUID     | PK, default `gen_random_uuid()`          |
| flashcardId        | UUID     | FK → Flashcard, NOT NULL, ON DELETE CASCADE |
| userId             | UUID     | FK → User, NOT NULL, ON DELETE CASCADE   |
| sessionId          | UUID     | FK → StudySession, NOT NULL              |
| generatedSentence  | String   | NOT NULL (the Chinese sentence shown)    |
| sentenceResponseJson | String?  | Nullable; full LLM JSON response for same-day sentence caching |
| priorState         | CardState| NOT NULL (card's FSRS state *before* this review; needed for new-card-per-day limit tracking) |
| userTranslation    | String   | NOT NULL (what the user typed)           |
| correctTranslation | String   | NOT NULL (LLM's reference translation)   |
| translationCorrect | Boolean  | NOT NULL                                 |
| userPinyin         | String   | NOT NULL (what the user typed)           |
| pinyinCorrect      | Boolean  | NOT NULL                                 |
| overallRating      | Rating   | NOT NULL (AGAIN or GOOD)                 |
| reviewedAt         | DateTime | NOT NULL, default `now()`                |
| responseTimeMs     | Int?     | Nullable, milliseconds to submit         |

**Indexes:**
- `@@index([userId, reviewedAt])` — metrics queries over time
- `@@index([flashcardId, reviewedAt])` — card history lookups
- `@@index([sessionId])` — session detail queries

```prisma
model ReviewLog {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  flashcardId        String   @db.Uuid
  userId             String   @db.Uuid
  sessionId          String   @db.Uuid
  generatedSentence    String
  sentenceResponseJson String?
  priorState           CardState
  userTranslation      String
  correctTranslation   String
  translationCorrect   Boolean
  userPinyin           String
  pinyinCorrect      Boolean
  overallRating      Rating
  reviewedAt         DateTime @default(now())
  responseTimeMs     Int?

  flashcard    Flashcard    @relation(fields: [flashcardId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  studySession StudySession @relation(fields: [sessionId], references: [id])

  @@index([userId, reviewedAt])
  @@index([flashcardId, reviewedAt])
  @@index([sessionId])
}
```

### StudySession

| Column        | Type      | Constraints                            |
|---------------|-----------|----------------------------------------|
| id            | UUID      | PK, default `gen_random_uuid()`        |
| userId        | UUID      | FK → User, NOT NULL, ON DELETE CASCADE |
| startedAt     | DateTime  | NOT NULL, default `now()`              |
| endedAt       | DateTime? | Nullable (set when session ends)       |
| cardsReviewed | Int       | NOT NULL, default `0`                  |
| cardsCorrect  | Int       | NOT NULL, default `0`                  |

**Indexes:**
- `@@index([userId, startedAt])` — recent session lookups, streak calculation

```prisma
model StudySession {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId        String    @db.Uuid
  startedAt     DateTime  @default(now())
  endedAt       DateTime?
  cardsReviewed Int       @default(0)
  cardsCorrect  Int       @default(0)

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  reviewLogs ReviewLog[]

  @@index([userId, startedAt])
}
```

### Subscription Table Decision

**Recommendation: No separate Subscription table for v1.** Store subscription state directly on User (`subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`, `trialEndsAt`).

**Rationale:**
- v1 has a single subscription tier — no plan comparison logic needed.
- Stripe is the source of truth for billing history, invoices, and payment methods. Duplicating that locally adds sync complexity with no benefit.
- The Stripe webhook handler updates `subscriptionStatus` on User directly (e.g., `invoice.paid` → ACTIVE, `customer.subscription.deleted` → CANCELLED).
- If v2 introduces multiple plans, grandfathered pricing, or usage-based billing, extract to a separate table then.

---

## API Endpoints

All endpoints are under `/api`. Unless noted, all non-auth endpoints require a valid Auth.js session.

### Auth (handled by Auth.js)

Auth.js manages these routes automatically via its route handler at `app/api/auth/[...nextauth]/route.ts`.

| Method | Path                          | Description                        |
|--------|-------------------------------|------------------------------------|
| GET    | `/api/auth/signin`            | Renders sign-in page (redirects to Google) |
| GET    | `/api/auth/callback/google`   | Google OAuth callback; creates/updates User record, sets session cookie |
| POST   | `/api/auth/signout`           | Destroys session                   |
| GET    | `/api/auth/session`           | Returns current session object (`{ user: { id, email, name, image } }`) or `null` |

These are standard Auth.js endpoints and require no custom implementation beyond configuration.

---

### Quiz

#### `POST /api/quiz/start`

Start a new study session.

**Request:** `{}` (empty body; userId from session)

**Response:** `201 Created`
```json
{
  "sessionId": "uuid",
  "startedAt": "2025-01-15T10:00:00Z"
}
```

**Side effects:** Creates a StudySession row.

---

#### `GET /api/quiz/next-card?sessionId={uuid}`

Get the next card due for review. The server runs the FSRS scheduler to select the highest-priority card.

**Query params:**
- `sessionId` — current session ID (for validation)

**Response:** `200 OK`
```json
{
  "flashcard": {
    "id": "uuid",
    "word": "學習",
    "pinyin": "xue2xi2",
    "englishMeaning": "to study / to learn",
    "state": "REVIEW",
    "reps": 5,
    "lapses": 1
  },
  "cardsRemaining": 14,
  "newCardsRemaining": 3
}
```

**Response (no cards due):** `200 OK`
```json
{
  "flashcard": null,
  "cardsRemaining": 0,
  "nextDueAt": "2025-01-16T08:00:00Z"
}
```

**Logic:**
1. Query due cards: `Flashcard WHERE userId = :userId AND due <= now()`.
2. Separate into: Learning/Relearning cards, overdue Review cards, New cards.
3. Priority: Learning/Relearning first → overdue Review (most overdue first) → New cards (interleave 1 new card every 5 reviews).
4. Apply daily limits: max 20 new cards/day, max 1000 reviews/day (soft cap). Count today's reviews from `ReviewLog WHERE reviewedAt >= today AND userId = :userId`.
5. Filter out cards already reviewed this session: exclude flashcardIds with a `ReviewLog` entry for the current `sessionId`.
6. Return the top result, or `null` if nothing is due.

> See `03-srs-algorithm.md` Section 4 for the full card selection algorithm and interleaving logic.

---

#### `POST /api/quiz/generate-sentence`

Generate a natural Chinese sentence containing the target word. Calls Gemini 2.5 Flash via the Gemini API.

**Request:**
```json
{
  "flashcardId": "uuid"
}
```

> The server derives `userLevel` from the user's total card count: beginner (<300 cards), intermediate (300–1500), advanced (>1500). The client does not send this.

**Response:** `200 OK`
```json
{
  "sentence": "他每天都在圖書館學習中文。",
  "translation": "He studies Chinese at the library every day.",
  "wordBreakdown": [
    { "word": "他", "pinyin": "ta1", "meaning": "he" },
    { "word": "每天", "pinyin": "mei3tian1", "meaning": "every day" },
    { "word": "都", "pinyin": "dou1", "meaning": "all/both" },
    { "word": "在", "pinyin": "zai4", "meaning": "at/in" },
    { "word": "圖書館", "pinyin": "tu2shu1guan3", "meaning": "library" },
    { "word": "學習", "pinyin": "xue2xi2", "meaning": "to study", "isTarget": true },
    { "word": "中文", "pinyin": "zhong1wen2", "meaning": "Chinese" }
  ]
}
```

**Notes:**
- `wordBreakdown` powers the hover tooltip feature. The LLM returns `wordBreakdown` (see `04-llm-integration.md`); the server adds `isTarget: true` to the entry matching the flashcard's `word` field.
- `translation` is the LLM's reference English translation, needed by `check-translation` and for showing the correct answer on incorrect attempts.
- Rate limited: 60 requests/min per user.

---

#### `POST /api/quiz/check-translation`

Check the user's English translation against the generated sentence. Calls Gemini 2.5 Flash via the Gemini API.

**Request:**
```json
{
  "flashcardId": "uuid",
  "sentence": "他每天都在圖書館學習中文。",
  "userTranslation": "He studies Chinese at the library every day."
}
```

**Response:** `200 OK`
```json
{
  "correct": true,
  "explanation": "Your translation captures the meaning accurately.",
  "targetWordUsedCorrectly": true,
  "suggestedTranslation": "He studies Chinese at the library every day."
}
```

**Response (incorrect):** `200 OK`
```json
{
  "correct": false,
  "explanation": "Close, but '學習' means 'to study/learn', not 'to read'. The sentence is about studying, not reading.",
  "targetWordUsedCorrectly": false,
  "suggestedTranslation": "He studies Chinese at the library every day."
}
```

**Notes:**
- `correct` is determined directly by the LLM (boolean), not a numeric threshold. The LLM is instructed to be lenient on phrasing but strict on meaning, especially the target word.
- Field names match the LLM response schema in `04-llm-integration.md` (Zod: `TranslationCheckResponse`).
- `targetWordUsedCorrectly` indicates whether the user understood the target word specifically.
- The server resolves `targetWord` and `targetMeaning` from the `flashcardId` before sending to the LLM.
- Rate limited: 60 requests/min per user.

---

#### `POST /api/quiz/check-pinyin`

Verify the user's pinyin input against the stored pinyin. Server-side text comparison (no LLM call).

**Request:**
```json
{
  "flashcardId": "uuid",
  "userPinyin": "xue2xi2"
}
```

**Response:** `200 OK`
```json
{
  "correct": true,
  "expectedPinyin": "xue2xi2"
}
```

**Logic:**
- Normalize both strings: lowercase, trim whitespace, strip spaces between syllables.
- Exact match after normalization.

---

#### `POST /api/quiz/submit-result`

Submit the final result for a card review. Updates FSRS scheduling state.

**Request:**
```json
{
  "sessionId": "uuid",
  "flashcardId": "uuid",
  "rating": "GOOD",
  "generatedSentence": "他每天都在圖書館學習中文。",
  "userTranslation": "He studies Chinese at the library every day.",
  "correctTranslation": "He studies Chinese at the library every day.",
  "translationCorrect": true,
  "userPinyin": "xue2xi2",
  "pinyinCorrect": true,
  "responseTimeMs": 12500
}
```

**Response:** `200 OK`
```json
{
  "flashcard": {
    "id": "uuid",
    "nextDue": "2025-01-18T10:00:00Z",
    "state": "REVIEW",
    "stability": 4.23,
    "difficulty": 5.1,
    "reps": 6
  }
}
```

**Side effects:**
1. Run `ts-fsrs` `repeat()` with the given rating to compute new FSRS state.
2. Update the Flashcard row with new FSRS columns.
3. Create a ReviewLog row.
4. Increment `StudySession.cardsReviewed` (and `cardsCorrect` if rating = GOOD).

**Rating logic:**
- Both translation and pinyin correct → `GOOD`
- Either incorrect → `AGAIN`
- The client determines the rating and sends it; the server validates consistency.

---

#### `GET /api/quiz/today-stats`

Get the current day's review statistics. Used by the quiz UI and dashboard. There is no explicit "end session" action — stats are saved as-you-go via `submit-result`, and users simply navigate away when done.

**Response:** `200 OK`
```json
{
  "todayStats": {
    "cardsReviewed": 18,
    "cardsCorrect": 14,
    "accuracy": 0.778,
    "newCardsStudied": 5,
    "currentStreak": 12
  },
  "nextDueAt": "2025-01-16T08:00:00Z"
}
```

**Logic:** Aggregates from `ReviewLog WHERE userId = :userId AND reviewedAt >= startOfToday()`. Streak computed from `StudySession` records (any day with at least 1 review counts).

---

### Flashcards

#### `GET /api/flashcards`

List the current user's flashcards with cursor-based pagination and optional filters.

**Query params:**
- `cursor` (optional) — UUID of last card from previous page
- `limit` (optional) — page size, default 20, max 100
- `state` (optional) — filter by CardState: `NEW`, `LEARNING`, `REVIEW`, `RELEARNING`
- `search` (optional) — substring match on `word`, `pinyin`, or `englishMeaning`
- `sort` (optional) — `due_asc` (default), `created_desc`, `word_asc`

**Response:** `200 OK`
```json
{
  "flashcards": [
    {
      "id": "uuid",
      "word": "學習",
      "pinyin": "xue2xi2",
      "englishMeaning": "to study / to learn",
      "exampleSentence": null,
      "state": "REVIEW",
      "due": "2025-01-16T08:00:00Z",
      "reps": 5,
      "lapses": 1,
      "createdAt": "2025-01-01T12:00:00Z"
    }
  ],
  "nextCursor": "uuid-of-last-item",
  "hasMore": true,
  "totalCount": 247
}
```

---

#### `POST /api/flashcards`

Create a new flashcard manually.

**Request:**
```json
{
  "word": "圖書館",
  "pinyin": "tu2shu1guan3",
  "englishMeaning": "library",
  "exampleSentence": "我喜歡去圖書館看書。"
}
```

**Response:** `201 Created`
```json
{
  "flashcard": {
    "id": "uuid",
    "word": "圖書館",
    "pinyin": "tu2shu1guan3",
    "englishMeaning": "library",
    "exampleSentence": "我喜歡去圖書館看書。",
    "state": "NEW",
    "due": "2025-01-15T10:00:00Z",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

**Validation:**
- `word` is required, must contain at least one CJK character.
- `pinyin` is required, must match numbered pinyin format (letters + digits).
- `englishMeaning` is required, max 500 characters.
- Returns `409 Conflict` if `userId + word` already exists.

---

#### `PUT /api/flashcards/:id`

Update an existing flashcard. Only the card owner can update.

**Request:** (partial update — only include fields to change)
```json
{
  "englishMeaning": "library; book repository",
  "exampleSentence": "圖書館裡有很多書。"
}
```

**Response:** `200 OK` — returns updated flashcard object (same shape as POST response).

**Note:** FSRS state columns are not editable via this endpoint. They are only modified by `submit-result`.

---

#### `DELETE /api/flashcards/:id`

Delete a flashcard and all its associated ReviewLog entries (via CASCADE).

**Response:** `204 No Content`

---

#### `POST /api/flashcards/ai-create`

AI-assisted card creation. User provides a word (or word + partial info), LLM fills in the rest.

**Request:**
```json
{
  "word": "圖書館"
}
```

**Response:** `200 OK`
```json
{
  "suggestion": {
    "word": "圖書館",
    "pinyin": "tu2shu1guan3",
    "englishMeaning": "library",
    "exampleSentence": "我每個週末都會去圖書館借書。"
  },
  "confirmed": false
}
```

The client displays this for user confirmation. User can edit fields before confirming. On confirm, client calls `POST /api/flashcards` with the final data.

---

#### `GET /api/flashcards/export`

Export all of the user's flashcards as a downloadable JSON file. Available to all authenticated users, including lapsed/cancelled subscriptions (this is part of the "view-only" access for lapsed users).

**Response:** `200 OK` with `Content-Disposition: attachment; filename="flashcards-export.json"`
```json
{
  "exportedAt": "2025-01-15T10:00:00Z",
  "totalCards": 247,
  "cards": [
    {
      "word": "學習",
      "pinyin": "xue2xi2",
      "englishMeaning": "to study / to learn",
      "exampleSentence": "我每天都在學習中文。",
      "state": "REVIEW",
      "reps": 5,
      "lapses": 1,
      "createdAt": "2025-01-01T12:00:00Z"
    }
  ]
}
```

**Notes:**
- No pagination — returns all cards in a single response.
- FSRS scheduling state (stability, difficulty, due) is included so users can migrate to another SRS app.
- Explicitly allowed for lapsed/cancelled users — not gated by subscription middleware.

---

#### `POST /api/flashcards/quick-save`

Save a word directly from the hover tooltip during a quiz. Minimal input — LLM fills in missing fields.

**Request:**
```json
{
  "word": "圖書館",
  "pinyin": "tu2shu1guan3",
  "englishMeaning": "library"
}
```

**Response:** `201 Created` — returns flashcard object.

**Notes:**
- If pinyin and meaning are already available from `sentenceWords` (tooltip data), no LLM call needed.
- If only `word` is provided, calls LLM to generate pinyin and meaning (same as `ai-create` but auto-confirms).
- Returns `409 Conflict` if card already exists for this word.

---

### Metrics

#### `GET /api/metrics/overview`

Dashboard summary data for the current user.

**Response:** `200 OK`
```json
{
  "totalCards": 247,
  "cardsByState": {
    "NEW": 52,
    "LEARNING": 18,
    "REVIEW": 170,
    "RELEARNING": 7
  },
  "cardsDueToday": 23,
  "currentStreak": 12,
  "longestStreak": 15,
  "todayReviewed": 8,
  "last7DaysAccuracy": 0.82,
  "last30DaysAccuracy": 0.79
}
```

**Streak logic:** A streak day is any day where the user completed at least 1 review. Computed from StudySession rows.

---

#### `GET /api/metrics/history`

Review history for chart rendering.

**Query params:**
- `period` — `7d`, `30d`, `90d`, `all` (default `30d`)

**Response:** `200 OK`
```json
{
  "period": "30d",
  "data": [
    {
      "date": "2025-01-15",
      "cardsReviewed": 32,
      "cardsCorrect": 27,
      "accuracy": 0.844,
      "newCardsStudied": 5,
      "timeSpentMinutes": 18
    }
  ]
}
```

**Note:** Aggregated from ReviewLog and StudySession tables. Computed on-demand for now; add materialized views or caching if this query becomes slow.

---

### Billing

#### `POST /api/billing/create-checkout`

Create a Stripe Checkout session and return the URL for redirect.

**Request:**
```json
{
  "priceId": "price_monthly_799"
}
```

`priceId` must be one of the configured Stripe price IDs (monthly or annual).

**Response:** `200 OK`
```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_..."
}
```

**Side effects:** Creates a Stripe Customer if `user.stripeCustomerId` is null.

---

#### `POST /api/billing/webhook`

Stripe webhook handler. **No auth required** — authenticated via Stripe signature verification.

**Handled events:**
| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set `subscriptionStatus = ACTIVE`, store `stripeSubscriptionId` |
| `invoice.paid` | Set `subscriptionStatus = ACTIVE` |
| `invoice.payment_failed` | Set `subscriptionStatus = LAPSED` |
| `customer.subscription.deleted` | Set `subscriptionStatus = CANCELLED` |
| `customer.subscription.updated` | Update status based on subscription state |

**Response:** `200 OK` `{ "received": true }`

---

#### `GET /api/billing/portal`

Generate a Stripe Customer Portal URL and redirect.

**Response:** `302 Redirect` to `https://billing.stripe.com/p/session/...`

**Notes:** Requires `user.stripeCustomerId` to exist. Returns `400` if user has no Stripe customer.

---

#### `GET /api/billing/status`

Current subscription status for the authenticated user.

**Response:** `200 OK`
```json
{
  "status": "TRIAL",
  "trialEndsAt": "2025-01-22T00:00:00Z",
  "daysRemaining": 5,
  "canAccessQuiz": true
}
```

`canAccessQuiz` is `true` for `TRIAL` (before expiry) and `ACTIVE`. `false` for `LAPSED` and `CANCELLED`.

---

## API Design Principles

### Authentication & Authorization

- All endpoints except `/api/auth/*` and `/api/billing/webhook` require a valid Auth.js session.
- Auth is enforced via Next.js middleware at the `api/` route group level.
- Session is JWT-based (stored in HTTP-only cookie). The JWT contains `userId`, `email`, and `name`.
- All data queries are scoped to `userId` from the session — users can never access another user's data.
- Subscription enforcement: quiz endpoints (`/api/quiz/*`) check `canAccessQuiz` and return `403` if the user's subscription has lapsed. Flashcard read endpoints (`GET /api/flashcards`, `GET /api/flashcards/export`) remain accessible to lapsed users (view-only + export).

### Pagination

- Cursor-based pagination using the record's UUID as the cursor.
- Default page size: 20. Max page size: 100.
- Response includes `nextCursor` (null if no more results) and `hasMore` boolean.
- Cursor pagination avoids the offset-skip performance issues of traditional page-number pagination.

### Rate Limiting

- Implemented via Vercel's Edge Middleware or an in-memory store (e.g., `@upstash/ratelimit` with Vercel KV).
- Per-user limits (identified by `userId`):

| Endpoint group | Limit |
|----------------|-------|
| LLM endpoints (`generate-sentence`, `check-translation`, `ai-create`) | 60 req/min |
| Flashcard CRUD | 120 req/min |
| Metrics | 30 req/min |
| Billing | 10 req/min |

- Returns `429 Too Many Requests` with `Retry-After` header when exceeded.

### Error Format

All error responses follow a consistent shape:

```json
{
  "error": {
    "code": "CARD_NOT_FOUND",
    "message": "Flashcard with ID abc-123 not found.",
    "details": null
  }
}
```

**Standard error codes:**

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid request body or params |
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `SUBSCRIPTION_REQUIRED` | Quiz access blocked (lapsed/cancelled) |
| 404 | `NOT_FOUND` | Resource doesn't exist or belongs to another user |
| 409 | `DUPLICATE` | Unique constraint violation (e.g., duplicate card) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 502 | `LLM_ERROR` | Gemini API / LLM failure |
| 504 | `LLM_TIMEOUT` | Gemini API timeout |

### HTTP Status Codes

| Status | Usage |
|--------|-------|
| 200 | Successful read or update |
| 201 | Successful resource creation |
| 204 | Successful deletion (no body) |
| 302 | Redirect (billing portal) |
| 400 | Bad request / validation error |
| 401 | Not authenticated |
| 403 | Not authorized (subscription check) |
| 404 | Not found |
| 409 | Conflict (duplicate resource) |
| 429 | Rate limited |
| 500 | Internal server error |
| 502 | Upstream service error (Gemini API) |
| 504 | Upstream timeout |
