# 00 — Product Overview

## Product Vision

An AI-powered Mandarin flashcard app that teaches vocabulary in context, not in isolation. The app generates natural Chinese sentences around each target word, asks the learner to translate and produce pinyin, and uses the FSRS spaced-repetition algorithm to schedule reviews at the optimal moment for long-term retention. Supports both traditional and simplified characters (user preference).

## User Personas

| Persona | Description | Goals | Pain Points |
|---------|-------------|-------|-------------|
| **Primary — Intermediate Learner** | Has ~500-2,000 word vocabulary; can read simple passages. Studies 15-30 min/day. | Deepen contextual understanding of known words; acquire new vocabulary through natural sentences. | Anki cards feel sterile and decontextualized; existing apps use simplified characters or lack AI-generated content. |
| **Secondary — Motivated Beginner** | Has <500 words; may be taking a formal class. Studies 10-20 min/day. | Build foundational vocabulary with correct pinyin from day one. | Overwhelmed by full-sentence input; needs gentler difficulty curves. |

## Prioritized User Stories

### P0 — Must-Have for Launch

| # | Story |
|---|-------|
| 1 | As a learner, I want to see a Chinese sentence containing my target word so that I learn vocabulary in realistic context. |
| 2 | As a learner, I want to type an English translation and get immediate AI-graded feedback so that I know whether I understood the sentence. |
| 3 | As a learner, I want to type pinyin for the target word so that I reinforce pronunciation alongside meaning. |
| 4 | As a learner, I want cards I get wrong to appear more often and cards I get right to appear less often so that I study efficiently. |
| 5 | As a learner, I want to add, edit, and delete my flashcards so that I control what I'm studying. |
| 6 | As a user, I want to sign in with Google so that my progress is saved across devices. |

### P1 — Important but Deferrable

| # | Story |
|---|-------|
| 7 | As a learner, I want to hover over any word in a quiz sentence to see its translation and pinyin so that I can learn unfamiliar words on the fly. |
| 8 | As a learner, I want to double-click a hovered word to save it as a new flashcard so that I can capture vocabulary seamlessly during review. |
| 9 | As a learner, I want AI to suggest new flashcards based on my level so that I discover useful words I wouldn't find on my own. |
| 10 | As a learner, I want to see metrics (cards reviewed, accuracy trends, streak) so that I stay motivated. |
| 11 | As a user, I want a free trial and then a subscription plan so that I can evaluate the app before committing. |

## Feature Map

| Priority | Feature | Notes |
|----------|---------|-------|
| **P0** | Quiz engine (sentence display, translation input, pinyin input) | Core loop; LLM generates sentences and grades translations |
| **P0** | FSRS scheduling | Research-based spaced repetition; adjusts intervals on correct/incorrect |
| **P0** | Flashcard CRUD | Add, edit, delete cards; each card stores target word, definition, pinyin |
| **P0** | Google OAuth | Single sign-on; no email/password flow |
| **P1** | Hover-to-save | Tooltip on non-target words in quiz; double-click creates new card |
| **P1** | AI card creation | LLM suggests new cards appropriate to user level |
| **P1** | Metrics dashboard | Cards reviewed/day, accuracy over time, knowledge estimates |
| **P1** | Stripe billing | 7-day free trial → $4.99/mo or $39.99/yr; lapsed = view-only + data export |

## Key Assumptions

- **Characters:** Both traditional (繁體字) and simplified (简体字), selected per user in settings. Default: traditional.
- **Pinyin format:** Numbered tones (`ni3hao3`), not tone marks (`nǐhǎo`).
- **Daily limits:** 20 new cards/day, 1000 review cards/day (soft cap).
- **Sessions:** Open-ended (no fixed length).
- **Free trial:** 7 days, full access. After expiry, subscription required to quiz; flashcard list remains viewable and exportable (view-only mode with data export).
- **Pricing:** $4.99/mo or $39.99/yr.
- **LLM cost model:** Budget assumes ~100 cards/day per active user.

## Success Metrics

| Metric | Target (3-mo post-launch) |
|--------|---------------------------|
| D7 retention | ≥ 40% |
| D30 retention | ≥ 20% |
| Avg cards reviewed / active user / day | ≥ 30 |
| Quiz accuracy (7-day rolling) | Trending upward per user |
| Free-trial → paid conversion | ≥ 8% |
| Median session length | ≥ 8 min |

## Out of Scope (v1)

- Audio / text-to-speech / pronunciation scoring
- Multiplayer or social features
- Native mobile app (responsive web only)
- Handwriting recognition
- Grammar explanations or lesson plans
- Offline mode
- Languages other than Mandarin

## Build Sequencing

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| **1 — Foundation** | Project scaffolding, data layer, auth | Repo + CI setup; DB schema (users, cards, reviews); Google OAuth; basic flashcard CRUD API + UI |
| **2 — Core Quiz** | The learning loop | FSRS algorithm integration; LLM sentence generation + translation grading; quiz state machine (sentence → translation → pinyin → result); pinyin text matching |
| **3 — Polish** | Secondary features, monetization | Hover-to-save tooltips; AI card suggestions; Stripe billing + trial logic + view-only mode; metrics dashboard |
| **4 — Production** | Reliability and reach | Global error handling + retry logic; responsive / mobile styling; performance optimization (LLM latency, caching); logging, monitoring, alerting |
