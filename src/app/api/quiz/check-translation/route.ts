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
import { TranslationCheckResponseSchema } from "@/lib/llm/schemas";
import {
  TRANSLATION_CHECK_SYSTEM_MESSAGE,
  translationCheckUserMessage,
} from "@/lib/llm/prompts";
import { sanitizeForPrompt } from "@/lib/llm/sanitize";

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  flashcardId: z.string().uuid(),
  generatedSentence: z.string().min(1),
  userTranslation: z.string().min(1).max(1000),
});

// ---------------------------------------------------------------------------
// POST /api/quiz/check-translation
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
    const { flashcardId, generatedSentence, userTranslation } = parsed.data;

    // Fetch the flashcard to get target word and meaning
    const flashcard = await db.flashcard.findFirst({
      where: { id: flashcardId, userId },
    });
    if (!flashcard) {
      throw notFoundError("Flashcard", flashcardId);
    }

    // Call LLM
    const result = await callLLM({
      systemMessage: TRANSLATION_CHECK_SYSTEM_MESSAGE,
      userMessage: translationCheckUserMessage({
        chineseSentence: sanitizeForPrompt(generatedSentence),
        correctTranslation: "", // Not available client-side; LLM will assess directly
        userTranslation: sanitizeForPrompt(userTranslation),
        targetWord: sanitizeForPrompt(flashcard.word),
        targetMeaning: sanitizeForPrompt(flashcard.englishMeaning),
      }),
      schema: TranslationCheckResponseSchema,
      temperature: 0.3,
      maxTokens: 300,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
