"use client";

import React, { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Server,
  Users,
  Network,
  Gauge,
  Receipt,
  Headphones,
  Bot,
  Building2,
  ShieldCheck,
  Settings,
  LogOut,
  Sun,
  Moon,
  Laptop,
  Lock,
  Wifi,
  ChevronDown,
  MapPin,
  MessageSquare,
  Scale,
} from "lucide-react";
import { FEATURES } from "@/lib/config/features";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useSidebar } from "@/context/sidebar-context";
import { useBrand } from "@/context/brand-context";
import { BrandSwitcher } from "./brand-switcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoleName } from "@/types";

interface NavItem {
  key: string;
  defaultTitle: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  requireBrand?: boolean;
  allowedRoles?: RoleName[];
}

interface NavCategory {
  id: string;
  titleKey: string;
  defaultTitle: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    id: "general",
    titleKey: "nav.category.general",
    defaultTitle: "General",
    items: [
      {
        key: "nav.dashboard",
        defaultTitle: "NOC Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: "network",
    titleKey: "nav.category.network",
    defaultTitle: "Red & Infraestructura",
    items: [
      {
        key: "nav.nodes",
        defaultTitle: "Nodos MikroTik",
        href: "/dashboard/nodes",
        icon: Server,
        allowedRoles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        key: "nav.plans",
        defaultTitle: "Planes de Internet",
        href: "/dashboard/plans",
        icon: Gauge,
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING"],
      },
      {
        key: "nav.networkMap",
        defaultTitle: "Mapa de Red NOC",
        href: "/dashboard/network-map",
        icon: MapPin,
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "TECHNICIAN", "SUPPORT"],
      },
    ],
  },
  {
    id: "clients",
    titleKey: "nav.category.clients",
    defaultTitle: "Clientes & Servicios",
    items: [
      {
        key: "nav.clients",
        defaultTitle: "Abonados / Clientes",
        href: "/dashboard/clients",
        icon: Users,
        allowedRoles: [
          "SUPER_ADMIN",
          "ADMIN",
          "BILLING",
          "SUPPORT",
          "TECHNICIAN",
        ],
      },
      {
        key: "nav.contracts",
        defaultTitle: "Contratos & Enlaces",
        href: "/dashboard/contracts",
        icon: Network,
        allowedRoles: [
          "SUPER_ADMIN",
          "ADMIN",
          "BILLING",
          "SUPPORT",
          "TECHNICIAN",
        ],
      },
      {
        key: "nav.billing",
        defaultTitle: "Facturación & Pagos",
        href: "/dashboard/billing",
        icon: Receipt,
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING"],
      },
      {
        key: "nav.reconciliation",
        defaultTitle: "Conciliación de Pagos",
        href: "/dashboard/billing/reconciliation",
        icon: Scale,
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING"],
        requireBrand: true,
      },
    ],
  },
  {
    id: "support",
    titleKey: "nav.category.support",
    defaultTitle: "Operaciones & Soporte",
    items: [
      {
        key: "nav.tickets",
        defaultTitle: "Mesa de Ayuda & IA",
        href: "/dashboard/tickets",
        icon: Headphones,
        allowedRoles: [
          "SUPER_ADMIN",
          "ADMIN",
          "BILLING",
          "TECHNICIAN",
          "SUPPORT",
        ],
      },
      {
        key: "nav.whatsappChat",
        defaultTitle: "Chats de WhatsApp",
        href: "/dashboard/whatsapp-chat",
        icon: MessageSquare,
        allowedRoles: ["SUPER_ADMIN", "ADMIN", "BILLING", "SUPPORT"],
      },
    ],
  },
  {
    id: "management",
    titleKey: "nav.category.management",
    defaultTitle: "Administración & Sistema",
    items: [
      {
        key: "nav.brands",
        defaultTitle: "Marcas",
        href: "/dashboard/brands",
        icon: Building2,
        superAdminOnly: true,
        allowedRoles: ["SUPER_ADMIN"],
      },
      {
        key: "nav.users",
        defaultTitle: "Usuarios & Roles",
        href: "/dashboard/users",
        icon: ShieldCheck,
        allowedRoles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        key: "nav.aiSettings",
        defaultTitle: "Configuración de IA",
        href: "/dashboard/settings/ai",
        icon: Bot,
        allowedRoles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        key: "nav.settings",
        defaultTitle: "Configuración",
        href: "/dashboard/settings",
        icon: Settings,
        allowedRoles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
];

const allNavHrefs: readonly string[] = navCategories.flatMap((category) =>
  category.items.map((item) => item.href)
);

export function Sidebar({ userRoles }: { userRoles?: string[] }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isPinSet, setIsPinSet] = useState(false);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    general: true,
    network: true,
    clients: true,
    support: true,
    management: true,
  });

