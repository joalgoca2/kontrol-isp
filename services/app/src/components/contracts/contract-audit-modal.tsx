"use client";

import { useState } from "react";
import {
  Server,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Archive,
  Loader2,
  Check,
  Zap,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  auditContractsWithRouterAction,
  bulkProvisionSecretsAction,
  bulkMarkContractsRetiredAction,
} from "@/actions/contracts";
import type {
  MikrotikNode,
  ContractAuditResult,
  ContractAuditOrphanInCrm,
} from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ContractAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: MikrotikNode[];
  onAuditApplied?: () => void;
}

type TabType = "crm_orphans" | "router_orphans" | "synced";

export function ContractAuditModal({
  isOpen,
  onClose,
  nodes,
  onAuditApplied,
}: ContractAuditModalProps) {
  const { t } = useTranslation();

  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    nodes[0]?.id ?? ""
  );
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditResult, setAuditResult] = useState<ContractAuditResult | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<TabType>("crm_orphans");

  const [selectedCrmIds, setSelectedCrmIds] = useState<Set<string>>(
    new Set()
  );
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isRetiring, setIsRetiring] = useState(false);

  const handleRunAudit = async (nodeIdToAudit?: string) => {
    const targetNodeId = nodeIdToAudit || selectedNodeId;
    if (!targetNodeId) {
      toast.error(
        t("contracts.auditSelectNodeError", "Selecciona un nodo MikroTik.")
      );
      return;
    }

    setIsRunningAudit(true);
    setSelectedCrmIds(new Set());

    try {
      const res = await auditContractsWithRouterAction(targetNodeId);
      if (res.success && res.data) {
        setAuditResult(res.data);
        if (res.data.orphansInCrm.length > 0) {
          setActiveTab("crm_orphans");
        } else if (res.data.orphansInRouter.length > 0) {
          setActiveTab("router_orphans");
        } else {
          setActiveTab("synced");
        }
        toast.success(
          t(
            "contracts.auditSuccessMsg",
            "Auditoría completada exitosamente con RouterOS."
          )
        );
      } else {
        toast.error(
          res.error ||
            t("contracts.auditFailedMsg", "Error al comunicarse con MikroTik.")
        );
      }
    } catch {
      toast.error(
        t("contracts.auditUnexpectedErr", "Error inesperado durante auditoría.")
      );
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleSelectAllCrm = (checked: boolean) => {
    if (!auditResult) return;
    if (checked) {
      const allIds = new Set(
        auditResult.orphansInCrm.map((o: ContractAuditOrphanInCrm) => o.contractId)
      );
      setSelectedCrmIds(allIds);
    } else {
      setSelectedCrmIds(new Set());
    }
  };

  const handleSelectAllRetired = () => {
    if (!auditResult) return;
    const retiredIds = new Set(
      auditResult.orphansInCrm
        .filter((o) => o.detectedRetiredInRouter)
        .map((o) => o.contractId)
    );
    setSelectedCrmIds(retiredIds);
    toast.info(
      `Seleccionados ${retiredIds.size} contratos marcados como retirados en Router.`
    );
  };

  const handleToggleCrmRow = (contractId: string) => {
    const next = new Set(selectedCrmIds);
    if (next.has(contractId)) {
      next.delete(contractId);
    } else {
      next.add(contractId);
    }
    setSelectedCrmIds(next);
  };

  const handleProvisionSelected = async () => {
    if (selectedCrmIds.size === 0) return;
    setIsProvisioning(true);
    try {
      const ids = Array.from(selectedCrmIds);
      const res = await bulkProvisionSecretsAction(ids);
      if (res.success && res.data) {
        toast.success(
          `Se aprovisionaron ${res.data.provisionedCount} cuentas en MikroTik.`
        );
        if (res.data.failedCount > 0) {
          toast.warning(
            `${res.data.failedCount} cuentas no pudieron crearse.`
          );
        }
        onAuditApplied?.();
        await handleRunAudit(selectedNodeId);
      } else {
        toast.error(res.error || "Error al provisionar cuentas.");
      }
    } catch {
      toast.error("Error inesperado al aprovisionar.");
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleRetireSelected = async () => {
    if (selectedCrmIds.size === 0) return;
    setIsRetiring(true);
    try {
      const ids = Array.from(selectedCrmIds);
      const res = await bulkMarkContractsRetiredAction(ids);
      if (res.success && res.data) {
        toast.success(
          `Se marcaron ${res.data.updatedCount} contratos como RETIRADOS.`
        );
        onAuditApplied?.();
        await handleRunAudit(selectedNodeId);
      } else {
        toast.error(res.error || "Error al actualizar contratos.");
      }
    } catch {
      toast.error("Error inesperado al actualizar contratos.");
    } finally {
      setIsRetiring(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "max-w-5xl w-full max-h-[90vh] flex flex-col p-6",
          "overflow-hidden border border-zinc-200 dark:border-zinc-800",
          "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
        )}
      >
        <DialogHeader className="shrink-0 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600",
                  "dark:bg-emerald-500/20 dark:text-emerald-400"
                )}
              >
                <Server className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {t(
                    "contracts.auditTitle",
                    "Auditoría y Conciliación CRM vs MikroTik"
                  )}
                </DialogTitle>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t(
                    "contracts.auditSubtitle",
                    "Detección de contratos fantasma en CRM y cuentas huérfanas en RouterOS."
                  )}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Node selector & run button */}
        <div
          className={cn(
            "p-3 rounded-xl border border-zinc-200 dark:border-zinc-800",
            "bg-zinc-50/70 dark:bg-zinc-900/50 flex flex-wrap items-center",
            "justify-between gap-3 shrink-0"
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Label className="text-xs font-semibold shrink-0">
              {t("contracts.selectNodeLabel", "Nodo MikroTik:")}
            </Label>
            <Select
              value={selectedNodeId}
              onValueChange={(val) => {
                setSelectedNodeId(val);
                setAuditResult(null);
                setSelectedCrmIds(new Set());
              }}
            >
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue
                  placeholder={t(
                    "contracts.chooseNode",
                    "Selecciona un nodo"
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id} className="text-xs">
                    {n.name} ({n.host}:{n.port})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => handleRunAudit()}
            disabled={!selectedNodeId || isRunningAudit}
            className={cn(
              "h-9 px-4 text-xs font-semibold gap-2 rounded-xl",
              "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
          >
            {isRunningAudit ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("contracts.auditingBtn", "Consultando RouterOS...")}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {t("contracts.runAuditBtn", "Ejecutar Auditoría")}
              </>
            )}
          </Button>
        </div>

        {/* Audit content */}
        {!auditResult && !isRunningAudit && (
          <div
            className={cn(
              "flex-1 flex flex-col items-center justify-center p-8 text-center",
              "text-zinc-500 dark:text-zinc-400 space-y-3"
            )}
          >
            <div
              className={cn(
                "p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border",
                "border-zinc-200 dark:border-zinc-800"
              )}
            >
              <Server className="h-8 w-8 text-zinc-400" />
            </div>
            <div className="max-w-md">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {t(
                  "contracts.auditEmptyStateTitle",
                  "Auditoría en tiempo real"
                )}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {t(
                  "contracts.auditEmptyStateDesc",
                  "Selecciona el nodo que deseas inspeccionar y presiona " +
                    "'Ejecutar Auditoría'. Se consultará directamente /ppp/secret."
                )}
              </p>
            </div>
          </div>
        )}

        {auditResult && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Metric cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
              <div
                onClick={() => setActiveTab("synced")}
                className={cn(
                  "p-3.5 rounded-xl border transition-all cursor-pointer",
                  activeTab === "synced"
                    ? "ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500">
                    {t("contracts.syncedTitle", "Sincronizados")}
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {auditResult.syncedCount}
                  </span>
                  <span className="text-2xs text-zinc-400">
                    / {auditResult.totalCrmActive} en CRM
                  </span>
                </div>
                <p className="text-2xs text-zinc-400 mt-1">
                  Existen en CRM y MikroTik
                </p>
              </div>

              <div
                onClick={() => setActiveTab("crm_orphans")}
                className={cn(
                  "p-3.5 rounded-xl border transition-all cursor-pointer",
                  activeTab === "crm_orphans"
                    ? "ring-2 ring-amber-500 bg-amber-500/10 border-amber-500"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-amber-500/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500">
                    {t("contracts.crmOrphansTitle", "Fantasmas en CRM")}
                  </span>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {auditResult.orphansInCrm.length}
                  </span>
                  <span className="text-2xs text-zinc-400">
                    sin secret en router
                  </span>
                </div>
                {auditResult.detectedRetiredCount > 0 ? (
                  <p className="text-2xs font-bold text-rose-600 dark:text-rose-400 mt-1">
                    🏷️ {auditResult.detectedRetiredCount} marcados como retirados en Router
                  </p>
                ) : (
                  <p className="text-2xs text-zinc-400 mt-1">
                    Activos en CRM pero faltan en router
                  </p>
                )}
              </div>

              <div
                onClick={() => setActiveTab("router_orphans")}
                className={cn(
                  "p-3.5 rounded-xl border transition-all cursor-pointer",
                  activeTab === "router_orphans"
                    ? "ring-2 ring-sky-500 bg-sky-500/10 border-sky-500"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-sky-500/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500">
                    {t("contracts.routerOrphansTitle", "Huérfanos en Router")}
                  </span>
                  <HelpCircle className="h-4 w-4 text-sky-500" />
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-sky-600 dark:text-sky-400">
                    {auditResult.orphansInRouter.length}
                  </span>
                  <span className="text-2xs text-zinc-400">
                    / {auditResult.totalRouterSecrets} en router
                  </span>
                </div>
                <p className="text-2xs text-zinc-400 mt-1">
                  Secrets sin contrato activo en CRM
                </p>
              </div>
            </div>

            {/* Tab buttons */}
            <div
              className={cn(
                "flex items-center gap-2 border-b border-zinc-200",
                "dark:border-zinc-800 pb-2 shrink-0"
              )}
            >
              <Button
                variant={activeTab === "crm_orphans" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("crm_orphans")}
                className="h-8 text-xs rounded-lg gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Fantasmas en CRM ({auditResult.orphansInCrm.length})
              </Button>
              <Button
                variant={activeTab === "router_orphans" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("router_orphans")}
                className="h-8 text-xs rounded-lg gap-1.5"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Huérfanos en Router ({auditResult.orphansInRouter.length})
              </Button>
              <Button
                variant={activeTab === "synced" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("synced")}
                className="h-8 text-xs rounded-lg gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Sincronizados ({auditResult.synced.length})
              </Button>
            </div>

            {/* Tab 1: CRM Orphans (Actionable) */}
            {activeTab === "crm_orphans" && (
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                {auditResult.orphansInCrm.length > 0 && (
                  <div
                    className={cn(
                      "p-2.5 rounded-xl border border-amber-500/20",
                      "bg-amber-500/5 flex flex-wrap items-center",
                      "justify-between gap-2 shrink-0"
                    )}
                  >
                    <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                      {selectedCrmIds.size} seleccionados de{" "}
                      {auditResult.orphansInCrm.length}
                    </span>
                    <div className="flex items-center gap-2">
                      {auditResult.detectedRetiredCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSelectAllRetired}
                          className={cn(
                            "h-8 text-xs font-semibold gap-1.5 rounded-lg",
                            "border-amber-500/30 text-amber-700 hover:bg-amber-500/10",
                            "dark:text-amber-400"
                          )}
                        >
                          <Tag className="h-3.5 w-3.5 text-amber-500" />
                          Seleccionar Retirados ({auditResult.detectedRetiredCount})
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={selectedCrmIds.size === 0 || isProvisioning}
                        onClick={handleProvisionSelected}
                        className={cn(
                          "h-8 text-xs font-semibold gap-1.5 rounded-lg",
                          "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                      >
                        {isProvisioning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                        Provisionar en MikroTik ({selectedCrmIds.size})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selectedCrmIds.size === 0 || isRetiring}
                        onClick={handleRetireSelected}
                        className={cn(
                          "h-8 text-xs font-semibold gap-1.5 rounded-lg",
                          "border-rose-500/30 text-rose-600 hover:bg-rose-500/10",
                          "dark:text-rose-400"
                        )}
                      >
                        {isRetiring ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                        Marcar como Retirados ({selectedCrmIds.size})
                      </Button>
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "flex-1 overflow-auto border rounded-xl",
                    "border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900/60 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-10 p-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={
                              auditResult.orphansInCrm.length > 0 &&
                              selectedCrmIds.size ===
                                auditResult.orphansInCrm.length
                            }
                            onChange={(e) =>
                              handleSelectAllCrm(e.target.checked)
                            }
                            className="rounded border-zinc-300"
                          />
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                          Contrato
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                          Cliente
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                          Usuario PPPoE
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                          Plan Asignado
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                          Estado CRM
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditResult.orphansInCrm.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-8 text-xs text-zinc-500"
                          >
                            🎉 No se detectaron contratos fantasma. Todos los
                            contratos activos tienen cuenta en RouterOS.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditResult.orphansInCrm.map((orphan) => {
                          const isSelected = selectedCrmIds.has(
                            orphan.contractId
                          );
                          return (
                            <TableRow
                              key={orphan.contractId}
                              className={cn(
                                "text-xs cursor-pointer",
                                isSelected && "bg-amber-500/5 dark:bg-amber-500/10"
                              )}
                              onClick={() =>
                                handleToggleCrmRow(orphan.contractId)
                              }
                            >
                              <TableCell
                                className="p-2 text-center align-middle w-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    handleToggleCrmRow(orphan.contractId)
                                  }
                                  className="rounded border-zinc-300"
                                />
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "font-semibold text-emerald-600",
                                  "dark:text-emerald-400"
                                )}
                              >
                                {orphan.contractNumber}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    {orphan.clientName}
                                  </p>
                                  {orphan.clientPhone && (
                                    <p className="text-2xs text-zinc-400">
                                      {orphan.clientPhone}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono font-medium">
                                {orphan.pppoeUser || (
                                  <span className="text-rose-500 italic">
                                    (Sin usuario)
                                  </span>
                                )}
                                {orphan.detectedRetiredInRouter && (
                                  <div className="mt-1 flex flex-col gap-0.5">
                                    <Badge
                                      className={cn(
                                        "text-[10px] w-fit font-bold",
                                        "bg-rose-500/10 text-rose-600",
                                        "dark:text-rose-400 border border-rose-500/20"
                                      )}
                                    >
                                      🏷️ Retirado en Router
                                    </Badge>
                                    <span className="text-[10px] text-zinc-400 font-mono">
                                      {orphan.routerSecretName}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-2xs">
                                  {orphan.planName || "Sin plan"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={cn(
                                    "text-2xs font-semibold",
                                    orphan.billingStatus === "ACTIVO"
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : "bg-amber-500/10 text-amber-600"
                                  )}
                                >
                                  {orphan.billingStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Tab 2: Router Orphans */}
            {activeTab === "router_orphans" && (
              <div
                className={cn(
                  "flex-1 overflow-auto border rounded-xl",
                  "border-zinc-200 dark:border-zinc-800"
                )}
              >
                <Table>
                  <TableHeader className="bg-zinc-50 dark:bg-zinc-900/60 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">
                        Usuario PPPoE
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Perfil MikroTik
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Estado Router
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        IP Remota
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Comentario
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Última Desconexión
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditResult.orphansInRouter.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-xs text-zinc-500"
                        >
                          🎉 No hay cuentas huérfanas. Todos los secrets del
                          router corresponden a contratos en CRM.
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditResult.orphansInRouter.map((secret) => (
                        <TableRow key={secret.name} className="text-xs">
                          <TableCell
                            className={cn(
                              "font-mono font-semibold text-sky-600",
                              "dark:text-sky-400"
                            )}
                          >
                            {secret.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-2xs">
                              {secret.profile || "default"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-2xs",
                                secret.disabled
                                  ? "bg-rose-500/10 text-rose-600"
                                  : "bg-emerald-500/10 text-emerald-600"
                              )}
                            >
                              {secret.disabled ? "Deshabilitado" : "Activo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-zinc-500">
                            {secret.remoteAddress || "—"}
                          </TableCell>
                          <TableCell className="text-zinc-500 max-w-[200px] truncate">
                            {secret.comment || "—"}
                          </TableCell>
                          <TableCell className="text-2xs text-zinc-400 font-mono">
                            {secret.lastLoggedOut || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Tab 3: Synced */}
            {activeTab === "synced" && (
              <div
                className={cn(
                  "flex-1 overflow-auto border rounded-xl",
                  "border-zinc-200 dark:border-zinc-800"
                )}
              >
                <Table>
                  <TableHeader className="bg-zinc-50 dark:bg-zinc-900/60 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">
                        Contrato
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Cliente
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Usuario PPPoE
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Perfil Router
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Estado en Router
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Estado CRM
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditResult.synced.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-xs text-zinc-500"
                        >
                          No hay contratos sincronizados con este nodo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditResult.synced.map((item) => (
                        <TableRow key={item.contractId} className="text-xs">
                          <TableCell
                            className={cn(
                              "font-semibold text-emerald-600",
                              "dark:text-emerald-400"
                            )}
                          >
                            {item.contractNumber}
                          </TableCell>
                          <TableCell className="font-medium text-zinc-800 dark:text-zinc-200">
                            {item.clientName}
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {item.pppoeUser}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-2xs">
                              {item.profileInRouter || "default"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-2xs",
                                item.disabledInRouter
                                  ? "bg-rose-500/10 text-rose-600"
                                  : "bg-emerald-500/10 text-emerald-600"
                              )}
                            >
                              {item.disabledInRouter
                                ? "Deshabilitado"
                                : "Activo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-2xs font-semibold",
                                item.serviceStatus === "ONLINE"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-zinc-500/10 text-zinc-600"
                              )}
                            >
                              {item.serviceStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
