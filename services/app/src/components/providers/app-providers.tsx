"use client";

import { Toaster } from "sonner";
import { SessionProvider } from "./session-provider";
import { ThemeProvider } from "./theme-provider";
import { ThemeStyleProvider } from "@/components/theme-style-provider";
import { I18nProvider } from "./i18n-provider";
import { PwaProvider } from "./pwa-provider";

import { BrandProvider } from "@/context/brand-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <ThemeProvider>
          <ThemeStyleProvider>
            <BrandProvider>
              <PwaProvider>
                {children}
                <Toaster position="top-right" richColors closeButton />
              </PwaProvider>
            </BrandProvider>
          </ThemeStyleProvider>
        </ThemeProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
