"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  Database,
  Network,
  KeyRound,
  Mail,
  Bot,
} from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="h-4 w-4" />
            <span>{t("common.backHome", "Volver al Inicio")}</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Lock className="h-4 w-4 text-emerald-500" />
          <span>
            {t(
              "privacy.lastUpdated",
              "Última actualización: 30 de Octubre, 2026"
            )}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight
                     text-zinc-900 dark:text-white"
        >
          {t(
            "privacy.title",
            "Política de Privacidad y Tratamiento de Datos"
          )}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-base">
          {t(
            "privacy.subtitle",
            "Protección de datos de telecomunicaciones, abonados e infraestructura según Ley 1581."
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
                "privacy.cardTitle",
                "Seguridad y Tratamiento de Información de Telecomunicaciones"
              )}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent
          className="space-y-6 pt-6 text-sm leading-relaxed
                     text-zinc-700 dark:text-zinc-300"
        >
          {/* Section 1 */}
          <section className="space-y-2">
            <h3
              className="font-bold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Database className="h-4 w-4 text-emerald-500" />
              {t("privacy.sec1Title", "1. Datos Recopilados de Abonados y Red")}
            </h3>
            <p>
              {t(
                "privacy.sec1Desc",
                "Para la correcta prestación de servicios ISP y gestión NOC, procesamos:"
              )}
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <li>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {t("privacy.sec1Item1Head", "Datos del Titular y Suscriptor:")}
                </span>{" "}
                {t(
                  "privacy.sec1Item1Body",
                  "Nombre completo, identificación (CC/NIT), teléfono móvil/WhatsApp y correo."
                )}
              </li>
              <li>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {t("privacy.sec1Item2Head", "Datos Técnicos del Enlace y Contrato:")}
                </span>{" "}
                {t(
                  "privacy.sec1Item2Body",
                  "Dirección de instalación, GPS, usuario PPPoE, IP, MAC y potencia óptica."
                )}
              </li>
              <li>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {t("privacy.sec1Item3Head", "Registros de Facturación:")}
                </span>{" "}
                {t(
                  "privacy.sec1Item3Body",
                  "Comprobantes digitales de recaudo (#RC-XXXX) y estados de corte/activación."
                )}
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-2">
            <h3
              className="font-bold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Network className="h-4 w-4 text-blue-500" />
              {t(
                "privacy.sec2Title",
                "2. Finalidad del Tratamiento de Datos"
              )}
            </h3>
            <p>
              {t(
                "privacy.sec2Desc",
                "Los datos se utilizan exclusivamente para propósitos operativos y de red:"
              )}
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <li>
                {t(
                  "privacy.sec2Item1",
                  "Aprovisionamiento y sincronización en enrutadores MikroTik RouterOS."
                )}
              </li>
              <li>
                {t(
                  "privacy.sec2Item2",
                  "Envío automático de recibos digitales de pago y recordatorios vía WhatsApp."
                )}
              </li>
              <li>
                {t(
                  "privacy.sec2Item3",
                  "Diagnóstico preventivo de potencias ópticas y telemetría de tráfico."
                )}
              </li>
              <li>
                {t(
                  "privacy.sec2Item4",
                  "Atención automatizada por Agente de IA para validar estado de mora y enlace."
                )}
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-2">
            <h3
              className="font-bold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <KeyRound className="h-4 w-4 text-amber-500" />
              {t(
                "privacy.sec3Title",
                "3. Seguridad, Multimarca Aislado y Cifrado"
              )}
            </h3>
            <p>
              {t(
                "privacy.sec3Desc",
                "Cada marca operadora (Brand) tiene aislamiento de datos lógico. " +
                "Las contraseñas de usuarios se cifran con bcrypt, las conexiones a " +
                "MikroTik usan API cifrada (SSL/TLS opcional) y el tráfico web va sobre HTTPS."
              )}
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-2">
            <h3
              className="font-bold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Bot className="h-4 w-4 text-purple-500" />
              {t(
                "privacy.sec4Title",
                "4. Privacidad en Conversaciones con el Agente de IA"
              )}
            </h3>
            <p>
              {t(
                "privacy.sec4Desc",
                "Las consultas en el Agente IA de WhatsApp registran logs anonimizados " +
                "de triaje para auditoría y mejora continua, sin transferir datos personales " +
                "a modelos públicos."
              )}
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-2">
            <h3 className="font-bold text-zinc-900 dark:text-white text-base">
              {t(
                "privacy.sec5Title",
                "5. Derechos de los Titulares (Habeas Data)"
              )}
            </h3>
            <p>
              {t(
                "privacy.sec5Desc",
                "Los abonados pueden solicitar conocer, actualizar, rectificar y " +
                "suprimir sus datos personales de conformidad con la Ley 1581 de 2012."
              )}
            </p>
          </section>

          {/* Contact Section */}
          <section className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3
              className="font-semibold text-zinc-900 dark:text-white text-base
                         flex items-center gap-2"
            >
              <Mail className="h-4 w-4 text-emerald-500" />
              {t(
                "privacy.contactTitle",
                "Oficial de Privacidad y Protección de Datos"
              )}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t(
                "privacy.contactDesc",
                "Para ejercer tus derechos ARCO, contacta a la administración de tu ISP " +
                "o escribe a privacidad@kontroldev.com."
              )}
            </p>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
