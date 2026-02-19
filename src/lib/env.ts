import { z } from "zod";

/**
 * Zod schema for server-side environment variables.
 *
 * Validated once at import time. If any required variable is missing or
 * malformed, the process will crash immediately with a descriptive error.
 */
const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Auth.js
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters for sufficient entropy"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),

  // Poe API
  POE_API_KEY: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // Upstash Redis (optional — rate limiting is disabled when absent)
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Runtime
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Client-safe environment variables (exposed to the browser via NEXT_PUBLIC_*).
 * None required for Phase 1, but the pattern is here for future use.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

function validateEnv() {
  // Zod 4 uses safeParse the same way
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "Invalid environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error(
      "Invalid environment variables. Check the server logs for details."
    );
  }

  return parsed.data;
}

/**
 * Validated server environment. Import this instead of reading `process.env`
 * directly so you get type safety and early failure on misconfiguration.
 *
 * Usage:
 * ```ts
 * import { env } from "@/lib/env";
 * const key = env.STRIPE_SECRET_KEY;
 * ```
 */
export const env = validateEnv();
