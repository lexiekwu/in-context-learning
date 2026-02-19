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

// ---------------------------------------------------------------------------
// Lenient translation matching
// ---------------------------------------------------------------------------

/**
 * Check if a user's translation captures the core meaning.
 * - Splits "to study / to learn" into individual meanings
 * - Strips common filler words
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
  const meaningVariants = expectedMeaning.split(/[\/;,]/).map((s) => s.trim());

  for (const variant of meaningVariants) {
    const expectedWords = extractKeywords(variant);
    for (const word of expectedWords) {
      if (userWords.has(word)) return true;
      for (const uw of userWords) {
        if (uw.startsWith(word) || word.startsWith(uw)) return true;
      }
    }
  }

  // Full substring containment as a last resort
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

    // Parse & validate request body
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError("Invalid request body", parsed.error.flatten());
    }
    const { flashcardId, generatedTranslation, userTranslation } = parsed.data;

    // Fetch the flashcard to get target word and meaning
    const flashcard = await db.flashcard.findFirst({
      where: { id: flashcardId, userId },
    });
    if (!flashcard) {
      throw notFoundError("Flashcard", flashcardId);
    }

    // Check against both the target word meaning and the generated sentence translation
    const matchesMeaning = lenientTranslationMatch(
      userTranslation,
      flashcard.englishMeaning
    );
    const matchesTranslation = generatedTranslation
      ? lenientTranslationMatch(userTranslation, generatedTranslation)
      : false;

    const isCorrect = matchesMeaning || matchesTranslation;

    return NextResponse.json({ correct: isCorrect });
  } catch (error) {
    return errorResponse(error);
  }
}
