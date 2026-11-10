"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  ShieldAlert,
  Database,
  UserCheck,
  Check,
  Trash2,
  Info,
} from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getUserNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type DbNotification,
} from "@/actions/notification";

export function NotificationCenter({ isAdmin }: { isAdmin?: boolean }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [dbNotifications, setDbNotifications] = useState<DbNotification[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const res = await getUserNotificationsAction();
    if (res.success && res.data) {
      setDbNotifications(res.data);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = dbNotifications.filter((n) => !n.read).length;
  const filteredNotifications = dbNotifications.filter((n) => {
    if (activeTab === "unread") return !n.read;
    return true;
  });

  const handleToggleRead = async (id: string) => {
    setDbNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
    await markNotificationReadAction(id);
  };

  const handleMarkAllAsRead = async () => {
    setDbNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsReadAction();
  };

  const handleClearAll = () => {
    setDbNotifications([]);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "security":
        return <ShieldAlert className="h-4 w-4 text-amber-400" />;
      case "database":
        return <Database className="h-4 w-4 text-emerald-400" />;
      case "user":
        return <UserCheck className="h-4 w-4 text-blue-400" />;
      default:
        return <Info className="h-4 w-4 text-zinc-400" />;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 " +
            "dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white " +
            "rounded-xl h-10 w-10 relative transition-all active:scale-95",
          isOpen && "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-white"
        )}
        aria-label={t("notifications.title", "Notificaciones")}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className={
              "absolute top-2 right-2 h-2.5 w-2.5 bg-emerald-400 " +
              "rounded-full border-2 border-white dark:border-zinc-950 animate-pulse"
            }
          />
        )}
      </Button>

      {/* Floating Popover Modal */}
      {isOpen && (
        <div
          className={
            "fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 " +
            "sm:top-auto sm:mt-2 w-auto sm:w-80 md:w-96 bg-white/95 " +
            "dark:bg-zinc-950/95 border border-zinc-200 dark:border-zinc-800 " +
            "backdrop-blur-2xl rounded-2xl shadow-2xl z-50 overflow-hidden"
          }
        >
          {/* Popover Header */}
          <div
            className={
              "p-4 border-b border-zinc-200 dark:border-zinc-800 " +
              "flex items-center justify-between"
            }
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-white">
                {t("notifications.title", "Notificaciones")}
              </span>
              {unreadCount > 0 && (
                <Badge variant="success" className="text-[10px]">
                  {unreadCount} {t("notifications.newBadge", "Nuevas")}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {dbNotifications.length > 0 && unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleMarkAllAsRead}
                  title={t("notifications.markAllRead", "Marcar todas como leídas")}
                  className={
                    "h-7 w-7 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 " +
                    "dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900 " +
                    "rounded-lg"
                  }
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
              {dbNotifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearAll}
                  title={t("notifications.clearAll", "Limpiar notificaciones")}
                  className={
                    "h-7 w-7 text-zinc-500 hover:text-rose-600 " +
                    "hover:bg-rose-500/10 rounded-lg"
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          {dbNotifications.length > 0 && (
            <div className="px-4 pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-lg transition-all",
                  activeTab === "all"
                    ? "bg-zinc-200 text-zinc-900 font-bold dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                {t("notifications.allTab", "Todas")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-lg transition-all",
                  activeTab === "unread"
                    ? "bg-zinc-200 text-zinc-900 font-bold dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                {t("notifications.unreadTab", "Sin Leer")} ({unreadCount})
              </button>
            </div>
          )}

          {/* List Area */}
          <div
            className={
              "max-h-80 overflow-y-auto divide-y divide-zinc-200/60 " +
              "dark:divide-zinc-800/60 p-2"
            }
          >
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <Bell className="h-7 w-7 text-zinc-400 dark:text-zinc-600" />
                <span className="text-xs text-zinc-500 italic">
                  {activeTab === "unread"
                    ? t("notifications.emptyUnread", "No tienes alertas sin leer.")
                    : t("notifications.emptyAll", "Sin notificaciones.")}
                </span>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleToggleRead(n.id)}
                  className={cn(
                    "p-3 rounded-xl flex items-start gap-3 hover:bg-zinc-100 " +
                      "dark:hover:bg-zinc-900/60 cursor-pointer transition-colors relative",
                    !n.read && "bg-emerald-500/5"
                  )}
                >
                  {!n.read && (
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 bg-emerald-400 rounded-full" />
                  )}

                  <div
                    className={
                      "p-2 bg-zinc-100 border border-zinc-200 " +
                      "dark:bg-zinc-900 dark:border-zinc-800 rounded-lg shrink-0"
                    }
                  >
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "text-xs font-bold truncate",
                          n.read
                            ? "text-zinc-500 dark:text-zinc-400"
                            : "text-zinc-900 dark:text-white"
                        )}
                      >
                        {n.title}
                      </span>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {new Date(n.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-[11px] leading-relaxed mt-0.5",
                        n.read
                          ? "text-zinc-500"
                          : "text-zinc-700 dark:text-zinc-300"
                      )}
                    >
                      {n.desc}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className={
              "p-3 bg-zinc-50 border-t border-zinc-200 dark:bg-zinc-900/40 " +
              "dark:border-zinc-800 text-center text-[10px] font-bold text-zinc-500 " +
              "uppercase tracking-wider"
            }
          >
            {isAdmin
              ? t("notifications.adminConnected", "Panel Admin Conectado")
              : t("notifications.alertCenter", "Centro de Alertas")}
          </div>
        </div>
      )}
    </div>
  );
}
