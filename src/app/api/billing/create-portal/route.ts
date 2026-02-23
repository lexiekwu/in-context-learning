import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { errorResponse, unauthorizedError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw unauthorizedError();
    const userId = session.user.id;

    const limited = await checkRateLimit("billing", userId);
    if (limited) return limited;

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 400 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? env.NEXTAUTH_URL;
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/settings`,
    });

    return NextResponse.json({ portalUrl: portalSession.url });
  } catch (error) {
    return errorResponse(error);
  }
}
