"use client";

import React, { useState, useEffect } from "react";
import {
  completeWalkthroughAction,
  skipWalkthroughAction,
  getWalkthroughStatusAction,
} from "@/actions/walkthrough";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/config/features";
import {
  Wifi,
  Server,
  Network,
  Bot,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";

export function WalkthroughWizard() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [step, setStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!FEATURES.walkthrough) return;

    const handleManualOpen = () => {
      setStep(0);
      setIsOpen(true);
    };

    window.addEventListener("open-walkthrough-wizard", handleManualOpen);

    const dismissedLocal = localStorage.getItem("walkthrough_dismissed");
    if (dismissedLocal === "true") {
      setIsOpen(false);
    } else {
      getWalkthroughStatusAction().then((res) => {
        if (res.success && res.data) {
          if (!res.data.showWalkthrough) {
            localStorage.setItem("walkthrough_dismissed", "true");
            setIsOpen(false);
          } else {
            setIsOpen(true);
            if (res.data.step > 0) {
              setStep(res.data.step);
            }
          }
        }
      });
    }

    return () => {
      window.removeEventListener("open-walkthrough-wizard", handleManualOpen);
    };
  }, []);

  if (!FEATURES.walkthrough || !isOpen) {
    return null;
  }

  const steps = [
    {
      icon: Wifi,
      title: t(
        "walkthrough.step1Title",
        "¡Bienvenido a Kontrol ISP!"
      ),
      desc: t(
        "walkthrough.step1Desc",
        "Plataforma integral para gestión de redes, nodos MikroTik, contratos y cobranzas."
      ),
      color: "from-emerald-500 to-teal-600",
    },
    {
      icon: Server,
      title: t("walkthrough.step2Title", "Operaciones con Nodos MikroTik"),
      desc: t(
        "walkthrough.step2Desc",
        "Conecta y monitorea routers CCR en tiempo real vía API RouterOS con fallback LAN."
      ),
      color: "from-teal-500 to-emerald-600",
    },
    {
      icon: Network,
      title: t("walkthrough.step3Title", "Contratos 1 a N y Cobranza Automática"),
      desc: t(
        "walkthrough.step3Desc",
        "Asocia múltiples contratos por abonado, corte por mora y reconexión inmediata."
      ),
      color: "from-sky-500 to-blue-600",
    },
    {
      icon: Bot,
      title: t(
        "walkthrough.step4Title",
        "Agente de Soporte IA 24/7"
      ),
      desc: t(
        "walkthrough.step4Desc",
        "Triaje automatizado en 3 fases: mora, potencias ópticas en MikroTik y escalamiento."
      ),
      color: "from-purple-500 to-indigo-600",
    },
  ];

  const currentStep = steps[step];
  const StepIcon = currentStep.icon;

  const handleNext = async () => {
    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      setLoading(true);
      localStorage.setItem("walkthrough_dismissed", "true");
      await completeWalkthroughAction();
      setLoading(false);
      setIsOpen(false);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((prev) => prev - 1);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    localStorage.setItem("walkthrough_dismissed", "true");
    await skipWalkthroughAction();
    setLoading(false);
    setIsOpen(false);
  };

  return (
    <div
      className={
        "fixed inset-0 z-50 flex items-center justify-center p-4 " +
        "bg-zinc-950/80 backdrop-blur-md transition-all"
      }
    >
      <div
        className={
          "relative w-full max-w-lg overflow-hidden bg-white border " +
          "border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-3xl shadow-2xl"
        }
      >
        {/* Header decoration */}
        <div className={`h-3 w-full bg-gradient-to-r ${currentStep.color}`} />

        {/* Close / Skip button */}
        <button
          type="button"
          onClick={handleSkip}
          disabled={loading}
          className={
            "absolute top-5 right-5 p-2 text-zinc-400 hover:text-zinc-600 " +
            "dark:hover:text-zinc-200 transition-colors rounded-full " +
            "hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }
          title={t("walkthrough.skip", "Omitir")}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Body */}
        <div className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div
              className={
                `p-4 rounded-2xl bg-gradient-to-br ${currentStep.color} ` +
                "text-white shadow-lg shadow-emerald-500/10"
              }
            >
              <StepIcon className="w-10 h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              {currentStep.title}
            </h3>
            <p
              className="text-sm text-zinc-500 dark:text-zinc-400
                         leading-relaxed max-w-md mx-auto"
            >
              {currentStep.desc}
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex justify-center items-center gap-2 pt-2">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={
                  `h-2 rounded-full transition-all duration-300 ${
                    idx === step
                      ? "w-8 bg-emerald-500 dark:bg-emerald-400"
                      : "w-2 bg-zinc-200 dark:bg-zinc-800"
                  }`
                }
              />
            ))}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div
          className={
            "flex items-center justify-between px-8 py-5 border-t border-zinc-100 " +
            "dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40"
          }
        >
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={loading}
            className={
              "text-xs font-semibold text-zinc-500 hover:text-zinc-900 " +
              "dark:text-zinc-400 dark:hover:text-white"
            }
          >
            {t("walkthrough.skip", "Omitir")}
          </Button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={loading}
                className="gap-1 rounded-xl text-xs font-semibold"
              >
                <ChevronLeft className="w-4 h-4" />
                {t("walkthrough.back", "Anterior")}
              </Button>
            )}

            <Button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className={
                "gap-1 rounded-xl text-xs font-bold bg-emerald-500 " +
                "hover:bg-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/20"
              }
            >
              {step === steps.length - 1
                ? t("walkthrough.finish", "Finalizar Tour")
                : t("walkthrough.next", "Siguiente")}
              {step < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
