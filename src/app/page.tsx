"use client";

import { useSession, signIn } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <main className="flex w-full max-w-lg flex-col items-center gap-10 text-center">
        {/* Logo / App Name */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl" aria-hidden="true">
            字
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-50">
            In Context Flashcards
          </h1>
          <p className="text-lg text-zinc-400">
            Learn Mandarin vocabulary with smart review timing and real-world
            example sentences.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid w-full gap-4 sm:grid-cols-3">
          <FeatureCard
            icon="🔁"
            title="Spaced Repetition"
            description="Reviews are automatically scheduled at the perfect time so you remember words long-term."
          />
          <FeatureCard
            icon="✨"
            title="AI Sentences"
            description="Each review shows a unique sentence with your target word in natural context."
          />
          <FeatureCard
            icon="🗣️"
            title="Pinyin Practice"
            description="Reinforce pronunciation with pinyin recall on every card."
          />
        </div>

        {/* Sign In */}
        <button
          onClick={() => signIn("google")}
          className="flex min-h-11 items-center gap-3 rounded-lg bg-zinc-50 px-6 py-3 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        <p className="text-sm text-zinc-500">
          Free 7-day trial. No credit card required.
        </p>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      <p className="text-xs leading-relaxed text-zinc-400">{description}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
