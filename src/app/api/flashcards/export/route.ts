import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, unauthorizedError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// GET /api/flashcards/export
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }
    const userId = session.user.id;

    const limited = await checkRateLimit("flashcard", userId);
    if (limited) return limited;

    // Fetch ALL user flashcards — not subscription-gated
    const cards = await db.flashcard.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalCards: cards.length,
      cards: cards.map((card) => ({
        word: card.word,
        pinyin: card.reading ?? "",
        englishMeaning: card.englishMeaning,
        exampleSentence: card.exampleSentence,
        state: card.state,
        reps: card.reps,
        lapses: card.lapses,
        stability: card.stability,
        difficulty: card.difficulty,
        due: card.due.toISOString(),
        createdAt: card.createdAt.toISOString(),
      })),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="flashcards-export.json"',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
