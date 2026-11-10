"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  Server,
  Network,
  Receipt,
  Bot,
  Activity,
} from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { t } = useTranslation();
  const { data: session } = useSession();

  return (
    <main
      className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950
                 transition-colors"
    >
      {/* Hero Section */}
      <section
        className="relative w-full overflow-hidden bg-gradient-to-b
                   from-zinc-100 via-white to-zinc-50
                   dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950
                   py-20 sm:py-28 text-zinc-900 dark:text-white transition-colors"
      >
        {/* Glow Effects */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/15
                     rounded-full blur-3xl pointer-events-none"
        />
        <div
          className="absolute top-1/3 right-10 w-72 h-72 bg-sky-500/10
                     rounded-full blur-3xl pointer-events-none"
        />

        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 text-center space-y-6">
          {/* Tag Badge */}
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                       bg-emerald-500/10 border border-emerald-500/30
                       text-emerald-700 dark:text-emerald-400
                       text-xs font-bold tracking-wide"
          >
            <span
              className="flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping"
            />
            <span>
              {t("landing.badge", "PLATAFORMA ISP MULTI-TENANT & MULTI-NODO CON IA")}
            </span>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <h1
              className="text-3xl sm:text-5xl md:text-6xl font-black
                         tracking-tight leading-tight uppercase text-zinc-900 dark:text-white"
            >
              {t("landing.heroTitle", "Kontrol ISP")}
              <span
                className="block text-transparent bg-clip-text bg-gradient-to-r
                           from-emerald-600 via-teal-500 to-sky-600
                           dark:from-emerald-400 dark:via-teal-300 dark:to-sky-400 font-extrabold
                           text-2xl sm:text-4xl md:text-5xl mt-2 normal-case"
              >
                {t("landing.heroSub", "CRM & Operaciones de Red para ISPs")}
              </span>
            </h1>

            <p
              className="text-zinc-600 dark:text-zinc-300 text-sm sm:text-base font-normal
                         max-w-2xl mx-auto leading-relaxed"
            >
              {t(
                "landing.heroDesc",
                "Gestión centralizada de servidores MikroTik RouterOS por zonas geográficas, " +
                  "control de abonados y múltiples contratos, facturación con auto-corte y " +
                  "atención técnica 24/7 con Agente de IA."
              )}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={session ? "/dashboard" : "/login"}>
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-8 rounded-xl bg-emerald-500
                           hover:bg-emerald-600 text-zinc-950 font-black text-sm
                           gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
              >
                <span>
                  {session
                    ? t("landing.goToNoc", "Ir al Panel NOC")
                    : t("landing.loginNoc", "Acceder al Panel NOC")}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/terms">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-12 px-7 rounded-xl
                           border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700
                           dark:border-zinc-700 dark:bg-transparent dark:hover:bg-zinc-800
                           dark:text-zinc-200 text-sm font-semibold"
              >
                {t("landing.exploreDocs", "Políticas & Términos")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Live NOC Telemetry Preview Widget */}
      <section className="-mt-10 relative z-20 max-w-5xl mx-auto px-4 sm:px-6 w-full">
        <div
          className="p-5 sm:p-6 rounded-2xl bg-white/95 dark:bg-zinc-900/95
                     border border-zinc-200 dark:border-zinc-800 shadow-xl backdrop-blur"
        >
          <div
            className="flex items-center justify-between pb-4 border-b
                       border-zinc-100 dark:border-zinc-800/80"
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span
                className="text-xs font-black uppercase tracking-wider
                           text-zinc-800 dark:text-zinc-200"
              >
                Telemetría en Vivo de Servidores MikroTik
              </span>
            </div>
            <div
              className="flex items-center gap-1.5 text-xs text-emerald-600
                         dark:text-emerald-400 font-bold"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              RouterOS API Activa
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
            <div
              className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60
                         border border-zinc-200/60 dark:border-zinc-800/60"
            >
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                Nodo Central (Soacha):
              </span>
              <div className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">
                CCR1009 — 190.242.115.10:8728
              </div>
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                ONLINE (14 ms) • 142 sesiones PPPoE
              </div>
            </div>

            <div
              className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60
                         border border-zinc-200/60 dark:border-zinc-800/60"
            >
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                Nodo Cazucá (Torre):
              </span>
              <div className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">
                CCR2004 — 38.52.120.45:8728
              </div>
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                ONLINE (22 ms) • 89 sesiones PPPoE
              </div>
            </div>

            <div
              className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60
                         border border-zinc-200/60 dark:border-zinc-800/60"
            >
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                Agente IA WhatsApp (n8n):
              </span>
              <div className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5">
                Evolution API Gateway
              </div>
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                CONECTADO • Triaje 3 Fases
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="w-full py-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2
            className="text-2xl sm:text-3xl font-black text-zinc-900
                       dark:text-white tracking-tight"
          >
            {t("landing.featuresTitle", "Todo lo que tu ISP necesita en una sola plataforma")}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm">
            {t(
              "landing.featuresSub",
              "Diseñado para operadores de fibra óptica y microondas que buscan automatizar."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Multi-Nodo */}
          <div
            className="p-6 rounded-2xl border border-zinc-200 bg-white/90
                       dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs
                       hover:shadow-md transition-all space-y-3"
          >
            <div
              className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600
                         dark:text-emerald-400 flex items-center justify-center font-bold"
            >
              <Server className="h-5 w-5" />
            </div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white">
              {t("landing.feat1Title", "NOC Multi-Nodo MikroTik")}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t(
                "landing.feat1Desc",
                "Conexión TCP binaria y TLS a routers distribuidos con telemetría en vivo."
              )}
            </p>
          </div>

          {/* Card 2: 1 a N Contratos */}
          <div
            className="p-6 rounded-2xl border border-zinc-200 bg-white/90
                       dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs
                       hover:shadow-md transition-all space-y-3"
          >
            <div
              className="h-11 w-11 rounded-xl bg-sky-500/10 text-sky-600
                         dark:text-sky-400 flex items-center justify-center font-bold"
            >
              <Network className="h-5 w-5" />
            </div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white">
              {t("landing.feat2Title", "Clientes 1 a N Contratos")}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t(
                "landing.feat2Desc",
                "Un titular con múltiples servicios en diferentes nodos. Ficha técnica FTTH."
              )}
            </p>
          </div>

          {/* Card 3: Facturación & Auto-Corte */}
          <div
            className="p-6 rounded-2xl border border-zinc-200 bg-white/90
                       dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs
                       hover:shadow-md transition-all space-y-3"
          >
            <div
              className="h-11 w-11 rounded-xl bg-indigo-500/10 text-indigo-600
                         dark:text-indigo-400 flex items-center justify-center font-bold"
            >
              <Receipt className="h-5 w-5" />
            </div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white">
              {t("landing.feat3Title", "Cobranza & Auto-Reactivación")}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t(
                "landing.feat3Desc",
                "Corte de morosos en MikroTik y reactivación instantánea al registrar el pago."
              )}
            </p>
          </div>

          {/* Card 4: Agente IA */}
          <div
            className="p-6 rounded-2xl border border-zinc-200 bg-white/90
                       dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs
                       hover:shadow-md transition-all space-y-3"
          >
            <div
              className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600
                         dark:text-amber-400 flex items-center justify-center font-bold"
            >
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white">
              {t("landing.feat4Title", "Agente IA WhatsApp 24/7")}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t(
                "landing.feat4Desc",
                "Triaje en 3 fases: mora, diagnóstico de potencias ópticas y traspaso humano."
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section
        className="w-full py-16 bg-gradient-to-b from-zinc-100 to-white
                   dark:from-zinc-900 dark:to-zinc-950
                   text-zinc-900 dark:text-white
                   border-t border-zinc-200 dark:border-zinc-800 transition-colors"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
            {t("landing.ctaTitle", "¿Listo para profesionalizar la red de tu ISP?")}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto">
            {t(
              "landing.ctaDesc",
              "Monitorea nodos MikroTik, despacha soporte técnico y elimina los cortes manuales."
            )}
          </p>
          <div className="pt-2">
            <Link href={session ? "/dashboard" : "/login"}>
              <Button
                size="lg"
                className="h-11 px-8 rounded-xl bg-emerald-500 hover:bg-emerald-600
                           text-zinc-950 font-black text-xs gap-2"
              >
                <span>{t("landing.enterNoc", "Ingresar a Kontrol ISP")}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
