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
import { checkRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// LLM prompt — focused narrowly on target word understanding
// ---------------------------------------------------------------------------

const SYSTEM_MESSAGE = `You are grading a Mandarin learner's English translation of a Chinese sentence.

Your ONLY job: decide if the student understood the meaning of the **target word** based on their translation.

Rules:
- Be LENIENT on grammar, style, word order, and phrasing of the overall sentence.
- Be STRICT on the target word. The student's translation must show they understood what the target word means in context. Synonyms and paraphrasing of the target word are fine.
- If the target word's meaning is completely absent or wrong in the translation, mark incorrect.

Respond with JSON: {"correct": true} or {"correct": false}
Nothing else.`;

function buildUserMessage(params: {
  chineseSentence: string;
  referenceTranslation: string;
  userTranslation: string;
  targetWord: string;
  targetMeaning: string;
}): string {
  return `Chinese sentence: ${params.chineseSentence}
Reference translation: ${params.referenceTranslation}
Student's translation: ${params.userTranslation}

Target word: ${params.targetWord}
Target word meaning: ${params.targetMeaning}

Is the target word's meaning reflected in the student's translation? {"correct": true or false}`;
}

// ---------------------------------------------------------------------------
// Response schema — minimal
// ---------------------------------------------------------------------------

const ResponseSchema = z.object({
  correct: z.boolean(),
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

    // Fetch the flashcard to get target word and meaning
    const flashcard = await db.flashcard.findFirst({
      where: { id: flashcardId, userId },
    });
    if (!flashcard) {
      throw notFoundError("Flashcard", flashcardId);
    }

    // Ask LLM to judge whether the target word's meaning is reflected
    const result = await callLLM({
      systemMessage: SYSTEM_MESSAGE,
      userMessage: buildUserMessage({
        chineseSentence: generatedSentence,
        referenceTranslation: generatedTranslation ?? "",
        userTranslation,
        targetWord: flashcard.word,
        targetMeaning: flashcard.englishMeaning,
      }),
      schema: ResponseSchema,
      maxRetries: 1,
      temperature: 0.1,
      maxTokens: 1000,
    });

    return NextResponse.json({ correct: result.correct });
  } catch (error) {
    return errorResponse(error);
  }
}
