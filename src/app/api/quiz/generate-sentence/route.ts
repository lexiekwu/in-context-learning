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
import { checkRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  flashcardId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

    const limited = await checkRateLimit("quiz", userId);
    if (limited) return limited;

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

    // Get character set from user profile
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { characterSet: true },
    });
    const characterSet = user.characterSet.toLowerCase() as "traditional" | "simplified";

    // Dev fallback: if POE_API_KEY is not configured or is a placeholder, return mock data
    const poeKey = process.env.POE_API_KEY;
    if (!poeKey || poeKey.startsWith("your")) {
      const word = flashcard.word;
      const meaning = flashcard.englishMeaning;
      const pin = flashcard.pinyin;

      // Pick a varied template based on flashcard ID hash
      const templates = [
        {
          sentence: `他很喜歡${word}。`,
          translation: `He really likes to ${meaning}.`,
          breakdown: [
            { word: "他", pinyin: "ta1", meaning: "he" },
            { word: "很", pinyin: "hen3", meaning: "very" },
            { word: "喜歡", pinyin: "xi3huan1", meaning: "to like" },
            { word, pinyin: pin, meaning },
          ],
        },
        {
          sentence: `我想${word}。`,
          translation: `I want to ${meaning}.`,
          breakdown: [
            { word: "我", pinyin: "wo3", meaning: "I" },
            { word: "想", pinyin: "xiang3", meaning: "to want" },
            { word, pinyin: pin, meaning },
          ],
        },
        {
          sentence: `你可以${word}嗎？`,
          translation: `Can you ${meaning}?`,
          breakdown: [
            { word: "你", pinyin: "ni3", meaning: "you" },
            { word: "可以", pinyin: "ke3yi3", meaning: "can" },
            { word, pinyin: pin, meaning },
            { word: "嗎", pinyin: "ma5", meaning: "(question particle)" },
          ],
        },
        {
          sentence: `我們一起${word}吧。`,
          translation: `Let's ${meaning} together.`,
          breakdown: [
            { word: "我們", pinyin: "wo3men5", meaning: "we" },
            { word: "一起", pinyin: "yi4qi3", meaning: "together" },
            { word, pinyin: pin, meaning },
            { word: "吧", pinyin: "ba5", meaning: "(suggestion particle)" },
          ],
        },
        {
          sentence: `她每天都${word}。`,
          translation: `She ${meaning}s every day.`,
          breakdown: [
            { word: "她", pinyin: "ta1", meaning: "she" },
            { word: "每天", pinyin: "mei3tian1", meaning: "every day" },
            { word: "都", pinyin: "dou1", meaning: "all / always" },
            { word, pinyin: pin, meaning },
          ],
        },
      ];

      // Simple hash over the full UUID for better distribution
      let hash = 0;
      for (let i = 0; i < flashcard.id.length; i++) {
        hash = (hash * 31 + flashcard.id.charCodeAt(i)) | 0;
      }
      const idx = Math.abs(hash) % templates.length;
      const tpl = templates[idx];

      return NextResponse.json({
        sentence: tpl.sentence,
        sentenceWithHighlight: tpl.sentence.replace(word, `<mark>${word}</mark>`),
        translation: tpl.translation,
        wordBreakdown: tpl.breakdown,
      });
    }

    // Call LLM
    const result: SentenceGenerationResponse = await callLLM({
      systemMessage: sentenceGenerationSystemMessage(characterSet),
      userMessage: sentenceGenerationUserMessage({
        targetWord: sanitizeForPrompt(flashcard.word),
        pinyin: sanitizeForPrompt(flashcard.pinyin),
        meaning: sanitizeForPrompt(flashcard.englishMeaning),
        characterSet,
      }),
      schema: SentenceGenerationResponseSchema,
      temperature: 0.7,
      maxTokens: 2000,
      purpose: "generate-sentence",
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
