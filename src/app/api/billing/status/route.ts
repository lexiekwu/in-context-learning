import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkSubscriptionAccess } from "@/lib/subscription";
import { errorResponse, unauthorizedError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw unauthorizedError();

    const access = await checkSubscriptionAccess(session.user.id);

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
