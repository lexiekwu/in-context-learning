import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating as FsrsRating,
  State as FsrsState,
  type Card as FsrsCard,
  type FSRS,
} from "ts-fsrs";
import type { Flashcard } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// FSRS Scheduler — singleton with project-specific parameters
// ---------------------------------------------------------------------------

const params = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
});

/** Global FSRS scheduler instance. Thread-safe (stateless computations). */
export const scheduler: FSRS = fsrs(params);

// Re-export ts-fsrs types/values used by the rest of the app
export { createEmptyCard, FsrsRating, FsrsState };
export type { FsrsCard };

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/** Map our Prisma CardState enum string to the ts-fsrs numeric State enum. */
function toFsrsState(state: string): FsrsState {
  switch (state) {
    case "NEW":
      return FsrsState.New;
    case "LEARNING":
      return FsrsState.Learning;
    case "REVIEW":
      return FsrsState.Review;
    case "RELEARNING":
      return FsrsState.Relearning;
    default:
      return FsrsState.New;
  }
}

/** Map a ts-fsrs numeric State back to our Prisma enum string. */
export function fromFsrsState(
  state: FsrsState
): "NEW" | "LEARNING" | "REVIEW" | "RELEARNING" {
  switch (state) {
    case FsrsState.New:
      return "NEW";
    case FsrsState.Learning:
      return "LEARNING";
    case FsrsState.Review:
      return "REVIEW";
    case FsrsState.Relearning:
      return "RELEARNING";
    default:
      return "NEW";
  }
}

/**
 * Convert a Prisma `Flashcard` row into a ts-fsrs `Card` object.
 *
 * The Flashcard table stores the same nine FSRS state columns that ts-fsrs
 * uses internally: due, stability, difficulty, elapsed_days, scheduled_days,
 * reps, lapses, state, lastReview.
 */
export function toFsrsCard(dbCard: Flashcard): FsrsCard {
  return {
    due: dbCard.due,
    stability: dbCard.stability,
    difficulty: dbCard.difficulty,
    elapsed_days: dbCard.elapsed_days,
    scheduled_days: dbCard.scheduled_days,
    reps: dbCard.reps,
    lapses: dbCard.lapses,
    state: toFsrsState(dbCard.state),
    last_review: dbCard.lastReview ?? undefined,
    learning_steps: 0,
  };
}

/**
 * Schedule a card after a quiz review.
 *
 * @param dbCard  The current Flashcard row from the database.
 * @param passed  `true` if both translation and pinyin were correct on the
 *                first attempt; `false` otherwise.
 * @param now     The review timestamp (defaults to `new Date()`).
 * @returns       An object containing the updated FSRS card fields to persist
 *                back to the database.
 */
export function scheduleCard(
  dbCard: Flashcard,
  passed: boolean,
  now: Date = new Date()
): {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";
  lastReview: Date;
} {
  const card = toFsrsCard(dbCard);
  const rating = passed ? FsrsRating.Good : FsrsRating.Again;

  const result = scheduler.repeat(card, now);
  const updated = result[rating].card;

  return {
    due: updated.due,
    stability: updated.stability,
    difficulty: updated.difficulty,
    elapsed_days: updated.elapsed_days,
    scheduled_days: updated.scheduled_days,
    reps: updated.reps,
    lapses: updated.lapses,
    state: fromFsrsState(updated.state),
    lastReview: updated.last_review ?? now,
  };
}
