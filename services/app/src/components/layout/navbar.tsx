"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  LogOut,
  Shield,
  Wifi,
  LogIn,
} from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useTranslation();

  const isDashboardOrAuth =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/register") ||
    pathname?.startsWith("/forgot-password") ||
    pathname?.startsWith("/reset-password") ||
    pathname?.startsWith("/brand");

  if (isDashboardOrAuth) {
    return null;
  }

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/90
                 dark:border-zinc-800 dark:bg-zinc-950/90 backdrop-blur
                 transition-colors duration-200"
    >
      <div
        className="mx-auto flex h-16 max-w-7xl items-center
                   justify-between px-4 sm:px-6"
      >
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl
                       bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20
                       transition-transform duration-300 group-hover:scale-105"
          >
            <Wifi className="h-5 w-5 font-black stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span
              className="font-extrabold text-zinc-900 dark:text-white
                         tracking-tight text-base sm:text-lg leading-tight"
            >
              Kontrol <span className="text-emerald-500">ISP</span>
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className="text-[10px] text-zinc-500 dark:text-zinc-400
                           font-semibold tracking-wider uppercase leading-none"
              >
                {t("nav.tagline", "CRM & NOC TELECOM")}
              </span>
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/terms"
            className="hidden sm:inline-block text-xs font-medium text-zinc-600
                       hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white
                       transition-colors px-2 py-1"
          >
            {t("footer.terms", "Términos")}
          </Link>
          <Link
            href="/privacy"
            className="hidden sm:inline-block text-xs font-medium text-zinc-600
                       hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white
                       transition-colors px-2 py-1"
          >
            {t("footer.privacy", "Privacidad")}
          </Link>

          <ThemeToggle />

          {session?.user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2 text-xs">
                  <LayoutDashboard className="h-4 w-4 text-emerald-500" />
                  <span>{t("nav.dashboard", "NOC Dashboard")}</span>
                </Button>
              </Link>

              {session.user.roles?.includes("ADMIN") && (
                <Link href="/dashboard/nodes">
                  <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    <span className="hidden sm:inline">
                      {t("nav.admin", "Nodos")}
                    </span>
                  </Button>
                </Link>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs text-zinc-600 hover:text-zinc-900
                           dark:text-zinc-400 dark:hover:text-white"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("nav.signOut", "Cerrar Sesión")}
                </span>
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button
                size="sm"
                className="gap-2 text-xs bg-emerald-500 hover:bg-emerald-600
                           text-zinc-950 font-bold shadow-sm"
              >
                <LogIn className="h-4 w-4" />
                <span>{t("nav.signIn", "Acceso NOC")}</span>
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}


