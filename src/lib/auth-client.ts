"use client";

/**
 * Client-side auth helpers.
 *
 * Re-exports the most commonly used functions from next-auth/react
 * so consumers import from a single location.
 */
export {
  useSession,
  signIn,
  signOut,
  SessionProvider,
} from "next-auth/react";
