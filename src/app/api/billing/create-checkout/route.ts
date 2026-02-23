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

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

    // Find or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId },
      });
      customerId = customer.id;
      await db.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const priceId = env.STRIPE_MONTHLY_PRICE_ID;
    if (!priceId) {
      return NextResponse.json(
        { error: "Billing not configured" },
        { status: 503 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? env.NEXTAUTH_URL;
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/settings?billing=cancelled`,
      metadata: { userId },
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error) {
    return errorResponse(error);
  }
}
