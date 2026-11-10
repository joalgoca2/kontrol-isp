/**
 * Date and Timezone Centralized Utilities
 * Enforces UTC database storage & localized UI rendering via Intl.DateTimeFormat
 */

export type DateFormatStyle =
  | "date"
  | "datetime"
  | "time"
  | "full"
  | "relative"
  | "PPP"
  | "PP"
  | "dd/MM/yy"
  | (string & {});

export interface FormatDateOptions {
  locale?: string; // e.g. "es", "en", "pt"
  timezone?: string; // e.g. "UTC", "America/Mexico_City", "America/New_York"
  format?: DateFormatStyle;
}

const LOCALE_MAP: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  pt: "pt-BR",
};

/**
 * Standardized Date Formatter
 */
export function formatDate(
  dateInput: Date | string | number | null | undefined,
  options: FormatDateOptions = {}
): string {
  if (!dateInput) return "—";

  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);

  if (isNaN(date.getTime())) {
    return "—";
  }

  const {
    locale = "es",
    timezone = "UTC",
    format = "date",
  } = options;

  const targetLocale = LOCALE_MAP[locale] ?? locale;

  try {
    if (format === "relative") {
      return formatRelativeTime(date, targetLocale);
    }

    let intlOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
    };

    switch (format) {
      case "date":
        intlOptions = {
          ...intlOptions,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        };
        break;
      case "datetime":
        intlOptions = {
          ...intlOptions,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: locale === "en",
        };
        break;
      case "time":
        intlOptions = {
          ...intlOptions,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: locale === "en",
        };
        break;
      case "full":
        intlOptions = {
          ...intlOptions,
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
          hour12: locale === "en",
        };
        break;
    }

    return new Intl.DateTimeFormat(targetLocale, intlOptions).format(date);
  } catch (_error: unknown) {
    // Fallback if invalid timezone or browser error occurs
    return date.toISOString().split("T")[0];
  }
}

/**
 * Helper for relative time formatting (e.g. "Hace 5 min", "5 mins ago", "Há 5 min")
 */
function formatRelativeTime(date: Date, locale: string): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diffInSeconds) < 60) {
    return rtf.format(-Math.max(1, diffInSeconds), "second");
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return rtf.format(-diffInMinutes, "minute");
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return rtf.format(-diffInHours, "hour");
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (Math.abs(diffInDays) < 30) {
    return rtf.format(-diffInDays, "day");
  }

  return formatDate(date, { locale, format: "date" });
}

/**
 * Converts a localized date input or string from the UI into a UTC Date object
 * ready for Prisma / database storage.
 */
export function toUtcDate(
  dateInput: Date | string | number | null | undefined,
  timezone: string = "UTC"
): Date | null {
  if (!dateInput) return null;

  if (dateInput instanceof Date) {
    return new Date(dateInput.getTime());
  }

  if (typeof dateInput === "number") {
    return new Date(dateInput);
  }

  const str = String(dateInput).trim();
  if (!str) return null;

  // If ISO string already contains timezone offset (Z or +/-HH:mm), parse directly
  if (/Z$|[+-]\d{2}:\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // Parse string as UTC if target timezone is UTC
  if (timezone === "UTC") {
    const d = new Date(str.endsWith("Z") ? str : `${str}Z`);
    return isNaN(d.getTime()) ? new Date(str) : d;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a Date object or UTC string into a string compatible with HTML
 * date inputs (YYYY-MM-DD or YYYY-MM-DDTHH:mm) in the user's timezone.
 */
export function formatDateForPicker(
  dateInput: Date | string | number | null | undefined,
  timezone: string = "UTC",
  includeTime: boolean = false
): string {
  if (!dateInput) return "";

  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(includeTime
        ? {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }
        : {}),
    });

    const parts = formatter.formatToParts(date);
    const getPart = (t: string) =>
      parts.find((p) => p.type === t)?.value ?? "00";

    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");

    if (!includeTime) {
      return `${year}-${month}-${day}`;
    }

    const hour = getPart("hour");
    const minute = getPart("minute");

    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch (_err: unknown) {
    return date.toISOString().slice(0, includeTime ? 16 : 10);
  }
}


