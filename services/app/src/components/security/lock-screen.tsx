"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Lock, Fingerprint, Delete, ShieldAlert, Key } from "lucide-react";
import { verifyPasswordAction } from "@/actions/security";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEATURES } from "@/lib/config/features";
import { cn } from "@/lib/utils";

interface LockScreenProps {
  inactivityTimeoutMs?: number;
}

export function LockScreen({
  inactivityTimeoutMs = 5 * 60 * 1000,
}: LockScreenProps) {
  const { t } = useTranslation();
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [mode, setMode] = useState<"pin" | "password">("pin");
  const [pinInput, setPinInput] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);

  const checkBioState = useCallback(() => {
    try {
      const isStandalone =
        typeof window !== "undefined" &&
        (window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as { standalone?: boolean }).standalone === true ||
          document.referrer.includes("android-app://"));
      const bio = localStorage.getItem("pwa_screen_lock_biometrics");
      setBiometricsEnabled(isStandalone && bio === "true");
    } catch (_e) {
      setBiometricsEnabled(false);
    }
  }, []);

  const unlockApp = useCallback(() => {
    try {
      sessionStorage.removeItem("app_screen_is_locked");
    } catch (_e) { }
    setIsLocked(false);
    setPinInput("");
    setPassword("");
    setErrorMsg("");
  }, []);

  const handleBiometricAuth = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      if (!window.PublicKeyCredential) {
        setErrorMsg(
          t("security.biometricsUnavailable", "Biometría no disponible")
        );
        return;
      }

      const available =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        setErrorMsg(
          t("security.biometricsUnavailable", "Biometría no disponible")
        );
        return;
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Kontrol PWA" },
          user: {
            id: userId,
            name: "kontrol_user",
            displayName: "Usuario Kontrol",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      });

      if (cred) {
        unlockApp();
      }
    } catch (_e) {
      setErrorMsg(
        t(
          "security.biometricsFailed",
          "Autenticación biométrica no completada"
        )
      );
    }
  }, [t, unlockApp]);

  // Check stored lock state on mount
  useEffect(() => {
    try {
      const lockState = sessionStorage.getItem("app_screen_is_locked");
      const savedPin = localStorage.getItem("pwa_screen_lock_pin");
      if (lockState === "true" && savedPin && savedPin.length >= 4) {
        setIsLocked(true);
      }
    } catch (_e) { }
  }, []);

  useEffect(() => {
    if (!FEATURES.screenLock) return;
    checkBioState();

    const handleLockTrigger = () => {
      checkBioState();
      const savedPin = localStorage.getItem("pwa_screen_lock_pin");
      if (savedPin && savedPin.length >= 4) {
        try {
          sessionStorage.setItem("app_screen_is_locked", "true");
        } catch (_e) { }
        setIsLocked(true);
        setPinInput("");
        setErrorMsg("");
        setMode("pin");
      }
    };

    window.addEventListener("lock-screen-trigger", handleLockTrigger);
    return () => {
      window.removeEventListener("lock-screen-trigger", handleLockTrigger);
    };
  }, [checkBioState]);

  // Visibility change auto-lock (e.g. mobile app minimized or screen locked)
  useEffect(() => {
    if (!FEATURES.screenLock) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const savedPin = localStorage.getItem("pwa_screen_lock_pin");
        if (savedPin && savedPin.length >= 4) {
          try {
            sessionStorage.setItem("app_screen_is_locked", "true");
          } catch (_e) { }
          setIsLocked(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!FEATURES.screenLock) return;

    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      const savedPin = localStorage.getItem("pwa_screen_lock_pin");
      if (!savedPin || savedPin.length < 4) return;

      clearTimeout(timer);
      timer = setTimeout(() => {
        checkBioState();
        try {
          sessionStorage.setItem("app_screen_is_locked", "true");
        } catch (_e) { }
        setIsLocked(true);
        setPinInput("");
        setErrorMsg("");
      }, inactivityTimeoutMs);
    };

    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [checkBioState, inactivityTimeoutMs]);

  const handleUnlock = useCallback(
    (input: string) => {
      try {
        const savedPin = localStorage.getItem("pwa_screen_lock_pin");
        if (savedPin && input === savedPin) {
          unlockApp();
        } else {
          setErrorMsg(t("security.wrongPin", "PIN Incorrecto"));
          setPinInput("");
        }
      } catch (_e) {
        setErrorMsg(t("security.wrongPin", "PIN Incorrecto"));
        setPinInput("");
      }
    },
    [t, unlockApp]
  );

  const handleKeyPress = (num: string) => {
    if (pinInput.length < 6) {
      const nextInput = pinInput + num;
      setPinInput(nextInput);
      setErrorMsg("");

      const savedPin = localStorage.getItem("pwa_screen_lock_pin");
      if (savedPin && nextInput.length === savedPin.length) {
        handleUnlock(nextInput);
      }
    }
  };

  const handleDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg("");
  };

  const handleUnlockWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const res = await verifyPasswordAction(password);
    setLoading(false);

    if (res.success && res.data) {
      unlockApp();
    } else {
      setErrorMsg(
        res.error ||
        t("security.invalidPassword", "Contraseña de la cuenta incorrecta")
      );
    }
  };

  if (!FEATURES.screenLock || !isLocked) {
    return null;
  }

  const savedPin =
    typeof window !== "undefined"
      ? localStorage.getItem("pwa_screen_lock_pin")
      : null;
  const targetLength = savedPin ? savedPin.length : 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-2xl transition-all text-white">
      <div className="w-full max-w-sm flex flex-col items-center space-y-5 text-center">
        {/* Header Icon */}
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-xl shadow-amber-500/10">
          <Lock className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-2xl font-black tracking-tight">
            {t("security.lockedTitle", "Pantalla Bloqueada")}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {mode === "pin"
              ? t(
                "security.lockedSub",
                "Ingresa tu PIN de seguridad para continuar"
              )
              : t(
                "security.enterPassword",
                "Ingresa la contraseña de tu cuenta para desbloquear"
              )}
          </p>
        </div>

        {/* PIN Indicators (Dot sequence) */}
        {mode === "pin" && (
          <div className="flex items-center gap-3 my-1">
            {Array.from({ length: targetLength }).map((_, idx) => (
              <div
                key={`pin-dot-${idx}`}
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-all duration-200",
                  idx < pinInput.length
                    ? "bg-amber-500 border-amber-400 scale-110"
                    : "border-zinc-700 bg-zinc-900"
                )}
              />
            ))}
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold animate-bounce">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Mode Switch: PIN Keypad vs Password Input */}
        {mode === "pin" ? (
          <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] pt-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={`keypad-${num}`}
                type="button"
                onClick={() => handleKeyPress(num)}
                className={cn(
                  "h-14 w-14 mx-auto rounded-2xl bg-zinc-900/80 border border-zinc-800",
                  "text-lg font-bold text-white hover:bg-zinc-800 active:scale-95",
                  "transition-all flex items-center justify-center cursor-pointer shadow-sm"
                )}
              >
                {num}
              </button>
            ))}

            {/* Biometrics button if enabled */}
            {biometricsEnabled ? (
              <button
                type="button"
                onClick={handleBiometricAuth}
                className={cn(
                  "h-14 w-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30",
                  "text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all",
                  "flex items-center justify-center cursor-pointer"
                )}
                title={t("security.useBiometrics", "Usar Huella / FaceID")}
              >
                <Fingerprint className="h-6 w-6" />
              </button>
            ) : (
              <div className="h-14 w-14" />
            )}

            {/* Zero Button */}
            <button
              type="button"
              onClick={() => handleKeyPress("0")}
              className={cn(
                "h-14 w-14 mx-auto rounded-2xl bg-zinc-900/80 border border-zinc-800",
                "text-lg font-bold text-white hover:bg-zinc-800 active:scale-95",
                "transition-all flex items-center justify-center cursor-pointer shadow-sm"
              )}
            >
              0
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={handleDelete}
              className={cn(
                "h-14 w-14 mx-auto rounded-2xl bg-zinc-900/80 border border-zinc-800",
                "text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95",
                "transition-all flex items-center justify-center cursor-pointer"
              )}
              title={t("security.delete", "Borrar")}
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleUnlockWithPassword} className="space-y-4 w-full">
            <div className="relative">
              <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
              <Input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 text-left text-sm font-semibold rounded-xl h-11 bg-zinc-900 border-zinc-800 text-white"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full h-11 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-md"
            >
              {loading
                ? t("security.verifying", "Verificando...")
                : t("security.unlockWithPasswordAction", "Desbloquear con Contraseña")}
            </Button>
          </form>
        )}

        {/* Footer Mode Switcher */}
        <div className="pt-3 border-t border-zinc-800 w-full">
          {mode === "pin" ? (
            <button
              type="button"
              onClick={() => {
                setMode("password");
                setErrorMsg("");
              }}
              className="text-xs font-semibold text-amber-400 hover:underline transition-all"
            >
              {t("security.forgotPin", "¿Olvidaste tu PIN? Usar Contraseña")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("pin");
                setErrorMsg("");
              }}
              className="text-xs font-semibold text-amber-400 hover:underline transition-all"
            >
              {t("security.usePinMode", "Volver al bloqueo por PIN")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
