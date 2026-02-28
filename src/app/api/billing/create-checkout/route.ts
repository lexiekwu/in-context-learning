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

    // Check Stripe is configured before doing any work
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_MONTHLY_PRICE_ID) {
      return NextResponse.json(
        { error: "Billing is not configured yet. Please check back soon." },
        { status: 503 },
      );
    }

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? env.NEXTAUTH_URL;
    // Validate redirect URL is on the expected domain
    const parsedUrl = new URL(appUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Invalid app URL configuration" }, { status: 500 });
    }
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: env.STRIPE_MONTHLY_PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/settings?billing=cancelled`,
      metadata: { userId },
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error) {
    return errorResponse(error);
  }
}
