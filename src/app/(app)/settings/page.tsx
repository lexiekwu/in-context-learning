"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useEffect, useState } from "react";

const LANGUAGES = [
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
];

// Languages that have variant options
const LANGUAGE_VARIANTS: Record<
  string,
  { label: string; options: { value: string; display: string; example: string }[] }
> = {
  zh: {
    label: "Character Set",
    options: [
      { value: "TRADITIONAL", display: "Traditional", example: "繁體字" },
      { value: "SIMPLIFIED", display: "Simplified", example: "简体字" },
    ],
  },
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [targetLanguage, setTargetLanguage] = useState("zh");
  const [languageVariant, setLanguageVariant] = useState<string | null>("TRADITIONAL");
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showLanguageWarning, setShowLanguageWarning] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);

  // Track the saved language to detect changes
  const [savedLanguage, setSavedLanguage] = useState("zh");

  // Fetch current settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/user/settings");
        if (res.ok) {
          const data = await res.json();
          setTargetLanguage(data.targetLanguage ?? "zh");
          setSavedLanguage(data.targetLanguage ?? "zh");
          setLanguageVariant(data.languageVariant ?? (data.targetLanguage === "zh" || !data.targetLanguage ? "TRADITIONAL" : null));
        }
      } catch {
        // Use defaults
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  async function saveSettings(updates: {
    targetLanguage?: string;
    languageVariant?: string | null;
  }) {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save settings");
      }

      setSavedLanguage(updates.targetLanguage ?? savedLanguage);
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

  function handleLanguageChange(newLanguageCode: string) {
    // If user has cards and is changing language, show warning
    if (newLanguageCode !== savedLanguage) {
      setPendingLanguage(newLanguageCode);
      setShowLanguageWarning(true);
      return;
    }

    applyLanguageChange(newLanguageCode);
  }

  function applyLanguageChange(newLanguageCode: string) {
    setTargetLanguage(newLanguageCode);
    setShowLanguageWarning(false);
    setPendingLanguage(null);

    // Set default variant for the new language
    const variants = LANGUAGE_VARIANTS[newLanguageCode];
    const newVariant = variants ? variants.options[0].value : null;
    setLanguageVariant(newVariant);

    saveSettings({
      targetLanguage: newLanguageCode,
      languageVariant: newVariant,
    });
  }

  function handleVariantChange(newVariant: string) {
    setLanguageVariant(newVariant);
    saveSettings({ languageVariant: newVariant });
  }

  function dismissWarning() {
    setShowLanguageWarning(false);
    setPendingLanguage(null);
  }

  const user = session?.user;
  const variantConfig = LANGUAGE_VARIANTS[targetLanguage];

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

      {/* Language */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-400">
          Language
        </h2>
        <p className="mb-5 text-sm text-zinc-500">
          Choose the language you are studying. AI-generated content will use
          this language.
        </p>

        {loadingSettings ? (
          <div className="h-12 w-64 animate-pulse rounded-lg bg-zinc-800" />
        ) : (
          <>
            {/* Language Picker */}
            <select
              value={targetLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={saving}
              className={`w-full max-w-xs appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 outline-none transition-colors hover:border-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${
                saving ? "cursor-wait opacity-60" : "cursor-pointer"
              }`}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>

            {/* Language change warning */}
            {showLanguageWarning && pendingLanguage && (
              <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/30 p-4">
                <p className="text-sm text-amber-300">
                  Changing your language will not affect your existing flashcards
                  -- they will remain tagged with their original language. New
                  AI-generated content will use the new language.
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => applyLanguageChange(pendingLanguage)}
                    disabled={saving}
                    className="inline-flex min-h-8 items-center rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    Change language
                  </button>
                  <button
                    onClick={dismissWarning}
                    disabled={saving}
                    className="inline-flex min-h-8 items-center rounded-lg border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Conditional Variant Picker */}
            {variantConfig && !showLanguageWarning && (
              <div className="mt-6">
                <h3 className="mb-1 text-sm font-medium text-zinc-300">
                  {variantConfig.label}
                </h3>
                <div className="mt-3 flex gap-3">
                  {variantConfig.options.map((option) => {
                    const isActive = languageVariant === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleVariantChange(option.value)}
                        disabled={saving}
                        className={`flex flex-col items-center gap-1 rounded-xl border px-6 py-4 text-center transition-colors ${
                          isActive
                            ? "border-indigo-500 bg-indigo-950/40 text-zinc-50"
                            : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                        } ${saving ? "cursor-wait opacity-60" : "cursor-pointer"}`}
                      >
                        <span className="text-2xl">{option.example}</span>
                        <span className="text-sm font-medium">
                          {option.display}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
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
        const msg = typeof data.error === "string" ? data.error : data.error?.message ?? "Failed to create checkout session";
        setActionError(msg);
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
        const msg = typeof data.error === "string" ? data.error : data.error?.message ?? "Failed to open billing portal";
        setActionError(msg);
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
