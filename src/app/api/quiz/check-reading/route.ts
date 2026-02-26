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
import { getLanguageConfig } from "@/lib/languages";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  flashcardId: z.string().uuid("flashcardId must be a valid UUID"),
  userReading: z.string().min(1, "userReading is required"),
});

/**
 * POST /api/quiz/check-reading
 *
 * Server-side reading verification (pinyin for Chinese, romaji for Japanese, etc.).
 * For phonetic languages where the writing IS the reading, this endpoint should
 * not be called. Returns 400 if called for a phonetic language.
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

    // Get user's language to check if reading is applicable
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { targetLanguage: true },
    });

    const langConfig = getLanguageConfig(user.targetLanguage);

    if (!langConfig.needsReading) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_OPERATION",
            message: `Reading check is not applicable for ${langConfig.name}. This language uses a phonetic writing system.`,
          },
        },
        { status: 400 }
      );
    }

    // Parse & validate request body
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "Invalid request body.",
        parsed.error.flatten().fieldErrors
      );
    }

    const { flashcardId, userReading } = parsed.data;

    // Look up the flashcard (scoped to user)
    const flashcard = await db.flashcard.findFirst({
      where: { id: flashcardId, userId },
      select: { pinyin: true },
    });

    if (!flashcard) {
      throw notFoundError("Flashcard", flashcardId);
    }

    // Run the reading verification (using pinyin verifier for now — works for numbered-tone formats)
    const result = verifyPinyin(userReading, flashcard.pinyin);

    // If tone marks were detected (Chinese-specific), return a soft rejection with feedback
    if (result.hasToneMarks) {
      return NextResponse.json({
        correct: false,
        correctReading: flashcard.pinyin,
        expectedReading: flashcard.pinyin,
        feedback: result.toneMarkMessage,
      });
    }

    return NextResponse.json({
      correct: result.correct,
      correctReading: flashcard.pinyin,
      expectedReading: flashcard.pinyin,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
