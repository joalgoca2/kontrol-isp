"use client";

import React from "react";
import { Building2, Globe } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useBrand, isBrandMandatoryRoute } from "@/context/brand-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function BrandSwitcher({ isCollapsed }: { isCollapsed?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activeBrandId,
    setActiveBrandId,
    brands,
    activeBrand,
    isSuperAdmin,
    isLoading,
  } = useBrand();

  const isOperational = isBrandMandatoryRoute(pathname);

  const handleBrandChange = (newBrandId: string) => {
    setActiveBrandId(newBrandId);

    if (newBrandId === "ALL" && isOperational) {
      toast.info("Cambiando a vista global. Redirigiendo al Dashboard NOC.");
      router.push("/dashboard");
    }
  };

  if (isLoading) {
    return (
      <div className="p-2 animate-pulse">
        <div className="h-9 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    if (!activeBrand) return null;
    return (
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl",
            "bg-emerald-500/10 border border-emerald-500/20",
            "text-xs font-bold text-emerald-600 dark:text-emerald-400"
          )}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          {!isCollapsed && (
            <span className="truncate">{activeBrand.name}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
      <Select value={activeBrandId} onValueChange={handleBrandChange}>
        <SelectTrigger
          className={cn(
            "w-full h-10 rounded-xl text-xs font-bold gap-2",
            "border-zinc-200 dark:border-zinc-800",
            "bg-zinc-50 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {activeBrandId === "ALL" ? (
              <>
                <Globe className="h-4 w-4 text-emerald-500 shrink-0" />
                {!isCollapsed && <span>Todas las Marcas (Global NOC)</span>}
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 text-emerald-500 shrink-0" />
                {!isCollapsed && (
                  <span className="truncate">
                    {activeBrand?.name ?? "Seleccionar Marca"}
                  </span>
                )}
              </>
            )}
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-60 rounded-xl">
          <SelectItem value="ALL" className="text-xs font-bold">
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Todas las Marcas (Global NOC)</span>
              </div>
              {isOperational && (
                <span
                  className={cn(
                    "text-[10px] font-normal text-zinc-400",
                    "bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded"
                  )}
                >
                  Ir a Dashboard
                </span>
              )}
            </div>
          </SelectItem>
          {brands.map((brand) => (
            <SelectItem
              key={brand.id}
              value={brand.id}
              className="text-xs font-medium"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-zinc-400 shrink-0" />
                <span>{brand.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
