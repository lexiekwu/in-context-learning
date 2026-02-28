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
  duplicateError,
} from "@/lib/errors";
import type { FlashcardResponse, FlashcardListResponse } from "@/types";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const VALID_CARD_STATES = ["NEW", "LEARNING", "REVIEW", "RELEARNING"] as const;
const VALID_SORT_FIELDS = ["due", "word", "createdAt"] as const;
const VALID_ORDERS = ["asc", "desc"] as const;

const listQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  state: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return val.split(",").map((s) => s.trim().toUpperCase());
    })
    .pipe(
      z
        .array(z.enum(VALID_CARD_STATES))
        .optional()
    ),
  sort: z.enum(VALID_SORT_FIELDS).default("due"),
  order: z.enum(VALID_ORDERS).default("asc"),
});

const createFlashcardSchema = z.object({
  word: z.string().min(1, "word is required"),
  pinyin: z.string().optional().default(""),
  reading: z.string().optional(),
  englishMeaning: z.string().min(1, "englishMeaning is required").max(500),
  exampleSentence: z.string().optional(),
  language: z.string().optional(),
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
// GET /api/flashcards
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }
    const userId = session.user.id;

    const limited = await checkRateLimit("flashcard", userId);
    if (limited) return limited;

    // Parse query params
    const url = req.nextUrl;
    const rawParams = {
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      order: url.searchParams.get("order") ?? undefined,
    };

    const parsed = listQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      throw validationError(
        "Invalid query parameters.",
        parsed.error.flatten().fieldErrors
      );
    }

    const { cursor, limit, search, state, sort, order } = parsed.data;

    // Build where clause
    const where: Record<string, unknown> = { userId };

    if (state && state.length > 0) {
      where.state = { in: state };
    }

    if (search) {
      where.OR = [
        { word: { contains: search, mode: "insensitive" } },
        { reading: { contains: search, mode: "insensitive" } },
        { englishMeaning: { contains: search, mode: "insensitive" } },
      ];
    }

    // Total count (for the current filter set)
    const total = await db.flashcard.count({ where });

    // Build orderBy
    const orderBy: Record<string, string> = { [sort]: order };

    // Cursor-based pagination
    const findArgs: Record<string, unknown> = {
      where,
      orderBy,
      take: limit + 1, // fetch one extra to determine if there's a next page
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1; // skip the cursor itself
    }

    const cards = await db.flashcard.findMany(findArgs as Parameters<typeof db.flashcard.findMany>[0]);

    // Determine next cursor
    let nextCursor: string | null = null;
    if (cards.length > limit) {
      const nextItem = cards.pop()!;
      nextCursor = nextItem.id;
    }

    const response: FlashcardListResponse = {
      flashcards: cards.map(toFlashcardResponse),
      nextCursor,
      hasMore: nextCursor !== null,
      totalCount: total,
    };

    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/flashcards
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
    const parsed = createFlashcardSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(
        "Invalid request body.",
        parsed.error.flatten().fieldErrors
      );
    }

    const { word, pinyin, reading, englishMeaning, exampleSentence } = parsed.data;
    // Use reading field if provided, fall back to pinyin for backward compat
    const effectiveReading = reading ?? pinyin ?? "";

    // Determine language: use provided language, or fall back to user's target language
    let language = parsed.data.language;
    if (!language) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { targetLanguage: true },
      });
      language = user?.targetLanguage ?? "zh";
    }
    const existing = await db.flashcard.findUnique({
      where: { userId_word_language: { userId, word, language } },
    });
    if (existing) {
      throw duplicateError(
        `A flashcard with the word "${word}" already exists.`
      );
    }

    const card = await db.flashcard.create({
      data: {
        userId,
        word,
        language,
        reading: effectiveReading || null,
        englishMeaning,
        exampleSentence: exampleSentence ?? null,
        difficulty: 0,
        stability: 0,
        reps: 0,
        lapses: 0,
        state: "NEW",
      },
    });

    return NextResponse.json(
      { flashcard: toFlashcardResponse(card) },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
