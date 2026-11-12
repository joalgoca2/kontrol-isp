"use client";

import { useState } from "react";
import Script from "next/script";
import {
  CreditCard,
  Zap,
  AlertTriangle,
  ShieldCheck,
  Phone,
  Wifi,
  Store,
  Loader2,
  Calendar,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { requestPublicPaymentPromise } from "@/actions/portal";
import type { PublicContractPaymentInfo } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EpaycoCheckoutInstance {
  open: (params: Record<string, unknown>) => void;
}

interface EpaycoGlobal {
  checkout: {
    configure: (config: {
      key: string;
      test: boolean;
    }) => EpaycoCheckoutInstance;
  };
}

interface PortalClientProps {
  initialData: PublicContractPaymentInfo;
  token: string;
}

export function PortalClient({ initialData, token }: PortalClientProps) {
  const [data, setData] = useState<PublicContractPaymentInfo>(initialData);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isRequestingPromise, setIsRequestingPromise] = useState(false);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: data.brandCurrency || "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleOpenEpayco = () => {
    if (!data.daviPayCheckoutData) {
      toast.error("La pasarela de pago en línea no está disponible.");
      return;
    }

    const windowWithEpayco = window as unknown as { ePayco?: EpaycoGlobal };
    if (!windowWithEpayco.ePayco) {
      toast.error(
        "Cargando pasarela de pago... Por favor, intenta en unos segundos."
      );
      return;
    }

    try {
      setIsOpeningCheckout(true);
      const checkout = windowWithEpayco.ePayco.checkout.configure({
        key: data.daviPayCheckoutData.publicKey,
        test: data.daviPayCheckoutData.test,
      });

      checkout.open({
        name: data.daviPayCheckoutData.name,
        description: data.daviPayCheckoutData.description,
        invoice: data.daviPayCheckoutData.invoice,
        currency: data.daviPayCheckoutData.currency,
        amount: String(data.daviPayCheckoutData.amount),
        tax_base: "0",
        tax: "0",
        country: "co",
        lang: "es",
        external: "false",
        extra1: data.daviPayCheckoutData.extra1,
        extra2: data.daviPayCheckoutData.extra2,
        response: data.daviPayCheckoutData.response,
        confirmation: data.daviPayCheckoutData.confirmation,
        name_billing: data.daviPayCheckoutData.nameBilling,
        address_billing: data.daviPayCheckoutData.addressBilling,
        type_doc_billing: data.daviPayCheckoutData.typeDocBilling,
        number_doc: data.daviPayCheckoutData.numberDoc,
        mobilephone_billing: data.daviPayCheckoutData.mobilephoneBilling,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error abriendo pasarela.";
      toast.error(msg);
    } finally {
      setIsOpeningCheckout(false);
    }
  };

  const handleRequestPromise = async () => {
    setIsRequestingPromise(true);
    try {
      const res = await requestPublicPaymentPromise(
        token,
        "Solicitada por el abonado desde el Portal de Pago sin clave."
      );
      if (res.success) {
        toast.success(
          "¡Prórroga de 24 horas concedida! Tu servicio ha sido reactivado."
        );
        setData((prev) => ({
          ...prev,
          billingStatus: "ACTIVO",
          serviceStatus: "ONLINE",
        }));
      } else {
        toast.error(
          res.error || "No fue posible conceder la prórroga de pago."
        );
      }
    } catch {
      toast.error("Error inesperado al solicitar la prórroga.");
    } finally {
      setIsRequestingPromise(false);
    }
  };

  const isSuspended =
    data.billingStatus === "SUSPENDIDO_MORA" ||
    data.billingStatus === "RETIRADO";

  return (
    <>
      <Script
        src="https://checkout.epayco.co/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setScriptLoaded(true)}
      />

      <div
        className={cn(
          "min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900",
          "dark:text-zinc-100 flex flex-col justify-between py-6 px-4"
        )}
      >
        <div className="max-w-xl w-full mx-auto space-y-4">
          {/* Header Brand */}
          <div
            className={cn(
              "flex items-center justify-between p-4 rounded-2xl border",
              "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900",
              "shadow-xs"
            )}
          >
            <div className="flex items-center gap-3">
              {data.brandLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.brandLogo}
                  alt={data.brandName}
                  className="h-10 w-10 object-contain rounded-xl"
                />
              ) : (
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600",
                    "dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center",
                    "justify-center font-bold text-lg"
                  )}
                >
                  {data.brandName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {data.brandName}
                </h1>
                <p className="text-2xs text-zinc-500">
                  Portal Seguro de Pago del Abonado
                </p>
              </div>
            </div>

            {data.brandSupportPhone && (
              <a
                href={`https://wa.me/${data.brandSupportPhone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border",
                  "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
                  "bg-emerald-500/10 text-xs font-semibold hover:bg-emerald-500/20",
                  "transition-all"
                )}
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Soporte</span>
              </a>
            )}
          </div>

          {/* Estado de Suspensión Alerta si aplica */}
          {isSuspended && (
            <div
              className={cn(
                "p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10",
                "space-y-3"
              )}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={cn(
                    "h-5 w-5 text-rose-600 dark:text-rose-400",
                    "shrink-0 mt-0.5"
                  )}
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    Servicio Suspendido por Falta de Pago
                  </p>
                  <p className="text-2xs text-rose-600/90 dark:text-rose-300/80">
                    Tu acceso a internet se encuentra suspendido. Realiza tu
                    pago en línea o solicita 24h de prórroga para reactivarlo
                    de inmediato.
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleRequestPromise}
                disabled={isRequestingPromise}
                className={cn(
                  "w-full text-xs font-semibold gap-2 rounded-xl",
                  "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                )}
              >
                {isRequestingPromise ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Activar Prórroga de Emergencia (24 Horas)
              </Button>
            </div>
          )}

          {/* Card Principal: Total a Pagar y Botón de Pago */}
          <Card
            className={cn(
              "border-emerald-500/40 bg-white dark:bg-zinc-900 shadow-md",
              "overflow-hidden"
            )}
          >
            <div className="bg-emerald-600 px-5 py-3 text-white flex items-center justify-between">
              <span className="text-xs font-semibold">Valor Total a Pagar</span>
              <span className="text-2xs bg-emerald-700/60 px-2 py-0.5 rounded-full">
                Corte día {data.billingDay} de cada mes
              </span>
            </div>

            <CardContent className="p-6 space-y-5">
              <div className="text-center space-y-1">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(data.monthlyAmountCop)}
                </span>
                <p className="text-xs text-zinc-500">
                  Plan {data.planName} · {data.downloadSpeedMbps} Megas
                </p>
              </div>

              {/* Botón DaviPay / ePayco */}
              {data.hasDaviPay ? (
                <Button
                  size="lg"
                  onClick={handleOpenEpayco}
                  disabled={!scriptLoaded || isOpeningCheckout}
                  className={cn(
                    "w-full h-12 text-sm font-bold gap-2.5 rounded-2xl",
                    "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md",
                    "transition-all duration-200 hover:scale-[1.01]"
                  )}
                >
                  {isOpeningCheckout ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CreditCard className="h-5 w-5" />
                  )}
                  Pagar en Línea (PSE · Nequi · DaviPlata · Tarjeta)
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              ) : (
                <div
                  className={cn(
                    "p-3 rounded-xl text-center text-xs text-zinc-500",
                    "bg-zinc-100 dark:bg-zinc-800"
                  )}
                >
                  El pago en línea con tarjeta o PSE se encuentra en
                  mantenimiento. Puedes pagar en efectivo a continuación.
                </div>
              )}

              {/* Opción Efecty en Efectivo */}
              {data.hasEfecty && (
                <div
                  className={cn(
                    "p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800",
                    "bg-zinc-50/80 dark:bg-zinc-900/60 space-y-2"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-2 text-xs font-semibold",
                      "text-zinc-800 dark:text-zinc-200"
                    )}
                  >
                    <Store className="h-4 w-4 text-amber-500" />
                    <span>Pago en Efectivo en Puntos Efecty</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div
                      className={cn(
                        "p-2 rounded-xl bg-white dark:bg-zinc-800",
                        "border border-zinc-200 dark:border-zinc-700"
                      )}
                    >
                      <span className="text-2xs text-zinc-400 block">
                        Convenio Efecty
                      </span>
                      <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {data.efectyAgreementCode}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "p-2 rounded-xl bg-white dark:bg-zinc-800",
                        "border border-zinc-200 dark:border-zinc-700"
                      )}
                    >
                      <span className="text-2xs text-zinc-400 block">
                        Referencia de Pago
                      </span>
                      <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {data.efectyReference}
                      </span>
                    </div>
                  </div>
                  <p className="text-2xs text-zinc-400">
                    Indica estos dos números en cualquier punto Efecty del
                    país. La reactivación es automática en minutos.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Detalle del Contrato */}
          <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <CardHeader className="py-3 px-5 border-b border-zinc-100 dark:border-zinc-800">
              <CardTitle
                className={cn(
                  "text-xs font-semibold text-zinc-700 dark:text-zinc-300",
                  "flex items-center justify-between"
                )}
              >
                <span>Información del Servicio</span>
                <Badge
                  className={cn(
                    "text-2xs font-semibold",
                    data.billingStatus === "ACTIVO"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-rose-500/10 text-rose-600"
                  )}
                >
                  {data.billingStatus}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              <div
                className={cn(
                  "flex justify-between py-1 border-b",
                  "border-zinc-100 dark:border-zinc-800"
                )}
              >
                <span className="text-zinc-400">Titular</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {data.clientName}
                </span>
              </div>
              <div
                className={cn(
                  "flex justify-between py-1 border-b",
                  "border-zinc-100 dark:border-zinc-800"
                )}
              >
                <span className="text-zinc-400">Documento</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-100">
                  {data.clientDocType} {data.clientDocNumber}
                </span>
              </div>
              <div
                className={cn(
                  "flex justify-between py-1 border-b",
                  "border-zinc-100 dark:border-zinc-800"
                )}
              >
                <span className="text-zinc-400">Contrato #</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {data.contractNumber}
                </span>
              </div>
              <div
                className={cn(
                  "flex justify-between py-1 border-b",
                  "border-zinc-100 dark:border-zinc-800"
                )}
              >
                <span className="text-zinc-400">Dirección</span>
                <span className="text-right text-zinc-800 dark:text-zinc-200">
                  {data.serviceAddress}, {data.city}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Velocidad</span>
                <span
                  className={cn(
                    "font-medium text-zinc-900 dark:text-zinc-100",
                    "flex items-center gap-1"
                  )}
                >
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                  {data.downloadSpeedMbps}M Bajada / {data.uploadSpeedMbps}M
                  Subida
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Historial de Pagos Recientes */}
          {data.recentPayments.length > 0 && (
            <Card
              className={cn(
                "border border-zinc-200 dark:border-zinc-800",
                "bg-white dark:bg-zinc-900"
              )}
            >
              <CardHeader className="py-3 px-5 border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle
                  className={cn(
                    "text-xs font-semibold text-zinc-700 dark:text-zinc-300",
                    "flex items-center gap-2"
                  )}
                >
                  <Receipt className="h-4 w-4 text-emerald-500" />
                  <span>Pagos Registrados Recientemente</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {data.recentPayments.map((p) => (
                  <div
                    key={p.receiptNumber}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl",
                      "bg-zinc-50 dark:bg-zinc-800/50 text-xs"
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          Recibo #{p.receiptNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-2xs text-emerald-600 border-emerald-500/30"
                        >
                          {p.status}
                        </Badge>
                      </div>
                      <span className="text-2xs text-zinc-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.createdAt).toLocaleDateString("es-CO")} ·{" "}
                        {p.paymentMethod}
                      </span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Footer Seguridad */}
          <div className="pt-2 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-2xs text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>
                Transacciones seguras encriptadas con cifrado bancario SHA-256
              </span>
            </div>
            <p className="text-3xs text-zinc-400">
              Powered by Kontrol ISP · {data.brandName}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
