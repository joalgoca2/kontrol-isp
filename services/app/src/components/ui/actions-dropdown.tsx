"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActionDropdownItem {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: "default" | "emerald" | "rose" | "destructive";
  disabled?: boolean;
}

export interface ActionsDropdownProps {
  items: ActionDropdownItem[];
  align?: "left" | "right";
  className?: string;
}

export function ActionsDropdown({
  items,
  align = "left",
  className,
}: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; right?: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = (items?.length || 1) * 36 + 16;

    let top = rect.bottom + 4;
    if (spaceBelow < menuHeight && rect.top > menuHeight) {
      top = rect.top - menuHeight - 4;
    }

    if (align === "right") {
      setCoords({
        top,
        left: Math.max(8, rect.right - 192),
      });
    } else {
      setCoords({
        top,
        left: Math.min(window.innerWidth - 200, Math.max(8, rect.left)),
      });
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleScrollOrResize = () => {
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!items || items.length === 0) return null;

  return (
    <div className={cn("inline-block text-left", className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className={cn(
          "h-8 w-8 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100",
          "dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors",
          isOpen && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        )}
        title="Acciones"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {isOpen &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className={cn(
              "z-[9999] w-48 rounded-xl border border-zinc-200 bg-white/95",
              "dark:border-zinc-800 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl py-1.5",
              "animate-in fade-in-50 zoom-in-95 duration-100"
            )}
          >
            {items.map((item, idx) => {
              const Icon = item.icon;
              const isRose = item.variant === "rose" || item.variant === "destructive";
              const isEmerald = item.variant === "emerald";

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    item.onClick();
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed",
                    isRose &&
                      "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40",
                    isEmerald &&
                      "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40",
                    !isRose &&
                      !isEmerald &&
                      "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
