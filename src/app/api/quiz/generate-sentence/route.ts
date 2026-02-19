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
import { callLLM } from "@/lib/llm/call";
import { SentenceGenerationResponseSchema } from "@/lib/llm/schemas";
import type { SentenceGenerationResponse } from "@/lib/llm/schemas";
import {
  sentenceGenerationSystemMessage,
  sentenceGenerationUserMessage,
} from "@/lib/llm/prompts";
import { sanitizeForPrompt } from "@/lib/llm/sanitize";

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  flashcardId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveUserLevel(totalCards: number): "beginner" | "intermediate" | "advanced" {
  if (totalCards < 300) return "beginner";
  if (totalCards <= 1500) return "intermediate";
  return "advanced";
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ---------------------------------------------------------------------------
// POST /api/quiz/generate-sentence
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Auth
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }
    const userId = session.user.id;

    // Parse & validate request body
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid request body", parsed.error.flatten());
    }
    const { flashcardId } = parsed.data;

    // Fetch the flashcard (must belong to this user)
    const flashcard = await db.flashcard.findFirst({
      where: { id: flashcardId, userId },
    });
    if (!flashcard) {
      throw notFoundError("Flashcard", flashcardId);
    }

    // Check for same-day cached sentence in ReviewLog
    const todayStart = startOfToday();
    const cachedLog = await db.reviewLog.findFirst({
      where: {
        flashcardId,
        userId,
        reviewedAt: { gte: todayStart },
        sentenceResponseJson: { not: null },
      },
      orderBy: { reviewedAt: "desc" },
    });

    if (cachedLog?.sentenceResponseJson) {
      try {
        const cached = JSON.parse(cachedLog.sentenceResponseJson);
        const validated = SentenceGenerationResponseSchema.safeParse(cached);
        if (validated.success) {
          return NextResponse.json(validated.data);
        }
      } catch {
        // Cache parse failed — regenerate below
      }
    }

    // Derive user level from total card count
    const totalCards = await db.flashcard.count({ where: { userId } });
    const userLevel = deriveUserLevel(totalCards);

    // Get character set from user profile
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { characterSet: true },
    });
    const characterSet = user.characterSet.toLowerCase() as "traditional" | "simplified";

    // Call LLM
    const result: SentenceGenerationResponse = await callLLM({
      systemMessage: sentenceGenerationSystemMessage(characterSet),
      userMessage: sentenceGenerationUserMessage({
        targetWord: sanitizeForPrompt(flashcard.word),
        pinyin: sanitizeForPrompt(flashcard.pinyin),
        meaning: sanitizeForPrompt(flashcard.englishMeaning),
        userLevel,
        characterSet,
      }),
      schema: SentenceGenerationResponseSchema,
      temperature: 0.7,
      maxTokens: 500,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
