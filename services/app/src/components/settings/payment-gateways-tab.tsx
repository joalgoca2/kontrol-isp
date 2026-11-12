"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Globe,
  Store,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  getPaymentGatewayConfigs,
  savePaymentGatewayConfig,
  togglePaymentGateway,
} from "@/actions/payment-gateways";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PaymentGatewayConfig } from "@/types";

interface PaymentGatewaysTabProps {
  effectiveBrandId?: string;
  isGlobalMode: boolean;
}

export function PaymentGatewaysTab({
  effectiveBrandId,
  isGlobalMode,
}: PaymentGatewaysTabProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [savingDaviPay, setSavingDaviPay] = useState(false);
  const [savingEfecty, setSavingEfecty] = useState(false);

  // DaviPay state
  const [daviPayEnabled, setDaviPayEnabled] = useState(false);
  const [daviPayTestMode, setDaviPayTestMode] = useState(true);
  const [daviPayCustomerId, setDaviPayCustomerId] = useState("");
  const [daviPayPublicKey, setDaviPayPublicKey] = useState("");
  const [daviPayPrivateKey, setDaviPayPrivateKey] = useState("");
  const [daviPayPKey, setDaviPayPKey] = useState("");
  const [showDaviPaySecrets, setShowDaviPaySecrets] = useState(false);

  // Efecty state
  const [efectyEnabled, setEfectyEnabled] = useState(false);
  const [efectyAgreementCode, setEfectyAgreementCode] = useState("");
  const [efectySecretKey, setEfectySecretKey] = useState("");
  const [efectyValidationMode, setEfectyValidationMode] = useState("DOCUMENT");
  const [showEfectySecret, setShowEfectySecret] = useState(false);

  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const loadConfigs = useCallback(async () => {
    if (!effectiveBrandId) return;
    setLoading(true);
    try {
      const res = await getPaymentGatewayConfigs(effectiveBrandId);
      if (res.success && res.data) {
        const configs: PaymentGatewayConfig[] = res.data;

        // Populate DaviPay
        const daviPay = configs.find((c) => c.provider === "DAVIPAY");
        if (daviPay) {
          setDaviPayEnabled(daviPay.isEnabled);
          setDaviPayTestMode(daviPay.isTestMode);
          setDaviPayCustomerId(daviPay.customerId || "");
          setDaviPayPublicKey(daviPay.publicKey || "");
          setDaviPayPrivateKey(daviPay.privateKey ? "••••••••••••" : "");
          setDaviPayPKey(daviPay.pKey ? "••••••••••••" : "");
        } else {
          setDaviPayEnabled(false);
          setDaviPayTestMode(true);
          setDaviPayCustomerId("");
          setDaviPayPublicKey("");
          setDaviPayPrivateKey("");
          setDaviPayPKey("");
        }

        // Populate Efecty
        const efecty = configs.find((c) => c.provider === "EFECTY");
        if (efecty) {
          setEfectyEnabled(efecty.isEnabled);
          setEfectyAgreementCode(efecty.agreementCode || "");
          setEfectySecretKey(efecty.secretKey ? "••••••••••••" : "");
          setEfectyValidationMode(efecty.validationMode || "DOCUMENT");
        } else {
          setEfectyEnabled(false);
          setEfectyAgreementCode("");
          setEfectySecretKey("");
          setEfectyValidationMode("DOCUMENT");
        }
      }
    } catch {
      toast.error(
        t("paymentGateways.fetchError", "Error al cargar pasarelas de pago")
      );
    } finally {
      setLoading(false);
    }
  }, [effectiveBrandId, t]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(
      `${label} ${t("paymentGateways.copied", "copiada al portapapeles")}`
    );
  };

  const handleToggleDaviPay = async () => {
    if (!effectiveBrandId) return;
    const nextState = !daviPayEnabled;
    setDaviPayEnabled(nextState);
    const res = await togglePaymentGateway(
      effectiveBrandId,
      "DAVIPAY",
      nextState
    );
    if (!res.success) {
      setDaviPayEnabled(!nextState);
      toast.error(res.error || "Error al actualizar estado");
    } else {
      toast.success(
        nextState
          ? t("paymentGateways.davipayEnabled", "DaviPay / ePayco activado")
          : t("paymentGateways.davipayDisabled", "DaviPay / ePayco desactivado")
      );
    }
  };

  const handleToggleEfecty = async () => {
    if (!effectiveBrandId) return;
    const nextState = !efectyEnabled;
    setEfectyEnabled(nextState);
    const res = await togglePaymentGateway(
      effectiveBrandId,
      "EFECTY",
      nextState
    );
    if (!res.success) {
      setEfectyEnabled(!nextState);
      toast.error(res.error || "Error al actualizar estado");
    } else {
      toast.success(
        nextState
          ? t("paymentGateways.efectyEnabled", "Efecty activado")
          : t("paymentGateways.efectyDisabled", "Efecty desactivado")
      );
    }
  };

  const handleSaveDaviPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBrandId) return;
    setSavingDaviPay(true);
    try {
      const isPlaceholderPrivate = daviPayPrivateKey.includes("•••");
      const isPlaceholderPKey = daviPayPKey.includes("•••");

      const res = await savePaymentGatewayConfig({
        brandId: effectiveBrandId,
        provider: "DAVIPAY",
        isEnabled: daviPayEnabled,
        isTestMode: daviPayTestMode,
        customerId: daviPayCustomerId.trim(),
        publicKey: daviPayPublicKey.trim(),
        privateKey: isPlaceholderPrivate ? undefined : daviPayPrivateKey.trim(),
        pKey: isPlaceholderPKey ? undefined : daviPayPKey.trim(),
        validationMode: "DOCUMENT",
      });

      if (res.success) {
        toast.success(
          t(
            "paymentGateways.davipaySaved",
            "Configuración de DaviPay guardada exitosamente"
          )
        );
        loadConfigs();
      } else {
        toast.error(res.error || "Error al guardar DaviPay");
      }
    } catch {
      toast.error("Error al guardar pasarela DaviPay");
    } finally {
      setSavingDaviPay(false);
    }
  };

  const handleSaveEfecty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBrandId) return;
    setSavingEfecty(true);
    try {
      const isPlaceholderSecret = efectySecretKey.includes("•••");

      const res = await savePaymentGatewayConfig({
        brandId: effectiveBrandId,
        provider: "EFECTY",
        isEnabled: efectyEnabled,
        isTestMode: false,
        agreementCode: efectyAgreementCode.trim(),
        secretKey: isPlaceholderSecret ? undefined : efectySecretKey.trim(),
        validationMode: efectyValidationMode,
      });

      if (res.success) {
        toast.success(
          t(
            "paymentGateways.efectySaved",
            "Configuración de Efecty guardada exitosamente"
          )
        );
        loadConfigs();
      } else {
        toast.error(res.error || "Error al guardar Efecty");
      }
    } catch {
      toast.error("Error al guardar Efecty");
    } finally {
      setSavingEfecty(false);
    }
  };

  if (isGlobalMode || !effectiveBrandId) {
    return (
      <Card
        className={
          "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 " +
          "backdrop-blur rounded-3xl shadow-sm overflow-hidden"
        }
      >
        <CardHeader className="p-6 border-b border-zinc-100 dark:border-zinc-800/60">
          <CardTitle
            className={
              "text-base font-bold text-zinc-900 dark:text-zinc-100 " +
              "flex items-center gap-2"
            }
          >
            <CreditCard className="h-5 w-5 text-emerald-500" />
            {t("paymentGateways.title", "Pasarelas de Pago Colombia")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div
            className={
              "p-4 rounded-2xl border border-amber-500/30 " +
              "bg-amber-500/10 text-amber-950 dark:text-amber-200 " +
              "flex flex-col sm:flex-row items-start sm:items-center " +
              "justify-between gap-3"
            }
          >
            <div className="flex items-start gap-3">
              <div
                className={
                  "h-9 w-9 rounded-xl bg-amber-500/20 text-amber-600 " +
                  "dark:text-amber-400 flex items-center justify-center " +
                  "shrink-0 font-bold"
                }
              >
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  {t(
                    "paymentGateways.globalNoticeTitle",
                    "Gestión de Pasarelas no disponible en vista Global"
                  )}
                </h4>
                <p className="text-xs mt-0.5 text-amber-900 dark:text-amber-300">
                  {t(
                    "paymentGateways.globalNoticeDesc",
                    "DaviPay y Efecty operan con convenios aislados por empresa. " +
                      "Selecciona una marca específica en el menú para gestionar."
                  )}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                "border-amber-500/40 text-amber-700 dark:text-amber-300 " +
                "text-[11px] shrink-0"
              }
            >
              {t(
                "settings.whatsappGlobalBadge",
                "Requiere seleccionar marca en el menú"
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  const davipayWebhookUrl = `${origin}/api/v1/webhook/davipay`;
  const efectyConsultaUrl = `${origin}/api/v1/efecty/consulta`;
  const efectyPagoUrl = `${origin}/api/v1/efecty/pago`;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div
        className={
          "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 " +
          "bg-zinc-100 dark:bg-zinc-900/80 p-5 rounded-3xl border " +
          "border-zinc-200 dark:border-zinc-800"
        }
      >
        <div>
          <h3
            className={
              "text-base font-bold text-zinc-900 dark:text-zinc-100 " +
              "flex items-center gap-2"
            }
          >
            <CreditCard className="h-5 w-5 text-emerald-500 shrink-0" />
            {t("paymentGateways.title", "Pasarelas de Pago Colombia")}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t(
              "paymentGateways.subtitle",
              "Recaudo digital (PSE, DaviPlata) y presencial (Efecty)."
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={loadConfigs}
          className="h-8 text-xs gap-1.5 rounded-xl border-zinc-200 dark:border-zinc-800 shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.refresh", "Actualizar")}
        </Button>
      </div>

      {/* GATEWAY 1: DAVIPAY / EPAYCO */}
      <Card
        className={
          "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 " +
          "backdrop-blur rounded-3xl shadow-sm overflow-hidden"
        }
      >
        <CardHeader
          className={
            "p-6 border-b border-zinc-100 dark:border-zinc-800/60 flex " +
            "flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          }
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <CardTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  DaviPay / ePayco Colombia
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    daviPayEnabled
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 text-[10px]"
                      : "border-zinc-300 bg-zinc-100 text-zinc-500 text-[10px]"
                  }
                >
                  {daviPayEnabled
                    ? t("common.active", "Activa")
                    : t("common.inactive", "Inactiva")}
                </Badge>
                {daviPayEnabled && (
                  <Badge
                    variant="outline"
                    className={
                      daviPayTestMode
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 text-[10px]"
                        : "border-blue-500/40 bg-blue-500/10 text-blue-600 text-[10px]"
                    }
                  >
                    {daviPayTestMode ? "Modo Pruebas" : "Producción"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {t(
                  "paymentGateways.davipayDesc",
                  "Pagos PSE, DaviPlata, Nequi y Tarjetas. Auto-reconecta MikroTik."
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={daviPayEnabled ? "destructive" : "default"}
              size="sm"
              onClick={handleToggleDaviPay}
              className="text-xs font-bold rounded-xl h-9 px-4"
            >
              {daviPayEnabled
                ? t("common.disable", "Desactivar")
                : t("common.enable", "Activar")}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          <form onSubmit={handleSaveDaviPay} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* ID Cliente */}
              <div className="space-y-1.5">
                <Label htmlFor="daviPayCustomerId" className="text-xs font-bold">
                  {t("paymentGateways.customerId", "ID Cliente ePayco")}
                </Label>
                <Input
                  id="daviPayCustomerId"
                  maxLength={100}
                  value={daviPayCustomerId}
                  onChange={(e) => setDaviPayCustomerId(e.target.value)}
                  placeholder="Ej: 110482"
                  className="rounded-xl text-xs h-10 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              {/* Public Key */}
              <div className="space-y-1.5">
                <Label htmlFor="daviPayPublicKey" className="text-xs font-bold">
                  {t("paymentGateways.publicKey", "Llave Pública (PUBLIC_KEY)")}
                </Label>
                <Input
                  id="daviPayPublicKey"
                  maxLength={150}
                  value={daviPayPublicKey}
                  onChange={(e) => setDaviPayPublicKey(e.target.value)}
                  placeholder="Ej: 4920f04e8b0b978..."
                  className="rounded-xl text-xs h-10 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              {/* Private Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="daviPayPrivateKey" className="text-xs font-bold">
                    {t("paymentGateways.privateKey", "Llave Privada (PRIVATE_KEY)")}
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowDaviPaySecrets(!showDaviPaySecrets)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-700 flex items-center"
                  >
                    {showDaviPaySecrets ? (
                      <EyeOff className="h-3 w-3 mr-1" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1" />
                    )}
                    {showDaviPaySecrets ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <Input
                  id="daviPayPrivateKey"
                  maxLength={255}
                  type={showDaviPaySecrets ? "text" : "password"}
                  value={daviPayPrivateKey}
                  onChange={(e) => setDaviPayPrivateKey(e.target.value)}
                  placeholder="Ej: 5b6a7c..."
                  className="rounded-xl text-xs h-10 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              {/* P_KEY */}
              <div className="space-y-1.5">
                <Label htmlFor="daviPayPKey" className="text-xs font-bold">
                  {t("paymentGateways.pKey", "Clave P_KEY (Firma SHA-256)")}
                </Label>
                <Input
                  id="daviPayPKey"
                  maxLength={255}
                  type={showDaviPaySecrets ? "text" : "password"}
                  value={daviPayPKey}
                  onChange={(e) => setDaviPayPKey(e.target.value)}
                  placeholder="Ej: 2bb608..."
                  className="rounded-xl text-xs h-10 border-zinc-200 dark:border-zinc-800"
                />
              </div>
            </div>

            {/* Test Mode Switch */}
            <div
              className={
                "flex items-center justify-between p-3.5 rounded-2xl " +
                "bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 " +
                "dark:border-zinc-800"
              }
            >
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {t("paymentGateways.testMode", "Modo Sandbox / Pruebas")}
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t(
                    "paymentGateways.testModeDesc",
                    "Prueba transacciones simuladas antes de producción."
                  )}
                </p>
              </div>
              <input
                type="checkbox"
                checked={daviPayTestMode}
                onChange={(e) => setDaviPayTestMode(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Webhook URL Box */}
            <div
              className={
                "p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 " +
                "border border-zinc-200 dark:border-zinc-700/60 space-y-1.5"
              }
            >
              <span
                className={
                  "text-[11px] font-bold text-zinc-700 dark:text-zinc-300 " +
                  "flex items-center gap-1.5"
                }
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                {t("paymentGateways.webhookUrlTitle", "URL Webhook DaviPay")}
              </span>
              <div className="flex items-center gap-2">
                <code
                  className={
                    "text-[11px] font-mono bg-white dark:bg-zinc-900 px-3 py-2 " +
                    "rounded-xl border border-zinc-200 dark:border-zinc-800 flex-1 truncate"
                  }
                >
                  {davipayWebhookUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(davipayWebhookUrl, "URL de Webhook")}
                  className="h-9 px-3 rounded-xl text-xs gap-1.5 shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t("common.copy", "Copiar")}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingDaviPay}
                className={
                  "bg-emerald-600 hover:bg-emerald-700 text-white font-bold " +
                  "text-xs h-10 px-5 rounded-xl gap-2 shadow-sm"
                }
              >
                {savingDaviPay ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("paymentGateways.saveDavipay", "Guardar DaviPay")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* GATEWAY 2: EFECTY COLOMBIA */}
      <Card
        className={
          "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 " +
          "backdrop-blur rounded-3xl shadow-sm overflow-hidden"
        }
      >
        <CardHeader
          className={
            "p-6 border-b border-zinc-100 dark:border-zinc-800/60 flex " +
            "flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          }
        >
          <div className="flex items-start gap-4">
            <div
              className={
                "p-3 rounded-2xl bg-amber-500/10 text-amber-600 " +
                "dark:text-amber-400 shrink-0"
              }
            >
              <Store className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <CardTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Efecty Colombia (Recaudo Presencial en Efectivo)
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    efectyEnabled
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 text-[10px]"
                      : "border-zinc-300 bg-zinc-100 text-zinc-500 text-[10px]"
                  }
                >
                  {efectyEnabled
                    ? t("common.active", "Activa")
                    : t("common.inactive", "Inactiva")}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {t(
                  "paymentGateways.efectyDesc",
                  "Convenio en taquillas Efecty. Consulta de saldo y reactivación instantánea."
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={efectyEnabled ? "destructive" : "default"}
              size="sm"
              onClick={handleToggleEfecty}
              className="text-xs font-bold rounded-xl h-9 px-4"
            >
              {efectyEnabled
                ? t("common.disable", "Desactivar")
                : t("common.enable", "Activar")}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          <form onSubmit={handleSaveEfecty} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Código Convenio */}
              <div className="space-y-1.5">
                <Label htmlFor="efectyAgreementCode" className="text-xs font-bold">
                  {t("paymentGateways.agreementCode", "Código de Convenio Efecty")}
                </Label>
                <Input
                  id="efectyAgreementCode"
                  maxLength={50}
                  value={efectyAgreementCode}
                  onChange={(e) => setEfectyAgreementCode(e.target.value)}
                  placeholder="Ej: 110542"
                  className="rounded-xl text-xs h-10 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              {/* Clave Secreta WS */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="efectySecretKey" className="text-xs font-bold">
                    {t("paymentGateways.secretKey", "Clave Secreta WS")}
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowEfectySecret(!showEfectySecret)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-700 flex items-center"
                  >
                    {showEfectySecret ? (
                      <EyeOff className="h-3 w-3 mr-1" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1" />
                    )}
                    {showEfectySecret ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <Input
                  id="efectySecretKey"
                  maxLength={255}
                  type={showEfectySecret ? "text" : "password"}
                  value={efectySecretKey}
                  onChange={(e) => setEfectySecretKey(e.target.value)}
                  placeholder="Token acordado con Efecty..."
                  className="rounded-xl text-xs h-10 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              {/* Modo de Validación */}
              <div className="space-y-1.5">
                <Label htmlFor="efectyValidationMode" className="text-xs font-bold">
                  {t("paymentGateways.validationMode", "Modo de Referencia")}
                </Label>
                <select
                  id="efectyValidationMode"
                  value={efectyValidationMode}
                  onChange={(e) => setEfectyValidationMode(e.target.value)}
                  className={
                    "w-full rounded-xl text-xs h-10 px-3 bg-white dark:bg-zinc-900 " +
                    "border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                  }
                >
                  <option value="DOCUMENT">Cédula / NIT del Abonado</option>
                  <option value="CONTRACT_NUMBER">Número de Contrato (ej: CT-104)</option>
                </select>
              </div>
            </div>

            {/* Efecty WS URLs Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={
                  "p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border " +
                  "border-zinc-200 dark:border-zinc-700/60 space-y-1.5"
                }
              >
                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  {t("paymentGateways.efectyConsultaUrl", "URL 1: Consulta de Deuda")}
                </span>
                <div className="flex items-center gap-2">
                  <code
                    className={
                      "text-[11px] font-mono bg-white dark:bg-zinc-900 px-3 py-2 " +
                      "rounded-xl border border-zinc-200 dark:border-zinc-800 flex-1 truncate"
                    }
                  >
                    {efectyConsultaUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(efectyConsultaUrl, "URL de Consulta")}
                    className="h-9 px-3 rounded-xl text-xs gap-1.5 shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div
                className={
                  "p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border " +
                  "border-zinc-200 dark:border-zinc-700/60 space-y-1.5"
                }
              >
                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  {t("paymentGateways.efectyPagoUrl", "URL 2: Notificación de Pago")}
                </span>
                <div className="flex items-center gap-2">
                  <code
                    className={
                      "text-[11px] font-mono bg-white dark:bg-zinc-900 px-3 py-2 " +
                      "rounded-xl border border-zinc-200 dark:border-zinc-800 flex-1 truncate"
                    }
                  >
                    {efectyPagoUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(efectyPagoUrl, "URL de Pago")}
                    className="h-9 px-3 rounded-xl text-xs gap-1.5 shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingEfecty}
                className={
                  "bg-emerald-600 hover:bg-emerald-700 text-white font-bold " +
                  "text-xs h-10 px-5 rounded-xl gap-2 shadow-sm"
                }
              >
                {savingEfecty ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("paymentGateways.saveEfecty", "Guardar Efecty")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
