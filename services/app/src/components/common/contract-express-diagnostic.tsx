"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Activity,
  Server,
  Cpu,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { runLiveContractDiagnostic } from "@/actions/contracts";
import { cn } from "@/lib/utils";
import type { Contract, MikrotikLiveDiagnostic, TrafficLightColor } from "@/types";

interface TrafficLightConfig {
  bgLight: string;
  borderLight: string;
  textColor: string;
  pulseColor: string;
  badgeBg: string;
  badgeText: string;
  icon: typeof CheckCircle2;
  label: string;
}

export const TRAFFIC_LIGHT_STYLES: Record<TrafficLightColor, TrafficLightConfig> = {
  GREEN: {
    bgLight: "bg-emerald-500/10 dark:bg-emerald-950/25",
    borderLight: "border-emerald-500/30 dark:border-emerald-500/25",
    textColor: "text-emerald-700 dark:text-emerald-300",
    pulseColor: "bg-emerald-500",
    badgeBg: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
    label: "ÓPTIMO / EN LÍNEA",
  },
  YELLOW: {
    bgLight: "bg-amber-500/10 dark:bg-amber-950/25",
    borderLight: "border-amber-500/30 dark:border-amber-500/25",
    textColor: "text-amber-700 dark:text-amber-300",
    pulseColor: "bg-amber-500",
    badgeBg: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    badgeText: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
    label: "ATENCIÓN / DEGRADADO",
  },
  RED: {
    bgLight: "bg-rose-500/10 dark:bg-rose-950/25",
    borderLight: "border-rose-500/30 dark:border-rose-500/25",
    textColor: "text-rose-700 dark:text-rose-300",
    pulseColor: "bg-rose-500",
    badgeBg: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
    badgeText: "text-rose-600 dark:text-rose-400",
    icon: XCircle,
    label: "FALLA / DESCONECTADO",
  },
};

export function resolveTrafficLight(
  diag?: MikrotikLiveDiagnostic | null
): TrafficLightColor {
  if (!diag) return "RED";
  if (diag.trafficLight) return diag.trafficLight;
  if (!diag.connected || diag.secretDisabled || !diag.sessionFound) {
    return "RED";
  }
  if (diag.latencyMs !== undefined && diag.latencyMs >= 80) {
    return "YELLOW";
  }
  return "GREEN";
}

interface DiagnosticBadgeProps {
  diagnostic?: MikrotikLiveDiagnostic | null;
  size?: "sm" | "md";
  className?: string;
}

export function ContractExpressDiagnosticBadge({
  diagnostic,
  size = "sm",
  className,
}: DiagnosticBadgeProps) {
  const color = resolveTrafficLight(diagnostic);
  const cfg = TRAFFIC_LIGHT_STYLES[color];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-mono font-bold tracking-tight",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        cfg.bgLight,
        cfg.borderLight,
        cfg.textColor,
        "border",
        className
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            cfg.pulseColor
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            cfg.pulseColor
          )}
        />
      </span>
      <span>{cfg.label}</span>
      {diagnostic?.latencyMs !== undefined && (
        <span className="opacity-80">({diagnostic.latencyMs}ms)</span>
      )}
    </span>
  );
}

interface DiagnosticCardProps {
  contract: Contract;
  diagnostic?: MikrotikLiveDiagnostic | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function ContractExpressDiagnosticCard({
  contract,
  diagnostic,
  isLoading = false,
  onRefresh,
  className,
}: DiagnosticCardProps) {
  const color = resolveTrafficLight(diagnostic);
  const cfg = TRAFFIC_LIGHT_STYLES[color];
  const IconComponent = cfg.icon;

  return (
    <div className={cn("space-y-3.5", className)}>
      {/* Semáforo Express Banner */}
      <div
        className={cn(
          "p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden",
          cfg.bgLight,
          cfg.borderLight
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs",
                "bg-white/80 dark:bg-zinc-900 border",
                cfg.borderLight
              )}
            >
              <IconComponent className={cn("h-6 w-6", cfg.textColor)} />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg",
                    cfg.badgeBg
                  )}
                >
                  {cfg.label}
                </span>

                {diagnostic?.latencyMs !== undefined && (
                  <span className="text-[11px] font-mono font-bold text-zinc-500">
                    Latencia API: {diagnostic.latencyMs} ms
                  </span>
                )}
              </div>

