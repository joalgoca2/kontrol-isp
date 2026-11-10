"use client";

import { useEffect } from "react";
import { FEATURES } from "@/lib/config/features";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!FEATURES.pwa) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
      return;
    }

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((_reg) => {
          // Service worker registrado exitosamente
        })
        .catch((_err) => {
          // Error silenciado en registro SW
        });
    }
  }, []);

  return <>{children}</>;
}
