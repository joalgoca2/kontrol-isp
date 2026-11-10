"use client";

import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  Server,
  Zap,
  Scale,
  Bot,
  Receipt,
  Headphones,
} from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="h-4 w-4" />
            <span>{t("common.backHome", "Volver al Inicio")}</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <FileText className="h-4 w-4 text-emerald-500" />
          <span>
            {t(
              "terms.lastUpdated",
              "Última actualización: 30 de Octubre, 2026"
            )}
          </span>
        </div>
      </div>

      {/* Page Header */}
      <div className="space-y-2">
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight
                     text-zinc-900 dark:text-white"
        >
          {t("terms.title", "Términos y Condiciones de Servicio")}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-base">
          {t(
            "terms.subtitle",
            "Políticas de operación, gestión de infraestructura MikroTik y software NOC."
          )}
        </p>
      </div>

      <Card
        className="border-zinc-200 bg-white/90 dark:border-zinc-800
                   dark:bg-zinc-900/50 backdrop-blur shadow-sm"
      >
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
          <CardTitle
            className="text-xl font-bold flex items-center gap-2
                       text-zinc-900 dark:text-white"
          >
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
            <span>
              {t(
                "terms.cardTitle",
                "Acuerdo de Operación de Telecomunicaciones & Licencia de Software"
              )}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent
          className="space-y-6 pt-6 text-sm leading-relaxed
                     text-zinc-700 dark:text-zinc-300"
        >
          {/* Section 1: Alcance de la Plataforma */}
          <section className="space-y-2">
            <h3
              className="font-bold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Server className="h-4 w-4 text-emerald-500" />
              {t(
                "terms.sec1Title",
                "1. Alcance de la Plataforma y Licencia Multimarca"
              )}
            </h3>
            <p>
              {t(
                "terms.sec1Desc",
                "Kontrol ISP es una solución integral para proveedores ISP y WISP que " +
                "centraliza el monitoreo de nodos MikroTik RouterOS, contratos de " +
                "abonados y mesa de ayuda con agentes de Inteligencia Artificial."
              )}
            </p>
          </section>

          {/* Section 2: Conexión con MikroTik */}
          <section className="space-y-2">
            <h3
              className="font-bold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Zap className="h-4 w-4 text-amber-500" />
              {t(
                "terms.sec2Title",
                "2. Conectividad con Nodos MikroTik y Responsabilidad de Red"
              )}
            </h3>
            <p>
              {t(
                "terms.sec2Desc",
                "El operador de red (Brand) provee credenciales y puertos de " +
                "acceso (RouterOS API 8728 / 8729 TLS) para telemetría y comandos automáticos:"
              )}
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <li>
                {t(
                  "terms.sec2Item1",
                  "Kontrol ISP no interfiere con el enrutamiento físico ni asume " +
                  "responsabilidad por caídas de enlace troncal del operador."
                )}
              </li>
              <li>
                {t(
                  "terms.sec2Item2",
                  "Las credenciales de acceso se almacenan cifradas en un esquema " +
                  "multi-inquilino aislado."
                )}
              </li>
              <li>
                {t(
                  "terms.sec2Item3",
                  "El operador debe asegurar reglas de firewall y listas de acceso permitidas " +
                  "para el servidor Kontrol ISP."
                )}
              </li>
            </ul>
          </section>

          {/* Section 3: Contratos & Facturación */}
          <section className="space-y-2">
            <h3
              className="font-bold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Receipt className="h-4 w-4 text-blue-500" />
              {t(
                "terms.sec3Title",
                "3. Gestión de Contratos, Facturación y Suspensión Automática"
              )}
            </h3>
            <p>
              {t(
                "terms.sec3Desc",
                "El módulo de cobranza ejecuta reglas de corte y reconexión automáticas:"
              )}
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <li>
                {t(
                  "terms.sec3Item1",
                  "Cada abonado puede disponer de 1 a N contratos vinculados a nodos y planes."
                )}
              </li>
              <li>
                {t(
                  "terms.sec3Item2",
                  "En caso de mora superior a los días de gracia, el sistema suspende " +
                  "automáticamente las credenciales PPPoE o asigna perfiles morosos."
                )}
              </li>
              <li>
                {t(
                  "terms.sec3Item3",
                  "Al registrar un recaudo válido, el sistema reactiva inmediatamente el " +
                  "servicio en el nodo correspondiente."
                )}
              </li>
            </ul>
          </section>

          {/* Section 4: Agente de IA y Mesa de Ayuda */}
          <section className="space-y-2">
            <h3
              className="font-bold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Bot className="h-4 w-4 text-purple-500" />
              {t(
                "terms.sec4Title",
                "4. Agente de Soporte con Inteligencia Artificial (WhatsApp)"
              )}
            </h3>
            <p>
              {t(
                "terms.sec4Desc",
                "El agente de IA atiende consultas de primer nivel mediante un protocolo de " +
                "3 fases (identificación/mora, telemetría óptica y cables, escalamiento). " +
                "La asistencia es orientativa y no sustituye soporte en sitio."
              )}
            </p>
          </section>

          {/* Section 5: Obligaciones del Usuario */}
          <section className="space-y-2">
            <h3
              className="font-bold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Scale className="h-4 w-4 text-emerald-500" />
              {t(
                "terms.sec5Title",
                "5. Obligaciones y Uso Aceptable de la Plataforma"
              )}
            </h3>
            <p>
              {t(
                "terms.sec5Desc",
                "Los usuarios deben salvaguardar sus credenciales de acceso, no realizar " +
                "ingeniería inversa sobre el protocolo RouterOS integrado y velar por el " +
                "cumplimiento regulatorio de telecomunicaciones."
              )}
            </p>
          </section>

          {/* Contact Section */}
          <section className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3
              className="font-semibold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Headphones className="h-4 w-4 text-emerald-500" />
              {t("terms.contactTitle", "Centro de Atención y Soporte NOC")}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t(
                "terms.contactDesc",
                "Para dudas contractuales, reportes de soporte técnico o configuración de " +
                "nuevos nodos, contacta al NOC de tu marca o al equipo de Kontrol ISP."
              )}
            </p>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
