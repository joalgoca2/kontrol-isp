"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import {
  Search,
  X,
  User,
  MapPin,
  Server,
  Zap,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPlanInfo } from "@/lib/plan-formatter";
import { runLiveContractDiagnostic } from "@/actions/contracts";
import {
  ContractExpressDiagnosticBadge,
  ContractExpressDiagnosticCard,
} from "./contract-express-diagnostic";
import { cn } from "@/lib/utils";
import type { Contract, MikrotikLiveDiagnostic } from "@/types";

interface ContractSearchSelectorProps {
  contracts?: Contract[];
  selectedContract?: Contract | null;
  selectedContractId?: string;
  onSelect: (contract: Contract | null) => void;
  onSearchServer?: (query: string) => Promise<Contract[]>;
  showDiagnostic?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ContractSearchSelector({
  contracts = [],
  selectedContract: controlledSelectedContract,
  selectedContractId,
  onSelect,
  onSearchServer,
  showDiagnostic = false,
  label = "Contrato de Servicio",
  placeholder = "Buscar por nombre, cédula, # contrato o PPPoE...",
  required = false,
  disabled = false,
  className,
}: ContractSearchSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [serverResults, setServerResults] = useState<Contract[]>([]);
  const [isPending, startTransition] = useTransition();
  const [quickDiagnostic, setQuickDiagnostic] =
    useState<MikrotikLiveDiagnostic | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false);
  const [showDiagCard, setShowDiagCard] = useState<boolean>(false);

  const selectedContract = useMemo(() => {
    if (controlledSelectedContract !== undefined) {
      return controlledSelectedContract;
    }
    if (!selectedContractId) return null;
    const foundLocal = contracts.find((c) => c.id === selectedContractId);
    if (foundLocal) return foundLocal;
    return serverResults.find((c) => c.id === selectedContractId) ?? null;
  }, [controlledSelectedContract, selectedContractId, contracts, serverResults]);

  useEffect(() => {
    if (!onSearchServer) return;
    const q = searchTerm.trim();
    if (!q) {
      setServerResults([]);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const results = await onSearchServer(q);
          setServerResults(results);
        } catch (_err) {
          setServerResults([]);
        }
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearchServer]);

  const displayedContracts = useMemo(() => {
    if (onSearchServer) {
      if (serverResults.length > 0) return serverResults;
      if (!searchTerm.trim()) return contracts.slice(0, 8);
      return [];
    }

    const q = searchTerm.trim().toLowerCase();
    if (!q) return contracts.slice(0, 8);

    return contracts
      .filter((c) => {
        const name = c.client?.fullName?.toLowerCase() ?? "";
        const doc = c.client?.documentNumber?.toLowerCase() ?? "";
        const code = c.client?.clientCode?.toLowerCase() ?? "";
        const num = c.contractNumber?.toLowerCase() ?? "";
        const pppoe = c.pppoeUser?.toLowerCase() ?? "";
        const ip = c.ipAddress?.toLowerCase() ?? "";
        return (
          name.includes(q) ||
          doc.includes(q) ||
          code.includes(q) ||
          num.includes(q) ||
          pppoe.includes(q) ||
          ip.includes(q)
        );
      })
      .slice(0, 8);
  }, [contracts, searchTerm, serverResults, onSearchServer]);

