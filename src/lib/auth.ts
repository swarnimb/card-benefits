import NextAuth, { type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Exported for testability — contains all credential validation logic
export async function authorizeUser(
  email: string,
  password: string
): Promise<{ id: string; email: string } | null> {
  if (email !== process.env.ADMIN_EMAIL) return null;
  const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH!);
  if (!match) return null;
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

export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session) throw { status: 401 };
  return session;
}

export function getUserId(): string {
  return process.env.ADMIN_USER_ID!;
}
