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
import { getNextDueCard } from "@/lib/db/queries";
import { callLLM } from "@/lib/llm/call";
import { SentenceGenerationResponseSchema } from "@/lib/llm/schemas";
import type { SentenceGenerationResponse } from "@/lib/llm/schemas";
import {
  sentenceGenerationSystemMessage,
  sentenceGenerationUserMessage,
} from "@/lib/llm/prompts";
import { sanitizeForPrompt } from "@/lib/llm/sanitize";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCharacterSet } from "@/lib/languages";

const querySchema = z.object({
  sessionId: z.string().uuid("sessionId must be a valid UUID"),
  excludeCardId: z.string().uuid().optional(),
});

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * GET /api/quiz/next-card-with-sentence?sessionId={uuid}
 *
 * Combined endpoint: selects the next due card AND generates a sentence for it
 * in a single request. Eliminates the round-trip between next-card and
 * generate-sentence, saving ~300-400ms on each card transition.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }

    const userId = session.user.id;

    const limited = await checkRateLimit("quiz", userId);
    if (limited) return limited;

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(searchParams);
    if (!parsed.success) {
      throw validationError(
        "Invalid query parameters.",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { sessionId, excludeCardId } = parsed.data;
    const extraExcludeIds = excludeCardId ? [excludeCardId] : [];

    // Get user's active language for filtering cards
    const userRecord = await db.user.findUnique({
      where: { id: userId },
      select: { targetLanguage: true, languageVariant: true },
    });
    const activeLang = userRecord?.targetLanguage ?? "zh";

    // Verify session belongs to user + get next card in parallel
    const [studySession, cardResult] = await Promise.all([
      db.studySession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      }),
      getNextDueCard(userId, sessionId, extraExcludeIds, activeLang),
    ]);

    if (!studySession || studySession.userId !== userId) {
      throw notFoundError("StudySession", sessionId);
    }

    if (!cardResult.card) {
      return NextResponse.json({
        flashcard: null,
        sentence: null,
        cardsRemaining: 0,
        nextDueAt: cardResult.nextDueAt?.toISOString() ?? null,
      });
    }

    const flashcard = cardResult.card;

    // Check for cached sentence first
    const todayStart = startOfToday();
    const cachedLog = await db.reviewLog.findFirst({
      where: {
        flashcardId: flashcard.id,
        userId,
        reviewedAt: { gte: todayStart },
        sentenceResponseJson: { not: null },
      },
      orderBy: { reviewedAt: "desc" },
    });

    let sentence: SentenceGenerationResponse | null = null;

    if (cachedLog?.sentenceResponseJson) {
      try {
        const cached = JSON.parse(cachedLog.sentenceResponseJson);
        const validated = SentenceGenerationResponseSchema.safeParse(cached);
        if (validated.success) {
          sentence = validated.data;
        }
      } catch {
        // Cache parse failed — generate below
      }
    }

    if (!sentence) {
      // Get language settings for sentence generation
      const langCode = activeLang;
      const characterSet = getCharacterSet(langCode, userRecord?.languageVariant) ?? "traditional";

      // Dev fallback for missing API key
      const poeKey = process.env.POE_API_KEY;
      if (!poeKey || poeKey.startsWith("your")) {
        const word = flashcard.word;
        const meaning = flashcard.englishMeaning;
        const pin = flashcard.reading ?? "";
        const templates = [
          {
            sentence: `他很喜歡${word}。`,
            translation: `He really likes to ${meaning}.`,
            wordBreakdown: [
              { word: "他", pinyin: "ta1", meaning: "he" },
              { word: "很", pinyin: "hen3", meaning: "very" },
              { word: "喜歡", pinyin: "xi3huan1", meaning: "to like" },
              { word, pinyin: pin, meaning },
            ],
          },
          {
            sentence: `我想${word}。`,
            translation: `I want to ${meaning}.`,
            wordBreakdown: [
              { word: "我", pinyin: "wo3", meaning: "I" },
              { word: "想", pinyin: "xiang3", meaning: "to want" },
              { word, pinyin: pin, meaning },
            ],
          },
        ];
        let hash = 0;
        for (let i = 0; i < flashcard.id.length; i++) {
          hash = (hash * 31 + flashcard.id.charCodeAt(i)) | 0;
        }
        sentence = {
          ...templates[Math.abs(hash) % templates.length],
          sentenceWithHighlight: "",
        };
      } else {
        sentence = await callLLM({
          systemMessage: sentenceGenerationSystemMessage(characterSet),
          userMessage: sentenceGenerationUserMessage({
            targetWord: sanitizeForPrompt(flashcard.word),
            pinyin: sanitizeForPrompt(flashcard.reading ?? ""),
            meaning: sanitizeForPrompt(flashcard.englishMeaning),
            characterSet,
          }),
          schema: SentenceGenerationResponseSchema,
          temperature: 0.7,
          maxTokens: 2000,
          purpose: "generate-sentence",
        });
      }
    }

    return NextResponse.json({
      flashcard: {
        id: flashcard.id,
        word: flashcard.word,
        pinyin: flashcard.reading ?? "",
        englishMeaning: flashcard.englishMeaning,
        state: flashcard.state,
        reps: flashcard.reps,
        lapses: flashcard.lapses,
      },
      sentence,
      cardsRemaining: cardResult.cardsRemaining,
      newCardsRemaining: cardResult.newCardsRemaining,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
