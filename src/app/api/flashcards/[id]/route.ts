import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CardState } from "@/generated/prisma/client";
import {
  errorResponse,
  unauthorizedError,
  validationError,
  notFoundError,
  duplicateError,
} from "@/lib/errors";
import type { FlashcardResponse } from "@/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const paramSchema = z.object({
  id: z.string().uuid("Invalid flashcard ID."),
});

const updateFlashcardSchema = z
  .object({
    word: z.string().min(1).optional(),
    pinyin: z.string().min(1).optional(),
    englishMeaning: z.string().min(1).max(500).optional(),
    exampleSentence: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update.",
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFlashcardResponse(card: {
  id: string;
  word: string;
  pinyin: string;
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
    pinyin: card.pinyin,
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
// PUT /api/flashcards/[id]
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }
    const userId = session.user.id;

    const { id } = await params;
    const paramResult = paramSchema.safeParse({ id });
    if (!paramResult.success) {
      throw validationError(
        "Invalid flashcard ID.",
        paramResult.error.flatten().fieldErrors
      );
    }

    const body = await req.json();
    const parsed = updateFlashcardSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "Invalid request body.",
        parsed.error.flatten().fieldErrors
      );
    }

    // Verify card exists and belongs to user
    const existing = await db.flashcard.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw notFoundError("Flashcard", id);
    }

    const data = parsed.data;

    // If word is being changed, check for duplicate
    if (data.word && data.word !== existing.word) {
      const duplicate = await db.flashcard.findUnique({
        where: { userId_word: { userId, word: data.word } },
      });
      if (duplicate) {
        throw duplicateError(
          `A flashcard with the word "${data.word}" already exists.`
        );
      }
    }

    const updated = await db.flashcard.update({
      where: { id },
      data,
    });

    return NextResponse.json({ card: toFlashcardResponse(updated) });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/flashcards/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }
    const userId = session.user.id;

    const { id } = await params;
    const paramResult = paramSchema.safeParse({ id });
    if (!paramResult.success) {
      throw validationError(
        "Invalid flashcard ID.",
        paramResult.error.flatten().fieldErrors
      );
    }

    // Verify card exists and belongs to user
    const existing = await db.flashcard.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw notFoundError("Flashcard", id);
    }

    // Cascading delete (ReviewLogs cascade from schema)
    await db.flashcard.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
