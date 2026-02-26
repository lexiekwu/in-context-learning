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
import type { LanguagePromptContext } from "@/lib/llm/prompts";
import { sanitizeForPrompt } from "@/lib/llm/sanitize";
import { checkRateLimit } from "@/lib/rate-limit";
import { getLanguageConfig, getCharacterSet } from "@/lib/languages";

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  word: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect input language: CJK chars -> target language script, ASCII -> english */
function detectInputLanguage(input: string, targetLangCode: string): string {
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(input)) return "chinese";
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(input)) return "japanese";
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(input)) return "korean";
  if (/^[\x00-\x7F\u00C0-\u024F]+$/.test(input)) return "english";
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

    const limited = await checkRateLimit("aiCreate", userId);
    if (limited) return limited;

    // Parse & validate request body
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid request body", parsed.error.flatten());
    }
    const { word } = parsed.data;

    // Get language settings from user profile
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { characterSet: true, targetLanguage: true, languageVariant: true },
    });

    const langConfig = getLanguageConfig(user.targetLanguage);
    const characterSet = getCharacterSet(user.targetLanguage, user.languageVariant)
      ?? (user.characterSet.toLowerCase() as "traditional" | "simplified");
    const langCtx: LanguagePromptContext = {
      language: langConfig,
      variant: user.languageVariant ?? (langConfig.code === "zh" ? characterSet : null),
    };

    // Auto-detect input language
    const inputLanguage = detectInputLanguage(word, langConfig.code);

    // Call LLM
    const result = await callLLM({
      systemMessage: aiCardCreationSystemMessage(characterSet, langCtx),
      userMessage: aiCardCreationUserMessage({
        input: sanitizeForPrompt(word),
        inputLanguage,
        characterSet,
        langCtx,
      }),
      schema: AICardCreationResponseSchema,
      temperature: 0.5,
      maxTokens: 300,
      purpose: "ai-create",
    });

    // Resolve reading: prefer "pinyin" field (Chinese), fall back to "reading" for other languages
    const reading = result.pinyin ?? result.reading ?? "";

    // Check for duplicate word for this user
    const existing = await db.flashcard.findFirst({
      where: { userId, word: result.word },
    });

    return NextResponse.json({
      suggestion: {
        word: result.word,
        pinyin: reading,
        reading,
        englishMeaning: result.meaning,
        exampleSentence: result.exampleSentence ?? "",
      },
      isDuplicate: existing !== null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
