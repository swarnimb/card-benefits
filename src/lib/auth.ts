import NextAuth, { type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/** Validates admin credentials against env vars. Returns user object or null. */
export async function authorizeUser(
  email: string,
  password: string
): Promise<{ id: string; email: string } | null> {
  if (email !== process.env.ADMIN_EMAIL) return null;
  if (password !== process.env.ADMIN_PASSWORD) return null;
  return { id: process.env.ADMIN_USER_ID!, email };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;
        return authorizeUser(
          credentials.email as string,
          credentials.password as string
        );
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/** Thrown when authentication fails — carries HTTP status code. */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** Returns the current session or throws AuthError(401) if not authenticated. */
export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session) throw new AuthError("Authentication required");
  return session;
}

/** Returns the admin user ID from env. Used to scope all DB queries to the current user. */
export function getUserId(): string {
  return process.env.ADMIN_USER_ID!;
}
