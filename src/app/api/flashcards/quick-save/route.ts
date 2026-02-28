import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CardState } from "@/generated/prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  errorResponse,
  unauthorizedError,
  validationError,
} from "@/lib/errors";
import type { FlashcardResponse } from "@/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const quickSaveSchema = z.object({
  word: z.string().min(1, "word is required"),
  pinyin: z.string().optional().default(""),
  reading: z.string().optional(),
  englishMeaning: z.string().min(1, "englishMeaning is required").max(500),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFlashcardResponse(card: {
  id: string;
  word: string;
  reading: string | null;
  englishMeaning: string;
  exampleSentence: string | null;
  state: CardState;
  due: Date;
  reps: number;
  lapses: number;
  createdAt: Date;
}): FlashcardResponse {
  return {
    id: card.id,
    word: card.word,
    pinyin: card.reading ?? "",
    englishMeaning: card.englishMeaning,
    exampleSentence: card.exampleSentence,
    state: card.state,
    due: card.due.toISOString(),
    reps: card.reps,
    lapses: card.lapses,
    createdAt: card.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// POST /api/flashcards/quick-save
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }
    const userId = session.user.id;

    const limited = await checkRateLimit("flashcard", userId);
    if (limited) return limited;

    const body = await req.json();
    const parsed = quickSaveSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "Invalid request body.",
        parsed.error.flatten().fieldErrors
      );
    }

    const { word, pinyin, reading, englishMeaning } = parsed.data;
    const effectiveReading = reading ?? pinyin ?? "";

    // Check for duplicate — if exists, return the existing card with isDuplicate flag
    // Note: uses language default "zh" for backwards compat; should be updated when language is passed
    const existing = await db.flashcard.findUnique({
      where: { userId_word_language: { userId, word, language: "zh" } },
    });

    if (existing) {
      return NextResponse.json({
        card: toFlashcardResponse(existing),
        isDuplicate: true,
      });
    }

    // Create new card with default FSRS values
    const card = await db.flashcard.create({
      data: {
        userId,
        word,
        reading: effectiveReading || null,
        englishMeaning,
        difficulty: 0,
        stability: 0,
        reps: 0,
        lapses: 0,
        state: "NEW",
      },
    });

    return NextResponse.json(
      { card: toFlashcardResponse(card), isDuplicate: false },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