  const isSuperAdmin = Boolean(userRoles?.includes("SUPER_ADMIN"));
  const isAdmin = isSuperAdmin || Boolean(userRoles?.includes("ADMIN"));
  const { activeBrandId, activeBrand } = useBrand();
  const isGlobalMode =
    isSuperAdmin && (activeBrandId === "ALL" || !activeBrand);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const checkPinState = () => {
    try {
      const pin = localStorage.getItem("pwa_screen_lock_pin");
      setIsPinSet(Boolean(pin && pin.length >= 4));
    } catch (_e) {
      setIsPinSet(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    checkPinState();

    window.addEventListener("storage", checkPinState);
    window.addEventListener("pin-state-changed", checkPinState);
    return () => {
      window.removeEventListener("storage", checkPinState);
      window.removeEventListener("pin-state-changed", checkPinState);
    };
  }, []);

  const handleLinkClick = () => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const isExpanded = isMobileOpen || !isCollapsed;

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "bg-white/90 border-r border-zinc-200 text-zinc-900 " +
          "dark:bg-zinc-950/90 dark:border-zinc-800 dark:text-zinc-100 " +
          "backdrop-blur-xl transition-all duration-300 ease-in-out " +
          "flex flex-col z-50 md:z-20 fixed inset-y-0 left-0 md:relative",
          isMobileOpen
            ? "translate-x-0 w-64"
            : "-translate-x-full md:translate-x-0",
          !isMobileOpen && isCollapsed ? "md:w-20" : "md:w-64"
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            "p-4 border-b border-zinc-200 dark:border-zinc-800 " +
            "transition-all duration-300",
            !isExpanded ? "flex justify-center" : ""
          )}
        >
          <div className="flex items-center gap-2.5 w-full truncate">
            <div
              className={
                "flex h-9 w-9 items-center justify-center rounded-xl " +
                "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 " +
                "dark:text-emerald-400 shrink-0 shadow-xs"
              }
            >
              <Wifi className="h-5 w-5" />
            </div>
            {isExpanded && (
              <div className="flex flex-col truncate">
                <span
                  className={
                    "text-sm font-extrabold text-zinc-900 " +
                    "dark:text-white tracking-tight leading-none"
                  }
                >
                  Kontrol ISP
                </span>
                <span
                  className={
                    "text-[10px] font-semibold text-emerald-600 " +
                    "dark:text-emerald-400 uppercase tracking-wider mt-0.5"
                  }
                >
                  CRM & Multi-Nodo
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Brand Switcher */}
        <BrandSwitcher isCollapsed={!isExpanded} />

        {/* Navigation Body with Collapsible Modules */}
        <nav className="flex-1 px-3 space-y-4 mt-3 overflow-y-auto">
          {navCategories.map((category) => {
            const visibleItems = category.items.filter((item) => {
              if (
                item.allowedRoles &&
                !item.allowedRoles.some((role) => userRoles?.includes(role))
              ) {
                return false;
              }
              if (item.superAdminOnly && !isSuperAdmin) return false;
              if (item.adminOnly && !isAdmin) return false;
              return true;
            });
            if (visibleItems.length === 0) return null;

            const isOpen = Boolean(openCategories[category.id]);
            const categoryTitle = t(category.titleKey, category.defaultTitle);

            return (
              <div key={category.id} className="space-y-1">
                {isExpanded ? (
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5",
                      "text-[10px] font-extrabold text-zinc-500 hover:text-zinc-800",
                      "dark:text-zinc-400 dark:hover:text-zinc-200 uppercase",
                      "tracking-widest rounded-lg transition-colors cursor-pointer select-none"
                    )}
                  >
                    <span>{categoryTitle}</span>
                    <ChevronDown
                      size={13}
                      className={cn(
                        "transition-transform duration-200 text-zinc-400",
                        isOpen ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </button>
                ) : (
                  <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2" />
                )}

                {(isOpen || !isExpanded) && (
                  <div className="space-y-1">
                    {visibleItems.map((item) => (
                      <SidebarNavLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        isExpanded={isExpanded}
                        isGlobalMode={isGlobalMode}
                        onClick={handleLinkClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Theme Switcher Footer (Omnistock Segmented 3-button style) */}
        {mounted && (
          <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
            {isExpanded ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {t("nav.themeMode", "Modo")}
                </span>
                <div
                  className={cn(
                    "flex bg-zinc-100 border border-zinc-200",
                    "dark:bg-zinc-900 dark:border-zinc-800 rounded-lg p-0.5"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={cn(
                      "p-1.5 rounded-md transition-all cursor-pointer active:scale-95",
                      theme === "light"
                        ? "bg-white text-emerald-600 dark:bg-zinc-800 " +
                        "dark:text-emerald-400 shadow-sm font-bold"
                        : "text-zinc-500 hover:text-zinc-900 " +
                        "dark:text-zinc-400 dark:hover:text-zinc-200"
                    )}
                    title={t("nav.themeLight", "Claro")}
                  >
                    <Sun size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "p-1.5 rounded-md transition-all cursor-pointer active:scale-95",
                      theme === "dark"
                        ? "bg-white text-emerald-600 dark:bg-zinc-800 " +
                        "dark:text-emerald-400 shadow-sm font-bold"
                        : "text-zinc-500 hover:text-zinc-900 " +
                        "dark:text-zinc-400 dark:hover:text-zinc-200"
                    )}
                    title={t("nav.themeDark", "Oscuro")}
                  >
                    <Moon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={cn(
                      "p-1.5 rounded-md transition-all cursor-pointer active:scale-95",
                      theme === "system"
                        ? "bg-white text-emerald-600 dark:bg-zinc-800 " +
                        "dark:text-emerald-400 shadow-sm font-bold"
                        : "text-zinc-500 hover:text-zinc-900 " +
                        "dark:text-zinc-400 dark:hover:text-zinc-200"
                    )}
                    title={t("nav.themeSystem", "Sistema")}
                  >
                    <Laptop size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={cn(
                    "p-2 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400",
                    "dark:hover:text-emerald-400 rounded-xl hover:bg-zinc-100",
                    "dark:hover:bg-zinc-900 transition-colors mx-auto cursor-pointer"
                  )}
                  title={t("nav.themeMode", "Modo")}
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
          <div
            className={cn(
              "grid gap-2",
              isExpanded && FEATURES.screenLock && isPinSet
                ? "grid-cols-2"
                : "grid-cols-1"
            )}
          >
            {FEATURES.screenLock && isPinSet && (
              <Button
                variant="ghost"
                onClick={() => {
                  handleLinkClick();
                  window.dispatchEvent(new Event("lock-screen-requested"));
                }}
                className={cn(
                  "w-full rounded-xl h-10 transition-all font-bold text-[11px]",
                  "uppercase tracking-wider flex items-center justify-center gap-1.5 px-2",
                  "bg-amber-500/10 border border-amber-500/30 text-amber-700",
                  "dark:text-amber-400 hover:bg-amber-500/20 hover:text-amber-800",
                  "dark:hover:text-amber-300 active:scale-95 cursor-pointer",
                  !isExpanded && "px-0"
                )}
                title={t("sidebar.lockApp", "Bloquear Pantalla")}
              >
                <Lock size={15} className="shrink-0" />
                {isExpanded && (
                  <span>{t("sidebar.lockShort", "BLOQUEAR")}</span>
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={() => {
                handleLinkClick();
                signOut({ callbackUrl: "/login" });
              }}
              className={cn(
                "w-full rounded-xl h-10 transition-all font-bold text-[11px]",
                "uppercase tracking-wider flex items-center justify-center gap-1.5 px-2",
                "bg-rose-500/10 border border-rose-500/30 text-rose-700",
                "dark:text-rose-400 hover:bg-rose-500/20 hover:text-rose-800",
                "dark:hover:text-rose-300 active:scale-95 cursor-pointer",
                !isExpanded && "px-0",
                (!FEATURES.screenLock || !isPinSet) && isExpanded && "col-span-1"
              )}
              title={t("nav.signOut", "Cerrar Sesión")}
            >
              <LogOut size={15} className="shrink-0" />
              {isExpanded && <span>{t("nav.signOutShort", "SALIR")}</span>}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarNavLink({
  item,
  pathname,
  isExpanded,
  isGlobalMode,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  isExpanded: boolean;
  isGlobalMode?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const title = t(item.key, item.defaultTitle);
  const isDirectMatch =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === item.href || pathname?.startsWith(`${item.href}/`);

  const hasMoreSpecificMatch =
    Boolean(isDirectMatch) &&
    allNavHrefs.some(
      (otherHref) =>
        otherHref !== item.href &&
        otherHref.startsWith(item.href) &&
        (pathname === otherHref || pathname?.startsWith(`${otherHref}/`))
    );

  const isActive = isDirectMatch && !hasMoreSpecificMatch;
  const isRestrictedGlobal = Boolean(item.requireBrand && isGlobalMode);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl",
        "transition-all duration-200 border group active:scale-[0.98]",
        isActive
          ? cn(
            "bg-emerald-500/10 border-emerald-500/20 text-emerald-600",
            "dark:text-emerald-400 font-bold shadow-xs"
          )
          : cn(
            "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border-transparent",
            "dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
          ),
        isRestrictedGlobal && "opacity-60",
        !isExpanded && "justify-center px-0"
      )}
      title={!isExpanded ? title : undefined}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive
            ? "text-emerald-600 dark:text-emerald-400"
            : cn(
              "text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-500",
              "dark:group-hover:text-zinc-300"
            ),
          isRestrictedGlobal && !isActive && "text-zinc-400"
        )}
      />
      {isExpanded && (
        <span className="truncate flex-1 flex items-center justify-between gap-1.5">
          <span className="truncate">{title}</span>
          {isRestrictedGlobal && (
            <span
              className={
                "text-[9px] font-mono px-1 py-0.2 rounded font-bold " +
                "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 shrink-0"
              }
            >
              Global
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
