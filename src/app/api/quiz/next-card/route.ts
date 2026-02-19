import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  errorResponse,
  unauthorizedError,
  validationError,
  notFoundError,
} from "@/lib/errors";
import { getNextDueCard } from "@/lib/db/queries";

const querySchema = z.object({
  sessionId: z.string().uuid("sessionId must be a valid UUID"),
});

/**
 * GET /api/quiz/next-card?sessionId={uuid}
 *
 * Returns the next card due for review, following the FSRS card selection
 * algorithm from 03-srs-algorithm.md Section 4:
 *
 *  Priority 1: Learning/Relearning cards that are due (ordered by due ASC)
 *  Priority 2: Review cards that are overdue (ordered by due ASC)
 *  Priority 3: New cards (interleaved 1:5 with reviews), max 20 new/day
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }

    const userId = session.user.id;

    // Parse & validate query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(searchParams);
    if (!parsed.success) {
      throw validationError(
        "Invalid query parameters.",
        parsed.error.flatten().fieldErrors
      );
    }

    const { sessionId } = parsed.data;

    // Verify the session belongs to this user
    const studySession = await db.studySession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!studySession || studySession.userId !== userId) {
      throw notFoundError("StudySession", sessionId);
    }

    // Run the card selection algorithm
    const result = await getNextDueCard(userId, sessionId);

    if (!result.card) {
      return NextResponse.json({
        flashcard: null,
        cardsRemaining: 0,
        nextDueAt: result.nextDueAt?.toISOString() ?? null,
      });
    }

    return NextResponse.json({
      flashcard: {
        id: result.card.id,
        word: result.card.word,
        pinyin: result.card.pinyin,
        englishMeaning: result.card.englishMeaning,
        state: result.card.state,
        reps: result.card.reps,
        lapses: result.card.lapses,
      },
      cardsRemaining: result.cardsRemaining,
      newCardsRemaining: result.newCardsRemaining,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
