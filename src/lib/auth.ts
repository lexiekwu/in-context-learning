import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * - Google OAuth provider for sign-in.
 * - JWT session strategy (stateless, serverless-friendly).
 * - Custom signIn callback handles user creation/lookup since our User model
 *   uses `googleId` instead of a separate Account table. The standard
 *   PrismaAdapter expects Account/Session models we intentionally omit.
 * - JWT callbacks embed userId, email, and name into the token so
 *   API routes can read them without a DB lookup.
 *
 * IMPORTANT: The `db` import is lazy (dynamic import) because this module
 * is loaded in Edge Runtime (middleware) where Node.js-only modules like
 * `pg` are not available. The DB callbacks only run during sign-in/JWT
 * enrichment which happens in the Node.js runtime, not in Edge middleware.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    /**
     * On sign-in, create or find the user in our database.
     * Returns true to allow sign-in, false to reject.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || !profile?.email) {
        return false;
      }

      // Lazy import to avoid loading pg in Edge Runtime
      const { db } = await import("@/lib/db");

      // Upsert: create user on first sign-in, update on subsequent ones
      await db.user.upsert({
        where: { googleId: profile.sub! },
        update: {
          email: profile.email,
          name: profile.name ?? profile.email,
          avatarUrl: profile.picture ?? null,
        },
        create: {
          email: profile.email,
          name: profile.name ?? profile.email,
          avatarUrl: profile.picture ?? null,
          googleId: profile.sub!,
        },
      });

      return true;
    },

    /**
     * Enrich the JWT with the database user ID so route handlers
     * can scope queries without an extra DB lookup.
     */
    async jwt({ token, account, profile }) {
      // On initial sign-in, look up the user we just upserted
      if (account?.provider === "google" && profile?.sub) {
        const { db } = await import("@/lib/db");

        const dbUser = await db.user.findUnique({
          where: { googleId: profile.sub },
          select: { id: true, name: true, email: true },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.email = dbUser.email;
          token.name = dbUser.name;
        }
      }

      return token;
    },

    /**
     * Expose userId, email, and name on the client-side session object.
     */
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      if (token.email) {
        session.user.email = token.email as string;
      }
      if (token.name) {
        session.user.name = token.name as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
  },
});
