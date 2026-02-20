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
import { verifyPinyin } from "@/lib/pinyin";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  flashcardId: z.string().uuid("flashcardId must be a valid UUID"),
  userPinyin: z.string().min(1, "userPinyin is required"),
});

/**
 * POST /api/quiz/check-pinyin
 *
 * Server-side pinyin verification using the text-based rules from
 * 01-quiz-flow.md Section 3. No LLM call required.
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

    const { flashcardId, userPinyin } = parsed.data;

    // Look up the flashcard (scoped to user)
    const flashcard = await db.flashcard.findFirst({
      where: { id: flashcardId, userId },
      select: { pinyin: true },
    });

    if (!flashcard) {
      throw notFoundError("Flashcard", flashcardId);
    }

    // Run the pinyin verification
    const result = verifyPinyin(userPinyin, flashcard.pinyin);

    // If tone marks were detected, return a soft rejection with feedback
    if (result.hasToneMarks) {
      return NextResponse.json({
        correct: false,
        correctPinyin: flashcard.pinyin,
      expectedPinyin: flashcard.pinyin,
        feedback: result.toneMarkMessage,
      });
    }

    return NextResponse.json({
      correct: result.correct,
      correctPinyin: flashcard.pinyin,
      expectedPinyin: flashcard.pinyin,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
