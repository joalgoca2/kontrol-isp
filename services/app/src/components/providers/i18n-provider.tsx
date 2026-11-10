"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import es from "@/locales/es.json";
import { updateUserLocale } from "@/actions/i18n";

type DictionaryMap = typeof es;

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => Promise<void>;
  t: (path: string, fallback?: string) => string;
}

const dictionaries: Record<string, DictionaryMap> = {
  es,
};

const I18nContext = createContext<I18nContextType>({
  locale: "es",
  setLocale: async () => {},
  t: (_path: string, fallback?: string) => fallback ?? _path,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { data: session, update: updateSession } = useSession();
  const sessionUser = session?.user;

  const [locale, setLocaleState] = useState<string>("es");

  useEffect(() => {
    setLocaleState("es");
    try {
      localStorage.setItem("NEXT_LOCALE", "es");
    } catch (_e) {}
  }, []);

  const setLocale = async (_newLocale: string) => {
    const targetLocale = "es";
    setLocaleState(targetLocale);

    try {
      localStorage.setItem("NEXT_LOCALE", targetLocale);
    } catch (_e) {}

    document.cookie = `NEXT_LOCALE=${targetLocale}; path=/; max-age=31536000; SameSite=Lax`;

    if (sessionUser?.id) {
      await updateUserLocale(sessionUser.id, targetLocale);
      await updateSession({ locale: targetLocale });
    }
  };

  const t = (path: string, fallback?: string): string => {
    const activeDict = dictionaries.es;
    const parts = path.split(".");
    let current: unknown = activeDict;

    for (const part of parts) {
      if (
        current &&
        typeof current === "object" &&
        part in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return fallback ?? path;
      }
    }

    return typeof current === "string" ? current : fallback ?? path;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
