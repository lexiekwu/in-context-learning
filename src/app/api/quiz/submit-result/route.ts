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
  // Reading fields are optional — absent for phonetic languages
  userReading: z.string().optional().nullable(),
  readingCorrect: z.boolean().optional().nullable(),
  // Legacy pinyin fields for backward compatibility
  userPinyin: z.string().optional().nullable(),
  pinyinCorrect: z.boolean().optional().nullable(),
  overallRating: z.enum(["GOOD", "AGAIN"]),
  responseTimeMs: z.number().int().positive().optional(),
});

/**
 * POST /api/quiz/submit-result
 *
 * Submits the final result for a card review. Updates FSRS scheduling state,
 * creates a ReviewLog, and increments StudySession counters.
 *
 * Rating logic:
 *   - For languages with readings: Both translation and reading correct -> GOOD, else AGAIN
 *   - For phonetic languages: Translation correct -> GOOD, else AGAIN
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
      userReading,
      readingCorrect,
      userPinyin,
      pinyinCorrect,
      overallRating,
      responseTimeMs,
    } = parsed.data;

    // Resolve reading fields: prefer new names, fall back to legacy pinyin names
    const effectiveUserReading = userReading ?? userPinyin ?? null;
    const effectiveReadingCorrect = readingCorrect ?? pinyinCorrect ?? null;

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
          userReading: effectiveUserReading,
          readingCorrect: effectiveReadingCorrect,
          overallRating,
          reviewedAt: now,
          responseTimeMs: responseTimeMs ?? null,
        },
      }),

      // 3. Increment StudySession counters with whole points (for schema compatibility)
      db.studySession.update({
        where: { id: sessionId },
        data: {
          cardsReviewed: { increment: 1 },
          cardsCorrect: {
            increment: Math.floor(
              effectiveReadingCorrect !== null
                ? (translationCorrect ? 0.5 : 0) + (effectiveReadingCorrect ? 0.5 : 0)
                : (translationCorrect ? 1.0 : 0)
            ),
          },
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
