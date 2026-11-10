"use client";

import React from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  compact?: boolean;
  variant?: "dropdown" | "pills";
}

export function LanguageSelector({
  compact = false,
  variant = "dropdown",
}: LanguageSelectorProps) {
  const spanishLang = { code: "es", name: "Español", flag: "🇪🇸" };

  if (variant === "pills") {
    return (
      <div className="flex flex-col gap-2.5 w-full">
        <div
          className={cn(
            "flex items-center justify-between p-3 rounded-2xl border ",
            "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 ",
            "dark:text-emerald-400 font-bold text-xs shadow-sm"
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{spanishLang.flag}</span>
            <span>{spanishLang.name}</span>
          </div>
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left">
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon" : "default"}
        className={cn(
          compact
            ? "h-9 w-9 rounded-xl text-zinc-600 dark:text-zinc-400"
            : "gap-2 h-9 px-3 rounded-xl text-xs font-semibold text-zinc-700 " +
                "dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 " +
                "bg-white/50 dark:bg-zinc-900/50"
        )}
        title="Idioma: Español"
      >
        <Globe className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        {!compact && (
          <>
            <span>{spanishLang.flag}</span>
            <span>{spanishLang.name}</span>
          </>
        )}
      </Button>
    </div>
  );
}
