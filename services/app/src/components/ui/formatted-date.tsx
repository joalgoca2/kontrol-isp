"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { formatDate, type DateFormatStyle } from "@/lib/date";

interface FormattedDateProps {
  date: Date | string | number | null | undefined;
  format?: DateFormatStyle;
  timezone?: string;
  className?: string;
}

export function FormattedDate({
  date,
  format = "date",
  timezone,
  className,
}: FormattedDateProps) {
  const { locale } = useTranslation();
  const { data: session } = useSession();

  const userTimezone =
    timezone ??
    (session?.user as { timezone?: string } | undefined)?.timezone ??
    "UTC";

  const formattedStr = formatDate(date, {
    locale,
    timezone: userTimezone,
    format,
  });

  return <span className={className}>{formattedStr}</span>;
}
