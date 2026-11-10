import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import {
  isRateLimited,
  incrementRateLimit,
  resetRateLimit,
  isPrivateIp,
} from "@/lib/rate-limit";

interface UserRoleRelation {
  role: {
    name: string;
    permissions: {
      permission: {
        name: string;
      };
    }[];
  };
}

export function extractClientIp(headerList: Headers): string {
  const rawIp =
    headerList.get("x-forwarded-for") ??
    headerList.get("x-real-ip") ??
    headerList.get("cf-connecting-ip") ??
    headerList.get("x-client-ip") ??
    "127.0.0.1";

  let clientIp = rawIp.split(",")[0].trim();
  if (clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.substring(7);
  }
  if (clientIp === "::1") {
    clientIp = "127.0.0.1";
  }
  return clientIp;
}

export function parseBrowser(userAgent: string): string {
  if (!userAgent || userAgent === "Unknown Device") return "Navegador Web";
  if (userAgent.includes("Edg/")) return "Microsoft Edge";
  if (userAgent.includes("OPR/") || userAgent.includes("Opera")) return "Opera";
  if (userAgent.includes("Brave")) return "Brave";
  if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/")) return "Google Chrome";
  if (userAgent.includes("Firefox/")) return "Mozilla Firefox";
  if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) return "Apple Safari";
  return "Navegador Web";
}

export function parseDevice(userAgent: string): string {
  if (!userAgent || userAgent === "Unknown Device") return "Escritorio";
  if (
    userAgent.includes("Mobile") ||
    userAgent.includes("Android") ||
    userAgent.includes("iPhone")
  ) {
    return "Móvil";
  }
  if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
    return "Tablet";
  }
  return "Escritorio";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días renovable (rolling session)
  },
  ...authConfig,
  providers: [
    ...authConfig.providers.filter((p) => p.id !== "credentials"),
    Credentials({
      async authorize(credentials, req) {
        let userAgent = "Unknown Device";
        let ip = "127.0.0.1";

        if (req && "headers" in req && req.headers) {
          const reqHeaders = req.headers as unknown as Record<string, string | string[]>;
          userAgent = (reqHeaders["user-agent"] as string) ?? "Unknown Device";
          const rawIp = reqHeaders["x-forwarded-for"] ?? reqHeaders["x-real-ip"];
          ip = Array.isArray(rawIp) ? rawIp[0] : (rawIp as string)?.split(",")[0]?.trim() || "127.0.0.1";
        }
        const ipBypass = isPrivateIp(ip);

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const ipLimitKey = `login:ip:${ip}`;
        const emailLimitKey = `login:email:${email}`;

        const handleAuthFailure = async () => {
          let ipSuccess = true;
          if (!ipBypass) {
            const ipIncrement = await incrementRateLimit(ipLimitKey, 5, 3 * 60, 30 * 60);
            ipSuccess = ipIncrement.success;
          }

          const emailIncrement = await incrementRateLimit(emailLimitKey, 3, 3 * 60, 30 * 60);
          const emailSuccess = emailIncrement.success;

          if (!ipSuccess || !emailSuccess) {
            throw new Error("Demasiados intentos fallidos. Tu acceso ha sido bloqueado temporalmente por 30 minutos.");
          }
        };

        if (!ipBypass) {
          const ipStatus = await isRateLimited(ipLimitKey, 5);
          if (ipStatus.limited) {
            throw new Error("IP bloqueada temporalmente debido a demasiados intentos fallidos.");
          }
        }

        const emailStatus = await isRateLimited(emailLimitKey, 3);
        if (emailStatus.limited) {
          throw new Error("Cuenta bloqueada temporalmente debido a demasiados intentos fallidos. Intenta más tarde.");
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          await handleAuthFailure();
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          await handleAuthFailure();
          return null;
        }

        await resetRateLimit(emailLimitKey);
        if (!ipBypass) {
          await resetRateLimit(ipLimitKey);
        }

        try {
          const browser = parseBrowser(userAgent);
          const device = parseDevice(userAgent);

          await prisma.loginHistory.create({
            data: {
              userId: user.id,
              userAgent,
              ip,
              browser,
              device,
            },
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Audit log error.";
          console.error("Failed to record login audit log:", message);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      const targetUserId = (user?.id ?? token?.id) as string | undefined;

      if (targetUserId && (user || trigger === "update")) {
        const dbUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: {
            name: true,
            email: true,
            locale: true,
            timezone: true,
            brandId: true,
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const userRoles = dbUser?.roles as unknown as UserRoleRelation[];
        const roles = userRoles?.map((ur) => ur.role.name) ?? [];
        const permissions =
          userRoles?.flatMap((ur) =>
            ur.role.permissions.map((rp) => rp.permission.name)
          ) ?? [];

        token.id = targetUserId;
        token.name =
          (session as { name?: string } | undefined)?.name ??
          (session as { user?: { name?: string } } | undefined)?.user?.name ??
          dbUser?.name ??
          token.name;
        token.brandId = dbUser?.brandId ?? (token.brandId as string) ?? null;
        token.roles = roles.length > 0 ? roles : (token.roles as string[]) ?? [];
        token.permissions =
          permissions.length > 0 ? permissions : (token.permissions as string[]) ?? [];
        token.locale =
          (session as { locale?: string } | undefined)?.locale ??
          (session as { user?: { locale?: string } } | undefined)?.user?.locale ??
          dbUser?.locale ??
          (token.locale as string) ??
          "es";
        token.timezone =
          (session as { timezone?: string } | undefined)?.timezone ??
          (session as { user?: { timezone?: string } } | undefined)?.user?.timezone ??
          dbUser?.timezone ??
          (token.timezone as string) ??
          "UTC";
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
});
