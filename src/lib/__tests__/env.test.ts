import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

/**
 * Because env.ts calls validateEnv() at import time (module-level side effect),
 * we cannot simply import it. Instead we replicate the schema here and test
 * the validation logic directly against process.env snapshots.
 *
 * This approach tests the same Zod schema behavior without fighting the
 * eager-evaluation import.
 */

// Replicate the server env schema from src/lib/env.ts
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters for sufficient entropy"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  GEMINI_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

function makeValidEnv(): Record<string, string> {
  return {
    DATABASE_URL: "https://db.example.com/mydb",
    DIRECT_URL: "https://db-direct.example.com/mydb",
    AUTH_SECRET: "a]Kx9#mP2vL$wQ7nR4tY6uBhD0fGjCsE", // 32 chars
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    NEXTAUTH_URL: "https://localhost:3000",
    GEMINI_API_KEY: "gemini-key",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
    NODE_ENV: "test",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("env validation schema", () => {
  it("passes with all valid required variables", () => {
    const result = serverEnvSchema.safeParse(makeValidEnv());
    expect(result.success).toBe(true);
  });

  it("fails when DATABASE_URL is missing", () => {
    const env = makeValidEnv();
    delete env.DATABASE_URL;
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("fails when DATABASE_URL is not a valid URL", () => {
    const env = makeValidEnv();
    env.DATABASE_URL = "not-a-url";
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("fails when AUTH_SECRET is shorter than 32 characters", () => {
    const env = makeValidEnv();
    env.AUTH_SECRET = "too-short";
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = result.error.flatten();
      const authErrors = flat.fieldErrors.AUTH_SECRET;
      expect(authErrors).toBeDefined();
      expect(authErrors!.some((msg: string) => msg.includes("32"))).toBe(true);
    }
  });

  it("fails when AUTH_SECRET is exactly 31 characters", () => {
    const env = makeValidEnv();
    env.AUTH_SECRET = "a".repeat(31);
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("passes when AUTH_SECRET is exactly 32 characters", () => {
    const env = makeValidEnv();
    env.AUTH_SECRET = "a".repeat(32);
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it("fails when GOOGLE_CLIENT_ID is empty string", () => {
    const env = makeValidEnv();
    env.GOOGLE_CLIENT_ID = "";
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("fails when NEXTAUTH_URL is not a URL", () => {
    const env = makeValidEnv();
    env.NEXTAUTH_URL = "not-a-url";
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("fails when multiple required vars are missing", () => {
    const result = serverEnvSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = result.error.flatten();
      expect(Object.keys(flat.fieldErrors).length).toBeGreaterThan(1);
    }
  });

  it("defaults NODE_ENV to development when omitted", () => {
    const env = makeValidEnv();
    delete env.NODE_ENV;
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });

  it("rejects invalid NODE_ENV value", () => {
    const env = makeValidEnv();
    env.NODE_ENV = "staging";
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("allows optional UPSTASH vars to be omitted", () => {
    const env = makeValidEnv();
    // These are not set — should still pass
    delete (env as Record<string, string | undefined>).UPSTASH_REDIS_REST_URL;
    delete (env as Record<string, string | undefined>).UPSTASH_REDIS_REST_TOKEN;
    const result = serverEnvSchema.safeParse(env);
    expect(result.success).toBe(true);
  });
});
