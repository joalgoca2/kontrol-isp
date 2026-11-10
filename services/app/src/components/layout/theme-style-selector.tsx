"use client";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useThemeStyle, type ThemeStyle } from "@/components/theme-style-provider";
import { Sparkles, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeStyleSelector({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { themeStyle, setThemeStyle } = useThemeStyle();

  const options: { id: ThemeStyle; label: string; icon: typeof Briefcase }[] = [
    { id: "professional", label: t("settings.themeClassicShort", "Clásico"), icon: Briefcase },
    { id: "modern", label: t("settings.themeModernShort", "Moderno"), icon: Sparkles },
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80 border border-zinc-300/50 dark:border-zinc-700/50",
        className
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = themeStyle === opt.id;

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setThemeStyle(opt.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
              isActive
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {!compact && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
