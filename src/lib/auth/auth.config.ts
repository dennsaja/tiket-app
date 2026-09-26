import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Public paths
      const publicPaths = [
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/api/health",
        "/api/auth",
      ];
      if (publicPaths.some((p) => pathname.startsWith(p))) {
        return true;
      }

      // API paths require auth
      if (pathname.startsWith("/api/")) {
        return isLoggedIn;
      }

      return isLoggedIn;
    },
  },
  providers: [], // Configured in index.ts with full node/db adapter
};
