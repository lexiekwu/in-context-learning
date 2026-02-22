import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import "dotenv/config";
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating as FsrsRating,
  type Card as FsrsCard,
} from "ts-fsrs";

const CSV_PATH =
  "/Users/lkrehbiel/Documents/personal_scripting/vocabulary_terms_2026-02-19.csv";

// Use the same FSRS parameters as the app (src/lib/fsrs.ts)
const params = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false, // Disable fuzz for deterministic migration
  enable_short_term: true,
});
const scheduler = fsrs(params);

type State = "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";

function stateString(s: number): State {
  return (["NEW", "LEARNING", "REVIEW", "RELEARNING"] as const)[s];
}

/**
 * Simulate N "Good" reviews on a fresh FSRS card, spaced 1 day apart,
 * anchored so the last review lands on `lastReviewDate`.
 *
 * Returns the final FSRS card state with proper stability, difficulty, and due.
 */
function simulateReviews(numReviews: number, lastReviewDate: Date): FsrsCard {
  let card = createEmptyCard(new Date(0)); // throwaway start time

  if (numReviews === 0) {
    // NEW card — due now
    card = createEmptyCard(new Date());
    return card;
  }

  // Work backwards: last review was on lastReviewDate,
  // space reviews 1 day apart before that
  const reviewDates: Date[] = [];
  for (let i = numReviews - 1; i >= 0; i--) {
    const d = new Date(lastReviewDate);
    d.setDate(d.getDate() - i);
    reviewDates.push(d);
  }

  card = createEmptyCard(reviewDates[0]);

  for (const reviewDate of reviewDates) {
    const result = scheduler.repeat(card, reviewDate);
    card = result[FsrsRating.Good].card;
  }

  return card;
}

/**
 * Map knowledge_factor to number of simulated "Good" reviews.
 * Higher factor = more reviews = higher stability = longer interval before due.
 */
function kfToReviewCount(kf: number): number {
  if (kf < 0.5) return 0;    // NEW
  if (kf < 1.0) return 1;    // LEARNING (1 review)
  if (kf < 1.5) return 2;    // Just entered REVIEW
  if (kf < 2.0) return 3;    // Solid REVIEW
  return 4;                   // Well-known
}

interface CsvRow {
  term: string;
  knowledge_factor_c2e: string;
  last_answered_c2e: string;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set. Check your .env file.");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  // Read CSV
  const csv = readFileSync(CSV_PATH, "utf-8");
  const rows: CsvRow[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });

  console.log(`Read ${rows.length} rows from CSV`);

  // Build a lookup: term -> { kf, lastAnswered }
  const csvLookup = new Map<string, { kf: number; lastAnswered: Date | null }>();
  for (const row of rows) {
    const kf = parseFloat(row.knowledge_factor_c2e);
    if (isNaN(kf)) continue;
    const lastAnswered = row.last_answered_c2e
      ? new Date(row.last_answered_c2e)
      : null;
    csvLookup.set(row.term, { kf, lastAnswered });
  }

  // Fetch all flashcards from DB
  const flashcards = await prisma.flashcard.findMany({
    where: { word: { in: [...csvLookup.keys()] } },
    select: { id: true, word: true },
  });

  console.log(`Found ${flashcards.length} matching flashcards in DB`);

  const now = new Date();
  const stateCounts: Record<State, number> = {
    NEW: 0,
    LEARNING: 0,
    REVIEW: 0,
    RELEARNING: 0,
  };
  let skipped = 0;

  // Process in batches of 50 concurrent updates
  const BATCH_SIZE = 50;
  for (let i = 0; i < flashcards.length; i += BATCH_SIZE) {
    const batch = flashcards.slice(i, i + BATCH_SIZE);
    const updates = batch.map((fc) => {
      const info = csvLookup.get(fc.word);
      if (!info) {
        skipped++;
        return null;
      }

      const numReviews = kfToReviewCount(info.kf);
      // Use last_answered_c2e if available, otherwise use now
      const anchor = info.lastAnswered ?? now;
      const fsrsCard = simulateReviews(numReviews, anchor);
      const finalState = stateString(fsrsCard.state);
      stateCounts[finalState]++;

      return prisma.flashcard.update({
        where: { id: fc.id },
        data: {
          state: finalState,
          stability: fsrsCard.stability,
          difficulty: fsrsCard.difficulty,
          due: fsrsCard.due,
          elapsed_days: fsrsCard.elapsed_days,
          scheduled_days: fsrsCard.scheduled_days,
          reps: fsrsCard.reps,
          lapses: fsrsCard.lapses,
          lastReview: fsrsCard.last_review ?? null,
        },
      });
    });

    await Promise.all(updates.filter(Boolean));

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= flashcards.length) {
      console.log(`  Processed ${Math.min(i + BATCH_SIZE, flashcards.length)}/${flashcards.length}...`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`NEW:        ${stateCounts.NEW}`);
  console.log(`LEARNING:   ${stateCounts.LEARNING}`);
  console.log(`REVIEW:     ${stateCounts.REVIEW}`);
  console.log(`RELEARNING: ${stateCounts.RELEARNING}`);
  console.log(`Skipped:    ${skipped}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
