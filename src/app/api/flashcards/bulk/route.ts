import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  errorResponse,
  unauthorizedError,
  validationError,
} from "@/lib/errors";

const bulkCreateSchema = z.object({
  cards: z
    .array(
      z.object({
        word: z.string().min(1),
        pinyin: z.string().optional().default(""),
        reading: z.string().optional(),
        englishMeaning: z.string().min(1).max(500),
      })
    )
    .min(1)
    .max(50),
});

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
    const parsed = bulkCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "Invalid request body.",
        parsed.error.flatten().fieldErrors
      );
    }

    const result = await db.flashcard.createMany({
      data: parsed.data.cards.map((card) => ({
        userId,
        word: card.word,
        pinyin: card.reading ?? card.pinyin ?? "",
        englishMeaning: card.englishMeaning,
        difficulty: 0,
        stability: 0,
        reps: 0,
        lapses: 0,
        state: "NEW" as const,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ created: result.count }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
