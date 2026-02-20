"use client";

import { useEffect, useState } from "react";
import type { BillingStatusResponse } from "@/types";

export function SubscriptionBanner() {
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBilling(data))
      .catch(() => {});
  }, []);

  if (!billing) return null;
  if (billing.status === "ACTIVE") return null;

  const isTrial = billing.status === "TRIAL" && billing.daysRemaining !== null;
  const isLapsed = billing.status === "LAPSED" || billing.status === "CANCELLED";

  if (!isTrial && !isLapsed) return null;

  return (
    <div
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm ${
        isLapsed
          ? "bg-red-900/40 text-red-200"
          : "bg-amber-900/40 text-amber-200"
      }`}
    >
      <span>
        {isLapsed
          ? "Your trial has expired."
          : `${billing.daysRemaining} day${billing.daysRemaining === 1 ? "" : "s"} left in your free trial.`}
      </span>
      <a
        href="/settings"
        className="font-medium underline underline-offset-2 hover:no-underline"
      >
        {isLapsed ? "Subscribe to continue" : "Subscribe"}
      </a>
    </div>
  );
}
