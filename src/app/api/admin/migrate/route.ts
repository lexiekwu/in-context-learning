import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import { errorResponse, unauthorizedError } from "@/lib/errors";

const execAsync = promisify(exec);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "lexiekwu@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * GET /api/admin/migrate
 *
 * Programmatic endpoint for admins to run pending Prisma database migrations.
 * Accessible only to authorized admin emails.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
      throw unauthorizedError();
    }

    // Run migrations programmatically
    try {
      const { stdout, stderr } = await execAsync("./node_modules/.bin/prisma migrate deploy");

      return NextResponse.json({
        success: true,
        message: "Database migrations applied successfully.",
        stdout,
        stderr,
      });
    } catch (execError: any) {
      console.error("[admin/migrate] Exec error running migrations:", execError);
      return NextResponse.json({
        success: false,
        message: "Failed to execute database migrations.",
        error: execError.message,
        stdout: execError.stdout || "",
        stderr: execError.stderr || "",
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[admin/migrate] Error running migrations:", error);
    return errorResponse(error);
  }
}
