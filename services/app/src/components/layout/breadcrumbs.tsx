"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";

export function Breadcrumbs() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const segmentTranslationMap: Record<string, string> = {
    dashboard: t("nav.dashboard", "Dashboard"),
    admin: t("nav.admin", "Panel Admin"),
    brands: t("nav.brands", "Marcas"),
    users: t("nav.users", "Usuarios"),
    billing: t("nav.billing", "Planes de Cobro"),
    settings: t("nav.settings", "Configuración"),
    students: t("nav.students", "Alumnos"),
    payments: t("nav.payments", "Pagos"),
  };

  const lastSegment = segments[segments.length - 1] ?? "";
  const lastTranslated =
    segmentTranslationMap[lastSegment.toLowerCase()] ??
    lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 min-w-0"
    >
      {/* Mobile View: Home Icon + Chevron + Current Page Only */}
      <div className="flex sm:hidden items-center gap-1.5 min-w-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-zinc-900
                     dark:hover:text-zinc-200 transition-colors shrink-0"
        >
          <Home className="h-3.5 w-3.5" />
          <span className="sr-only">{t("nav.dashboard", "Dashboard")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span
          className="font-bold text-amber-600 dark:text-amber-400 truncate
                     max-w-[110px]"
        >
          {lastTranslated}
        </span>
      </div>

      {/* Desktop View: Full Hierarchy */}
      <div className="hidden sm:flex items-center gap-1.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 hover:text-zinc-900
                     dark:hover:text-zinc-200 transition-colors shrink-0"
        >
          <Home className="h-3.5 w-3.5" />
          <span className="sr-only">{t("nav.dashboard", "Dashboard")}</span>
        </Link>

        {segments.map((segment, index) => {
          const url = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          const translated =
            segmentTranslationMap[segment.toLowerCase()] ??
            segment.charAt(0).toUpperCase() + segment.slice(1);

          return (
            <div key={url} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-600" />
              {isLast ? (
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {translated}
                </span>
              ) : (
                <Link
                  href={url}
                  className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                >
                  {translated}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
