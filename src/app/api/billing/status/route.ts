import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkSubscriptionAccess } from "@/lib/subscription";
import { errorResponse, unauthorizedError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw unauthorizedError();
    const userId = session.user.id;

    const limited = await checkRateLimit("billing", userId);
    if (limited) return limited;

    const access = await checkSubscriptionAccess(userId);

    return NextResponse.json({
      status: access.status,
      trialEndsAt: access.trialEndsAt?.toISOString() ?? null,
      daysRemaining: access.daysRemaining,
      canAccessQuiz: access.allowed,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
