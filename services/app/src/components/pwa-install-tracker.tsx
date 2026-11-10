"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Smartphone, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallTracker(): React.ReactElement | null {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      localStorage.setItem("pwa_install_tracked", "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstallPrompt(null);
        }
      } catch (_err) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  if (pathname !== "/" || isStandalone || isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md",
        "z-50 p-4 rounded-2xl bg-zinc-900/95 dark:bg-zinc-900/95",
        "text-white shadow-2xl border border-amber-500/40",
        "backdrop-blur-md transition-all animate-in slide-in-from-bottom-5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0"
            )}
          >
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-sm font-extrabold tracking-tight">
              {t("pwaInstall.title", "Instalar Kontrol PWA")}
            </h4>
            <p className="text-xs text-zinc-300">
              {t(
                "pwaInstall.description",
                "Instala la aplicación para un acceso rápido y directo."
              )}
            </p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsDismissed(true)}
          className={cn(
            "h-7 w-7 text-zinc-400 hover:text-white rounded-full shrink-0"
          )}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {showGuide && (
        <div
          className={cn(
            "mt-3 p-3 rounded-xl bg-zinc-800 text-[11px]",
            "text-zinc-300 leading-relaxed space-y-1 border border-zinc-700"
          )}
        >
          <div className="font-bold text-amber-400 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <span>
              {t("pwaInstall.guideTitle", "Instrucciones de Instalación:")}
            </span>
          </div>
          <p>
            {t("pwaInstall.guidePc", "PC: Toca el icono ⊕ en la barra URL.")}
          </p>
          <p>
            {t(
              "pwaInstall.guideAndroid",
              "Android: Menú ⋮ e Instalar app."
            )}
          </p>
          <p>
            {t(
              "pwaInstall.guideIos",
              "iOS: Toca Compartir ⎋ y Agregar a Inicio ➕."
            )}
          </p>
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsDismissed(true)}
          className="text-xs text-zinc-400 hover:text-white rounded-xl"
        >
          {t("pwaInstall.btnLater", "Ahora no")}
        </Button>
        <Button
          size="sm"
          onClick={handleInstallClick}
          className={cn(
            "gap-1.5 font-bold text-xs rounded-xl bg-amber-500",
            "hover:bg-amber-600 text-zinc-950 shadow-md"
          )}
        >
          <Download className="h-4 w-4" />
          <span>{t("pwaInstall.btnInstall", "Instalar App")}</span>
        </Button>
      </div>
    </div>
  );
}
