import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  errorResponse,
  unauthorizedError,
  validationError,
} from "@/lib/errors";
import { callLLM } from "@/lib/llm/call";
import { AICardCreationResponseSchema } from "@/lib/llm/schemas";
import {
  aiCardCreationSystemMessage,
  aiCardCreationUserMessage,
} from "@/lib/llm/prompts";
import { sanitizeForPrompt } from "@/lib/llm/sanitize";

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  input: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect input language: CJK chars → chinese, ASCII → english */
function detectInputLanguage(input: string): "chinese" | "english" | "unknown" {
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(input)) return "chinese";
  if (/^[\x00-\x7F]+$/.test(input)) return "english";
  return "unknown";
}

// ---------------------------------------------------------------------------
// POST /api/flashcards/ai-create
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
    const { input } = parsed.data;

    // Auto-detect input language
    const inputLanguage = detectInputLanguage(input);

    // Get character set from user profile
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { characterSet: true },
    });
    const characterSet = user.characterSet.toLowerCase() as "traditional" | "simplified";

    // Call LLM
    const result = await callLLM({
      systemMessage: aiCardCreationSystemMessage(characterSet),
      userMessage: aiCardCreationUserMessage({
        input: sanitizeForPrompt(input),
        inputLanguage,
        characterSet,
      }),
      schema: AICardCreationResponseSchema,
      temperature: 0.5,
      maxTokens: 300,
    });

    // Check for duplicate word for this user
    const existing = await db.flashcard.findFirst({
      where: { userId, word: result.word },
    });

    return NextResponse.json({
      word: result.word,
      pinyin: result.pinyin,
      englishMeaning: result.meaning,
      isDuplicate: existing !== null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
