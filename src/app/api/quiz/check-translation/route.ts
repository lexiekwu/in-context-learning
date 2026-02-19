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
// Lenient translation matching for dev mode (no LLM)
// ---------------------------------------------------------------------------

/**
 * Check if a user's translation captures the core meaning of the target word.
 * Much more lenient than exact matching:
 * - Splits "to study / to learn" into individual meanings
 * - Strips common filler words (the, a, an, to, is, etc.)
 * - Accepts any keyword overlap as correct
 * - Handles synonyms and partial matches
 */
function lenientTranslationMatch(
  userTranslation: string,
  expectedMeaning: string
): boolean {
  const stopWords = new Set([
    "i", "me", "my", "we", "you", "he", "she", "it", "they",
    "the", "a", "an", "is", "am", "are", "was", "were", "be",
    "to", "of", "in", "on", "at", "for", "with", "and", "or",
    "not", "no", "do", "does", "did", "have", "has", "had",
    "this", "that", "these", "those", "very", "really", "so",
    "every", "day", "all", "also", "just", "still", "already",
    "can", "will", "would", "should", "could", "may", "might",
  ]);

  function extractKeywords(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !stopWords.has(w))
    );
  }

  const userWords = extractKeywords(userTranslation);

  // Split expected meaning on / , ; to get alternate meanings
  // e.g., "to study / to learn" → ["to study", "to learn"]
  const meaningVariants = expectedMeaning.split(/[\/;,]/).map((s) => s.trim());

  for (const variant of meaningVariants) {
    const expectedWords = extractKeywords(variant);
    // If any keyword from the expected meaning appears in the user's translation
    for (const word of expectedWords) {
      if (userWords.has(word)) return true;
      // Also check if any user word starts with or contains the expected keyword
      for (const uw of userWords) {
        if (uw.startsWith(word) || word.startsWith(uw)) return true;
      }
    }
  }

  // Also check full substring containment as a last resort
  const normalizedUser = userTranslation.trim().toLowerCase();
  for (const variant of meaningVariants) {
    const normalizedVariant = variant.trim().toLowerCase()
      .replace(/^to /, "")
      .replace(/^be /, "");
    if (normalizedVariant.length > 2 && normalizedUser.includes(normalizedVariant)) {
      return true;
    }
  }

  return false;
}

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

    // Dev fallback: if POE_API_KEY is not configured or is a placeholder, use lenient matching
    const poeKey = process.env.POE_API_KEY;
    if (!poeKey || poeKey.startsWith("your")) {
      const isCorrect = lenientTranslationMatch(
        userTranslation,
        flashcard.englishMeaning
      );
      return NextResponse.json({
        correct: isCorrect,
        explanation: isCorrect
          ? "Good translation!"
          : `The expected meaning is "${flashcard.englishMeaning}".`,
        targetWordUsedCorrectly: isCorrect,
        suggestedTranslation: `I ${flashcard.englishMeaning} every day.`,
      });
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
