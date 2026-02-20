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
import { scheduleCard } from "@/lib/fsrs";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  sessionId: z.string().uuid("sessionId must be a valid UUID"),
  flashcardId: z.string().uuid("flashcardId must be a valid UUID"),
  generatedSentence: z.string().min(1, "generatedSentence is required"),
  userTranslation: z.string().min(1, "userTranslation is required"),
  correctTranslation: z.string().min(1, "correctTranslation is required"),
  translationCorrect: z.boolean(),
  userPinyin: z.string().min(1, "userPinyin is required"),
  pinyinCorrect: z.boolean(),
  overallRating: z.enum(["GOOD", "AGAIN"]),
  responseTimeMs: z.number().int().positive().optional(),
});

/**
 * POST /api/quiz/submit-result
 *
 * Submits the final result for a card review. Updates FSRS scheduling state,
 * creates a ReviewLog, and increments StudySession counters.
 *
 * Rating logic (from spec):
 *   - Both translation and pinyin correct on first attempt -> GOOD
 *   - Either incorrect -> AGAIN
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }

    const userId = session.user.id;

    const limited = await checkRateLimit("quiz", userId);
    if (limited) return limited;

    // Parse & validate request body
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "Invalid request body.",
        parsed.error.flatten().fieldErrors
      );
    }

    const {
      sessionId,
      flashcardId,
      generatedSentence,
      userTranslation,
      correctTranslation,
      translationCorrect,
      userPinyin,
      pinyinCorrect,
      overallRating,
      responseTimeMs,
    } = parsed.data;

    // Verify the session belongs to this user
    const studySession = await db.studySession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!studySession || studySession.userId !== userId) {
      throw notFoundError("StudySession", sessionId);
    }

    // Fetch the flashcard (scoped to user)
    const flashcard = await db.flashcard.findFirst({
      where: { id: flashcardId, userId },
    });

    if (!flashcard) {
      throw notFoundError("Flashcard", flashcardId);
    }

    // Compute FSRS scheduling update
    const passed = overallRating === "GOOD";
    const now = new Date();
    const updatedFields = scheduleCard(flashcard, passed, now);

    // Record the card's prior state before updating
    const priorState = flashcard.state;

    // Perform all writes in a transaction
    const [updatedCard, , updatedSession] = await db.$transaction([
      // 1. Update the flashcard with new FSRS state
      db.flashcard.update({
        where: { id: flashcardId },
        data: updatedFields,
      }),

      // 2. Create a ReviewLog record
      db.reviewLog.create({
        data: {
          flashcardId,
          userId,
          sessionId,
          generatedSentence,
          priorState,
          userTranslation,
          correctTranslation,
          translationCorrect,
          userPinyin,
          pinyinCorrect,
          overallRating,
          reviewedAt: now,
          responseTimeMs: responseTimeMs ?? null,
        },
      }),

      // 3. Increment StudySession counters
      db.studySession.update({
        where: { id: sessionId },
        data: {
          cardsReviewed: { increment: 1 },
          ...(passed ? { cardsCorrect: { increment: 1 } } : {}),
        },
      }),
    ]);

    return NextResponse.json({
      updatedCard: {
        state: updatedCard.state,
        due: updatedCard.due.toISOString(),
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
      },
      sessionStats: {
        cardsReviewed: updatedSession.cardsReviewed,
        cardsCorrect: updatedSession.cardsCorrect,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
