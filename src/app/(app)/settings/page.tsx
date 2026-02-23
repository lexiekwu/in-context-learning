"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useEffect, useState } from "react";

type CharacterSet = "TRADITIONAL" | "SIMPLIFIED";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [characterSet, setCharacterSet] = useState<CharacterSet>("TRADITIONAL");
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch current settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/user/settings");
        if (res.ok) {
          const data = await res.json();
          setCharacterSet(data.characterSet);
        }
      } catch {
        // Use default
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave(newSet: CharacterSet) {
    setCharacterSet(newSet);
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterSet: newSet }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save settings");
      }

      setMessage({ type: "success", text: "Settings saved." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  }

  const user = session?.user;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="mb-8 text-2xl font-bold text-zinc-50">Settings</h1>

      {/* User Info */}
      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
          Account
        </h2>
        <div className="flex items-center gap-4">
          {user?.image && (
            <img
              src={user.image}
              alt=""
              className="h-12 w-12 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <p className="text-base font-medium text-zinc-100">
              {user?.name ?? "User"}
            </p>
            <p className="text-sm text-zinc-400">{user?.email ?? ""}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-5 inline-flex min-h-9 items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          Sign out
        </button>
      </section>

      {/* Subscription */}
      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
          Subscription
        </h2>
        <SubscriptionSection />
      </section>

      {/* Character Set */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-400">
          Character Set
        </h2>
        <p className="mb-5 text-sm text-zinc-500">
          Choose whether AI-generated sentences use traditional or simplified
          Chinese characters.
        </p>

        {loadingSettings ? (
          <div className="h-12 w-48 animate-pulse rounded-lg bg-zinc-800" />
        ) : (
          <div className="flex gap-3">
            <CharacterSetOption
              label="Traditional"
              example="繁體字"
              value="TRADITIONAL"
              current={characterSet}
              disabled={saving}
              onSelect={handleSave}
            />
            <CharacterSetOption
              label="Simplified"
              example="简体字"
              value="SIMPLIFIED"
              current={characterSet}
              disabled={saving}
              onSelect={handleSave}
            />
          </div>
        )}

        {/* Status message */}
        {message && (
          <p
            className={`mt-4 text-sm ${
              message.type === "success" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}

function CharacterSetOption({
  label,
  example,
  value,
  current,
  disabled,
  onSelect,
}: {
  label: string;
  example: string;
  value: CharacterSet;
  current: CharacterSet;
  disabled: boolean;
  onSelect: (v: CharacterSet) => void;
}) {
  const isActive = value === current;

  return (
    <button
      onClick={() => onSelect(value)}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-xl border px-6 py-4 text-center transition-colors ${
        isActive
          ? "border-indigo-500 bg-indigo-950/40 text-zinc-50"
          : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
      } ${disabled ? "cursor-wait opacity-60" : "cursor-pointer"}`}
    >
      <span className="text-2xl">{example}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function SubscriptionSection() {
  const [billing, setBilling] = useState<{
    status: string;
    daysRemaining: number | null;
    canAccessQuiz: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBilling(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubscribe() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/billing/create-checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to create checkout session");
        setActionLoading(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
      setActionLoading(false);
    }
  }

  async function handleManageBilling() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/billing/create-portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to open billing portal");
        setActionLoading(false);
        return;
      }
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="h-16 animate-pulse rounded-lg bg-zinc-800" />;
  }

  if (!billing) {
    return <p className="text-sm text-zinc-500">Unable to load subscription status.</p>;
  }

  const statusDisplay: Record<string, { label: string; color: string }> = {
    TRIAL: { label: "Free Trial", color: "text-amber-400" },
    ACTIVE: { label: "Active", color: "text-emerald-400" },
    LAPSED: { label: "Expired", color: "text-red-400" },
    CANCELLED: { label: "Cancelled", color: "text-red-400" },
  };
  const display = statusDisplay[billing.status] ?? { label: billing.status, color: "text-zinc-400" };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-zinc-300">Status:</span>
        <span className={`text-sm font-semibold ${display.color}`}>{display.label}</span>
        {billing.status === "TRIAL" && billing.daysRemaining !== null && (
          <span className="text-xs text-zinc-500">
            ({billing.daysRemaining} day{billing.daysRemaining === 1 ? "" : "s"} remaining)
          </span>
        )}
      </div>

      {billing.status === "ACTIVE" ? (
        <button
          onClick={handleManageBilling}
          disabled={actionLoading}
          className="inline-flex min-h-9 items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-wait disabled:opacity-60"
        >
          {actionLoading ? "Loading..." : "Manage Billing"}
        </button>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={actionLoading}
          className="inline-flex min-h-9 items-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
        >
          {actionLoading ? "Loading..." : "Subscribe"}
        </button>
      )}

      {actionError && (
        <p className="mt-2 text-sm text-red-400">{actionError}</p>
      )}
    </div>
  );
}
