"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Menu, ChevronDown } from "lucide-react";
import { useSidebar } from "@/context/sidebar-context";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NotificationCenter } from "@/components/layout/notification-center";
import { useTranslation } from "@/components/providers/i18n-provider";

export function Header() {
  const { toggle, toggleMobile } = useSidebar();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const user = session?.user;
  const userRoles = user?.roles ?? [];
  const isAdmin = userRoles.includes("SUPER_ADMIN") || userRoles.includes("ADMIN");

  const displayName = user?.name || user?.email?.split("@")[0] || t("nav.user", "Usuario");
  const initial = displayName[0]?.toUpperCase() ?? "U";
  const roleBadgeText = isAdmin ? t("nav.roleAdmin", "Admin") : t("nav.roleUser", "Usuario");

  return (
    <header
      className={
        "h-16 bg-white/80 border-b border-zinc-200 text-zinc-900 " +
        "dark:bg-zinc-950/80 dark:border-zinc-800 dark:text-zinc-100 " +
        "backdrop-blur-xl flex items-center justify-between px-4 md:px-6 sticky top-0 z-40"
      }
    >
      <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={
            "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 " +
            "dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white " +
            "rounded-xl h-10 w-10 shrink-0 hidden md:flex"
          }
          aria-label="Toggle desktop sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMobile}
          className={
            "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 " +
            "dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white " +
            "rounded-xl h-10 w-10 shrink-0 flex md:hidden"
          }
          aria-label="Toggle mobile sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <Breadcrumbs />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 ml-4">
        <NotificationCenter isAdmin={isAdmin} />

        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block" />

        <Link
          href="/dashboard/settings"
          className={
            "flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl " +
            "bg-zinc-100/80 border border-zinc-200 hover:bg-zinc-200/80 " +
            "dark:bg-zinc-900/60 dark:border-zinc-800 dark:hover:bg-zinc-900 " +
            "dark:hover:border-zinc-700 transition-all group shadow-sm"
          }
        >
          <div
            className={
              "h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center " +
              "text-white font-bold text-xs shrink-0 shadow-sm"
            }
          >
            {initial}
          </div>

          <div className="flex flex-col text-left hidden md:flex">
            <div className="flex items-center gap-1.5">
              <span
                className={
                  "text-xs font-bold text-zinc-900 dark:text-white " +
                  "truncate max-w-[120px]"
                }
              >
                {displayName}
              </span>
              <ChevronDown
                className={
                  "h-3 w-3 text-zinc-400 group-hover:text-emerald-600 " +
                  "dark:text-zinc-500 dark:group-hover:text-emerald-400"
                }
              />
            </div>
            <span
              className={
                "text-[10px] font-semibold text-zinc-500 " +
                "dark:text-zinc-400 uppercase tracking-wider"
              }
            >
              {roleBadgeText}
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}
