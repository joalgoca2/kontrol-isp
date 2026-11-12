"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Server,
  Plus,
  Activity,
  Wifi,
  MapPin,
  CheckCircle2,
  XCircle,
  Search,
  X,
  Unlink,
  List,
  LayoutGrid,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useBrand } from "@/context/brand-context";
import {
  getMikrotikNodesPaginated,
  saveMikrotikNode,
  testNodeHealthAction,
  toggleMikrotikNodeStatus,
  deleteMikrotikNode,
  bulkToggleMikrotikNodesStatus,
  bulkDeleteMikrotikNodes,
} from "@/actions/nodes";
import type { MikrotikNode, MikrotikNodeWithCounts } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { PaginationControl } from "@/components/ui/pagination-control";
import {
  ActionsDropdown,
  type ActionDropdownItem,
} from "@/components/ui/actions-dropdown";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { NodeBroadcastModal } from "@/components/nodes/node-broadcast-modal";
import { cn } from "@/lib/utils";

function NodesTableContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { activeBrandId, activeBrand } = useBrand();

  const currentPage = Math.max(
    1,
    parseInt(searchParams.get("page") ?? "1", 10)
  );
  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentHealth = searchParams.get("health") ?? "all";
  const currentHasContracts = searchParams.get("hasContracts") ?? "";
  const currentView = (searchParams.get("view") === "grid"
    ? "grid"
    : "list") as "list" | "grid";

  const [nodes, setNodes] = useState<MikrotikNodeWithCounts[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [withoutContractsCount, setWithoutContractsCount] =
    useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchInput, setSearchInput] = useState<string>(currentSearch);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Dialog State (Create / Edit)
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingNode, setEditingNode] =
    useState<Partial<MikrotikNode> | null>(null);
  const [formPassword, setFormPassword] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete Confirmation State (Premium AlertDialog)
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Broadcast WhatsApp Incident Modal State
  const [broadcastNode, setBroadcastNode] = useState<MikrotikNode | null>(null);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState<boolean>(false);

  const handleOpenBroadcast = (node: MikrotikNode) => {
    setBroadcastNode(node);
    setIsBroadcastOpen(true);
  };

  const updateUrlParams = useCallback(
    (updates: {
      page?: number;
      search?: string;
      status?: string;
      health?: string;
      hasContracts?: string;
      view?: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.page !== undefined) {
        if (updates.page <= 1) {
          params.delete("page");
        } else {
          params.set("page", updates.page.toString());
        }
      }

      if (updates.search !== undefined) {
        if (!updates.search.trim()) {
          params.delete("search");
        } else {
          params.set("search", updates.search.trim());
        }
      }

      if (updates.status !== undefined) {
        if (updates.status === "all" || !updates.status) {
          params.delete("status");
        } else {
          params.set("status", updates.status);
        }
      }

      if (updates.health !== undefined) {
        if (updates.health === "all" || !updates.health) {
          params.delete("health");
        } else {
          params.set("health", updates.health);
        }
      }

      if (updates.hasContracts !== undefined) {
        if (!updates.hasContracts) {
          params.delete("hasContracts");
        } else {
          params.set("hasContracts", updates.hasContracts);
        }
      }

      if (updates.view !== undefined) {
        if (updates.view === "list") {
          params.delete("view");
        } else {
          params.set("view", updates.view);
        }
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const loadNodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getMikrotikNodesPaginated({
        brandId: activeBrandId,
        page: currentPage,
        limit: 10,
        search: currentSearch,
        status: currentStatus,
        health: currentHealth,
        hasContracts: currentHasContracts,
      });

      if (res.success && res.data) {
        setNodes(res.data.nodes);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setOnlineCount(res.data.onlineCount);
        setOfflineCount(res.data.offlineCount);
        setWithoutContractsCount(res.data.withoutContractsCount);
      } else {
        toast.error(res.error || "Error al cargar nodos MikroTik.");
      }
    } catch (_err) {
      toast.error("Error al consultar nodos MikroTik.");
    } finally {
      setIsLoading(false);
    }
  }, [
    activeBrandId,
    currentPage,
    currentSearch,
    currentStatus,
    currentHealth,
    currentHasContracts,
  ]);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ search: searchInput, page: 1 });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateUrlParams({ search: "", page: 1 });
  };

  const handleTestHealth = async (nodeId: string) => {
    setTestingId(nodeId);
    try {
      const res = await testNodeHealthAction(nodeId);
      if (res.success && res.data) {
        toast.success(
          `Conexión exitosa con RouterOS: ${res.data.activeSessions}` +
            ` sesiones activas (${res.data.latencyMs} ms).`
        );
        loadNodes();
      } else {
        toast.error(res.error || "No se pudo conectar al nodo MikroTik.");
      }
    } catch (_err) {
      toast.error("Fallo al probar salud del nodo.");
    } finally {
      setTestingId(null);
    }
  };

  const handleOpenCreate = () => {
    setEditingNode({
      brandId: activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id || "",
      port: 8728,
      useTls: false,
      isActive: true,
    });
    setFormPassword("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (node: MikrotikNodeWithCounts) => {
    setEditingNode(node);
    setFormPassword("");
    setIsDialogOpen(true);
  };

  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingNode?.name ||
      !editingNode?.code ||
      !editingNode?.host ||
      !editingNode?.username
    ) {
      toast.error("Por favor completa los campos requeridos.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...editingNode,
        brandId:
          editingNode.brandId ||
          (activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id),
        password: formPassword,
      };

      const res = await saveMikrotikNode(payload);
      if (res.success) {
        toast.success(t("nodes.saveSuccess", "Nodo MikroTik guardado."));
        setIsDialogOpen(false);
        loadNodes();
      } else {
        toast.error(res.error || "Error al guardar nodo.");
      }
    } catch (_err) {
      toast.error("Error al procesar solicitud.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (node: MikrotikNodeWithCounts) => {
    setIsActionLoading(true);
    try {
      const res = await toggleMikrotikNodeStatus(node.id);
      if (res.success) {
        toast.success(
          t("nodes.statusSuccess", "Estado del nodo actualizado.")
        );
        loadNodes();
      } else {
        toast.error(res.error || "Error al cambiar estado del nodo.");
      }
    } catch (_err) {
      toast.error("Error al actualizar nodo.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingNodeId) return;
    setIsActionLoading(true);
    try {
      const res = await deleteMikrotikNode(deletingNodeId);
      if (res.success) {
        toast.success(
          t("nodes.deleteSuccess", "Nodo MikroTik eliminado exitosamente.")
        );
        setDeletingNodeId(null);
        setSelectedNodeIds((prev) =>
          prev.filter((id) => id !== deletingNodeId)
        );
        loadNodes();
      } else {
        toast.error(res.error || "Error al eliminar nodo.");
      }
    } catch (_err) {
      toast.error("Error al procesar eliminación.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNodeIds(nodes.map((n) => n.id));
    } else {
      setSelectedNodeIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedNodeIds((prev) => [...prev, id]);
    } else {
      setSelectedNodeIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const isAllSelected = useMemo(() => {
    return (
      nodes.length > 0 &&
      nodes.every((n) => selectedNodeIds.includes(n.id))
    );
  }, [nodes, selectedNodeIds]);

  const handleBulkActivate = async () => {
    setIsActionLoading(true);
    try {
      const res = await bulkToggleMikrotikNodesStatus(
        selectedNodeIds,
        true
      );
      if (res.success) {
        toast.success(
          t("nodes.bulkActivateSuccess", "Nodos activados correctamente.")
        );
        setSelectedNodeIds([]);
        loadNodes();
      } else {
        toast.error(res.error || "Error al activar nodos.");
      }
    } catch (_err) {
      toast.error("Error al procesar acción masiva.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkDeactivate = async () => {
    setIsActionLoading(true);
    try {
      const res = await bulkToggleMikrotikNodesStatus(
        selectedNodeIds,
        false
      );
      if (res.success) {
        toast.success(
          t("nodes.bulkDeactivateSuccess", "Nodos desactivados correctamente.")
        );
        setSelectedNodeIds([]);
        loadNodes();
      } else {
        toast.error(res.error || "Error al desactivar nodos.");
      }
    } catch (_err) {
      toast.error("Error al procesar acción masiva.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsActionLoading(true);
    try {
      const res = await bulkDeleteMikrotikNodes(selectedNodeIds);
      if (res.success && res.data) {
        if (res.data.deletedCount > 0) {
          toast.success(
            `${t("nodes.bulkDeleteSuccess", "Nodos eliminados")}: ${
              res.data.deletedCount
            }`
          );
        }
        if (res.data.skippedCount > 0) {
          toast.warning(
            `${res.data.skippedCount} ${t(
              "nodes.bulkDeleteSkippedWarning",
              "nodo(s) no pudieron eliminarse por tener contratos vinculados."
            )}`
          );
        }
        setSelectedNodeIds([]);
        loadNodes();
      } else {
        toast.error(res.error || "Error al eliminar nodos seleccionados.");
      }
    } catch (_err) {
      toast.error("Error al procesar eliminación masiva.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const isTotalCardActive =
    currentHealth === "all" &&
    currentStatus === "all" &&
    !currentHasContracts;
  const isOnlineCardActive = currentHealth === "ONLINE";
  const isOfflineCardActive = currentHealth === "OFFLINE";
  const isWithoutContractsCardActive = currentHasContracts === "false";

  const cardBaseClasses =
    "cursor-pointer transition-all duration-200 border rounded-2xl " +
    "backdrop-blur";
  const cardActiveClasses =
    "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
    "border-emerald-500 shadow-md";
  const cardInactiveClasses =
    "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
    "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className={cn("text-xl sm:text-2xl font-black text-zinc-900 ",
                "dark:text-zinc-50 tracking-tight")}
          >
            {t("nodes.title", "NOC Nodos MikroTik")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {t(
              "nodes.subtitle",
              "Monitoreo en tiempo real de servidores RouterOS " +
                "descentralizados por zona geográfica."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className={cn("rounded-xl gap-2 text-xs font-semibold bg-emerald-600 ",
                "hover:bg-emerald-700 text-white shadow-xs")}
          >
            <Plus className="h-4 w-4" />
            {t("nodes.newNode", "Nuevo Nodo")}
          </Button>
        </div>
      </div>

      {/* Filter Metric Cards Standard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Nodos */}
        <Card
          onClick={() =>
            updateUrlParams({
              health: "all",
              status: "all",
              hasContracts: "",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isTotalCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn("text-xs font-bold text-zinc-500 dark:text-zinc-400 ",
                    "uppercase tracking-wider")}
              >
                {t("nodes.cardTotalTitle", "Total de Nodos")}
              </p>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                {isLoading ? <Skeleton className="h-8 w-14" /> : total}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t(
                  "nodes.cardTotalDesc",
                  "Enrutadores CCR y x86 registrados"
                )}
              </p>
            </div>
            <div
              className={cn("p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 ",
                  "text-zinc-600 dark:text-zinc-300")}
            >
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Nodos Online */}
        <Card
          onClick={() =>
            updateUrlParams({
              health: isOnlineCardActive ? "all" : "ONLINE",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isOnlineCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn("text-xs font-bold text-emerald-600 ",
                    "dark:text-emerald-400 uppercase tracking-wider")}
              >
                {t("nodes.cardOnlineTitle", "Nodos Online")}
              </p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {isLoading ? <Skeleton className="h-8 w-14" /> : onlineCount}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t("nodes.cardOnlineDesc", "Conexión activa con RouterOS")}
              </p>
            </div>
            <div
              className={cn("p-3 rounded-xl bg-emerald-500/10 ",
                  "text-emerald-600 dark:text-emerald-400")}
            >
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Nodos Offline */}
        <Card
          onClick={() =>
            updateUrlParams({
              health: isOfflineCardActive ? "all" : "OFFLINE",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isOfflineCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">
                {t("nodes.cardOfflineTitle", "Nodos Offline")}
              </p>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {isLoading ? <Skeleton className="h-8 w-14" /> : offlineCount}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t("nodes.cardOfflineDesc", "Sin respuesta de API binaria")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Sin Contratos */}
        <Card
          onClick={() =>
            updateUrlParams({
              hasContracts: isWithoutContractsCardActive ? "" : "false",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isWithoutContractsCardActive
              ? cardActiveClasses
              : cardInactiveClasses
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn("text-xs font-bold text-amber-600 ",
                    "dark:text-amber-400 uppercase tracking-wider")}
              >
                {t("nodes.cardWithoutContractsTitle", "Sin Contratos")}
              </p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {isLoading ? (
                  <Skeleton className="h-8 w-14" />
                ) : (
                  withoutContractsCount
                )}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t(
                  "nodes.cardWithoutContractsDesc",
                  "Nodos sin abonados asignados"
                )}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Unlink className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar with View Switcher */}
      <div
        className={cn("flex flex-col md:flex-row gap-3 items-stretch ",
            "md:items-center justify-between")}
      >
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <button
            type="submit"
            aria-label={t("common.search", "Buscar")}
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md",
              "text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400",
              "transition-colors cursor-pointer"
            )}
          >
            <Search className="h-4 w-4" />
          </button>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t(
              "nodes.searchPlaceholder",
              "Buscar por nombre, código, host o ubicación..."
            )}
            className={cn("pl-9 pr-9 rounded-xl text-xs h-10 border-zinc-200 ",
                "dark:border-zinc-800 bg-white dark:bg-zinc-900/60")}
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className={cn("absolute right-3 top-1/2 -translate-y-1/2 ",
                  "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
          {/* Health Filter */}
          <Select
            value={currentHealth}
            onValueChange={(val) => updateUrlParams({ health: val, page: 1 })}
          >
            <SelectTrigger
              className={cn("w-full sm:w-44 rounded-xl text-xs h-10 ",
                  "border-zinc-200 dark:border-zinc-800 bg-white ",
                  "dark:bg-zinc-900/60 font-medium")}
            >
              <SelectValue
                placeholder={t(
                  "nodes.filterHealthAll",
                  "Todos los Estados RouterOS"
                )}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="all">
                {t("nodes.filterHealthAll", "Todos los Estados RouterOS")}
              </SelectItem>
              <SelectItem value="ONLINE">
                {t("nodes.filterOnline", "En Línea (Online)")}
              </SelectItem>
              <SelectItem value="OFFLINE">
                {t("nodes.filterOffline", "Desconectados (Offline)")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={currentStatus}
            onValueChange={(val) => updateUrlParams({ status: val, page: 1 })}
          >
            <SelectTrigger
              className={cn("w-full sm:w-36 rounded-xl text-xs h-10 ",
                  "border-zinc-200 dark:border-zinc-800 bg-white ",
                  "dark:bg-zinc-900/60 font-medium")}
            >
              <SelectValue
                placeholder={t("nodes.filterAll", "Todos los Nodos")}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="all">
                {t("nodes.filterAll", "Todos los Nodos")}
              </SelectItem>
              <SelectItem value="active">
                {t("nodes.filterActive", "Activos")}
              </SelectItem>
              <SelectItem value="inactive">
                {t("nodes.filterInactive", "Inactivos")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Contracts Filter */}
          <Select
            value={currentHasContracts || "all"}
            onValueChange={(val) =>
              updateUrlParams({
                hasContracts: val === "all" ? "" : val,
                page: 1,
              })
            }
          >
            <SelectTrigger
              className={cn("w-full sm:w-44 rounded-xl text-xs h-10 ",
                  "border-zinc-200 dark:border-zinc-800 bg-white ",
                  "dark:bg-zinc-900/60 font-medium")}
            >
              <SelectValue
                placeholder={t(
                  "nodes.filterContractsAll",
                  "Todos los Contratos"
                )}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="all">
                {t("nodes.filterContractsAll", "Todos los Contratos")}
              </SelectItem>
              <SelectItem value="false">
                {t(
                  "nodes.filterWithoutContracts",
                  "Sin Contratos (Libres)"
                )}
              </SelectItem>
              <SelectItem value="true">
                {t(
                  "nodes.filterWithContracts",
                  "Con Contratos Vinculados"
                )}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode Switcher: List vs Grid */}
          <div
            className={cn("flex items-center p-1 rounded-xl bg-zinc-100 ",
                "dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60")}
          >
            <button
              type="button"
              onClick={() => updateUrlParams({ view: "list" })}
              title={t("nodes.viewList", "Vista Lista")}
              className={cn(
                "p-1.5 rounded-lg text-xs transition-all flex items-center gap-1",
                currentView === "list"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 " +
                      "dark:text-emerald-400 shadow-xs font-bold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => updateUrlParams({ view: "grid" })}
              title={t("nodes.viewGrid", "Vista Tarjetas")}
              className={cn(
                "p-1.5 rounded-lg text-xs transition-all flex items-center gap-1",
                currentView === "grid"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 " +
                      "dark:text-emerald-400 shadow-xs font-bold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Grid */}
      {currentView === "list" ? (
        <div
          className={cn("rounded-2xl border border-zinc-200 dark:border-zinc-800 ",
              "bg-white dark:bg-zinc-900/60 overflow-hidden shadow-xs")}
        >
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-950/50">
              <TableRow className="border-b border-zinc-200 dark:border-zinc-800">
                {/* Checkbox column */}
                <TableHead className="w-10 p-2 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className={cn("rounded border-zinc-300 dark:border-zinc-700 ",
                        "text-emerald-600 focus:ring-emerald-500 h-4 w-4 ",
                        "accent-emerald-600")}
                  />
                </TableHead>

                {/* ActionsDropdown empty header */}
                <TableHead className="w-10 p-2 text-center"></TableHead>

                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("nodes.tableNode", "Nodo & Código")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("nodes.tableLocation", "Ubicación")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("nodes.tableHost", "Host / Puerto API")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("nodes.tableHealth", "Conexión")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("nodes.tableTelemetry", "Sesiones & Latencia")}
                </TableHead>
                <TableHead
                  className={cn("text-xs font-bold uppercase tracking-wider ", "text-center")}
                >
                  {t("nodes.tableContracts", "Contratos")}
                </TableHead>
                <TableHead
                  className={cn("text-xs font-bold uppercase tracking-wider ", "text-center")}
                >
                  {t("nodes.tableStatus", "Estado")}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="p-2 text-center">
                      <Skeleton className="h-4 w-4 mx-auto" />
                    </TableCell>
                    <TableCell className="p-2 text-center">
                      <Skeleton className="h-7 w-7 rounded-lg mx-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-md" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-5 w-12 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : nodes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-64 text-center p-8 space-y-3"
                  >
                    <div
                      className={cn("p-3 w-12 h-12 rounded-2xl bg-zinc-100 ",
                          "dark:bg-zinc-800 text-zinc-400 mx-auto flex ",
                          "items-center justify-center")}
                    >
                      <Server className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {t(
                        "nodes.emptyTitle",
                        "No se encontraron nodos MikroTik"
                      )}
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      {t(
                        "nodes.emptyDesc",
                        "Ajusta tus filtros de búsqueda o registra un nuevo " +
                          "servidor RouterOS."
                      )}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                nodes.map((node) => {
                  const isSelected = selectedNodeIds.includes(node.id);
                  const isOnline = node.status === "ONLINE";
                  const contractsCount = node._count?.contracts ?? 0;
                  const isTesting = testingId === node.id;

                  const rowActions: ActionDropdownItem[] = [
                    {
                      label: isTesting
                        ? "Probando..."
                        : t("nodes.actionTest", "Test Conexión"),
                      icon: Activity,
                      onClick: () => handleTestHealth(node.id),
                      disabled: isTesting,
                    },
                    {
                      label: t("nodes.actionEdit", "Editar Nodo"),
                      icon: Server,
                      onClick: () => handleOpenEdit(node),
                    },
                    {
                      label: t(
                        "nodes.actionBroadcast",
                        "Notificar Incidencia (WhatsApp)"
                      ),
                      icon: MessageSquare,
                      variant: "emerald" as const,
                      onClick: () =>
                        handleOpenBroadcast(node as unknown as MikrotikNode),
                      disabled: contractsCount === 0,
                    },
                    {
                      label: node.isActive
                        ? t("nodes.actionDeactivate", "Desactivar Nodo")
                        : t("nodes.actionActivate", "Activar Nodo"),
                      icon: node.isActive ? XCircle : CheckCircle2,
                      variant: node.isActive ? "default" : "emerald",
                      onClick: () => handleToggleStatus(node),
                    },
                    {
                      label: t("nodes.actionDelete", "Eliminar Nodo"),
                      icon: XCircle,
                      variant: "destructive",
                      onClick: () => setDeletingNodeId(node.id),
                      disabled: contractsCount > 0,
                    },
                  ];

                  return (
                    <TableRow
                      key={node.id}
                      className={cn(
                        "hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 " +
                          "transition-colors",
                        isSelected &&
                          "bg-emerald-50/40 dark:bg-emerald-950/15"
                      )}
                    >
                      {/* Checkbox cell */}
                      <TableCell className="p-2 text-center align-middle w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            handleSelectRow(node.id, e.target.checked)
                          }
                          className={cn("rounded border-zinc-300 ",
                              "dark:border-zinc-700 text-emerald-600 ",
                              "focus:ring-emerald-500 h-4 w-4 accent-emerald-600")}
                        />
                      </TableCell>

                      {/* ActionsDropdown cell */}
                      <TableCell className="p-2 text-center align-middle w-10">
                        <ActionsDropdown align="left" items={rowActions} />
                      </TableCell>

                      {/* Node Name & Code */}
                      <TableCell className="min-w-[220px]">
                        <div className="flex flex-col gap-1">
                          <span
                            className={cn(
                              "font-bold text-xs text-zinc-900",
                              "dark:text-zinc-100 whitespace-nowrap"
                            )}
                          >
                            {node.name}
                          </span>
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono",
                                "bg-zinc-100 dark:bg-zinc-800 text-zinc-600",
                                "dark:text-zinc-300 border border-zinc-200",
                                "dark:border-zinc-700 whitespace-nowrap"
                              )}
                            >
                              {node.code}
                            </span>
                            {node.routerOsVersion && (
                              <span
                                className="text-[10px] text-zinc-400 truncate max-w-[200px]"
                                title={node.routerOsVersion}
                              >
                                {node.routerOsVersion}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Location */}
                      <TableCell className="whitespace-nowrap">
                        <div
                          className={cn(
                            "flex items-center gap-1.5 text-xs",
                            "text-zinc-600 dark:text-zinc-400 whitespace-nowrap"
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          <span>{node.location}</span>
                        </div>
                      </TableCell>

                      {/* Host & Port */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col text-xs font-mono whitespace-nowrap">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            {node.host}:{node.port}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            User: {node.username}
                            {node.fallbackHost ? ` · LAN: ${node.fallbackHost}` : ""}
                          </span>
                        </div>
                      </TableCell>

                      {/* Connection Health */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-1 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "relative flex h-2 w-2 rounded-full shrink-0",
                                isOnline ? "bg-emerald-500" : "bg-rose-500"
                              )}
                            >
                              {isOnline && (
                                <span
                                  className={cn(
                                    "animate-ping absolute inline-flex",
                                    "h-full w-full rounded-full bg-emerald-400",
                                    "opacity-75"
                                  )}
                                />
                              )}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-black uppercase",
                                "tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap",
                                isOnline
                                  ? "bg-emerald-500/10 text-emerald-600 " +
                                      "dark:text-emerald-400 " +
                                      "border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-500 " +
                                      "border-rose-500/20"
                              )}
                            >
                              {isOnline ? "ONLINE" : "OFFLINE"}
                            </Badge>
                          </div>
                          {node.cpuUsage !== null && node.cpuUsage !== undefined && (
                            <span className="text-[10px] text-zinc-400 font-mono pl-4">
                              CPU: {node.cpuUsage}%
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Telemetry (Sessions & Latency) */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col text-xs whitespace-nowrap">
                          <span
                            className={cn(
                              "font-bold text-emerald-600",
                              "dark:text-emerald-400 flex items-center gap-1.5"
                            )}
                          >
                            <Wifi className="h-3.5 w-3.5 shrink-0" />
                            <span>{node.activeSessions} abonados</span>
                          </span>
                          <span className="text-[11px] text-zinc-400 pl-5">
                            {node.latencyMs
                              ? `Latencia: ${node.latencyMs} ms`
                              : "Latencia N/D"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Contracts Count */}
                      <TableCell className="text-center whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap",
                            contractsCount > 0
                              ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 " +
                                  "dark:text-zinc-300"
                              : "bg-amber-500/10 text-amber-600 " +
                                  "dark:text-amber-400 " +
                                  "border border-amber-500/20"
                          )}
                        >
                          {contractsCount.toLocaleString("es-CO")}{" "}
                          {contractsCount === 1 ? "contrato" : "contratos"}
                        </Badge>
                      </TableCell>

                      {/* Node Status */}
                      <TableCell className="text-center whitespace-nowrap">
                        <Badge
                          variant={node.isActive ? "default" : "secondary"}
                          className={cn(
                            "text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap",
                            node.isActive
                              ? "bg-emerald-500/10 text-emerald-600 " +
                                  "dark:text-emerald-400 " +
                                  "border border-emerald-500/20"
                              : "bg-zinc-200 text-zinc-600 " +
                                  "dark:bg-zinc-800 dark:text-zinc-400"
                          )}
                        >
                          {node.isActive ? "ACTIVO" : "INACTIVO"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Grid of Cards (NOC Style) */
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={cn("h-64 rounded-2xl bg-zinc-100 ",
                      "dark:bg-zinc-900 animate-pulse border ",
                      "border-zinc-200 dark:border-zinc-800")}
                />
              ))}
            </div>
          ) : nodes.length === 0 ? (
            <div
              className={cn("p-12 text-center rounded-2xl border ",
                  "border-dashed border-zinc-300 dark:border-zinc-800")}
            >
              <Server className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {t("nodes.emptyTitle", "No se encontraron nodos MikroTik")}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 mb-4">
                {t(
                  "nodes.emptyDesc",
                  "Ajusta tus filtros de búsqueda o registra un nuevo " +
                    "servidor RouterOS."
                )}
              </p>
              <Button
                onClick={handleOpenCreate}
                size="sm"
                className={cn("rounded-xl bg-emerald-600 hover:bg-emerald-700 ",
                    "text-white text-xs font-semibold")}
              >
                {t("nodes.newNode", "Nuevo Nodo")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {nodes.map((node) => {
                const isSelected = selectedNodeIds.includes(node.id);
                const isOnline = node.status === "ONLINE";
                const contractsCount = node._count?.contracts ?? 0;
                const isTesting = testingId === node.id;

                const rowActions: ActionDropdownItem[] = [
                  {
                    label: isTesting
                      ? "Probando..."
                      : t("nodes.actionTest", "Test Conexión"),
                    icon: Activity,
                    onClick: () => handleTestHealth(node.id),
                    disabled: isTesting,
                  },
                  {
                    label: t("nodes.actionEdit", "Editar Nodo"),
                    icon: Server,
                    onClick: () => handleOpenEdit(node),
                  },
                  {
                    label: t(
                      "nodes.actionBroadcast",
                      "Notificar Incidencia (WhatsApp)"
                    ),
                    icon: MessageSquare,
                    variant: "emerald" as const,
                    onClick: () =>
                      handleOpenBroadcast(node as unknown as MikrotikNode),
                    disabled: contractsCount === 0,
                  },
                  {
                    label: node.isActive
                      ? t("nodes.actionDeactivate", "Desactivar Nodo")
                      : t("nodes.actionActivate", "Activar Nodo"),
                    icon: node.isActive ? XCircle : CheckCircle2,
                    variant: node.isActive ? "default" : "emerald",
                    onClick: () => handleToggleStatus(node),
                  },
                  {
                    label: t("nodes.actionDelete", "Eliminar Nodo"),
                    icon: XCircle,
                    variant: "destructive",
                    onClick: () => setDeletingNodeId(node.id),
                    disabled: contractsCount > 0,
                  },
                ];

                return (
                  <div
                    key={node.id}
                    className={cn(
                      "p-5 rounded-2xl border transition-all duration-200 " +
                        "flex flex-col justify-between bg-white " +
                        "dark:bg-zinc-900/90 shadow-xs hover:shadow-md",
                      isSelected
                        ? "ring-2 ring-emerald-500 bg-emerald-50/30 " +
                            "dark:bg-emerald-950/20 border-emerald-500"
                        : isOnline
                          ? "border-emerald-500/20 hover:border-emerald-500/40"
                          : "border-zinc-200 dark:border-zinc-800"
                    )}
                  >
                    <div>
                      {/* Top Bar: Checkbox + Code + ActionsDropdown + Online Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              handleSelectRow(node.id, e.target.checked)
                            }
                            className={cn(
                              "rounded border-zinc-300 dark:border-zinc-700",
                              "text-emerald-600 focus:ring-emerald-500 h-4 w-4",
                              "accent-emerald-600 cursor-pointer"
                            )}
                          />
                          <ActionsDropdown align="left" items={rowActions} />
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-lg text-[10px] font-extrabold font-mono",
                              "uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800",
                              "text-zinc-600 dark:text-zinc-300",
                              "border border-zinc-200 dark:border-zinc-700"
                            )}
                          >
                            {node.code}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "relative flex h-2 w-2 rounded-full",
                              isOnline ? "bg-emerald-500" : "bg-rose-500"
                            )}
                          >
                            {isOnline && (
                              <span
                                className={cn("animate-ping absolute ",
                                    "inline-flex h-full w-full rounded-full ",
                                    "bg-emerald-400 opacity-75")}
                              />
                            )}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-black",
                              isOnline
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-500"
                            )}
                          >
                            {isOnline ? "ONLINE" : "OFFLINE"}
                          </span>
                        </div>
                      </div>

                      {/* Node Title & Location */}
                      <h3
                        className={cn("text-base font-black text-zinc-900 ",
                            "dark:text-white leading-tight")}
                      >
                        {node.name}
                      </h3>
                      <div
                        className={cn("flex items-center gap-1.5 text-xs ",
                            "text-zinc-500 dark:text-zinc-400 mt-1")}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{node.location}</span>
                      </div>

                      {/* Telemetry Panel */}
                      <div
                        className={cn("mt-4 p-3 rounded-xl bg-zinc-50 ",
                            "dark:bg-zinc-950/60 border border-zinc-200/70 ",
                            "dark:border-zinc-800/80 space-y-2 text-xs")}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Host IP:</span>
                          <span
                            className={cn("font-mono font-bold text-zinc-800 ",
                                "dark:text-zinc-200")}
                          >
                            {node.host}:{node.port}
                          </span>
                        </div>
                        {node.fallbackHost && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-zinc-400">Fallback LAN:</span>
                            <span className="font-mono text-zinc-600 dark:text-zinc-400">
                              {node.fallbackHost}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Sesiones PPPoE:</span>
                          <span
                            className={cn("font-bold text-emerald-600 ",
                                "dark:text-emerald-400 flex items-center gap-1")}
                          >
                            <Wifi className="h-3.5 w-3.5" />
                            {node.activeSessions} abonados
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Latencia API:</span>
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            {node.latencyMs ? `${node.latencyMs} ms` : "N/D"}
                          </span>
                        </div>
                        <div
                          className={cn("flex justify-between items-center pt-1 ",
                              "border-t border-zinc-200/50 dark:border-zinc-800/50")}
                        >
                          <span className="text-zinc-500">Contratos:</span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-bold px-1.5 py-0.2"
                          >
                            {contractsCount}{" "}
                            {contractsCount === 1 ? "abonado" : "abonados"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div
                      className={cn("mt-4 pt-4 border-t border-zinc-100 ",
                          "dark:border-zinc-800/60 flex items-center ",
                          "justify-between gap-2")}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(node)}
                        className="text-xs font-semibold rounded-xl"
                      >
                        {t("nodes.actionEdit", "Editar")}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestHealth(node.id)}
                        disabled={isTesting}
                        className={cn("rounded-xl gap-1.5 text-xs font-bold ",
                            "border-emerald-500/30 text-emerald-600 ",
                            "dark:text-emerald-400 hover:bg-emerald-500/10")}
                      >
                        <Activity
                          className={cn(
                            "h-3.5 w-3.5",
                            isTesting && "animate-spin"
                          )}
                        />
                        {isTesting ? "Probando..." : "Test Conexión"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mandatory Always-Visible PaginationControl */}
      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => updateUrlParams({ page })}
      />

      {/* Floating BulkActionsBar */}
      <BulkActionsBar
        selectedCount={selectedNodeIds.length}
        onClearSelection={() => setSelectedNodeIds([])}
        onActivate={handleBulkActivate}
        onDeactivate={handleBulkDeactivate}
        onDelete={handleBulkDelete}
        resourceName="nodos"
        isLoading={isActionLoading}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              {editingNode?.id
                ? t("nodes.modalEditTitle", "Editar Nodo MikroTik")
                : t("nodes.modalCreateTitle", "Registrar Nuevo Nodo MikroTik")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveNode} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("nodes.labelCode", "Código Identificador *")}
                </Label>
                <Input
                  required
                  maxLength={30}
                  placeholder="ej. NOD-SOA-01"
                  value={editingNode?.code || ""}
                  onChange={(e) =>
                    setEditingNode({
                      ...editingNode,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="rounded-xl text-xs h-9 uppercase font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("nodes.labelName", "Nombre del Nodo *")}
                </Label>
                <Input
                  required
                  maxLength={100}
                  placeholder="ej. CCR1009 Soacha"
                  value={editingNode?.name || ""}
                  onChange={(e) =>
                    setEditingNode({ ...editingNode, name: e.target.value })
                  }
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t("nodes.labelLocation", "Ubicación Física *")}
              </Label>
              <Input
                required
                maxLength={150}
                placeholder="ej. Soacha Centro (Cra 5 # 12-30)"
                value={editingNode?.location || ""}
                onChange={(e) =>
                  setEditingNode({ ...editingNode, location: e.target.value })
                }
                className="rounded-xl text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs font-bold">
                  {t("nodes.labelHost", "Host IP Pública / Dominio *")}
                </Label>
                <Input
                  required
                  maxLength={100}
                  placeholder="ej. 190.242.115.10"
                  value={editingNode?.host || ""}
                  onChange={(e) =>
                    setEditingNode({ ...editingNode, host: e.target.value })
                  }
                  className="rounded-xl text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("nodes.labelPort", "Puerto API")}
                </Label>
                <Input
                  type="number"
                  value={editingNode?.port || 8728}
                  onChange={(e) =>
                    setEditingNode({
                      ...editingNode,
                      port: parseInt(e.target.value, 10) || 8728,
                    })
                  }
                  className="rounded-xl text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t("nodes.labelFallbackHost", "IP Fallback LAN (Opcional)")}
              </Label>
              <Input
                maxLength={100}
                placeholder="ej. 192.168.21.1 (si falla la IP pública)"
                value={editingNode?.fallbackHost || ""}
                onChange={(e) =>
                  setEditingNode({
                    ...editingNode,
                    fallbackHost: e.target.value,
                  })
                }
                className="rounded-xl text-xs h-9 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("nodes.labelUsername", "Usuario API *")}
                </Label>
                <Input
                  required
                  maxLength={60}
                  placeholder="ej. api_kontrol"
                  value={editingNode?.username || ""}
                  onChange={(e) =>
                    setEditingNode({
                      ...editingNode,
                      username: e.target.value,
                    })
                  }
                  className="rounded-xl text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("nodes.labelPassword", "Contraseña API")}
                </Label>
                <Input
                  type="password"
                  maxLength={100}
                  placeholder={
                    editingNode?.id
                      ? "•••••••• (sin cambios)"
                      : "Contraseña"
                  }
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="useTls"
                checked={editingNode?.useTls || false}
                onChange={(e) =>
                  setEditingNode({
                    ...editingNode,
                    useTls: e.target.checked,
                  })
                }
                className={cn("rounded border-zinc-300 dark:border-zinc-700 ",
                    "text-emerald-600 focus:ring-emerald-500 h-4 w-4 ",
                    "accent-emerald-600")}
              />
              <Label
                htmlFor="useTls"
                className="text-xs font-semibold cursor-pointer"
              >
                {t(
                  "nodes.labelUseTls",
                  "Conexión Segura TLS (api-ssl)"
                )}
              </Label>
            </div>

            <div
              className={cn("pt-4 flex justify-end gap-2 border-t ",
                  "border-zinc-100 dark:border-zinc-800")}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className={cn("rounded-xl bg-emerald-600 hover:bg-emerald-700 ",
                    "text-white text-xs font-bold")}
              >
                {isSaving ? "Guardando..." : "Guardar Nodo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Premium Individual Delete AlertDialog */}
      <AlertDialog
        open={Boolean(deletingNodeId)}
        onOpenChange={(open) => !open && setDeletingNodeId(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-rose-600">
              {t(
                "nodes.deleteConfirmTitle",
                "¿Eliminar este nodo MikroTik definitivamente?"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-600 dark:text-zinc-400">
              {t(
                "nodes.deleteConfirmDesc",
                "Esta acción es irreversible y solo se permite si el " +
                  "nodo no tiene contratos de abonados vinculados."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              disabled={isActionLoading}
              className="rounded-xl text-xs"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isActionLoading}
              onClick={handleDeleteConfirm}
              className={cn("rounded-xl bg-rose-600 hover:bg-rose-700 ",
                  "text-white text-xs font-bold")}
            >
              {isActionLoading ? "Eliminando..." : "Eliminar Nodo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Incident WhatsApp Broadcast Modal */}
      <NodeBroadcastModal
        node={broadcastNode}
        open={isBroadcastOpen}
        onOpenChange={setIsBroadcastOpen}
      />
    </div>
  );
}

export default function NodesDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-10 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
          <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
        </div>
      }
    >
      <NodesTableContent />
    </Suspense>
  );
}
