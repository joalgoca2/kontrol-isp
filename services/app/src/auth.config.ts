import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const isGoogleEnabled =
  Boolean(process.env.AUTH_GOOGLE_ID) &&
  Boolean(process.env.AUTH_GOOGLE_SECRET);

export default {
  secret:
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "dev_secret_key_change_in_production_123456789",
  providers: [
    Credentials({
      async authorize() {
        return null;
      },
    }),
    ...(isGoogleEnabled
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID ?? "",
            clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.roles = (token.roles as string[]) ?? [];
        session.user.permissions = (token.permissions as string[]) ?? [];
        session.user.locale = (token.locale as string) ?? "es";
        session.user.timezone = (token.timezone as string) ?? "UTC";
        session.user.brandId = (token.brandId as string) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
