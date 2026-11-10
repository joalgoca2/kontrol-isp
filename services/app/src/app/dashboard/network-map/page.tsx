"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  MapPin,
  RefreshCw,
  Search,
  Activity,
  Router,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Sparkles,
  X,
  Navigation,
  Copy,
  ExternalLink,
  Crosshair,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useBrand } from "@/context/brand-context";
import {
  getNetworkMapPoints,
  startBackgroundGeocoding,
  getGeocodingStatus,
  syncAllNetworkStatus,
  type MapPoint,
  type NetworkMapResponse,
} from "@/actions/network-map";
import {
  runLiveContractDiagnostic,
  syncContractTelemetry,
} from "@/actions/contracts";
import { GoogleMapView } from "@/components/network-map/google-map-view";
import {
  OsmMapView,
  type FocusTarget,
} from "@/components/network-map/osm-map-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MikrotikLiveDiagnostic } from "@/types";
import { cn } from "@/lib/utils";

export default function NetworkMapPage() {
  const { t } = useTranslation();
  const { activeBrandId } = useBrand();

  const [mapData, setMapData] = useState<NetworkMapResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);

  const configuredEngine =
    process.env.NEXT_PUBLIC_DEFAULT_MAP_ENGINE === "google"
      ? "google"
      : "osm";

  // Filters & State
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nodeFilter, setNodeFilter] = useState<string>("all");
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [engineMode, setEngineMode] =
    useState<"google" | "osm">(configuredEngine);

  // Geocoding Batch Execution
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  // Live Diagnostic Modal
  const [diagModalOpen, setDiagModalOpen] = useState<boolean>(false);
  const [diagLoading, setDiagLoading] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] =
    useState<MikrotikLiveDiagnostic | null>(null);
  const [isSyncingTelemetry, setIsSyncingTelemetry] = useState<boolean>(false);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);

  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getNetworkMapPoints(activeBrandId);
      if (res.success && res.data) {
        setMapData(res.data);
      } else {
        toast.error(res.error || "Error al cargar puntos de red.");
      }
    } catch (_err) {
      toast.error("Error de comunicación.");
    } finally {
      setIsLoading(false);
    }
  }, [activeBrandId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync engineMode from env if configured explicitly
  useEffect(() => {
    if (configuredEngine === "google" && googleApiKey) {
      setEngineMode("google");
    } else {
      setEngineMode("osm");
    }
  }, [configuredEngine, googleApiKey]);

  const handleRunGeocodeBatch = async () => {
    if (isGeocoding) return;
    setIsGeocoding(true);
    try {
      const res = await startBackgroundGeocoding(activeBrandId, 25);
      if (res.success && res.data) {
        if (res.data.status === "already_running") {
          toast.info(
            "Ya existe un proceso de geolocalización activo en segundo plano."
          );
        } else {
          toast.success(
            "Geolocalización iniciada en segundo plano sin bloquear el sistema."
          );
        }

        // Poll status every 2.5s until background worker completes
        const intervalId = setInterval(async () => {
          try {
            const statusRes = await getGeocodingStatus();
            if (statusRes.success && statusRes.data) {
              if (!statusRes.data.isRunning) {
                clearInterval(intervalId);
                setIsGeocoding(false);
                toast.success(
                  `Lote completado: ${statusRes.data.processed} contratos ` +
                    `geolocalizados. Restan: ${statusRes.data.totalRemaining}`
                );
                await loadData();
              }
            }
          } catch (_e) {
            clearInterval(intervalId);
            setIsGeocoding(false);
          }
        }, 2500);
      } else {
        setIsGeocoding(false);
        toast.error(res.error || "Error al iniciar geolocalización.");
      }
    } catch (_err) {
      setIsGeocoding(false);
      toast.error("Error en proceso de geocodificación.");
    }
  };

  const handleSyncAllNetworkStatus = async () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);
    try {
      const res = await syncAllNetworkStatus(activeBrandId);
      if (res.success && res.data) {
        toast.success(
          `Sincronización MikroTik completada: ${res.data.onlineCount} ` +
            `contratos ONLINE y ${res.data.offlineCount} OFFLINE.`
        );
        await loadData();
      } else {
        toast.error(res.error || "Error al sincronizar con MikroTik.");
      }
    } catch (_err) {
      toast.error("Error al ejecutar sincronización masiva con MikroTik.");
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleRunLiveDiag = async (point: MapPoint) => {
    setDiagModalOpen(true);
    setDiagLoading(true);
    setDiagnosticResult(null);
    setIsSynced(false);
    try {
      const res = await runLiveContractDiagnostic(point.id);
      if (res.success && res.data) {
        setDiagnosticResult(res.data);
      } else {
        toast.error(res.error || "Error al contactar MikroTik.");
      }
    } catch (_err) {
      toast.error("Fallo de comunicación con router.");
    } finally {
      setDiagLoading(false);
    }
  };

  const handleSyncContractTelemetry = async () => {
    if (!selectedPoint || !diagnosticResult?.session) return;
    setIsSyncingTelemetry(true);
    try {
      const res = await syncContractTelemetry(selectedPoint.id, {
        ipAddress: diagnosticResult.session.address || null,
        macAddress: diagnosticResult.session.callerId || null,
        serviceStatus: "ONLINE",
        setBillingActive: true,
      });
      if (res.success && res.data) {
        toast.success(
          "Contrato sincronizado con IP, MAC y estado ACTIVO."
        );
        setIsSynced(true);
        setSelectedPoint((prev) =>
          prev
            ? {
                ...prev,
                serviceStatus: "ONLINE",
                billingStatus: "ACTIVO",
                equipment: {
                  ...prev.equipment,
                  routerMac: diagnosticResult.session?.callerId || null,
                },
              }
            : null
        );
        setMapData((prev) =>
          prev
            ? {
                ...prev,
                points: prev.points.map((p) =>
                  p.id === selectedPoint.id
                    ? { ...p, serviceStatus: "ONLINE", billingStatus: "ACTIVO" }
                    : p
                ),
              }
            : null
        );
      } else {
        toast.error(res.error || "Error al sincronizar.");
      }
    } catch (_err) {
      toast.error("Error inesperado en sincronización.");
    } finally {
      setIsSyncingTelemetry(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setAppliedSearch("");
  };

  // Filter points in memory for instantaneous search & node drill-down
  const filteredPoints = (mapData?.points || []).filter((p) => {
    if (nodeFilter !== "all" && p.nodeId !== nodeFilter) return false;

    if (statusFilter === "ACTIVO" && p.billingStatus !== "ACTIVO") return false;
    if (statusFilter === "ONLINE" && p.serviceStatus !== "ONLINE") return false;
    if (
      statusFilter === "OFFLINE" &&
      (p.serviceStatus === "ONLINE" || p.billingStatus === "SUSPENDIDO_MORA")
    ) {
      return false;
    }
    if (statusFilter === "SUSPENDIDO" && p.billingStatus !== "SUSPENDIDO_MORA") {
      return false;
    }

    if (!appliedSearch.trim()) return true;
    const normalizeStr = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const term = normalizeStr(appliedSearch);
    return (
      normalizeStr(p.contractNumber).includes(term) ||
      Boolean(p.clientCode && normalizeStr(p.clientCode).includes(term)) ||
      normalizeStr(p.clientDoc).includes(term) ||
      normalizeStr(p.pppoeUser).includes(term) ||
      normalizeStr(p.clientName).includes(term) ||
      normalizeStr(p.address).includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className={cn(
              "text-xl font-black text-zinc-900",
              "dark:text-zinc-50 flex items-center gap-2"
            )}
          >
            <MapPin className="h-6 w-6 text-emerald-500" />
            {t("networkMap.title", "Mapa de Red & Monitoreo NOC")}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t(
              "networkMap.subtitle",
              "Geolocalización en vivo de enlaces y abonados con telemetría MikroTik"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Data */}
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={isLoading}
            title={t("common.refresh", "Actualizar datos del mapa")}
            className="rounded-xl text-xs h-9 px-3 border-zinc-200 dark:border-zinc-800"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
          </Button>

          {/* Secondary Action: Geocode Batch */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunGeocodeBatch}
            disabled={isGeocoding}
            className={cn(
              "rounded-xl text-xs h-9 font-semibold",
              "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300",
              "hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400"
            )}
          >
            <Sparkles
              className={cn(
                "h-3.5 w-3.5 mr-1.5 text-amber-500",
                isGeocoding && "animate-spin"
              )}
            />
            {isGeocoding ? "Geocodificando de fondo..." : "Geocodificar (+25)"}
          </Button>

          {/* Primary Action: Sync MikroTik Live Telemetry */}
          <Button
            size="sm"
            onClick={handleSyncAllNetworkStatus}
            disabled={isSyncingAll || isLoading}
            className={cn(
              "rounded-xl text-xs h-9 font-bold shadow-xs",
              "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
          >
            <Activity
              className={cn(
                "h-3.5 w-3.5 mr-1.5",
                isSyncingAll && "animate-spin"
              )}
            />
            {isSyncingAll
              ? "Sincronizando..."
              : "Sincronizar MikroTik"}
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Puntos Mapeados
              </span>
              <p className="text-xl font-black text-zinc-900 dark:text-zinc-50">
                {mapData?.totalWithCoords ?? 0}
              </p>
              <span className="text-[10px] text-zinc-400">
                {mapData?.totalWithoutCoords ?? 0} pendientes
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  "text-emerald-600 dark:text-emerald-400"
                )}
              >
                Online MikroTik
              </span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {mapData?.onlineCount ?? 0}
              </p>
              <span className="text-[10px] text-zinc-400">Sesiones activas</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  "text-rose-600 dark:text-rose-400"
                )}
              >
                Offline
              </span>
              <p className="text-xl font-black text-rose-600 dark:text-rose-400">
                {mapData?.offlineCount ?? 0}
              </p>
              <span className="text-[10px] text-zinc-400">Sin conexión</span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  "text-amber-600 dark:text-amber-400"
                )}
              >
                Suspendidos Mora
              </span>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                {mapData?.suspendedCount ?? 0}
              </p>
              <span className="text-[10px] text-zinc-400">Cortados</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar: 3-Column Responsive Grid */}
      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5",
          "items-center"
        )}
      >
        {/* Text Search Form (Enter or Click Lupa) */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <button
            type="submit"
            title="Buscar abonado"
            className={cn(
              "absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg",
              "text-zinc-400 hover:text-emerald-600 transition-colors"
            )}
          >
            <Search className="h-4 w-4" />
          </button>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por contrato, código o titular (Enter)..."
            className={cn(
              "pl-9 pr-8 text-xs h-9 rounded-xl",
              "border-zinc-200 dark:border-zinc-800"
            )}
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              title="Limpiar búsqueda"
              className={cn(
                "absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg",
                "text-zinc-400 hover:text-rose-500 transition-colors"
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        {/* MikroTik Node Filter */}
        <Select value={nodeFilter} onValueChange={setNodeFilter}>
          <SelectTrigger
            className={cn(
              "w-full text-xs h-9 rounded-xl",
              "border-zinc-200 dark:border-zinc-800"
            )}
          >
            <SelectValue placeholder="Nodo MikroTik..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl text-xs">
            <SelectItem value="all">🌐 Todos los Nodos</SelectItem>
            {(mapData?.nodes || []).map((node) => (
              <SelectItem key={node.id} value={node.id}>
                🖥️ {node.name} ({node.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Link / Billing Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className={cn(
              "w-full text-xs h-9 rounded-xl",
              "border-zinc-200 dark:border-zinc-800"
            )}
          >
            <SelectValue placeholder="Estado de enlace..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl text-xs">
            <SelectItem value="all">⚡ Todos los Estados</SelectItem>
            <SelectItem value="ACTIVO">✅ Solo Contratos Activos (CRM)</SelectItem>
            <SelectItem value="ONLINE">🟢 Solo Online (MikroTik)</SelectItem>
            <SelectItem value="OFFLINE">🔴 Solo Offline</SelectItem>
            <SelectItem value="SUSPENDIDO">🟠 Suspendidos Mora</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Map Canvas with Floating Desktop Card & Mobile Bottom Sheet */}
      <div
        className={cn(
          "w-full rounded-2xl border border-zinc-200 dark:border-zinc-800",
          "bg-white dark:bg-zinc-900/60 overflow-hidden shadow-xs relative",
          "h-[620px] md:h-[680px] lg:h-[720px]"
        )}
      >
        {engineMode === "google" && googleApiKey ? (
          <GoogleMapView
            apiKey={googleApiKey}
            points={filteredPoints}
            selectedPoint={selectedPoint}
            onSelectPoint={setSelectedPoint}
          />
        ) : (
          <OsmMapView
            points={filteredPoints}
            selectedPoint={selectedPoint}
            onSelectPoint={setSelectedPoint}
            focusTarget={focusTarget}
          />
        )}

        {/* Floating Map Engine Layer Switcher (top-right) */}
        <div
          className={cn(
            "absolute top-3.5 right-3.5 z-[400] flex items-center p-1 rounded-xl",
            "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border",
            "border-zinc-200 dark:border-zinc-800 shadow-md"
          )}
        >
          <button
            type="button"
            onClick={() => setEngineMode("osm")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
              engineMode === "osm"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 " +
                    "dark:hover:text-zinc-100"
            )}
          >
            OpenStreetMap
          </button>
          <button
            type="button"
            onClick={() => {
              if (!googleApiKey) {
                toast.info(
                  "Agrega NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en .env para Google Maps."
                );
              }
              setEngineMode("google");
            }}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
              engineMode === "google"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 " +
                    "dark:hover:text-zinc-100"
            )}
          >
            Google Maps
          </button>
        </div>

        {/* Quick Legend Overlay (bottom-left) */}
        <div
          className={cn(
            "absolute bottom-4 left-4 z-[400] px-3.5 py-2 rounded-xl",
            "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border",
            "border-zinc-200 dark:border-zinc-800 flex items-center gap-3.5",
            "text-[11px] font-bold shadow-md"
          )}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-xs"
              style={{ backgroundColor: "#10b981" }}
            />
            <span className="text-zinc-700 dark:text-zinc-300 font-bold">Online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-xs"
              style={{ backgroundColor: "#f43f5e" }}
            />
            <span className="text-zinc-700 dark:text-zinc-300 font-bold">Offline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-xs"
              style={{ backgroundColor: "#f59e0b" }}
            />
            <span className="text-zinc-700 dark:text-zinc-300 font-bold">Mora</span>
          </div>
          <div
            className={cn(
              "hidden sm:flex items-center gap-1.5 pl-2 border-l",
              "border-zinc-200 dark:border-zinc-700"
            )}
          >
            <span
              className={cn(
                "h-4 px-1.5 rounded-full bg-emerald-500/20 text-emerald-700",
                "dark:text-emerald-300 text-[10px] font-mono font-bold flex",
                "items-center justify-center border border-emerald-500/30"
              )}
            >
              3+
            </span>
            <span className="text-zinc-500 text-[10px]">
              Círculos: Agrupamiento (3+)
            </span>
          </div>
        </div>

        {/* Selected Subscriber: Floating Overlay (Desktop) / Bottom Sheet (Mobile) */}
        {selectedPoint && (
          <>
            {/* Backdrop overlay on mobile */}
            <div
              onClick={() => setSelectedPoint(null)}
              className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-[990]"
            />

            <div
              className={cn(
                // Mobile: Fixed Bottom Sheet
                "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-[1000]",
                "max-sm:rounded-t-3xl max-sm:max-h-[82vh] max-sm:shadow-2xl",
                "max-sm:border-t max-sm:border-zinc-200 max-sm:dark:border-zinc-800",
                "max-sm:p-5 max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-200",
                // Desktop: Floating Glassmorphism Card inside Map
                "sm:absolute sm:top-4 sm:right-4 sm:z-[500] sm:w-[380px]",
                "sm:max-h-[calc(100%-2rem)] sm:rounded-2xl sm:shadow-2xl",
                "sm:border sm:border-zinc-200/90 sm:dark:border-zinc-800/90",
                "sm:p-4 sm:animate-in sm:fade-in sm:slide-in-from-right-4 sm:duration-200",
                // Shared styles
                "bg-white/98 dark:bg-zinc-900/98 backdrop-blur-md",
                "overflow-y-auto flex flex-col justify-between"
              )}
            >
              {/* Mobile Drag Indicator */}
              <div className="sm:hidden flex justify-center mb-2">
                <span className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </div>

              <div className="space-y-3.5">
                {/* Header: Contract #, Client Code, Status, Close Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-black font-mono",
                        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        "border border-emerald-500/20 shadow-xs"
                      )}
                    >
                      Contrato: #{selectedPoint.contractNumber}
                    </span>
                    {selectedPoint.clientCode && (
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono",
                          "bg-sky-500/10 text-sky-600 dark:text-sky-400",
                          "border border-sky-500/20"
                        )}
                      >
                        Cliente: #{selectedPoint.clientCode}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-black uppercase tracking-wider",
                        selectedPoint.serviceStatus === "ONLINE"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                      )}
                    >
                      {selectedPoint.serviceStatus === "ONLINE"
                        ? "ONLINE"
                        : "OFFLINE"}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPoint(null)}
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center",
                      "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                      "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    )}
                    aria-label="Cerrar panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Client Info */}
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-50 leading-snug">
                    {selectedPoint.clientName}
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    {selectedPoint.clientDoc}
                  </p>
                </div>

                {/* Network & Plan Badges */}
                <div
                  className={cn(
                    "grid grid-cols-2 gap-2 text-xs p-2.5 rounded-xl",
                    "bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60",
                    "dark:border-zinc-800/70"
                  )}
                >
                  <div>
                    <span className="text-zinc-400 text-[10px] uppercase font-bold block">
                      PPPoE
                    </span>
                    <span
                      className={cn(
                        "font-mono font-bold text-zinc-800 dark:text-zinc-200",
                        "truncate block text-[11px]"
                      )}
                    >
                      {selectedPoint.pppoeUser}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[10px] uppercase font-bold block">
                      Nodo MikroTik
                    </span>
                    <span
                      className={cn(
                        "font-bold text-zinc-800 dark:text-zinc-200",
                        "truncate block text-[11px]"
                      )}
                    >
                      {selectedPoint.nodeCode}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "col-span-2 pt-1 border-t border-zinc-200/50",
                      "dark:border-zinc-800/50 flex items-center justify-between"
                    )}
                  >
                    <span className="text-zinc-400 text-[10px] uppercase font-bold">
                      Plan Contratado
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                      {selectedPoint.planSpeed}
                    </span>
                  </div>
                </div>

                {/* Address & Navigation */}
                <div
                  className={cn(
                    "p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border",
                    "border-zinc-200/60 dark:border-zinc-800/70 space-y-1.5 text-xs"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">
                      Dirección en Sitio
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${selectedPoint.address}, ${selectedPoint.city}`
                          );
                          toast.success("Dirección copiada al portapapeles");
                        }}
                        className={cn(
                          "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                          "p-1 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-md"
                        )}
                        title="Copiar dirección"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <a
                        href={
                          `https://www.google.com/maps/dir/?api=1&destination=` +
                          `${selectedPoint.latitude},${selectedPoint.longitude}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5",
                          "rounded-md bg-emerald-500/10 text-emerald-600",
                          "dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        )}
                      >
                        <Navigation className="h-2.5 w-2.5" />
                        Navegar GPS
                      </a>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "font-semibold text-zinc-800 dark:text-zinc-200",
                      "text-xs leading-snug"
                    )}
                  >
                    {selectedPoint.address}
                  </p>
                  <div
                    className={cn(
                      "pt-1.5 flex items-center justify-between border-t",
                      "border-zinc-200/50 dark:border-zinc-800/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className="text-zinc-400 font-bold">LAT:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {selectedPoint.latitude.toFixed(5)}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span className="text-zinc-400 font-bold">LNG:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {selectedPoint.longitude.toFixed(5)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setFocusTarget({
                          lat: selectedPoint.latitude,
                          lng: selectedPoint.longitude,
                          ts: Date.now(),
                        });
                        toast.success("Enfocando nodo en el mapa");
                      }}
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5",
                        "rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400",
                        "hover:bg-sky-500/20 transition-colors shadow-2xs"
                      )}
                      title="Centrar y enfocar nodo en el mapa"
                    >
                      <Crosshair className="h-3 w-3" />
                      Centrar en Mapa
                    </button>
                  </div>
                </div>

                {/* CPE Equipment Box */}
                <div
                  className={cn(
                    "p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border",
                    "border-zinc-200/60 dark:border-zinc-800/70 space-y-1.5 text-xs"
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-extrabold uppercase tracking-wider",
                      "text-zinc-500 flex items-center gap-1"
                    )}
                  >
                    <Router className="h-3 w-3 text-emerald-500" />
                    Equipo CPE Instalado
                  </span>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                    {selectedPoint.equipment?.routerBrand || "Sin Router Registrado"}{" "}
                    {selectedPoint.equipment?.routerModel || ""}
                  </p>
                  <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                    <span>Antena / ONT:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {selectedPoint.equipment?.antennaType ||
                        selectedPoint.equipment?.routerMac ||
                        "N/D"}
                    </span>
                  </div>
                  {selectedPoint.equipment?.opticalPowerRx !== null &&
                    selectedPoint.equipment?.opticalPowerRx !== undefined && (
                      <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                        <span>Potencia Óptica Rx:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {selectedPoint.equipment.opticalPowerRx} dBm
                        </span>
                      </div>
                    )}
                </div>

                {/* Primary & Secondary Action Buttons */}
                <div className="pt-1 space-y-2">
                  <Button
                    size="sm"
                    onClick={() => handleRunLiveDiag(selectedPoint)}
                    className={cn(
                      "w-full rounded-xl bg-emerald-600 hover:bg-emerald-700",
                      "text-white text-xs font-bold h-9 gap-1.5 shadow-xs"
                    )}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Diagnóstico en Vivo MikroTik
                  </Button>
                  <Link
                    href={
                      `/dashboard/contracts?search=` +
                      `${encodeURIComponent(selectedPoint.contractNumber)}`
                    }
                    className={cn(
                      "w-full rounded-xl border border-zinc-200 dark:border-zinc-800",
                      "bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700",
                      "text-zinc-700 dark:text-zinc-200 text-xs font-bold h-8 gap-1.5",
                      "flex items-center justify-center transition-colors"
                    )}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver Ficha del Contrato
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Live Diagnostic Modal */}
      <Dialog open={diagModalOpen} onOpenChange={setDiagModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              Diagnóstico en Vivo MikroTik
            </DialogTitle>
          </DialogHeader>

          {selectedPoint && (
            <div className="space-y-4 mt-2 text-xs">
              <div
                className={cn(
                  "p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border",
                  "border-zinc-200 dark:border-zinc-800 space-y-1"
                )}
              >
                <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-50">
                  Contrato #{selectedPoint.contractNumber}
                  {selectedPoint.clientCode
                    ? ` (Cliente #${selectedPoint.clientCode})`
                    : ""}{" "}
                  — {selectedPoint.clientName}
                </span>
                <p className="text-zinc-500">
                  PPPoE:{" "}
                  <span className="font-mono text-emerald-600 font-bold">
                    {selectedPoint.pppoeUser}
                  </span>
                </p>
              </div>

              {diagLoading ? (
                <div className="p-8 text-center space-y-2">
                  <RefreshCw className="h-7 w-7 animate-spin mx-auto text-emerald-500" />
                  <p className="text-xs text-zinc-500">
                    Consultando router MikroTik...
                  </p>
                </div>
              ) : diagnosticResult ? (
                <div className="space-y-3">
                  <div
                    className={cn(
                      "p-3.5 rounded-xl border flex items-center gap-2.5",
                      diagnosticResult.sessionFound
                        ? "bg-emerald-500/10 border-emerald-500/20 " +
                            "text-emerald-700 dark:text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 " +
                            "text-rose-700 dark:text-rose-400"
                    )}
                  >
                    {diagnosticResult.sessionFound ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-black text-xs">
                        {diagnosticResult.sessionFound
                          ? "Enlace Activo en MikroTik (ONLINE)"
                          : "Sin Sesión Activa (OFFLINE)"}
                      </h4>
                      <p className="text-[10px] opacity-90">
                        {diagnosticResult.sessionFound
                          ? `Uptime: ${diagnosticResult.session?.uptime}`
                          : "Equipo apagado o cable desconectado."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={cn(
                        "p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border",
                        "border-zinc-200 dark:border-zinc-800"
                      )}
                    >
                      <span className="text-[10px] text-zinc-500">IP Activa:</span>
                      <p className="font-bold font-mono mt-0.5">
                        {diagnosticResult.session?.address || "N/D"}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border",
                        "border-zinc-200 dark:border-zinc-800"
                      )}
                    >
                      <span className="text-[10px] text-zinc-500">MAC Router:</span>
                      <p className="font-bold font-mono mt-0.5 truncate">
                        {diagnosticResult.session?.callerId || "N/D"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                {diagnosticResult?.sessionFound && (
                  <Button
                    size="sm"
                    disabled={isSyncingTelemetry}
                    onClick={handleSyncContractTelemetry}
                    className={cn(
                      "rounded-xl text-xs font-bold gap-1.5 shadow-xs transition-all",
                      isSynced
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    )}
                  >
                    {isSyncingTelemetry ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : isSynced ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {isSynced
                      ? "¡IP, MAC y Estado Sincronizados!"
                      : "Sincronizar IP, MAC y Estado Activo"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDiagModalOpen(false)}
                  className="rounded-xl text-xs ml-auto"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
