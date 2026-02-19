"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface LoadingSkeletonProps {
  message?: string;
  showSlowWarning?: boolean;
}

export function LoadingSkeleton({
  message = "Loading...",
  showSlowWarning = true,
}: LoadingSkeletonProps) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!showSlowWarning) return;
    const timer = setTimeout(() => setIsSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [showSlowWarning]);

  return (
    <div className="flex w-full flex-col items-center gap-6 py-8">
      {/* Sentence skeleton */}
      <div className="w-full max-w-lg space-y-3">
        <div className="h-6 w-3/4 animate-pulse rounded bg-zinc-700" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-zinc-700" />
      </div>

      {/* Input skeleton */}
      <div className="w-full max-w-lg space-y-3">
        <div className="h-12 w-full animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-zinc-800 sm:w-48" />
      </div>

      {/* Status message */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm text-zinc-400">{message}</p>
        <p
          className={cn(
            "text-xs text-amber-400 transition-opacity duration-300",
            isSlow ? "opacity-100" : "opacity-0",
          )}
        >
          Taking longer than usual...
        </p>
      </div>
    </div>
  );
}
