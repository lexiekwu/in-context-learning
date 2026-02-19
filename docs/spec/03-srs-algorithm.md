# 03 — SRS Algorithm

## 1. Why FSRS over SM-2

SM-2 (SuperMemo 2) has been the dominant spaced-repetition algorithm since the late 1980s and was the default in Anki for over a decade. FSRS (Free Spaced Repetition Scheduler) is its modern replacement, built on machine learning research analyzing hundreds of millions of real review records.

| Dimension | SM-2 | FSRS |
|-----------|------|------|
| **Origin** | 1987, hand-tuned heuristic | 2022, machine-learning-derived (DSR model) |
| **Retention prediction** | Rough approximation; no formal memory model | Models memory stability and retrievability explicitly |
| **Parameters** | Fixed ease factor per card; drifts over time ("ease hell") | 17 optimizable weights shared across a user's collection |
| **Per-user optimization** | Not supported | Can optimize weights from a user's own review history |
| **Interval accuracy** | Tends to over-schedule easy cards, under-schedule hard ones | Empirically better interval predictions across large datasets |
| **Maintenance** | No active development | Open-source, actively maintained ([ts-fsrs on npm](https://www.npmjs.com/package/ts-fsrs)) |
| **Anki adoption** | Default through Anki 23.10 | Default scheduler from Anki 23.10+ |

**Key advantages of FSRS for this project:**

- **Better retention prediction.** FSRS models two separate quantities — memory *stability* (how slowly a memory decays) and memory *difficulty* (how hard the item is to learn) — producing more accurate scheduling than SM-2's single ease factor.
- **Fewer parameters to tune.** SM-2 requires per-card ease factors that degrade over time. FSRS uses a single set of 17 global weights that work well out of the box and can be optimized later.
- **Backed by ML research.** FSRS was developed by analyzing 300M+ reviews from Anki users, using a DSR (Difficulty-Stability-Retrievability) model grounded in memory science.
- **Open-source TypeScript implementation.** The `ts-fsrs` library provides a production-ready implementation with full TypeScript types, avoiding the need to port algorithm logic from scratch.

**Library reference:** [`ts-fsrs`](https://www.npmjs.com/package/ts-fsrs) (MIT license).

---

## 2. Binary Quiz Outcome → FSRS Rating Mapping

FSRS defines four rating levels: `Again` (1), `Hard` (2), `Good` (3), and `Easy` (4). Our quiz exposes only **two outcomes** to the user, which map to two of these ratings:

| Quiz Outcome | Condition | FSRS Rating | Value |
|--------------|-----------|-------------|-------|
| **Pass** | Translation correct AND pinyin correct, both on first attempt | **Good** | `Rating.Good` (3) |
| **Fail** | Translation wrong OR pinyin wrong on first attempt (even if user retypes correctly afterward) | **Again** | `Rating.Again` (1) |

### Why we skip Hard and Easy

- **No "Hard" button.** A partial-credit rating adds cognitive overhead ("was that *wrong* or just *hard*?") and invites self-deception. Binary pass/fail keeps the review flow fast and unambiguous.
- **No "Easy" button.** Users tend to over-use "Easy," pushing intervals far beyond what their actual retention supports. Removing it prevents premature over-spacing. If a card truly is easy, repeated `Good` ratings will naturally lengthen its interval.
- **Product philosophy.** The quiz already determines the outcome automatically (AI grades the translation; pinyin is string-matched). There is no moment where the user chooses a difficulty button — the system decides pass or fail, and the corresponding rating is applied silently.

### What each rating does to the card

- **Good (3):** Increases the card's *stability*, which increases the scheduled interval. The card moves forward in the lifecycle (Learning → Review, or stays in Review with a longer interval).
- **Again (1):** Resets the card to a short interval. If the card was in Review, it *lapses* — its `lapses` counter increments and it enters Relearning with a short interval. If the card was in Learning, it stays in Learning and the interval resets.

---

## 3. Card Lifecycle States

FSRS defines four card states. The full lifecycle:

```
NEW ──(first review)──▶ LEARNING ──(graduate)──▶ REVIEW
                                                    │
                                                    │ (lapse: user answers Again)
                                                    ▼
                                                RELEARNING ──(graduate)──▶ REVIEW
```

| State | Description | Typical Intervals |
|-------|-------------|-------------------|
| **New** | Card has never been reviewed. Sits in the "new card" pool until the scheduler surfaces it. | N/A (not yet scheduled) |
| **Learning** | Card has been seen but has not yet graduated to long-term review. FSRS applies short, fixed-step intervals. | Minutes to hours (1 min, 10 min, 1 hr) |
| **Review** | Card has graduated from Learning. Intervals are computed by the FSRS algorithm and grow with each successful review. | Days → weeks → months → up to `maximum_interval` |
| **Relearning** | Card was in Review but the user failed it (lapsed). Behaves like Learning with short intervals, then graduates back to Review. | Minutes to hours, similar to Learning |

### Session boundary behavior

This app does **not** support intra-session re-review. Each card appears at most once per study session. This means:

- If FSRS schedules a Learning or Relearning card with an interval of 1 minute or 10 minutes, the card will **not** reappear later in the same session.
- Instead, it will appear in the **next session** the user opens (or the next day, whichever comes first).
- The `enable_short_term` FSRS parameter is set to `true` so that Learning/Relearning cards do get proper short-term scheduling — but the app's card selection logic enforces "once per session" and picks up short-interval cards the next time the user returns.

This is a deliberate trade-off: it simplifies the quiz state machine at the cost of slightly less optimal Learning-phase scheduling. For most users who study daily, the effect is negligible.

---

## 4. Card Selection Algorithm

When the user starts a study session, the app builds a review queue using the following logic:

```typescript
function getNextCard(userId: string): Flashcard | null {
  // 1. Gather candidate cards
  const now = new Date();
  const todayStart = startOfDay(now);

  const dueCards = await db.flashcard.findMany({
    where: { userId, due: { lte: now } },
    orderBy: { due: 'asc' },
  });

  // 2. Categorize
  const learningCards = dueCards.filter(
    c => c.state === State.Learning || c.state === State.Relearning
  );
  const reviewCards = dueCards.filter(c => c.state === State.Review);
  const newCards = await db.flashcard.findMany({
    where: { userId, state: State.New },
    orderBy: { createdAt: 'asc' },
  });

  // 3. Check daily limits
  const todayStats = await getTodayStats(userId, todayStart);
  const newCardLimit = 20;
  const reviewSoftCap = 1000;
  const newCardsRemaining = newCardLimit - todayStats.newCardsStudied;
  const reviewsAtCap = todayStats.reviewCount >= reviewSoftCap;

  // 4. Selection priority
  //    a. Learning/Relearning cards (highest priority)
  if (learningCards.length > 0) {
    return learningCards[0];
  }

  //    b. Interleave: insert 1 new card after every 5 review cards
  if (
    todayStats.reviewsSinceLastNew >= 5 &&
    newCardsRemaining > 0 &&
    newCards.length > 0
  ) {
    return newCards[0];
  }

  //    c. Overdue review cards (most overdue first)
  if (reviewCards.length > 0 && !reviewsAtCap) {
    return reviewCards[0]; // already sorted by due ASC = most overdue first
  }

  //    d. New cards (if under daily limit)
  if (newCardsRemaining > 0 && newCards.length > 0) {
    return newCards[0];
  }

  //    e. Nothing available
  return null; // triggers "All caught up!" message
}
```

### Selection priority rationale

| Priority | Card Type | Why |
|----------|-----------|-----|
| 1st | Learning / Relearning | These cards are in fragile memory states with short target intervals. Reviewing them promptly is critical for initial encoding. |
| 2nd | Overdue review cards | Every day a card is overdue, its predicted retrievability drops. Reviewing the *most* overdue cards first rescues the memories at greatest risk. |
| 3rd | New cards | New cards expand the user's knowledge but don't have a retention clock ticking. They can wait. Interleaving them (1 new per 5 reviews) prevents the session from being all-new or all-review. |

---

## 5. Daily Limits

| Limit | Default | Behavior |
|-------|---------|----------|
| **New cards per day** | 20 | Hard cap. When reached, no more New cards are introduced for the day. |
| **Review cards per day** | 1000 | Soft cap. When reached, the app shows a message: *"You've completed 1000 reviews today. Continue reviewing?"* User can choose to keep going or stop. |

### How limits are tracked

Limits are computed from `StudySession` and `ReviewLog` records:

```typescript
async function getTodayStats(userId: string, todayStart: Date) {
  const reviews = await db.reviewLog.findMany({
    where: {
      userId,
      reviewedAt: { gte: todayStart },
    },
  });

  return {
    reviewCount: reviews.length,
    newCardsStudied: reviews.filter(r => r.priorState === State.New).length,
    reviewsSinceLastNew: countReviewsSinceLastNew(reviews),
  };
}
```

### When limits are reached

- **New card limit reached:** New cards silently stop appearing. The user continues reviewing due cards only. No disruptive message unless they have zero due cards left.
- **Review soft cap reached:** The app pauses and displays a confirmation dialog. If the user opts to continue, the cap is lifted for the remainder of the session.
- **No cards at all:** The app displays "All caught up! Come back tomorrow." with the next due card's date and time.

---

## 6. FSRS Configuration Parameters

These parameters are passed to the `ts-fsrs` `FSRS` constructor:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `request_retention` | `0.9` | Target retention rate (90%). FSRS computes intervals so the predicted probability of recall at review time equals this value. |
| `maximum_interval` | `365` | Maximum days between reviews. No card will be scheduled more than 1 year out, even if FSRS computes a longer interval. |
| `w` | FSRS-5 defaults | 17 model weights. The `ts-fsrs` library ships with empirically derived defaults: `[0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755]`. These work well for most users without optimization. |
| `enable_fuzz` | `true` | Adds a small random offset (±5% of interval) to prevent cards learned at the same time from clustering on the same due date. |
| `enable_short_term` | `true` | Enables short-term scheduling for Learning/Relearning cards (sub-day intervals). Required for proper Learning-state behavior. |

### Initialization example

```typescript
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';

const params = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
});

const scheduler = fsrs(params);
```

---

## 7. FSRS State Columns

Each `Flashcard` record persists the following FSRS fields. These map directly to the `Card` type in `ts-fsrs`:

| Column | Type | Default (New Card) | Description |
|--------|------|-------------------|-------------|
| `due` | `DateTime` | `now()` | When the card is next due for review. For New cards, set to creation time so they enter the pool immediately. |
| `stability` | `Float` | `0` | FSRS stability parameter (S). Higher values mean the memory decays more slowly, producing longer intervals. |
| `difficulty` | `Float` | `0` | FSRS difficulty parameter (D). Range 1-10. Higher values mean the card is harder to remember. |
| `elapsed_days` | `Int` | `0` | Number of days since the last review. Used by FSRS to compute retrievability. |
| `scheduled_days` | `Int` | `0` | Number of days that were scheduled between the previous review and this one. Used for optimization. |
| `reps` | `Int` | `0` | Total number of times the card has been reviewed (regardless of outcome). |
| `lapses` | `Int` | `0` | Number of times the card has transitioned from Review → Relearning (i.e., the user failed a graduated card). |
| `state` | `Enum` | `NEW` | Current lifecycle state: `NEW`, `LEARNING`, `REVIEW`, or `RELEARNING`. |
| `last_review` | `DateTime?` | `null` | Timestamp of the most recent review. Null if the card has never been reviewed. |

### Mapping to ts-fsrs

When scheduling a review, convert the database row into a `ts-fsrs` `Card` object, call `scheduler.repeat(card, now)`, extract the result for the appropriate rating, and write the updated `Card` fields back to the database:

```typescript
import { Card, Rating, State } from 'ts-fsrs';

// Convert DB row → ts-fsrs Card
function toFsrsCard(dbCard: FlashcardRow): Card {
  return {
    due: dbCard.due,
    stability: dbCard.stability,
    difficulty: dbCard.difficulty,
    elapsed_days: dbCard.elapsed_days,
    scheduled_days: dbCard.scheduled_days,
    reps: dbCard.reps,
    lapses: dbCard.lapses,
    state: dbCard.state as State,
    last_review: dbCard.last_review ?? undefined,
  };
}

// After quiz, schedule the card
function scheduleCard(dbCard: FlashcardRow, passed: boolean): Card {
  const card = toFsrsCard(dbCard);
  const now = new Date();
  const rating = passed ? Rating.Good : Rating.Again;

  const result = scheduler.repeat(card, now);
  const updated = result[rating].card;

  // updated contains new values for all 9 fields — persist them
  return updated;
}
```

---

## 8. Example Scheduling Walkthrough

Concrete example for the card **你好** (nǐ hǎo, "hello"), using FSRS-5 default weights at 90% target retention. Intervals are approximate — `enable_fuzz` adds minor variation in production.

| Day | Event | Rating | New State | Stability | Difficulty | Next Due | Interval |
|-----|-------|--------|-----------|-----------|------------|----------|----------|
| **1** | First review. User sees "你好" in a sentence, translates correctly, types `ni3hao3` correctly. | Good (3) | Learning | ~3.7 | ~5.2 | Day 2 | 1 day |
| **2** | Card due (Learning). User gets both right. Card graduates. | Good (3) | Review | ~8.4 | ~5.2 | Day 5 | 3 days |
| **5** | Card due (Review). User types wrong pinyin (`ni2hao3`). | Again (1) | Relearning | ~3.1 | ~5.9 | Day 6 | 1 day |
| **6** | Card due (Relearning). User gets both right. Graduates back to Review. | Good (3) | Review | ~5.8 | ~5.9 | Day 9 | 3 days |
| **9** | Card due (Review). User gets both right. | Good (3) | Review | ~10.2 | ~5.7 | Day 19 | 10 days |
| **19** | Card due (Review). User gets both right. | Good (3) | Review | ~20.5 | ~5.5 | Day 40 | 21 days |
| **40** | Card due (Review). User gets both right. | Good (3) | Review | ~42.0 | ~5.4 | Day 83 | 43 days |

**Key observations:**

- After a lapse on Day 5, the card's stability dropped from ~8.4 to ~3.1 and its difficulty increased from ~5.2 to ~5.9. The user had to rebuild the interval from scratch.
- Each consecutive `Good` rating roughly doubles the interval (1 → 3 → 10 → 21 → 43 days), though the exact growth depends on stability and difficulty values.
- At 90% target retention, FSRS schedules the card so the user has approximately a 90% chance of remembering it at each due date. If they consistently pass, intervals grow. If they lapse, the algorithm tightens the schedule.

---

## 9. Future Enhancements (v2)

### Per-user parameter optimization

FSRS can optimize its 17 weights based on an individual user's review history, improving scheduling accuracy beyond the global defaults.

- **Minimum data requirement:** ~100-200 reviews before optimization produces meaningful results. Below this threshold, the default weights are better.
- **Implementation:** The `ts-fsrs` library provides an `fsrs().optimize()` path, or optimization can be done server-side by collecting `ReviewLog` records and running the FSRS optimizer.
- **Trigger:** Offer optimization after a user accumulates 200+ reviews. Re-optimize monthly or when retention rate deviates significantly from the 90% target.

### Optional Hard / Easy buttons

Some advanced users may want finer-grained control:

- Add an "Advanced mode" setting that surfaces all four FSRS ratings after each card.
- **Hard (2):** "I got it right, but it was difficult" — schedules a shorter interval than Good.
- **Easy (4):** "This was trivially easy" — schedules a longer interval than Good.
- Default remains binary (Pass/Fail) for all new users.

### Retention analytics

- **Predicted vs actual retention:** Compare FSRS's predicted retrievability at review time with the user's actual pass rate. Display this on the metrics dashboard.
- **Retention trend chart:** Rolling 7-day and 30-day retention rates.
- **Lapse hotspots:** Surface cards with the highest `lapses` count so the user can add mnemonics or context.
- **Mature card count:** Show how many cards have intervals > 21 days (a proxy for "well-known" vocabulary).
