"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/components/providers/i18n-provider";

export function Footer() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "2.4.0";

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
    <footer
      className={
        "w-full border-t border-zinc-200 bg-white/60 py-6 text-xs text-zinc-600 " +
        "transition-colors duration-200 dark:border-zinc-800/80 " +
        "dark:bg-zinc-950/60 dark:text-zinc-400"
      }
    >
      <div
        className={
          "mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 " +
          "px-4 sm:flex-row sm:px-6"
        }
      >
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              Kontrol ISP &copy; {new Date().getFullYear()}
            </span>
            <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline">
              — {t("footer.subtitle", "CRM & NOC Multi-Tenant")}
            </span>
          </div>
          <span className="pl-4 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            {t("footer.version", "Versión")}: {appVersion} • RouterOS API Ready
          </span>
        </div>

        <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400">
          <Link
            href="/terms"
            className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            {t("footer.terms", "Términos de Servicio")}
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <Link
            href="/privacy"
            className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            {t("footer.privacy", "Privacidad & Habeas Data")}
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {t("footer.status", "NOC Operativo")}
          </span>
        </div>
      </div>
    </footer>
  );
}

