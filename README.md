# In Context Learning

A Mandarin Chinese flashcard app that teaches vocabulary in context through AI-generated sentences and spaced repetition.

## Overview

In Context Learning generates natural Chinese sentences around target vocabulary words, then quizzes learners on translation and pinyin. The app uses the FSRS (Free Spaced Repetition Scheduler) algorithm to schedule reviews at optimal intervals for long-term retention. An LLM grades free-form English translations with nuance, while pinyin verification uses deterministic string matching. Both traditional and simplified character sets are supported.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 14 (App Router) | Full-stack React with server components and API routes |
| Language | TypeScript | End-to-end type safety |
| ORM | Prisma 7 | Type-safe database client with declarative migrations |
| Database | Supabase (PostgreSQL) | Managed Postgres with connection pooling via PgBouncer |
| Auth | Auth.js v5 (NextAuth) | Google OAuth with JWT sessions |
| SRS | ts-fsrs | FSRS-5 spaced repetition algorithm implementation |
| AI | Google Gemini API (2.5 Flash) | Sentence generation, translation grading, card creation |
| Payments | Stripe | Checkout, webhooks, customer portal |
| Styling | Tailwind CSS + shadcn/ui | Utility-first CSS with accessible component library |
| Rate Limiting | Upstash Redis | Per-user rate limiting on API routes |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project (for PostgreSQL)
- Google OAuth credentials
- Gemini API key (from https://aistudio.google.com/apikey)
- Stripe account (for billing features)
- Upstash Redis instance (for rate limiting)

### Installation

```bash
git clone <repository-url>
cd in-context-learning
npm install
```

### Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Refer to `.env.example` for all required environment variables including database URLs, OAuth secrets, API keys, and Stripe configuration.

### Database Setup

Run the Prisma migration to create the database schema:

```bash
npx prisma migrate deploy
```

Seed the database with sample data for development:

```bash
npx prisma db seed
```

Generate the Prisma client:

```bash
npx prisma generate
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
in-context-learning/
├── src/
│   ├── app/                    # Next.js App Router pages and API routes
│   │   ├── api/
│   │   │   ├── auth/           # Auth.js route handlers
│   │   │   ├── quiz/           # Quiz engine endpoints
│   │   │   ├── flashcards/     # Flashcard CRUD + AI creation
│   │   │   ├── metrics/        # Dashboard aggregation queries
│   │   │   └── billing/        # Stripe integration
│   │   └── ...                 # Page components
│   ├── lib/                    # Shared server-side utilities
│   │   ├── auth.ts             # Auth.js configuration
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── env.ts              # Environment variable validation
│   │   ├── errors.ts           # Standardized error responses
│   │   ├── fsrs.ts             # FSRS scheduler setup and helpers
│   │   └── pinyin.ts           # Pinyin normalization and verification
│   ├── generated/              # Prisma generated client
│   ├── middleware.ts           # Edge Middleware (auth, rate limiting)
│   └── types/                  # Shared TypeScript type definitions
├── prisma/
│   ├── schema.prisma           # Database schema (User, Flashcard, ReviewLog, StudySession)
│   ├── migrations/             # Database migrations
│   └── seed.ts                 # Development seed data
├── docs/
│   └── spec/                   # Full product and technical specification
├── public/                     # Static assets
├── package.json
├── tsconfig.json
└── next.config.ts
```

## Architecture

The core learning loop follows this flow:

1. **Card Selection** -- The FSRS scheduler selects the next due card, prioritizing Learning/Relearning cards, then overdue Review cards, then New cards (interleaved 1 per 5 reviews).
2. **Sentence Generation** -- The Google Gemini API (2.5 Flash) generates a natural Chinese sentence containing the target word, along with a word-by-word breakdown for hover tooltips.
3. **Translation Check** -- The user types an English translation. The LLM evaluates semantic correctness, with particular emphasis on the target word's meaning.
4. **Pinyin Check** -- The user types numbered-tone pinyin (e.g., `xue2xi2`) for the target word. Server-side string comparison verifies the answer.
5. **FSRS Update** -- Based on the outcome (both correct = Good, either wrong = Again), the ts-fsrs library computes new scheduling parameters and the card's next review date is persisted.

Stats are saved after each card review. There is no explicit "end session" action -- users simply navigate away when done.

## API Routes

| Method | Path | Owner | Description |
|--------|------|-------|-------------|
| GET | `/api/auth/signin` | Auth.js | Google OAuth sign-in |
| GET | `/api/auth/callback/google` | Auth.js | OAuth callback |
| POST | `/api/auth/signout` | Auth.js | Destroy session |
| GET | `/api/auth/session` | Auth.js | Current session |
| POST | `/api/quiz/start` | Quiz Engine | Start a new study session |
| GET | `/api/quiz/next-card` | Quiz Engine | Get next due card via FSRS |
| POST | `/api/quiz/generate-sentence` | LLM Integration | Generate Chinese sentence for a card |
| POST | `/api/quiz/check-translation` | LLM Integration | Grade user's English translation |
| POST | `/api/quiz/check-pinyin` | Quiz Engine | Verify pinyin (string match, no LLM) |
| POST | `/api/quiz/submit-result` | Quiz Engine | Submit review result, update FSRS state |
| GET | `/api/quiz/today-stats` | Quiz Engine | Today's review statistics |
| GET | `/api/flashcards` | Quiz Engine | List flashcards (paginated, filterable) |
| POST | `/api/flashcards` | Quiz Engine | Create a flashcard |
| PUT | `/api/flashcards/:id` | Quiz Engine | Update a flashcard |
| DELETE | `/api/flashcards/:id` | Quiz Engine | Delete a flashcard |
| POST | `/api/flashcards/ai-create` | LLM Integration | AI-assisted card creation |
| POST | `/api/flashcards/quick-save` | LLM Integration | Save word from quiz tooltip |
| GET | `/api/flashcards/export` | Billing | Export all cards as JSON |
| GET | `/api/metrics/overview` | Frontend | Dashboard summary stats |
| GET | `/api/metrics/history` | Frontend | Review history for charts |
| POST | `/api/billing/create-checkout` | Billing | Create Stripe checkout session |
| POST | `/api/billing/webhook` | Billing | Stripe webhook handler |
| GET | `/api/billing/portal` | Billing | Redirect to Stripe customer portal |
| GET | `/api/billing/status` | Billing | Current subscription status |

## Development

### Lint

```bash
npm run lint
```

### Type Check

```bash
npx tsc --noEmit
```

### Build

```bash
npm run build
```

## Documentation

Full product and technical specification documents are available in `docs/spec/`:

| Document | Contents |
|----------|----------|
| [00-overview.md](docs/spec/00-overview.md) | Product vision, user stories, feature map, success metrics |
| [01-quiz-flow.md](docs/spec/01-quiz-flow.md) | Quiz state machine, hover-to-save, pinyin rules, edge cases |
| [02-data-model.md](docs/spec/02-data-model.md) | Prisma schema, all API endpoints, error codes |
| [03-srs-algorithm.md](docs/spec/03-srs-algorithm.md) | FSRS configuration, card selection, daily limits |
| [04-llm-integration.md](docs/spec/04-llm-integration.md) | LLM prompts, Zod schemas, caching, cost model |
| [05-tech-architecture.md](docs/spec/05-tech-architecture.md) | Architecture diagram, wireframes, performance targets |
| [06-decisions.md](docs/spec/06-decisions.md) | Design decisions and rationale |
| [07-agent-team.md](docs/spec/07-agent-team.md) | Build agent roles and ownership boundaries |

## License

Private. Not open source.
