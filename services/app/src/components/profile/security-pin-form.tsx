"use client";

import React, { useState, useEffect } from "react";
import {
  updateSecurityPinAction,
  disableSecurityPinAction,
  saveWebAuthnCredentialAction,
  disableWebAuthnAction,
  getSecurityConfigAction,
} from "@/actions/security";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FEATURES } from "@/lib/config/features";
import {
  registerBiometricCredential,
  isBiometricSupported,
  isStandalonePWA,
} from "@/lib/security/webauthn";
import {
  KeyRound,
  Fingerprint,
  CheckCircle2,
  ShieldAlert,
  Smartphone,
  Trash2,
} from "lucide-react";

export function SecurityPinForm() {
  const { t } = useTranslation();
  const [pin, setPin] = useState<string>("");
  const [confirmPin, setConfirmPin] = useState<string>("");
  const [hasPin, setHasPin] = useState<boolean>(false);
  const [hasWebAuthn, setHasWebAuthn] = useState<boolean>(false);
  const [isPwa, setIsPwa] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!FEATURES.screenLock) return;
    setIsPwa(isStandalonePWA());

    getSecurityConfigAction().then((res) => {
      if (res.success && res.data) {
        setHasPin(res.data.hasPin);
        setHasWebAuthn(res.data.hasWebAuthn);
      }
    });
  }, []);

  if (!FEATURES.screenLock) {
    return null;
  }

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (pin !== confirmPin) {
      setMessage({
        text: t("security.pinMismatch", "Los PINs ingresados no coinciden"),
        isError: true,
      });
      return;
    }

    setLoading(true);
    const res = await updateSecurityPinAction(pin);
    setLoading(false);

    if (res.success) {
      setHasPin(true);
      setPin("");
      setConfirmPin("");
      setMessage({
        text: t("security.pinSaved", "PIN de seguridad guardado y activado"),
      });
    } else {
      setMessage({
        text: res.error || t("security.pinError", "Error al guardar el PIN"),
        isError: true,
      });
    }
  };

  const handleDisablePin = async () => {
    setMessage(null);
    setLoading(true);
    const res = await disableSecurityPinAction();
    setLoading(false);

    if (res.success) {
      setHasPin(false);
      setPin("");
      setConfirmPin("");
      setMessage({
        text: t("security.pinDisabled", "Bloqueo por PIN desactivado correctamente"),
      });
    } else {
      setMessage({
        text: res.error || t("security.disableError", "Error al desactivar el PIN"),
        isError: true,
      });
    }
  };

  const handleRegisterBiometrics = async () => {
    setMessage(null);
    setLoading(true);

    const bioRes = await registerBiometricCredential("user");
    if (!bioRes.success || !bioRes.credentialId) {
      setLoading(false);
      setMessage({
        text:
          bioRes.error ||
          t("security.biometricRegisterFailed", "Falló el registro biométrico"),
        isError: true,
      });
      return;
    }

    const saveRes = await saveWebAuthnCredentialAction(bioRes.credentialId);
    setLoading(false);

    if (saveRes.success) {
      setHasWebAuthn(true);
      setMessage({
        text: t(
          "security.biometricSaved",
          "Huella digital activada exitosamente"
        ),
      });
    } else {
      setMessage({
        text:
          saveRes.error ||
          t("security.biometricSaveError", "Error al vincular biometría"),
        isError: true,
      });
    }
  };

  const handleDisableBiometrics = async () => {
    setMessage(null);
    setLoading(true);
    const res = await disableWebAuthnAction();
    setLoading(false);

    if (res.success) {
      setHasWebAuthn(false);
      setMessage({
        text: t(
          "security.biometricDisabled",
          "Huella digital desactivada correctamente"
        ),
      });
    } else {
      setMessage({
        text:
          res.error ||
          t("security.biometricDisableError", "Error al desactivar biometría"),
        isError: true,
      });
    }
  };

  return (
    <div className="p-6 bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {t("security.pinTitle", "Seguridad y Bloqueo de Pantalla")}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t(
                "security.pinSubtitle",
                "Habilita el bloqueo por PIN o Huella Digital para proteger tu sesión."
              )}
            </p>
          </div>
        </div>

        {hasPin && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
            {t("security.pinEnabledBadge", "Bloqueo por PIN Activo")}
          </span>
        )}
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-3 text-xs font-semibold rounded-xl border ${
            message.isError
              ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50"
              : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50"
          }`}
        >
          {message.isError ? (
            <ShieldAlert className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Section 1: Security PIN */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          {t("security.pinSection", "1. Bloqueo por PIN Numérico")}
        </h4>

        <form onSubmit={handleSavePin} className="space-y-4 max-w-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("security.newPin", "PIN (4-6 dígitos)")}
              </Label>
              <Input
                type="password"
                maxLength={6}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="text-center font-bold tracking-widest"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("security.confirmPin", "Confirmar PIN")}
              </Label>
              <Input
                type="password"
                maxLength={6}
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="text-center font-bold tracking-widest"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={loading || pin.length < 4}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4"
            >
              {hasPin
                ? t("security.updatePin", "Actualizar PIN")
                : t("security.enablePin", "Habilitar Bloqueo por PIN")}
            </Button>

            {hasPin && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDisablePin}
                disabled={loading}
                className="text-xs font-semibold gap-1.5 rounded-xl h-10 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-4 h-4" />
                {t("security.disablePin", "Deshabilitar PIN")}
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Section 2: Biometrics / Fingerprint (Shown only if PWA) */}
      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-emerald-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              {t("security.biometricSection", "2. Desbloqueo por Huella Digital")}
            </h4>
          </div>

          {isPwa ? (
            hasWebAuthn && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {t("security.active", "Activa")}
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              <Smartphone className="w-3 h-3" />
              {t("security.pwaRequired", "Requiere App Instalada (PWA)")}
            </span>
          )}
        </div>

        {isPwa && isBiometricSupported() ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t(
                "security.pwaBiometricDesc",
                "Permite desbloquear la aplicación PWA usando el sensor de huella digital de tu dispositivo."
              )}
            </p>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={hasWebAuthn ? "outline" : "default"}
                onClick={handleRegisterBiometrics}
                disabled={loading}
                className={`text-xs font-bold gap-2 rounded-xl h-10 px-4 ${
                  !hasWebAuthn
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : ""
                }`}
              >
                <Fingerprint className="w-4 h-4 text-emerald-500" />
                {hasWebAuthn
                  ? t("security.reRegisterBiometrics", "Re-registrar Huella")
                  : t("security.enableBiometrics", "Habilitar Huella Digital")}
              </Button>

              {hasWebAuthn && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDisableBiometrics}
                  disabled={loading}
                  className="text-xs font-semibold gap-1.5 rounded-xl h-10 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("security.disableBiometrics", "Deshabilitar Huella")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
            {t(
              "security.pwaOnlyNotice",
              "La autenticación por huella digital está reservada exclusivamente cuando la aplicación se ejecuta instalada como PWA (Progressive Web App)."
            )}
          </p>
        )}
      </div>
    </div>
  );
}
