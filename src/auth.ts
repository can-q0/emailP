import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  cookies: {
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      // When re-authenticating with Google, update the stored tokens
      if (account?.provider === "google" && user.id) {
        try {
          const existing = await prisma.account.findFirst({
            where: { userId: user.id, provider: "google" },
          });
          if (existing) {
            await prisma.account.update({
              where: { id: existing.id },
              data: {
                access_token: account.access_token,
                refresh_token: account.refresh_token ?? existing.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                id_token: account.id_token,
                scope: account.scope,
              },
            });
          }
        } catch (err) {
          console.error("[auth] Failed to update Google tokens on re-sign-in:", err);
        }
      }
      return true;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
