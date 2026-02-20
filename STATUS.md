# Project Status — In Context Learning

**Last updated:** 2026-02-20

## Summary

Phases 1–2 are functionally complete. The core quiz loop (sentence generation → translation grading → pinyin check → FSRS scheduling) works end-to-end with real LLM calls. Phases 3–4 are not started.

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
| Quiz state machine (16 states) | ✅ | `useQuizStateMachine` hook |
| Quiz API (7 endpoints) | ✅ | start, next-card, generate-sentence, check-translation, check-pinyin, submit-result, today-stats |
| LLM sentence generation | ✅ | Poe API → Gemini-2.5-Flash, Zod validation, retry logic |
| LLM translation grading | ✅ | Lenient grading with explanation + suggested translation |
| Pinyin verification | ✅ | Server-side normalized matching, tone-mark rejection |
| Quiz UI components | ✅ | QuizCard, TranslationInput/Feedback, PinyinInput/Feedback, CardComplete, SessionSummary |
| Dashboard (basic) | ✅ | Due cards, streak, accuracy, total cards |
| Metrics overview API | ✅ | Cards by state, streak, accuracy |
| Next-card pre-fetching | ✅ | Prefetch during CARD_COMPLETE phase, eliminates 3-5s wait |
| Hover-to-save tooltips | ✅ | Double-click (desktop), Save button (mobile), "Already saved" badge, hint for first 3 tooltips |
| AI card creation | ✅ | API response shape fixed, fully wired to CreateCardDialog UI |
| Metrics history API + charts | ✅ | `/api/metrics/history` with 7d/30d/90d/all, CSS bar chart on dashboard |

## Phase 3 — Polish & Monetization ❌ Not Started

| Feature | Status |
|---------|--------|
| Stripe billing (checkout, portal, webhooks) | ❌ |
| Trial period + view-only mode | ❌ |
| Settings page UI | ❌ |
| AI card suggestions | ❌ |

## Phase 4 — Production ❌ Not Started

| Feature | Status |
|---------|--------|
| Rate limiting (Upstash installed, not wired) | ❌ |
| Mobile gestures (swipe, long-press) | ❌ |
| Session recovery (localStorage) | ❌ |
| Structured logging / Sentry | ❌ |
| CI/CD pipeline | ❌ |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **DB:** Supabase PostgreSQL via Prisma 7 + driver adapters
- **Auth:** Auth.js v5, Google OAuth, JWT
- **SRS:** ts-fsrs (FSRS-5)
- **LLM:** Poe API (OpenAI-compatible) → Gemini-2.5-Flash
- **Styling:** Tailwind CSS (dark-only, indigo accent)
- **Testing:** Vitest 3

## Known Issues

- No deployment config yet (local dev only)
- Demo account has stale data from testing
