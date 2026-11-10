"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationControlProps {
  currentPage?: number;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationControl({
  currentPage,
  page,
  totalPages,
  totalItems: _totalItems,
  onPageChange,
  className,
}: PaginationControlProps) {
  const { t } = useTranslation();

  const rawPage = currentPage ?? page ?? 1;
  const rawTotalPages = totalPages ?? 1;

  const validTotal =
    typeof rawTotalPages === "number" &&
    Number.isFinite(rawTotalPages) &&
    !Number.isNaN(rawTotalPages)
      ? Math.max(1, Math.floor(rawTotalPages))
      : 1;

  const validCurrent =
    typeof rawPage === "number" &&
    Number.isFinite(rawPage) &&
    !Number.isNaN(rawPage)
      ? Math.max(1, Math.floor(rawPage))
      : 1;

  const safeTotalPages = Math.max(1, validTotal);
  const safeCurrentPage = Math.min(validCurrent, safeTotalPages);

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (safeTotalPages <= maxVisible) {
      for (let i = 1; i <= safeTotalPages; i += 1) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, safeCurrentPage - 1);
      let end = Math.min(safeTotalPages - 1, safeCurrentPage + 1);

      if (safeCurrentPage <= 3) {
        start = 2;
        end = 4;
      } else if (safeCurrentPage >= safeTotalPages - 2) {
        start = safeTotalPages - 3;
        end = safeTotalPages - 1;
      }

      if (start > 2) {
        pages.push("...");
      }

      for (let i = start; i <= end; i += 1) {
        pages.push(i);
      }

      if (end < safeTotalPages - 1) {
        pages.push("...");
      }

      pages.push(safeTotalPages);
    }

    return pages;
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 py-4 text-sm text-zinc-400",
        className
      )}
    >
      <div className="text-xs">
        {t("pagination.page", "Página")}{" "}
        <span className="font-semibold text-zinc-900 dark:text-white">
          {safeCurrentPage}
        </span>{" "}
        {t("pagination.of", "de")}{" "}
        <span className="font-semibold text-zinc-900 dark:text-white">
          {safeTotalPages}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          aria-label={t("pagination.previous", "Anterior")}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">
            {t("pagination.previous", "Anterior")}
          </span>
        </Button>

        {getPageNumbers().map((page, index) =>
          typeof page === "number" ? (
            <Button
              key={`page-${page}`}
              variant={safeCurrentPage === page ? "default" : "outline"}
              size="sm"
              className="h-8 w-8 p-0 font-bold"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ) : (
            <span
              key={`ellipsis-${index}`}
              className="px-1 text-zinc-600 select-none"
            >
              ...
            </span>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= safeTotalPages}
          aria-label={t("pagination.next", "Siguiente")}
        >
          <span className="hidden sm:inline">
            {t("pagination.next", "Siguiente")}
          </span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
