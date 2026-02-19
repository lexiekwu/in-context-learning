/**
 * Auth.js route handler — catches all /api/auth/* requests.
 *
 * Delegates entirely to the Auth.js configuration in @/lib/auth.
 * Handles: /api/auth/signin, /api/auth/callback/google,
 *          /api/auth/signout, /api/auth/session, etc.
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
