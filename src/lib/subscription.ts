import { db } from "@/lib/db";

export interface SubscriptionAccessResult {
  allowed: boolean;
  status: "TRIAL" | "ACTIVE" | "LAPSED" | "CANCELLED";
  daysRemaining: number | null;
  trialEndsAt: Date | null;
}

export async function checkSubscriptionAccess(userId: string): Promise<SubscriptionAccessResult> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
    },
  });

  const { subscriptionStatus, trialEndsAt } = user;

  if (subscriptionStatus === "ACTIVE") {
    return { allowed: true, status: "ACTIVE", daysRemaining: null, trialEndsAt };
  }

  if (subscriptionStatus === "TRIAL") {
    const now = new Date();
    if (trialEndsAt && trialEndsAt > now) {
      const msRemaining = trialEndsAt.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      return { allowed: true, status: "TRIAL", daysRemaining, trialEndsAt };
    }

    // Trial expired — auto-flip to LAPSED
    await db.user.update({
      where: { id: userId },
      data: { subscriptionStatus: "LAPSED" },
    });
    return { allowed: false, status: "LAPSED", daysRemaining: 0, trialEndsAt };
  }

  // LAPSED or CANCELLED
  return { allowed: false, status: subscriptionStatus, daysRemaining: null, trialEndsAt };
}
