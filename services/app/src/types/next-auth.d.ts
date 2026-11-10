import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      permissions: string[];
      locale: string;
      timezone: string;
      brandId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    roles?: string[];
    permissions?: string[];
    locale?: string;
    timezone?: string;
    brandId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roles: string[];
    permissions: string[];
    locale: string;
    timezone: string;
    brandId?: string | null;
  }
}
