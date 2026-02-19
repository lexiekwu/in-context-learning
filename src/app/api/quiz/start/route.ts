import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, unauthorizedError } from "@/lib/errors";

/**
 * POST /api/quiz/start
 *
 * Creates a new StudySession record and returns the sessionId.
 * Request body is empty — userId comes from the JWT session.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw unauthorizedError();
    }

    const userId = session.user.id;

    const studySession = await db.studySession.create({
      data: { userId },
    });

    return NextResponse.json(
      {
        sessionId: studySession.id,
        startedAt: studySession.startedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