  const handleQuickDiagnose = async () => {
    if (!selectedContract?.id) return;
    setIsDiagnosing(true);
    setShowDiagCard(true);
    try {
      const res = await runLiveContractDiagnostic(selectedContract.id);
      if (res.success && res.data) {
        setQuickDiagnostic(res.data);
      } else {
        setQuickDiagnostic({
          connected: false,
          targetHost: "",
          targetPort: 0,
          sessionFound: false,
          trafficLight: "RED",
          trafficSummary: res.error || "No se pudo conectar con el nodo.",
          trafficRecommendation:
            "Verifica que el router MikroTik responda en la red.",
        });
      }
    } catch (_err) {
      setQuickDiagnostic({
        connected: false,
        targetHost: "",
        targetPort: 0,
        sessionFound: false,
        trafficLight: "RED",
        trafficSummary: "Error inesperado al conectar.",
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSelect = (contract: Contract) => {
    onSelect(contract);
    setSearchTerm("");
    setServerResults([]);
    setQuickDiagnostic(null);
    setShowDiagCard(false);
  };

  const handleClear = () => {
    onSelect(null);
    setSearchTerm("");
    setServerResults([]);
    setQuickDiagnostic(null);
    setShowDiagCard(false);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {selectedContract && (
          <span
            className={cn(
              "text-[11px] font-semibold",
              "text-emerald-600 dark:text-emerald-400"
            )}
          >
            Abonado seleccionado
          </span>
        )}
      </div>

      {selectedContract ? (
        /* Premium Selected Contract Card */
        <div
          className={cn(
            "p-3.5 rounded-2xl border transition-all duration-200",
            "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent",
            "dark:from-emerald-950/30 dark:via-emerald-950/15 dark:to-transparent",
            "border-emerald-500/30 dark:border-emerald-500/25 shadow-xs space-y-2.5"
          )}
        >
          {/* Row 1: Identity & Clear Button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                  "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                  "border border-emerald-500/30 shadow-xs"
                )}
              >
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-xs text-zinc-900 dark:text-white truncate">
                    {selectedContract.client?.fullName || "Cliente sin nombre"}
                  </span>
                  {selectedContract.client?.clientCode && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] py-0 px-1.5 font-mono font-bold",
                        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        "border border-emerald-500/30"
                      )}
                    >
                      ID: #{selectedContract.client.clientCode}
                    </Badge>
                  )}
                  {selectedContract.client?.documentNumber && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] py-0 px-1.5 font-mono",
                        "text-zinc-600 dark:text-zinc-400"
                      )}
                    >
                      CC: {selectedContract.client.documentNumber}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {showDiagnostic && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDiagnosing}
                  onClick={handleQuickDiagnose}
                  className={cn(
                    "h-7 text-xs font-semibold rounded-lg px-2 shrink-0 transition-colors",
                    "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10",
                    "border-amber-500/30 hover:border-amber-500/50",
                    "bg-white/80 dark:bg-zinc-900"
                  )}
                  title="Diagnóstico Express en tiempo real con MikroTik"
                >
                  <Zap
                    className={cn(
                      "h-3 w-3 mr-1 text-amber-500",
                      isDiagnosing && "animate-spin"
                    )}
                  />
                  {isDiagnosing ? "Probando..." : "Diagnóstico"}
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={handleClear}
                className={cn(
                  "h-7 text-xs font-semibold rounded-lg px-2.5 shrink-0 transition-colors",
                  "text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400",
                  "hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
                )}
                title="Cambiar o buscar otro contrato"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cambiar
              </Button>
            </div>
          </div>

          {/* Row 2: Connectivity Badges (Pills) */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span
              className={cn(
                "px-2 py-0.5 rounded-lg font-mono font-extrabold",
                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                "border border-emerald-500/30"
              )}
            >
              #{selectedContract.contractNumber}
            </span>

            {selectedContract.pppoeUser && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-lg font-mono font-medium",
                  "bg-white/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
                  "border border-zinc-200 dark:border-zinc-700 truncate max-w-[190px]"
                )}
                title={selectedContract.pppoeUser}
              >
                PPPoE: {selectedContract.pppoeUser}
              </span>
            )}

            {selectedContract.plan && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-lg font-medium flex items-center gap-1",
                  "bg-white/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
                  "border border-zinc-200 dark:border-zinc-700"
                )}
              >
                <Zap className="h-3 w-3 text-amber-500" />
                <span>
                  {formatPlanInfo(selectedContract.plan).speed} &bull;{" "}
                  {formatPlanInfo(selectedContract.plan).priceText}
                </span>
              </span>
            )}

            {quickDiagnostic && (
              <button
                type="button"
                onClick={() => setShowDiagCard((prev) => !prev)}
                className="cursor-pointer focus:outline-hidden"
                title="Clic para ver u ocultar detalles del semáforo"
              >
                <ContractExpressDiagnosticBadge diagnostic={quickDiagnostic} />
              </button>
            )}
          </div>

          {/* Row 3: Physical Address & Router Node */}
          <div
            className={cn(
              "flex items-center gap-3 flex-wrap text-[11px]",
              "text-zinc-500 dark:text-zinc-400 pt-0.5",
              "border-t border-emerald-500/15"
            )}
          >
            {selectedContract.address && (
              <div className="flex items-center gap-1 truncate max-w-[280px]">
                <MapPin className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate" title={selectedContract.address}>
                  {selectedContract.address}
                  {selectedContract.neighborhood
                    ? `, ${selectedContract.neighborhood}`
                    : ""}
                </span>
              </div>
            )}

            {selectedContract.node?.name && (
              <div className="flex items-center gap-1 shrink-0">
                <Server className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate max-w-[160px]">
                  {selectedContract.node.name}
                </span>
              </div>
            )}
          </div>

          {/* Row 4: Express Traffic Light Card */}
          {showDiagCard && quickDiagnostic && (
            <div className="pt-2 border-t border-emerald-500/15">
              <ContractExpressDiagnosticCard
                contract={selectedContract}
                diagnostic={quickDiagnostic}
                isLoading={isDiagnosing}
                onRefresh={handleQuickDiagnose}
              />
            </div>
          )}
        </div>
      ) : (
        /* Search Box & Results Dropdown */
        <div className="space-y-1.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              value={searchTerm}
              disabled={disabled}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="h-8.5 pl-8 pr-7 rounded-xl text-xs"
            />
            {isPending ? (
              <Loader2
                className="h-3.5 w-3.5 text-zinc-400 absolute right-2.5 top-2.5 animate-spin"
              />
            ) : searchTerm ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setServerResults([]);
                }}
                className={cn(
                  "absolute right-2.5 top-2 text-zinc-400",
                  "hover:text-zinc-600 cursor-pointer"
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Interactive Results List */}
          <div
            className={cn(
              "border border-zinc-200 dark:border-zinc-800 rounded-xl",
              "max-h-48 overflow-y-auto divide-y divide-zinc-100",
              "dark:divide-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
            )}
          >
            {displayedContracts.length === 0 ? (
              <div className="p-3 text-center text-xs text-zinc-400">
                {isPending
                  ? "Buscando contratos..."
                  : "No se encontraron contratos coincidentes."}
              </div>
            ) : (
              displayedContracts.map((c) => {
                const planDetails = formatPlanInfo(c.plan);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={cn(
                      "w-full text-left p-2.5 hover:bg-emerald-50/70",
                      "dark:hover:bg-emerald-950/20 transition-colors cursor-pointer",
                      "flex items-center justify-between gap-2 text-xs"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-zinc-800 dark:text-zinc-100 truncate">
                          {c.client?.fullName || "Abonado"}
                        </span>
                        {c.client?.clientCode && (
                          <span className="font-mono text-[10px] text-emerald-600 font-semibold">
                            #{c.client.clientCode}
                          </span>
                        )}
                        {c.client?.documentNumber && (
                          <span className="text-[10px] text-zinc-400 font-mono">
                            CC: {c.client.documentNumber}
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "text-[11px] text-zinc-500 truncate flex",
                          "items-center gap-1.5"
                        )}
                      >
                        <span className="font-mono text-emerald-600 font-bold">
                          #{c.contractNumber}
                        </span>
                        <span>&bull;</span>
                        <span className="font-mono">{c.pppoeUser}</span>
                        <span>&bull;</span>
                        <span>{planDetails.speed}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                        {planDetails.priceText}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