              <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                {diagnostic?.trafficSummary ||
                  (diagnostic?.sessionFound
                    ? "Enlace activo y navegando en MikroTik."
                    : "Sin sesión activa en RouterOS.")}
              </h4>

              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {diagnostic?.trafficRecommendation ||
                  "Verifica el suministro de energía o el estado de la fibra."}
              </p>
            </div>
          </div>

          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={onRefresh}
              className={cn(
                "h-8 text-xs font-semibold rounded-xl px-2.5 shrink-0 transition-colors",
                "bg-white/80 dark:bg-zinc-900 hover:bg-zinc-100"
              )}
              title="Volver a consultar MikroTik en tiempo real"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")}
              />
              {isLoading ? "Consultando..." : "Diagnosticar"}
            </Button>
          )}
        </div>
      </div>

      {/* 3 Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        {/* Card 1: Enlace Físico & Sesión */}
        <div
          className={cn(
            "p-3 rounded-xl border bg-white dark:bg-zinc-900/70",
            "border-zinc-200 dark:border-zinc-800 space-y-1.5"
          )}
        >
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-semibold">
            <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            <span>Enlace Físico / ONU</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Uptime:</span>
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                {diagnostic?.session?.uptime || "0s (Offline)"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">IP Remota:</span>
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate">
                {diagnostic?.session?.address ||
                  contract.ipAddress ||
                  "Sin asignar"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">MAC / Caller:</span>
              <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 truncate">
                {diagnostic?.session?.callerId ||
                  diagnostic?.lastCallerId ||
                  "N/D"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Autenticación PPPoE */}
        <div
          className={cn(
            "p-3 rounded-xl border bg-white dark:bg-zinc-900/70",
            "border-zinc-200 dark:border-zinc-800 space-y-1.5"
          )}
        >
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-semibold">
            <Cpu className="h-3.5 w-3.5 text-blue-500" />
            <span>Autenticación PPPoE</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Usuario:</span>
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate">
                {contract.pppoeUser || "Sin PPPoE"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Secret:</span>
              <span
                className={cn(
                  "font-bold text-[11px]",
                  diagnostic?.secretFound
                    ? diagnostic.secretDisabled
                      ? "text-rose-600"
                      : "text-emerald-600"
                    : "text-zinc-400"
                )}
              >
                {diagnostic?.secretFound
                  ? diagnostic.secretDisabled
                    ? "Deshabilitado"
                    : "Habilitado"
                  : "No encontrado"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Perfil:</span>
              <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 truncate">
                {diagnostic?.secretProfile || contract.plan?.name || "Default"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Nodo & Causa de Corte */}
        <div
          className={cn(
            "p-3 rounded-xl border bg-white dark:bg-zinc-900/70",
            "border-zinc-200 dark:border-zinc-800 space-y-1.5"
          )}
        >
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-semibold">
            <Server className="h-3.5 w-3.5 text-purple-500" />
            <span>Nodo & Eventos</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Router:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                {contract.node?.name || "Sin nodo"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Última caída:</span>
              <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 truncate">
                {diagnostic?.lastLoggedOut || "Sin registro"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Causa:</span>
              <span
                className="font-medium text-[10px] text-zinc-600 dark:text-zinc-400 truncate"
                title={diagnostic?.lastDisconnectReason || ""}
              >
                {diagnostic?.lastDisconnectReason || "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DiagnosticModalProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContractExpressDiagnosticModal({
  contract,
  open,
  onOpenChange,
}: DiagnosticModalProps) {
  const [diagnostic, setDiagnostic] = useState<MikrotikLiveDiagnostic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchDiagnostic = useCallback(async () => {
    if (!contract?.id) return;
    setIsLoading(true);
    try {
      const res = await runLiveContractDiagnostic(contract.id);
      if (res.success && res.data) {
        setDiagnostic(res.data);
      } else {
        setDiagnostic({
          connected: false,
          targetHost: "",
          targetPort: 0,
          sessionFound: false,
          error: res.error || "No se pudo conectar al nodo.",
          trafficLight: "RED",
          trafficSummary: res.error || "Error al conectar con MikroTik.",
          trafficRecommendation:
            "Revisa que el router esté online y que el puerto API esté accesible.",
        });
      }
    } catch (_err) {
      setDiagnostic({
        connected: false,
        targetHost: "",
        targetPort: 0,
        sessionFound: false,
        error: "Error inesperado al ejecutar diagnóstico.",
        trafficLight: "RED",
        trafficSummary: "Error inesperado al conectar.",
        trafficRecommendation: "Intenta de nuevo en unos momentos.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [contract?.id]);

  useEffect(() => {
    if (open && contract?.id) {
      setDiagnostic(null);
      fetchDiagnostic();
    }
  }, [open, contract?.id, fetchDiagnostic]);

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              <span>Diagnóstico Express de Enlace</span>
            </div>
            <span className="text-xs font-mono text-zinc-400 font-normal mr-6">
              #{contract.contractNumber}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          <div className="text-xs text-zinc-500">
            Abonado:{" "}
            <span className="font-bold text-zinc-800 dark:text-zinc-200">
              {contract.client?.fullName}
            </span>{" "}
            &bull; Nodo:{" "}
            <span className="font-bold text-zinc-800 dark:text-zinc-200">
              {contract.node?.name || "Sin nodo"}
            </span>
          </div>

          <ContractExpressDiagnosticCard
            contract={contract}
            diagnostic={diagnostic}
            isLoading={isLoading}
            onRefresh={fetchDiagnostic}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
