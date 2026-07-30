import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/llm/call";
import {
  errorResponse,
  unauthorizedError,
  validationError,
  notFoundError,
} from "@/lib/errors";
import { getLanguageConfig } from "@/lib/languages";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeForPrompt } from "@/lib/llm/sanitize";
import { requestLogger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// LLM prompt — focused narrowly on target word understanding
// ---------------------------------------------------------------------------

function buildSystemMessage(languageName: string): string {
  return `You are grading a ${languageName} learner's English translation of a ${languageName} sentence.

You must evaluate two things:
1. "sentenceCorrect": true if the student's translation accurately conveys the overall meaning of the full sentence (be lenient on grammar, style, and phrasing, but the full sentence meaning must be preserved).
2. "targetWordCorrect": true if the student's translation shows they understood the meaning of the **target word** in context (even if the rest of the sentence is incomplete or incorrect). Synonyms and paraphrasing of the target word are fine.

Note:
- If "sentenceCorrect" is true, "targetWordCorrect" must also be true.
- If only the target word is correct but the overall sentence translation is wrong or incomplete, set "sentenceCorrect": false and "targetWordCorrect": true.
- If the target word's meaning is absent or wrong, set "targetWordCorrect": false and "sentenceCorrect": false.
- Set "correct" to true whenever "targetWordCorrect" is true (or "sentenceCorrect" is true).

Respond with JSON: {"correct": boolean, "sentenceCorrect": boolean, "targetWordCorrect": boolean}`;
}

function buildUserMessage(params: {
  sentence: string;
  referenceTranslation: string;
  userTranslation: string;
  targetWord: string;
  targetMeaning: string;
  languageName: string;
}): string {
  return `${params.languageName} sentence: ${params.sentence}
Reference translation: ${params.referenceTranslation}
Student's translation: ${params.userTranslation}

Target word: ${params.targetWord}
Target word meaning: ${params.targetMeaning}

Evaluate the student's translation. Return JSON: {"correct": true/false, "sentenceCorrect": true/false, "targetWordCorrect": true/false}`;
}

// ---------------------------------------------------------------------------
// Response schema — minimal
// ---------------------------------------------------------------------------

const ResponseSchema = z.object({
  correct: z.boolean(),
  sentenceCorrect: z.boolean().optional().default(false),
  targetWordCorrect: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  flashcardId: z.string().uuid(),
  generatedSentence: z.string().min(1),
  generatedTranslation: z.string().optional(),
  userTranslation: z.string().min(1).max(1000),
});

// ---------------------------------------------------------------------------
// POST /api/quiz/check-translation
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const routeStart = Date.now();
    const log = requestLogger("check-translation");

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
    const { flashcardId, generatedSentence, generatedTranslation, userTranslation } = parsed.data;

    // Fetch the flashcard and user language in parallel
    const [flashcard, user] = await Promise.all([
      db.flashcard.findFirst({
        where: { id: flashcardId, userId },
      }),
      db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { targetLanguage: true },
      }),
    ]);
    if (!flashcard) {
      throw notFoundError("Flashcard", flashcardId);
    }

    const langConfig = getLanguageConfig(user.targetLanguage);
    const languageName = langConfig.name;

    // Ask LLM to judge whether the target word's meaning is reflected
    const llmStart = Date.now();
    const result = await callLLM({
      systemMessage: buildSystemMessage(languageName),
      userMessage: buildUserMessage({
        sentence: sanitizeForPrompt(generatedSentence),
        referenceTranslation: sanitizeForPrompt(generatedTranslation ?? ""),
        userTranslation: sanitizeForPrompt(userTranslation),
        targetWord: flashcard.word,
        targetMeaning: flashcard.englishMeaning,
        languageName,
      }),
      schema: ResponseSchema,
      maxRetries: 1,
      purpose: "check-translation",
      temperature: 0.1,
      maxTokens: 1000,
    });

    const llmMs = Date.now() - llmStart;
    const totalMs = Date.now() - routeStart;
    log.info({ llmMs, totalMs, flashcardId }, "check-translation complete");
    if (totalMs > 3000) {
      log.warn({ llmMs, totalMs, flashcardId }, "Slow check-translation response");
    }

    const correct = Boolean(result.correct || result.targetWordCorrect || result.sentenceCorrect);
    const sentenceCorrect = Boolean(result.sentenceCorrect);
    const targetWordCorrect = Boolean(result.targetWordCorrect || correct);

    return NextResponse.json({
      correct,
      sentenceCorrect,
      targetWordCorrect,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
