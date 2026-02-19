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
