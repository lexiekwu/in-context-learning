import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, unauthorizedError } from "@/lib/errors";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "lexiekwu@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * GET /api/admin/migrate
 *
 * Programmatic endpoint to run raw SQL altering StudySession table.
 * Accessible only to whitelisted admin emails.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
      throw unauthorizedError();
    }

    // Execute raw SQL migration directly via Prisma
    await db.$executeRawUnsafe(
      'ALTER TABLE "StudySession" ALTER COLUMN "cardsCorrect" SET DATA TYPE DOUBLE PRECISION;'
    );

    await db.$executeRawUnsafe(
      'DROP INDEX IF EXISTS "Flashcard_userId_language_due_idx";'
    );

    await db.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Flashcard_userId_language_state_due_idx" ON "Flashcard"("userId", "language", "state", "due");'
    );

    return NextResponse.json({
      success: true,
      message: "Database migrated successfully! Index 'Flashcard_userId_language_state_due_idx' created.",
    });
  } catch (error: any) {
    console.error("[admin/migrate] SQL migration failed:", error);
    return errorResponse(error);
  }
}
