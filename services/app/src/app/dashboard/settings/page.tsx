"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  User as UserIcon,
  Shield,
  Lock,
  Loader2,
  Globe,
  Palette,
  Info,
  Sparkles,
  ShieldCheck,
  Trash2,
  Terminal,
  Smartphone,
  Monitor,
  Fingerprint,
  MessageSquare,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  PhoneCall,
  Unlink,
  X,
  Building2,
  Eye,
  EyeOff,
  Copy,
  Server,
  CreditCard,
} from "lucide-react";

import { useBrand } from "@/context/brand-context";

import { useTranslation } from "@/components/providers/i18n-provider";
import { LanguageSelector } from "@/components/layout/language-selector";
import { PaymentGatewaysTab } from "@/components/settings/payment-gateways-tab";
import { updateProfile, changePassword } from "@/actions/auth";
import {
  getRecentLoginHistoryAction,
  type LoginAuditItem,
} from "@/actions/security";
import {
  getEvolutionStatusAction,
  connectEvolutionAction,
  disconnectEvolutionAction,
  sendTestMessageAction,
  getWhatsappFullConfigAction,
  saveWhatsappFullConfigAction,
} from "@/actions/evolution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FormattedDate } from "@/components/ui/formatted-date";
import { FEATURES } from "@/lib/config/features";
import type { WhatsappStatusData } from "@/types";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: session, update: updateSession } = useSession();
  const sessionUser = session?.user;

  const [activeTab, setActiveTab] = useState("profile");

  // Profile Form state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("America/Bogota");
  const [locale, setLocale] = useState("es");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // PIN & Biometrics state
  const [pin, setPin] = useState("");
  const [inputPin, setInputPin] = useState("");
  const [biometrics, setBiometrics] = useState(false);
  const [isPwa, setIsPwa] = useState(false);

  // Login Audit History state
  const [loginLogs, setLoginLogs] = useState<LoginAuditItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Brand Context (Synchronized strictly with sidebar selection)
  const { activeBrandId, activeBrand, isSuperAdmin } = useBrand();
  const isGlobalMode = isSuperAdmin && (activeBrandId === "ALL" || !activeBrand);
  const currentWhatsappBrand = !isGlobalMode ? activeBrand : null;
  const effectiveBrandId = !isGlobalMode && activeBrand ? activeBrand.id : undefined;

  // WhatsApp / Evolution API & Meta Cloud API state
  const [whatsappStatus, setWhatsappStatus] =
    useState<WhatsappStatusData | null>(null);
  const [whatsappProvider, setWhatsappProvider] =
    useState<"EVOLUTION" | "META_CLOUD">("EVOLUTION");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaWabaId, setMetaWabaId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaWebhookVerifyToken, setMetaWebhookVerifyToken] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [evolutionInstanceName, setEvolutionInstanceName] = useState("");
  const [evolutionToken, setEvolutionToken] = useState("");
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [showMetaSecret, setShowMetaSecret] = useState(false);
  const [isSavingWhatsappConfig, setIsSavingWhatsappConfig] = useState(false);
  const [isLoadingWhatsapp, setIsLoadingWhatsapp] = useState(false);
  const [isConnectingWhatsapp, setIsConnectingWhatsapp] = useState(false);
  const [isDisconnectingWhatsapp, setIsDisconnectingWhatsapp] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  const fetchLoginHistory = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await getRecentLoginHistoryAction(10);
      if (res.success && res.data) {
        setLoginLogs(res.data);
      }
    } catch (_err) {
      // Ignore login audit load errors
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  const fetchWhatsappStatus = useCallback(
    async (brandIdToQuery?: string) => {
      const target = brandIdToQuery || effectiveBrandId;
      if (!target) {
        setWhatsappStatus(null);
        return;
      }
      setIsLoadingWhatsapp(true);
      try {
        const [statusRes, configRes] = await Promise.all([
          getEvolutionStatusAction(target),
          getWhatsappFullConfigAction(target),
        ]);

        if (statusRes.success && statusRes.data) {
          setWhatsappStatus(statusRes.data);
        }

        if (configRes.success && configRes.data) {
          const cfg = configRes.data;
          setWhatsappProvider(cfg.provider || "EVOLUTION");
          setEvolutionInstanceName(cfg.instanceName || "");
          setEvolutionToken(cfg.evolutionToken || "");
          setMetaPhoneNumberId(cfg.metaPhoneNumberId || "");
          setMetaWabaId(cfg.metaWabaId || "");
          setMetaAccessToken(cfg.metaAccessToken || "");
          setMetaWebhookVerifyToken(cfg.metaWebhookVerifyToken || "");
          setMetaAppSecret(cfg.metaAppSecret || "");
        }
      } catch (_err) {
        // Ignore status fetch error
      } finally {
        setIsLoadingWhatsapp(false);
      }
    },
    [effectiveBrandId]
  );

  const userName = sessionUser?.name;
  const userTimezone = sessionUser?.timezone;
  const userLocale = (sessionUser as { locale?: string })?.locale;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");
      setIsPwa(isStandalone);
    }

    if (sessionUser) {
      setName(userName ?? "");
      setTimezone(userTimezone ?? "America/Bogota");
      setLocale(userLocale ?? "es");
    }
    try {
      const savedPin = localStorage.getItem("pwa_screen_lock_pin");
      if (savedPin) setPin(savedPin);

      const bioState = localStorage.getItem("pwa_screen_lock_biometrics");
      if (bioState === "true") setBiometrics(true);
    } catch (_e) {}
  }, [userName, userTimezone, userLocale]);

  useEffect(() => {
    if (activeTab === "security") {
      fetchLoginHistory();
    } else if (activeTab === "whatsapp") {
      fetchWhatsappStatus();
    }
  }, [activeTab, effectiveBrandId, fetchLoginHistory, fetchWhatsappStatus]);

  // Auto-polling for WhatsApp status when connecting
  useEffect(() => {
    if (
      activeTab === "whatsapp" &&
      whatsappStatus?.connectionStatus === "connecting"
    ) {
      const timer = setInterval(() => {
        fetchWhatsappStatus();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [activeTab, whatsappStatus?.connectionStatus, fetchWhatsappStatus]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await updateProfile({
        name,
        bio,
        timezone,
        locale,
      });

      if (res.success) {
        toast.success(
          t("settings.profileUpdateSuccess", "Perfil actualizado correctamente")
        );
        try {
          localStorage.setItem("NEXT_LOCALE", locale);
          document.cookie =
            `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
        } catch (_storageErr) {}

        await updateSession({
          user: {
            name,
            timezone,
            locale,
          },
        });
      } else {
        toast.error(
          res.error ?? t("common.errorGeneric", "Error al actualizar perfil")
        );
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error al actualizar perfil"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(
        t("settings.passwordMismatch", "Las contraseñas no coinciden")
      );
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword({
        currentPassword,
        newPassword,
      });

      if (res.success) {
        toast.success(
          t(
            "settings.passwordChangeSuccess",
            "Contraseña cambiada correctamente"
          )
        );
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(
          res.error ?? t("common.errorGeneric", "Error al cambiar contraseña")
        );
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error al cambiar contraseña"));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSavePin = () => {
    if (inputPin.trim().length >= 4) {
      const cleanPin = inputPin.trim();
      localStorage.setItem("pwa_screen_lock_pin", cleanPin);
      setPin(cleanPin);
      setInputPin("");
      window.dispatchEvent(new Event("pin-state-changed"));
      toast.success(t("settings.pinSaved", "PIN guardado correctamente"));
    }
  };

  const handleRemovePin = () => {
    localStorage.removeItem("pwa_screen_lock_pin");
    localStorage.removeItem("pwa_screen_lock_biometrics");
    setPin("");
    setBiometrics(false);
    window.dispatchEvent(new Event("pin-state-changed"));
    toast.success(t("settings.pinRemoved", "PIN eliminado"));
  };

  const handleToggleBiometrics = async () => {
    if (biometrics) {
      setBiometrics(false);
      localStorage.setItem("pwa_screen_lock_biometrics", "false");
      toast.info(t("settings.bioDisabled", "Biometría desactivada."));
      return;
    }

    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      toast.error(
        t("settings.bioUnsupported", "Tu navegador no soporta WebAuthn.")
      );
      return;
    }

    try {
      const available =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        toast.error(
          t(
            "settings.bioUnavailable",
            "No se encontró lector de huella o FaceID en este dispositivo."
          )
        );
        return;
      }

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const cred = (await navigator.credentials.create({
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
      })) as PublicKeyCredential | null;

      if (cred?.rawId) {
        const bytes = new Uint8Array(cred.rawId);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const credIdStr = btoa(binary)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");
        localStorage.setItem("pwa_biometric_cred_id", credIdStr);
      }

      setBiometrics(true);
      localStorage.setItem("pwa_screen_lock_biometrics", "true");
      toast.success(
        t("settings.bioSuccess", "¡Huella / FaceID verificada y activada!")
      );
    } catch (_err) {
      toast.error(
        t("settings.bioFailed", "Cancelación o fallo al verificar biometría.")
      );
    }
  };

  const handleConnectWhatsapp = async () => {
    if (!effectiveBrandId) {
      toast.error("Selecciona una marca para conectar WhatsApp");
      return;
    }
    setIsConnectingWhatsapp(true);
    try {
      const res = await connectEvolutionAction(effectiveBrandId);
      if (res.success && res.data) {
        setWhatsappStatus(res.data);
        toast.success("Código QR generado. Escanéalo en WhatsApp Móvil.");
      } else {
        toast.error(res.error || "Fallo al generar QR Code");
      }
    } catch (_err) {
      toast.error("Error al conectar con Evolution API");
    } finally {
      setIsConnectingWhatsapp(false);
    }
  };

  const handleDisconnectWhatsapp = async () => {
    if (!effectiveBrandId) return;
    setIsDisconnectingWhatsapp(true);
    try {
      const res = await disconnectEvolutionAction(effectiveBrandId);
      if (res.success) {
        setWhatsappStatus((prev) =>
          prev
            ? {
                ...prev,
                qrCode: null,
                connectionStatus: "close",
                phoneNumber: null,
              }
            : null
        );
        toast.success("WhatsApp desvinculado correctamente.");
        fetchWhatsappStatus();
      } else {
        toast.error(res.error || "Fallo al desvincular");
      }
    } catch (_err) {
      toast.error("Error al desvincular WhatsApp");
    } finally {
      setIsDisconnectingWhatsapp(false);
    }
  };

  const handleCancelQr = () => {
    setWhatsappStatus((prev) =>
      prev ? { ...prev, qrCode: null, connectionStatus: "close" } : null
    );
    toast.info("Generación de QR cancelada.");
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;

    setIsSendingTest(true);
    try {
      const res = await sendTestMessageAction(testPhone, effectiveBrandId);
      if (res.success) {
        toast.success("Mensaje de prueba enviado por WhatsApp");
        setTestPhone("");
      } else {
        toast.error(res.error || "Error al enviar mensaje de prueba");
      }
    } catch (_err) {
      toast.error("Error de conexión");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSaveWhatsappConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBrandId) {
      toast.error(t("common.error", "Selecciona una marca válida"));
      return;
    }
    setIsSavingWhatsappConfig(true);
    try {
      const res = await saveWhatsappFullConfigAction({
        brandId: effectiveBrandId,
        provider: whatsappProvider,
        instanceName: evolutionInstanceName || undefined,
        evolutionToken: evolutionToken || undefined,
        metaPhoneNumberId: metaPhoneNumberId || undefined,
        metaWabaId: metaWabaId || undefined,
        metaAccessToken: metaAccessToken || undefined,
        metaWebhookVerifyToken: metaWebhookVerifyToken || undefined,
        metaAppSecret: metaAppSecret || undefined,
      });

      if (res.success) {
        toast.success(
          t(
            "settings.saveSuccess",
            "Configuración de WhatsApp guardada exitosamente"
          )
        );
        await fetchWhatsappStatus(effectiveBrandId);
      } else {
        toast.error(res.error || "Error al guardar configuración");
      }
    } catch (_err) {
      toast.error("Error al guardar configuración");
    } finally {
      setIsSavingWhatsappConfig(false);
    }
  };

  const handleGenerateVerifyToken = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "kont_meta_";
    for (let i = 0; i < 24; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setMetaWebhookVerifyToken(token);
    toast.success("Nuevo token de verificación generado");
  };

  const handleCopyWebhookUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/v1/webhook/whatsapp`;
    navigator.clipboard.writeText(url);
    toast.success(
      t(
        "settings.copiedWebhookUrl",
        "URL del Webhook copiada al portapapeles"
      )
    );
  };

  const handleLaunchWalkthrough = () => {
    window.dispatchEvent(new Event("open-walkthrough-wizard"));
  };

  const handleTestLock = () => {
    window.dispatchEvent(new Event("lock-screen-trigger"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          {t("settings.title", "Configuración")}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          {t(
            "settings.subtitle",
            "Personaliza las preferencias locales del sistema y la interfaz."
          )}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList
          className="bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl w-full
                     grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 h-auto"
        >
          <TabsTrigger
            value="profile"
            className="rounded-xl text-xs font-bold gap-2 justify-center px-2 py-2.5
                       data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800
                       data-[state=active]:shadow-sm"
          >
            <UserIcon className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="truncate">{t("settings.tabProfile", "Perfil")}</span>
          </TabsTrigger>

          <TabsTrigger
            value="security"
            className="rounded-xl text-xs font-bold gap-2 justify-center px-2 py-2.5
                       data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800
                       data-[state=active]:shadow-sm"
          >
            <Shield className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="truncate">
              <span className="hidden sm:inline">
                {t("settings.tabSecurity", "Seguridad & PIN")}
              </span>
              <span className="sm:hidden">
                {t("settings.tabSecurityShort", "Seguridad")}
              </span>
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="whatsapp"
            className={cn(
              "rounded-xl text-xs font-bold gap-2 justify-center px-2 py-2.5",
              "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800",
              "data-[state=active]:shadow-sm transition-all",
              isGlobalMode && "opacity-60"
            )}
          >
            <MessageSquare
              className={cn(
                "h-4 w-4 shrink-0",
                isGlobalMode ? "text-zinc-400" : "text-emerald-500"
              )}
            />
            <span className="truncate flex items-center gap-1.5">
              <span className="hidden sm:inline">
                {t("settings.tabWhatsapp", "WhatsApp (Evolution API)")}
              </span>
              <span className="sm:hidden">WhatsApp</span>
              {isGlobalMode && (
                <span
                  className={
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-md " +
                    "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                  }
                >
                  Global
                </span>
              )}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="payments"
            className={cn(
              "rounded-xl text-xs font-bold gap-2 justify-center px-2 py-2.5",
              "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800",
              "data-[state=active]:shadow-sm transition-all",
              isGlobalMode && "opacity-60"
            )}
          >
            <CreditCard
              className={cn(
                "h-4 w-4 shrink-0",
                isGlobalMode ? "text-zinc-400" : "text-emerald-500"
              )}
            />
            <span className="truncate flex items-center gap-1.5">
              <span className="hidden sm:inline">
                {t("settings.tabPayments", "Pasarelas de Pago")}
              </span>
              <span className="sm:hidden">
                {t("settings.tabPaymentsShort", "Pasarelas")}
              </span>
              {isGlobalMode && (
                <span
                  className={
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-md " +
                    "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                  }
                >
                  Global
                </span>
              )}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="appearance"
            className="rounded-xl text-xs font-bold gap-2 justify-center px-2 py-2.5
                       data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800
                       data-[state=active]:shadow-sm"
          >
            <Palette className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="truncate">
              <span className="hidden sm:inline">
                {t("settings.tabAppearance", "Apariencia e Idioma")}
              </span>
              <span className="sm:hidden">
                {t("settings.tabAppearanceShort", "Apariencia")}
              </span>
            </span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PROFILE */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-emerald-500" />
                <span>{t("settings.userProfileTitle", "Perfil de Usuario")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold">
                    {t("settings.fullNameLabel", "Nombre Completo")}
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl h-10 text-xs"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold">
                    {t("settings.readOnlyEmailLabel", "Correo Electrónico")}
                  </Label>
                  <Input
                    id="email"
                    value={sessionUser?.email ?? ""}
                    disabled
                    className="rounded-xl h-10 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-xs font-bold">
                    {t("settings.bioLabel", "Biografía / Notas")}
                  </Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t(
                      "settings.bioPlaceholder",
                      "Información adicional sobre tu rol..."
                    )}
                    className="rounded-xl text-xs min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-xs font-bold">
                      {t("settings.userTimezoneLabel", "Zona Horaria")}
                    </Label>
                    <select
                      id="timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className={cn(
                        "w-full rounded-xl h-10 text-xs px-3",
                        "border border-zinc-200 dark:border-zinc-800",
                        "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                      )}
                    >
                      <option value="America/Bogota">Bogotá, Lima, Quito (UTC-5)</option>
                      <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
                      <option value="America/Caracas">Caracas (UTC-4)</option>
                      <option value="America/Santiago">Santiago de Chile (UTC-3/4)</option>
                      <option value="America/Argentina/Buenos_Aires">
                        Buenos Aires (UTC-3)
                      </option>
                      <option value="America/La_Paz">La Paz (UTC-4)</option>
                      <option value="America/Panama">Panamá (UTC-5)</option>
                      <option value="America/Costa_Rica">Costa Rica (UTC-6)</option>
                      <option value="America/Guatemala">Guatemala (UTC-6)</option>
                      <option value="America/Santo_Domingo">Santo Domingo (UTC-4)</option>
                      <option value="UTC">Tiempo Universal Coordinado (UTC)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="locale" className="text-xs font-bold">
                      {t("settings.userLanguageLabel", "Idioma de Preferencia")}
                    </Label>
                    <select
                      id="locale"
                      value={locale}
                      onChange={(e) => setLocale(e.target.value)}
                      className={cn(
                        "w-full rounded-xl h-10 text-xs px-3",
                        "border border-zinc-200 dark:border-zinc-800",
                        "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                      )}
                    >
                      <option value="es">🇪🇸 Español (es)</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold text-xs h-10 px-5 rounded-xl shadow-sm"
                >
                  {isSavingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserIcon className="h-4 w-4" />
                  )}
                  <span>{t("settings.btnSaveProfile", "Guardar Perfil")}</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: SECURITY */}
        <TabsContent value="security" className="space-y-6">
          {/* Change Password */}
          <Card className="border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-500" />
                <span>{t("settings.changePasswordTitle", "Cambiar Contraseña")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-xs font-bold">
                    {t("settings.currentPasswordLabel", "Contraseña Actual")}
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    maxLength={100}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="rounded-xl h-10 text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-xs font-bold">
                      {t("settings.newPasswordLabel", "Nueva Contraseña")}
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      maxLength={100}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="rounded-xl h-10 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs font-bold">
                      {t("settings.confirmPasswordLabel", "Confirmar Nueva Contraseña")}
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      maxLength={100}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="rounded-xl h-10 text-xs"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isChangingPassword}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-bold text-xs h-10 px-5 rounded-xl shadow-sm"
                >
                  {isChangingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                  <span>{t("settings.btnUpdatePassword", "Actualizar Contraseña")}</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* PIN Lock Card */}
          {FEATURES.screenLock && (
            <Card className="border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur rounded-3xl shadow-sm overflow-hidden">
              <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Lock className="h-5 w-5 text-amber-500" />
                  <span>
                    {t("settings.secTitle", "Seguridad y Bloqueo de Pantalla")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t(
                    "settings.secSub",
                    "Configura un PIN local o biometría para proteger el acceso a la app."
                  )}
                </p>

                {pin ? (
                  <div className="space-y-3 pt-1">
                    {/* Status Banner */}
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-extrabold text-emerald-950 dark:text-emerald-200">
                          {t("settings.pinActive", "PIN de Seguridad Activado")}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 border-emerald-500/30">
                        Protegido
                      </Badge>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-row items-center gap-2.5 [&>button]:flex-1 sm:[&>button]:flex-none sm:justify-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemovePin}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 h-9 rounded-xl font-semibold gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        <span>{t("settings.btnRemovePin", "Eliminar PIN")}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestLock}
                        className="text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-300 dark:border-amber-800/60 h-9 rounded-xl font-semibold gap-1.5"
                      >
                        <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>{t("settings.btnTestLock", "Bloquear Ahora")}</span>
                      </Button>
                    </div>

                    {isPwa && (
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                          <Fingerprint className="h-4 w-4 text-emerald-500" />
                          <span>
                            {t(
                              "settings.enableBiometrics",
                              "Habilitar Huella / FaceID (PWA)"
                            )}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={biometrics}
                          onChange={handleToggleBiometrics}
                          className="h-4 w-4 accent-emerald-500 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="inputPin" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Crear PIN de Seguridad (4 a 6 dígitos)
                    </Label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <input
                        id="inputPin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={inputPin}
                        onChange={(e) =>
                          setInputPin(e.target.value.replace(/\D/g, ""))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleSavePin()}
                        placeholder="Ingresa 4 a 6 dígitos..."
                        className="w-full sm:w-56 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-mono tracking-widest text-center shadow-sm"
                      />
                      <Button
                        type="button"
                        onClick={handleSavePin}
                        disabled={inputPin.trim().length < 4}
                        className="h-11 sm:h-10 gap-2 font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 disabled:opacity-50 shrink-0"
                      >
                        <Lock className="h-4 w-4" />
                        <span>{t("settings.btnSetPin", "Guardar PIN")}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Login Audit History Card */}
          <Card className="border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-emerald-500" />
                  <span>
                    {t(
                      "settings.loginHistoryTitle",
                      "Historial de Inicios de Sesión y Auditoría"
                    )}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
                  Últimos 10
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3">
              {isLoadingLogs ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton
                      key={`log-skel-${i}`}
                      className="h-14 w-full rounded-2xl"
                    />
                  ))}
                </div>
              ) : loginLogs.length === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950 text-center text-zinc-500 text-xs font-semibold">
                  {t(
                    "settings.loginHistoryEmpty",
                    "No hay registros de inicio de sesión auditados."
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {loginLogs.map((log) => {
                    const isMobile = log.device === "Móvil";
                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {isMobile ? (
                              <Smartphone className="h-4 w-4" />
                            ) : (
                              <Monitor className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-900 dark:text-white">
                              {log.device} • {log.browser}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-mono">
                              IP: {log.ip || "127.0.0.1"}
                            </p>
                          </div>
                        </div>
                        <FormattedDate
                          date={log.createdAt}
                          format="relative"
                          className="text-[11px] font-semibold text-zinc-500"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: WHATSAPP / EVOLUTION API */}
        <TabsContent value="whatsapp" className="space-y-6">
          <Card className="border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-emerald-500" />
                  <span>
                    {t(
                      "settings.whatsappTitle",
                      "Canal de WhatsApp (Evolution API)"
                    )}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchWhatsappStatus(effectiveBrandId)}
                  disabled={isLoadingWhatsapp || isGlobalMode}
                  className="h-8 text-xs gap-1.5 rounded-xl border-zinc-200 dark:border-zinc-800"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      isLoadingWhatsapp ? "animate-spin" : ""
                    }`}
                  />
                  <span>Actualizar</span>
                </Button>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t(
                  "settings.whatsappSub",
                  "Configura el canal oficial para el envío de notificaciones y recibos digitales."
                )}
              </p>

              {/* Global Mode Notice Banner */}
              {isGlobalMode && (
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
                          "settings.whatsappGlobalNoticeTitle",
                          "Gestión de WhatsApp no disponible en vista Global"
                        )}
                      </h4>
                      <p className="text-xs mt-0.5 text-amber-900 dark:text-amber-300">
                        {t(
                          "settings.whatsappGlobalNoticeDesc",
                          "Evolution API opera con una instancia aislada por empresa. Selecciona una marca específica en el selector del menú lateral para vincular o gestionar su línea."
                        )}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] shrink-0"
                  >
                    {t(
                      "settings.whatsappGlobalBadge",
                      "Requiere seleccionar marca en el menú"
                    )}
                  </Badge>
                </div>
              )}

              {/* Brand Indicator Bar (Synchronized with Sidebar) */}
              <div
                className={
                  "flex flex-col sm:flex-row sm:items-center " +
                  "justify-between gap-3 p-3.5 bg-zinc-50 " +
                  "dark:bg-zinc-950/60 rounded-2xl border " +
                  "border-zinc-200 dark:border-zinc-800"
                }
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0",
                      isGlobalMode
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {isGlobalMode ? (
                      <Globe className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <span
                      className={
                        "text-[10px] font-bold text-zinc-500 " +
                        "uppercase tracking-wider block"
                      }
                    >
                      {t("settings.whatsappBrandLabel", "Empresa / Marca ISP")}
                    </span>
                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                      {isGlobalMode
                        ? "Todas las Marcas (Global NOC)"
                        : currentWhatsappBrand?.name || "Sin marca seleccionada"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {isGlobalMode
                      ? "Modo Global (Sin marca activa)"
                      : `Slug: ${currentWhatsappBrand?.slug ?? "desconocido"}`}
                  </span>
                </div>
              </div>

              {/* WhatsApp Provider Selector (Filter Metric Cards Standard) */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {t(
                    "settings.whatsappProviderTitle",
                    "Proveedor de Conexión WhatsApp"
                  )}
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setWhatsappProvider("EVOLUTION")}
                    className={cn(
                      "cursor-pointer transition-all duration-200 border rounded-2xl p-4 space-y-1.5",
                      whatsappProvider === "EVOLUTION"
                        ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
                            "border-emerald-500 shadow-md"
                        : "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 " +
                            "hover:border-emerald-500/40 hover:shadow-xs"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        <QrCode className="h-4 w-4 text-emerald-500" />
                        <span>
                          {t(
                            "settings.providerEvolution",
                            "Evolution API (Gateway QR)"
                          )}
                        </span>
                      </div>
                      {whatsappProvider === "EVOLUTION" && (
                        <Badge className="bg-emerald-500 text-white text-[10px] h-5">
                          Activo
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {t(
                        "settings.providerEvolutionDesc",
                        "Sesión basada en Baileys mediante escaneo de código QR."
                      )}
                    </p>
                  </div>

                  <div
                    onClick={() => setWhatsappProvider("META_CLOUD")}
                    className={cn(
                      "cursor-pointer transition-all duration-200 border rounded-2xl p-4 space-y-1.5",
                      whatsappProvider === "META_CLOUD"
                        ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
                            "border-emerald-500 shadow-md"
                        : "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 " +
                            "hover:border-emerald-500/40 hover:shadow-xs"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        <Globe className="h-4 w-4 text-emerald-500" />
                        <span>
                          {t(
                            "settings.providerMeta",
                            "WhatsApp Cloud API (Meta Oficial)"
                          )}
                        </span>
                      </div>
                      {whatsappProvider === "META_CLOUD" && (
                        <Badge className="bg-emerald-500 text-white text-[10px] h-5">
                          Activo
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {t(
                        "settings.providerMetaDesc",
                        "Conexión directa empresarial con Meta sin depender de teléfono físico."
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* PANEL 1: META WHATSAPP CLOUD API CONFIGURATION */}
              {whatsappProvider === "META_CLOUD" && (
                <form
                  onSubmit={handleSaveWhatsappConfig}
                  className="space-y-5 p-5 bg-zinc-50/70 dark:bg-zinc-950/40 rounded-3xl border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Globe className="h-4 w-4 text-emerald-500" />
                        <span>
                          {t(
                            "settings.metaConfigTitle",
                            "Credenciales de WhatsApp Cloud API (Meta)"
                          )}
                        </span>
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {t(
                          "settings.metaConfigSub",
                          "Configura las llaves de tu aplicación en Meta for Developers."
                        )}
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSavingWhatsappConfig || isGlobalMode || !effectiveBrandId}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl gap-2 shadow-sm"
                    >
                      {isSavingWhatsappConfig ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>
                        {t(
                          "settings.btnSaveWhatsappConfig",
                          "Guardar Configuración Meta"
                        )}
                      </span>
                    </Button>
                  </div>

                  {/* Webhook Callback URL Notice Box */}
                  <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs space-y-1.5">
                    <p className="font-bold text-emerald-950 dark:text-emerald-100 flex items-center justify-between gap-2">
                      <span>
                        {t(
                          "settings.metaWebhookUrlTitle",
                          "URL del Webhook para Meta Developers"
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyWebhookUrl}
                        className="h-7 text-[11px] gap-1 rounded-lg text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar URL</span>
                      </Button>
                    </p>
                    <code className="block p-2 bg-white/80 dark:bg-zinc-900/80 rounded-xl font-mono text-[11px] text-zinc-800 dark:text-zinc-200 select-all break-all border border-emerald-500/20">
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/api/v1/webhook/whatsapp`
                        : "https://tudominio.com/api/v1/webhook/whatsapp"}
                    </code>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                      {t(
                        "settings.metaWebhookUrlDesc",
                        "Pega esta URL en el portal de Meta for Developers junto con tu Verify Token."
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="metaPhoneId"
                        className="text-xs font-bold text-zinc-700 dark:text-zinc-300"
                      >
                        {t(
                          "settings.metaPhoneNumberIdLabel",
                          "Phone Number ID"
                        )}
                      </Label>
                      <Input
                        id="metaPhoneId"
                        disabled={isGlobalMode || !effectiveBrandId}
                        placeholder={t(
                          "settings.metaPhoneNumberIdPlaceholder",
                          "Ej: 104829103948572"
                        )}
                        value={metaPhoneNumberId}
                        onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                        className="h-10 text-xs rounded-xl font-mono border-zinc-300 dark:border-zinc-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="metaWabaId"
                        className="text-xs font-bold text-zinc-700 dark:text-zinc-300"
                      >
                        {t(
                          "settings.metaWabaIdLabel",
                          "WABA ID (WhatsApp Business Account)"
                        )}
                      </Label>
                      <Input
                        id="metaWabaId"
                        disabled={isGlobalMode || !effectiveBrandId}
                        placeholder={t(
                          "settings.metaWabaIdPlaceholder",
                          "Ej: 194820194820194"
                        )}
                        value={metaWabaId}
                        onChange={(e) => setMetaWabaId(e.target.value)}
                        className="h-10 text-xs rounded-xl font-mono border-zinc-300 dark:border-zinc-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="metaToken"
                      className="text-xs font-bold text-zinc-700 dark:text-zinc-300"
                    >
                      {t(
                        "settings.metaAccessTokenLabel",
                        "Token de Acceso Permanente (System User Token)"
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        id="metaToken"
                        type={showMetaToken ? "text" : "password"}
                        disabled={isGlobalMode || !effectiveBrandId}
                        placeholder="EAA..."
                        value={metaAccessToken}
                        onChange={(e) => setMetaAccessToken(e.target.value)}
                        className="h-10 text-xs rounded-xl font-mono pr-10 border-zinc-300 dark:border-zinc-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMetaToken(!showMetaToken)}
                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        {showMetaToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="metaVerifyToken"
                          className="text-xs font-bold text-zinc-700 dark:text-zinc-300"
                        >
                          {t(
                            "settings.metaWebhookVerifyTokenLabel",
                            "Verify Token (Webhook)"
                          )}
                        </Label>
                        <button
                          type="button"
                          onClick={handleGenerateVerifyToken}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                        >
                          {t(
                            "settings.btnGenerateVerifyToken",
                            "Generar Token"
                          )}
                        </button>
                      </div>
                      <Input
                        id="metaVerifyToken"
                        maxLength={255}
                        disabled={isGlobalMode || !effectiveBrandId}
                        placeholder={t(
                          "settings.metaWebhookVerifyTokenPlaceholder",
                          "Clave secreta del webhook..."
                        )}
                        value={metaWebhookVerifyToken}
                        onChange={(e) =>
                          setMetaWebhookVerifyToken(e.target.value)
                        }
                        className="h-10 text-xs rounded-xl font-mono border-zinc-300 dark:border-zinc-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="metaAppSecret"
                        className="text-xs font-bold text-zinc-700 dark:text-zinc-300"
                      >
                        {t(
                          "settings.metaAppSecretLabel",
                          "App Secret (Firma SHA-256)"
                        )}
                      </Label>
                      <div className="relative">
                        <Input
                          id="metaAppSecret"
                          type={showMetaSecret ? "text" : "password"}
                          maxLength={255}
                          disabled={isGlobalMode || !effectiveBrandId}
                          placeholder={t(
                            "settings.metaAppSecretPlaceholder",
                            "Secreto de la app de Meta..."
                          )}
                          value={metaAppSecret}
                          onChange={(e) => setMetaAppSecret(e.target.value)}
                          className="h-10 text-xs rounded-xl font-mono pr-10 border-zinc-300 dark:border-zinc-700"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMetaSecret(!showMetaSecret)}
                          className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          {showMetaSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* PANEL 2: EVOLUTION API (BAILEYS / QR GATEWAY) */}
              {whatsappProvider === "EVOLUTION" && (
                <div className="space-y-5">
                  {/* Instance and Token Settings Box */}
                  <form
                    onSubmit={handleSaveWhatsappConfig}
                    className="p-4 bg-zinc-50/70 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Server className="h-4 w-4 text-emerald-500" />
                        <span>
                          {t(
                            "settings.evolutionConfigTitle",
                            "Configuración de Instancia Evolution API"
                          )}
                        </span>
                      </h4>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isSavingWhatsappConfig || isGlobalMode || !effectiveBrandId}
                        className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5"
                      >
                        {isSavingWhatsappConfig ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>Guardar Instancia</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label
                          htmlFor="evolutionInstance"
                          className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300"
                        >
                          {t(
                            "settings.evolutionInstanceNameLabel",
                            "Nombre de la Instancia"
                          )}
                        </Label>
                        <Input
                          id="evolutionInstance"
                          maxLength={100}
                          disabled={isGlobalMode || !effectiveBrandId}
                          placeholder="isp_serkoi"
                          value={evolutionInstanceName}
                          onChange={(e) =>
                            setEvolutionInstanceName(e.target.value)
                          }
                          className="h-9 text-xs font-mono rounded-xl border-zinc-300 dark:border-zinc-700"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label
                          htmlFor="evolutionTokenInput"
                          className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300"
                        >
                          {t(
                            "settings.evolutionTokenLabel",
                            "Token de Instancia (Evolution API)"
                          )}
                        </Label>
                        <Input
                          id="evolutionTokenInput"
                          maxLength={255}
                          disabled={isGlobalMode || !effectiveBrandId}
                          placeholder={t(
                            "settings.evolutionTokenPlaceholder",
                            "Hash de la instancia en Evolution Manager..."
                          )}
                          value={evolutionToken}
                          onChange={(e) => setEvolutionToken(e.target.value)}
                          className="h-9 text-xs font-mono rounded-xl border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                    </div>
                  </form>

              {/* Status Banner */}
              <div
                className={cn(
                  "p-4 rounded-2xl border transition-all space-y-3",
                  whatsappStatus?.connectionStatus === "open"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                    : whatsappStatus?.connectionStatus === "connecting"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
                      : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                )}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {whatsappStatus?.connectionStatus === "open" ? (
                      <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                    ) : whatsappStatus?.connectionStatus === "connecting" ? (
                      <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center shrink-0">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                        {whatsappStatus?.connectionStatus === "open"
                          ? t("settings.whatsappConnected", "Línea WhatsApp Oficial Conectada 🟢")
                          : whatsappStatus?.connectionStatus === "connecting"
                            ? t("settings.whatsappConnecting", "Esperando Escaneo de QR 🟡")
                            : t("settings.whatsappDisconnected", "Línea Desconectada 🔴")}
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {whatsappStatus?.connectionStatus === "open"
                          ? "Canal de mensajería listo para expedir comprobantes automáticamente."
                          : "Vincula el WhatsApp de la empresa ISP para habilitar el envío de recibos."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      className={
                        "text-xs font-mono font-semibold text-zinc-600 " +
                        "dark:text-zinc-400 border-zinc-300 dark:border-zinc-700"
                      }
                    >
                      Instancia:{" "}
                      {whatsappStatus?.instanceName ||
                        (currentWhatsappBrand
                          ? `isp_${currentWhatsappBrand.slug}`
                          : "isp_serkoi")}
                    </Badge>

                    {whatsappStatus?.connectionStatus === "open" &&
                      (whatsappStatus?.phoneNumber ? (
                        <Badge
                          className={
                            "bg-zinc-900 text-white dark:bg-zinc-100 " +
                            "dark:text-zinc-950 border border-zinc-700 " +
                            "dark:border-zinc-300 font-mono font-bold text-xs " +
                            "px-3 py-1.5 rounded-xl gap-1.5 shadow-sm"
                          }
                        >
                          📱 +{whatsappStatus.phoneNumber}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs font-mono font-bold text-amber-600 border-amber-500/30"
                        >
                          📱 Conectado
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>

              {/* Main Actions: Connect / Disconnect / QR Display */}
              {whatsappStatus?.connectionStatus === "open" ? (
                <div className="space-y-4">
                  <div
                    className={cn(
                      "p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20",
                      "text-emerald-800 dark:text-emerald-300 text-xs space-y-1"
                    )}
                  >
                    <p className="font-bold text-sm flex items-center justify-between flex-wrap gap-2">
                      <span>¡WhatsApp listo para enviar recibos!</span>
                      {whatsappStatus?.phoneNumber && (
                        <span
                          className={
                            "font-mono text-xs font-bold text-emerald-950 " +
                            "dark:text-emerald-100 bg-emerald-500/20 " +
                            "dark:bg-emerald-500/30 border border-emerald-500/30 " +
                            "px-2.5 py-1 rounded-lg"
                          }
                        >
                          📱 +{whatsappStatus.phoneNumber}
                        </span>
                      )}
                    </p>
                    <p>
                      Todos los cobros registrados en la sección de Pagos
                      ofrecerán la opción de enviar el comprobante digital
                      directamente al celular del alumno o acudiente.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={handleDisconnectWhatsapp}
                      disabled={isDisconnectingWhatsapp || isGlobalMode || !effectiveBrandId}
                      className={cn(
                        "text-rose-600 hover:text-rose-700 hover:bg-rose-50",
                        "dark:hover:bg-rose-950/30 border-rose-200",
                        "dark:border-rose-900/40 rounded-xl text-xs h-10 gap-2"
                      )}
                    >
                      {isDisconnectingWhatsapp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span>
                        {t("settings.btnDisconnectWhatsapp", "Desvincular Línea")}
                      </span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Single Primary Action when Disconnected */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <Button
                      onClick={handleConnectWhatsapp}
                      disabled={isConnectingWhatsapp || isGlobalMode || !effectiveBrandId}
                      className={cn(
                        "font-bold text-xs h-11 px-6 rounded-xl shadow-md gap-2.5 w-full sm:w-auto",
                        isGlobalMode
                          ? "bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                      )}
                    >
                      {isConnectingWhatsapp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4" />
                      )}
                      <span>
                        {t(
                          "settings.btnConnectWhatsapp",
                          "Conectar WhatsApp / Generar QR"
                        )}
                      </span>
                    </Button>

                    {whatsappStatus?.qrCode && (
                      <Button
                        variant="outline"
                        onClick={handleCancelQr}
                        className="rounded-xl text-xs h-11 px-4 gap-2 border-zinc-200 dark:border-zinc-800"
                      >
                        <X className="h-4 w-4" />
                        <span>{t("common.cancel", "Cancelar")}</span>
                      </Button>
                    )}
                  </div>

                  {/* QR Code Container */}
                  {whatsappStatus?.qrCode && (
                    <div
                      className="p-6 bg-white dark:bg-zinc-950 border border-zinc-200
                                 dark:border-zinc-800 rounded-3xl shadow-sm max-w-md
                                 space-y-4 text-center"
                    >
                      <div
                        className="font-bold text-xs text-zinc-900 dark:text-white
                                   uppercase tracking-wider flex items-center
                                   justify-between gap-2"
                      >
                        <span className="flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-emerald-500" />
                          <span>Escanea para vincular WhatsApp</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelQr}
                          className="h-7 text-[11px] text-zinc-500 hover:text-zinc-900
                                     dark:hover:text-white rounded-lg px-2 gap-1"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Cancelar</span>
                        </Button>
                      </div>

                      <div
                        className="flex justify-center p-3 bg-white rounded-2xl
                                   border border-zinc-200 inline-block mx-auto shadow-inner"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            whatsappStatus.qrCode.startsWith("data:")
                              ? whatsappStatus.qrCode
                              : `data:image/png;base64,${whatsappStatus.qrCode}`
                          }
                          alt="WhatsApp QR Code"
                          className="w-56 h-56 object-contain"
                        />
                      </div>

                      <div
                        className="text-left text-xs text-zinc-600 dark:text-zinc-400
                                   space-y-1.5 bg-zinc-50 dark:bg-zinc-900 p-4
                                   rounded-2xl border border-zinc-100 dark:border-zinc-800"
                      >
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">
                          {t(
                            "settings.qrInstructionsTitle",
                            "Instrucciones de Vinculación:"
                          )}
                        </p>
                        <p>
                          {t(
                            "settings.qrStep1",
                            "1. Abre la aplicación de WhatsApp en tu teléfono."
                          )}
                        </p>
                        <p>
                          {t(
                            "settings.qrStep2",
                            "2. Toca Menú ⋮ o Configuración ⚙️ y selecciona Dispositivos vinculados."
                          )}
                        </p>
                        <p>
                          {t(
                            "settings.qrStep3",
                            "3. Toca Vincular un dispositivo y escanea este código QR."
                          )}
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-2.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelQr}
                          className="rounded-xl text-xs h-9 px-4 border-zinc-200
                                     dark:border-zinc-800 gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Cancelar QR</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDisconnectWhatsapp}
                          disabled={isDisconnectingWhatsapp}
                          className="text-rose-600 hover:text-rose-700
                                     border-rose-200 dark:border-rose-900/50
                                     rounded-xl text-xs h-9 px-4 gap-1.5"
                        >
                          {isDisconnectingWhatsapp ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Unlink className="h-3.5 w-3.5" />
                          )}
                          <span>Desvincular</span>
                        </Button>
                      </div>

                      <p
                        className="text-[11px] text-amber-500 font-semibold animate-pulse
                                   flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Sincronizando estado de vinculación...</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
                </div>
              )}

              {/* Test WhatsApp Message Dispatch Card */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Send className="h-4 w-4 text-emerald-500" />
                  <span>Probar Envío de Recibo de Ejemplo</span>
                </h4>

                <form
                  onSubmit={handleSendTestMessage}
                  className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 max-w-lg"
                >
                  <div className="space-y-1.5 flex-1">
                    <Label htmlFor="testPhone" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {t("settings.testPhoneLabel", "Celular de Prueba (Colombia)")}
                    </Label>
                    <div className="relative">
                      <PhoneCall className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <Input
                        id="testPhone"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        disabled={isGlobalMode || !effectiveBrandId}
                        placeholder={t(
                          "settings.testPhonePlaceholder",
                          "Ej: 3001234567"
                        )}
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className="pl-9 h-10 text-xs rounded-xl border-zinc-300 dark:border-zinc-700"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSendingTest || !testPhone || isGlobalMode || !effectiveBrandId}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-5 rounded-xl gap-2 shadow-sm shrink-0 disabled:opacity-50"
                  >
                    {isSendingTest ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>
                      {t(
                        "settings.btnSendTestMessage",
                        "Enviar Comprobante de Prueba"
                      )}
                    </span>
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: APPEARANCE & LANGUAGE */}
        <TabsContent value="appearance" className="space-y-6">
          <Card className="border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                <span>{t("settings.langTitle", "Idioma y Región")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t(
                  "settings.langSub",
                  "Selecciona el idioma de la aplicación. Tu preferencia se guardará en LocalStorage."
                )}
              </p>
              <div className="pt-2 max-w-xs">
                <LanguageSelector />
              </div>
            </CardContent>
          </Card>

          {/* System Info & Walkthrough Launcher */}
          <Card className="border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                <span>
                  {t(
                    "settings.infoTitle",
                    "Información del Sistema & Tutorial"
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {t(
                  "settings.infoDesc",
                  "Plataforma multimarca para telecomunicaciones y gestión de nodos MikroTik."
                )}
              </p>
              <Button
                variant="outline"
                onClick={handleLaunchWalkthrough}
                className={
                  "gap-2 rounded-xl text-xs font-bold border-emerald-500/40 " +
                  "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                }
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {t(
                    "settings.btnLaunchWalkthrough",
                    "Iniciar Tutorial de Bienvenida"
                  )}
                </span>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: PASARELAS DE PAGO (COLOMBIA) */}
        <TabsContent value="payments" className="space-y-6">
          <PaymentGatewaysTab
            effectiveBrandId={effectiveBrandId}
            isGlobalMode={isGlobalMode}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
