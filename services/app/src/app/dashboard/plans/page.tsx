"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Gauge,
  Plus,
  Radio,
  Wifi,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  X,
  Zap,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useBrand } from "@/context/brand-context";
import {
  getPlansPaginated,
  savePlan,
  togglePlanStatus,
  deletePlan,
  bulkTogglePlansStatus,
  bulkDeletePlans,
} from "@/actions/plans";
import type { Plan, TechnologyType } from "@/types";
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
import { cn } from "@/lib/utils";

function PlansTableContent() {
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
  const currentTech = searchParams.get("technology") ?? "";
  const currentHasContracts = searchParams.get("hasContracts") ?? "";

  const [plans, setPlans] = useState<Plan[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [inactiveCount, setInactiveCount] = useState<number>(0);
  const [withoutContractsCount, setWithoutContractsCount] =
    useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchInput, setSearchInput] = useState<string>(currentSearch);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

  // Dialog State (Create / Edit)
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete Confirmation State (Premium AlertDialog)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const updateUrlParams = useCallback(
    (updates: {
      page?: number;
      search?: string;
      status?: string;
      technology?: string;
      hasContracts?: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.page !== undefined) {
        if (updates.page <= 1) params.delete("page");
        else params.set("page", updates.page.toString());
      }

      if (updates.search !== undefined) {
        if (!updates.search.trim()) params.delete("search");
        else params.set("search", updates.search.trim());
      }

      if (updates.status !== undefined) {
        if (updates.status === "all") params.delete("status");
        else params.set("status", updates.status);
      }

      if (updates.technology !== undefined) {
        if (!updates.technology) params.delete("technology");
        else params.set("technology", updates.technology);
      }

      if (updates.hasContracts !== undefined) {
        if (!updates.hasContracts) params.delete("hasContracts");
        else params.set("hasContracts", updates.hasContracts);
      }

      const queryString = params.toString();
      const newPath = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newPath);
    },
    [pathname, router, searchParams]
  );

  const fetchServerPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getPlansPaginated({
        brandId: activeBrandId,
        page: currentPage,
        limit: 10,
        search: currentSearch || undefined,
        status: currentStatus !== "all" ? currentStatus : undefined,
        technology: currentTech || undefined,
        hasContracts: currentHasContracts || undefined,
      });

      if (res.success && res.data) {
        setPlans(res.data.plans);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setActiveCount(res.data.activeCount);
        setInactiveCount(res.data.inactiveCount);
        setWithoutContractsCount(res.data.withoutContractsCount);
      } else {
        toast.error(res.error || t("common.error", "Error al cargar planes"));
      }
    } catch (_err) {
      toast.error(t("common.error", "Error al consultar planes"));
    } finally {
      setIsLoading(false);
    }
  }, [
    activeBrandId,
    currentPage,
    currentSearch,
    currentStatus,
    currentTech,
    currentHasContracts,
    t,
  ]);

  useEffect(() => {
    fetchServerPlans();
  }, [fetchServerPlans]);

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

  // Metric Cards states
  const isTotalActive =
    currentStatus === "all" &&
    !currentTech &&
    !currentHasContracts &&
    !currentSearch;
  const isActiveFilterActive = currentStatus === "active";
  const isInactiveFilterActive = currentStatus === "inactive";
  const isWithoutContractsActive = currentHasContracts === "false";

  const handleFilterCardClick = (
    type: "total" | "active" | "inactive" | "withoutContracts"
  ) => {
    if (type === "total") {
      updateUrlParams({
        status: "all",
        technology: "",
        hasContracts: "",
        page: 1,
      });
    } else if (type === "active") {
      const next = isActiveFilterActive ? "all" : "active";
      updateUrlParams({
        status: next,
        technology: "",
        hasContracts: "",
        page: 1,
      });
    } else if (type === "inactive") {
      const next = isInactiveFilterActive ? "all" : "inactive";
      updateUrlParams({
        status: next,
        technology: "",
        hasContracts: "",
        page: 1,
      });
    } else if (type === "withoutContracts") {
      const next = isWithoutContractsActive ? "" : "false";
      updateUrlParams({
        status: "all",
        technology: "",
        hasContracts: next,
        page: 1,
      });
    }
  };

  // Multiselect logic
  const isAllChecked = useMemo(() => {
    if (plans.length === 0) return false;
    return plans.every((p) => selectedPlanIds.includes(p.id));
  }, [plans, selectedPlanIds]);

  const handleToggleSelectAll = () => {
    if (isAllChecked) {
      setSelectedPlanIds([]);
    } else {
      const pageIds = plans.map((p) => p.id);
      setSelectedPlanIds(Array.from(new Set([...selectedPlanIds, ...pageIds])));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // CRUD Handlers
  const handleOpenCreate = () => {
    setEditingPlan({
      brandId: activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id || "",
      downloadSpeedMbps: 30,
      uploadSpeedMbps: 30,
      rateLimit: "30M/30M",
      priceCop: 50000,
      billingDay: 10,
      technology: "FIBRA_OPTICA",
      isActive: true,
      mikrotikProfile: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan?.name || !editingPlan?.downloadSpeedMbps) {
      toast.error(t("common.error", "Completa los campos obligatorios."));
      return;
    }

    setIsSaving(true);
    try {
      const targetBrandId =
        editingPlan.brandId ||
        (activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id);

      if (!targetBrandId) {
        toast.error("Selecciona una marca específica para crear el plan.");
        return;
      }

      const payload = {
        ...editingPlan,
        brandId: targetBrandId,
        rateLimit:
          editingPlan.rateLimit ||
          `${editingPlan.downloadSpeedMbps}M/${
            editingPlan.uploadSpeedMbps || editingPlan.downloadSpeedMbps
          }M`,
      };

      const res = await savePlan(payload);
      if (res.success) {
        toast.success(t("plans.saveSuccess", "Plan guardado exitosamente."));
        setIsDialogOpen(false);
        fetchServerPlans();
      } else {
        toast.error(res.error || t("common.error", "Error al guardar plan."));
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error al procesar solicitud."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (plan: Plan) => {
    setIsActionLoading(true);
    try {
      const res = await togglePlanStatus(plan.id);
      if (res.success) {
        toast.success(
          t("plans.statusSuccess", "Estado del plan actualizado.")
        );
        fetchServerPlans();
      } else {
        toast.error(
          res.error || t("common.error", "Error al actualizar estado.")
        );
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error inesperado."));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!deletingPlanId) return;
    setIsActionLoading(true);
    try {
      const res = await deletePlan(deletingPlanId);
      if (res.success) {
        toast.success(
          t("plans.deleteSuccess", "Plan eliminado exitosamente.")
        );
        setDeletingPlanId(null);
        setSelectedPlanIds((prev) =>
          prev.filter((id) => id !== deletingPlanId)
        );
        fetchServerPlans();
      } else {
        toast.error(
          res.error || t("common.error", "Error al eliminar plan.")
        );
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error inesperado al eliminar."));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Bulk Handlers
  const handleBulkActivate = async () => {
    if (selectedPlanIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await bulkTogglePlansStatus(selectedPlanIds, true);
      if (res.success) {
        toast.success(
          t("plans.bulkActivateSuccess", "Planes activados correctamente.")
        );
        setSelectedPlanIds([]);
        fetchServerPlans();
      } else {
        toast.error(res.error || t("common.error", "Error en lote."));
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error al activar lote."));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedPlanIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await bulkTogglePlansStatus(selectedPlanIds, false);
      if (res.success) {
        toast.success(
          t("plans.bulkDeactivateSuccess", "Planes desactivados correctamente.")
        );
        setSelectedPlanIds([]);
        fetchServerPlans();
      } else {
        toast.error(res.error || t("common.error", "Error en lote."));
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error al desactivar lote."));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPlanIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await bulkDeletePlans(selectedPlanIds);
      if (res.success && res.data) {
        toast.success(
          `${t("plans.bulkDeleteSuccess", "Planes eliminados")}: ${
            res.data.deletedCount
          }`
        );
        if (res.data.skippedCount > 0) {
          toast.warning(
            `${res.data.skippedCount} plan(es) no pudieron eliminarse por tener contratos vinculados.`
          );
        }
        setSelectedPlanIds([]);
        fetchServerPlans();
      } else {
        toast.error(
          res.error || t("common.error", "Error al eliminar planes en lote.")
        );
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error en eliminación masiva."));
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
            {t("plans.title", "Planes de Internet & Tarifas")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t(
              "plans.subtitle",
              "Gestión de paquetes de ancho de banda, tarifas mensuales y sincronización con perfiles RouterOS."
            )}
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleOpenCreate}
          className={
            "rounded-xl gap-2 text-xs font-semibold bg-emerald-600 " +
            "hover:bg-emerald-700 text-white shadow-sm shrink-0"
          }
        >
          <Plus className="h-4 w-4" />
          <span>{t("plans.newPlan", "Nuevo Plan")}</span>
        </Button>
      </div>

      {/* Filter / Metric Cards (Standard selection classes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <Card
          onClick={() => handleFilterCardClick("total")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isTotalActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
                "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
                "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t("plans.cardTotalTitle", "Total de Planes")}
              </span>
              <div className="text-2xl font-black text-zinc-900 dark:text-white">
                {isLoading ? <Skeleton className="h-8 w-12" /> : total}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {t("plans.cardTotalDesc", "Planes y perfiles configurados")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
              <Gauge className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Activos */}
        <Card
          onClick={() => handleFilterCardClick("active")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isActiveFilterActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
                "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
                "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t("plans.cardActiveTitle", "Planes Activos")}
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {isLoading ? <Skeleton className="h-8 w-12" /> : activeCount}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {t("plans.cardActiveDesc", "Disponibles para contratación")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Inactivos */}
        <Card
          onClick={() => handleFilterCardClick("inactive")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isInactiveFilterActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
                "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
                "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t("plans.cardInactiveTitle", "Planes Inactivos")}
              </span>
              <div className="text-2xl font-black text-zinc-600 dark:text-zinc-300">
                {isLoading ? <Skeleton className="h-8 w-12" /> : inactiveCount}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {t("plans.cardInactiveDesc", "Fuera de comercialización")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Sin Contratos */}
        <Card
          onClick={() => handleFilterCardClick("withoutContracts")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isWithoutContractsActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
                "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
                "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t("plans.cardWithoutContractsTitle", "Sin Contratos")}
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  withoutContractsCount
                )}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {t(
                  "plans.cardWithoutContractsDesc",
                  "Tarifas sin abonados asignados"
                )}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Unlink className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <button
            type="submit"
            aria-label={t("common.search", "Buscar")}
            className={
              "absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md " +
              "text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 " +
              "transition-colors cursor-pointer"
            }
          >
            <Search className="h-4 w-4" />
          </button>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t(
              "plans.searchPlaceholder",
              "Buscar por nombre, rate limit o perfil..."
            )}
            className="pl-9 pr-8 h-10 rounded-xl text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Contracts Assignment Filter */}
          <Select
            value={currentHasContracts || "all"}
            onValueChange={(val) =>
              updateUrlParams({
                hasContracts: val === "all" ? "" : val,
                page: 1,
              })
            }
          >
            <SelectTrigger className="h-10 w-full sm:w-44 rounded-xl text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("plans.filterContractsAll", "Todos los Contratos")}
              </SelectItem>
              <SelectItem value="false">
                {t("plans.filterWithoutContracts", "Sin Contratos (Libres)")}
              </SelectItem>
              <SelectItem value="true">
                {t("plans.filterWithContracts", "Con Contratos Vinculados")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Status Select Filter */}
          <Select
            value={currentStatus}
            onValueChange={(val) => updateUrlParams({ status: val, page: 1 })}
          >
            <SelectTrigger className="h-10 w-full sm:w-36 rounded-xl text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("plans.filterAll", "Todos los Estados")}
              </SelectItem>
              <SelectItem value="active">
                {t("plans.filterActive", "Activos")}
              </SelectItem>
              <SelectItem value="inactive">
                {t("plans.filterInactive", "Inactivos")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Technology Select Filter */}
          <Select
            value={currentTech || "all"}
            onValueChange={(val) =>
              updateUrlParams({
                technology: val === "all" ? "" : val,
                page: 1,
              })
            }
          >
            <SelectTrigger className="h-10 w-full sm:w-40 rounded-xl text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tecnología (Todas)</SelectItem>
              <SelectItem value="FIBRA_OPTICA">Fibra Óptica</SelectItem>
              <SelectItem value="MICROONDAS">Microondas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800">
              <TableHead className="w-10 p-2 text-center align-middle">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos los planes"
                  checked={isAllChecked}
                  onChange={handleToggleSelectAll}
                  className={
                    "rounded border-zinc-300 dark:border-zinc-700 " +
                    "text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                  }
                />
              </TableHead>
              <TableHead className="w-10 p-2 text-center"></TableHead>
              <TableHead className="text-xs font-bold">
                {t("plans.tablePlan", "Plan & Perfil")}
              </TableHead>
              <TableHead className="text-xs font-bold">
                {t("plans.tableSpeed", "Velocidad (Rate Limit)")}
              </TableHead>
              <TableHead className="text-xs font-bold">
                {t("plans.tablePrice", "Tarifa Mensual")}
              </TableHead>
              <TableHead className="text-xs font-bold">
                {t("plans.tableTech", "Tecnología")}
              </TableHead>
              <TableHead className="text-xs font-bold">
                {t("plans.tableContracts", "Contratos Activos")}
              </TableHead>
              <TableHead className="text-xs font-bold">
                {t("plans.tableStatus", "Estado")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell className="p-2 text-center">
                    <Skeleton className="h-4 w-4 mx-auto rounded" />
                  </TableCell>
                  <TableCell className="p-2 text-center">
                    <Skeleton className="h-8 w-8 mx-auto rounded-lg" />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <Gauge className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    {t("plans.emptyTitle", "No se encontraron planes")}
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    {t(
                      "plans.emptyDesc",
                      "Ajusta tus filtros de búsqueda o crea una nueva tarifa de internet."
                    )}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => {
                const isSelected = selectedPlanIds.includes(plan.id);

                const dropdownItems: ActionDropdownItem[] = [
                  {
                    label: t("plans.actionEdit", "Editar Plan"),
                    icon: Edit2,
                    onClick: () => handleOpenEdit(plan),
                  },
                  {
                    label: plan.isActive
                      ? t("plans.actionDeactivate", "Desactivar Plan")
                      : t("plans.actionActivate", "Activar Plan"),
                    icon: plan.isActive ? XCircle : CheckCircle2,
                    variant: plan.isActive ? "default" : "emerald",
                    onClick: () => handleToggleStatus(plan),
                  },
                  {
                    label: t("plans.actionDelete", "Eliminar Plan"),
                    icon: Trash2,
                    variant: "destructive",
                    onClick: () => setDeletingPlanId(plan.id),
                  },
                ];

                return (
                  <TableRow
                    key={plan.id}
                    className={cn(
                      "transition-colors border-zinc-100 dark:border-zinc-800/80",
                      isSelected && "bg-emerald-500/5 dark:bg-emerald-500/10"
                    )}
                  >
                    {/* Checkbox placement standard */}
                    <TableCell className="p-2 text-center align-middle w-10">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar plan ${plan.name}`}
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(plan.id)}
                        className={
                          "rounded border-zinc-300 dark:border-zinc-700 " +
                          "text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        }
                      />
                    </TableCell>

                    {/* Actions dropdown immediately adjacent on left */}
                    <TableCell className="p-2 text-center align-middle w-10">
                      <ActionsDropdown align="left" items={dropdownItems} />
                    </TableCell>

                    {/* Plan Name & Profile */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          {plan.name}
                        </span>
                        {plan.mikrotikProfile ? (
                          <span className="text-[11px] font-mono text-zinc-400 block">
                            Perfil: {plan.mikrotikProfile}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400 block">
                            Perfil: Predeterminado
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Rate Limit */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {plan.rateLimit}
                        </span>
                      </div>
                    </TableCell>

                    {/* Price and Cutoff */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 block">
                          ${Number(plan.priceCop).toLocaleString("es-CO")} COP
                        </span>
                        <span className="text-[11px] text-zinc-400 block">
                          Corte: Día {plan.billingDay}
                        </span>
                      </div>
                    </TableCell>

                    {/* Technology Badge */}
                    <TableCell>
                      {plan.technology === "FIBRA_OPTICA" ? (
                        <Badge
                          variant="outline"
                          className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 text-[11px] font-bold gap-1"
                        >
                          <Radio className="h-3 w-3" />
                          <span>Fibra Óptica</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-bold gap-1"
                        >
                          <Wifi className="h-3 w-3" />
                          <span>Microondas</span>
                        </Badge>
                      )}
                    </TableCell>

                    {/* Contracts Count */}
                    <TableCell>
                      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {plan.contractsCount ?? 0} contratos
                      </span>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px] font-bold rounded-full px-2.5 py-0.5",
                          plan.isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700"
                        )}
                      >
                        {plan.isActive
                          ? t("common.active", "Activo")
                          : t("common.inactive", "Inactivo")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Mandatory Pagination Control */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <span className="text-xs text-zinc-500">
            Total: {total} {total === 1 ? "plan" : "planes"}
          </span>
          <PaginationControl
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => updateUrlParams({ page })}
          />
        </div>
      </Card>

      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedPlanIds.length}
        onClearSelection={() => setSelectedPlanIds([])}
        onActivate={handleBulkActivate}
        onDeactivate={handleBulkDeactivate}
        onDelete={handleBulkDelete}
        resourceName="planes de internet"
        isLoading={isActionLoading}
      />

      {/* Create / Edit Plan Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              {editingPlan?.id
                ? t("plans.modalEditTitle", "Editar Plan de Internet")
                : t("plans.modalCreateTitle", "Crear Nuevo Plan de Internet")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePlan} className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t("plans.labelName", "Nombre del Plan *")}
              </Label>
              <Input
                required
                maxLength={80}
                placeholder="ej. 50M Fibra Óptica Residencial"
                value={editingPlan?.name || ""}
                onChange={(e) =>
                  setEditingPlan({ ...editingPlan, name: e.target.value })
                }
                className="rounded-xl text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("plans.labelDownload", "Bajada (Mbps) *")}
                </Label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={editingPlan?.downloadSpeedMbps || 30}
                  onChange={(e) => {
                    const dl = parseInt(e.target.value, 10) || 1;
                    const ul = editingPlan?.uploadSpeedMbps || dl;
                    setEditingPlan({
                      ...editingPlan,
                      downloadSpeedMbps: dl,
                      rateLimit: `${dl}M/${ul}M`,
                    });
                  }}
                  className="rounded-xl text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("plans.labelUpload", "Subida (Mbps) *")}
                </Label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={editingPlan?.uploadSpeedMbps || 30}
                  onChange={(e) => {
                    const ul = parseInt(e.target.value, 10) || 1;
                    const dl = editingPlan?.downloadSpeedMbps || ul;
                    setEditingPlan({
                      ...editingPlan,
                      uploadSpeedMbps: ul,
                      rateLimit: `${dl}M/${ul}M`,
                    });
                  }}
                  className="rounded-xl text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("plans.labelPrice", "Precio Mensual ($ COP) *")}
                </Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={editingPlan?.priceCop || 50000}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      priceCop: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="rounded-xl text-xs h-9 font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("plans.labelBillingDay", "Día de Corte")}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={editingPlan?.billingDay || 10}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      billingDay: parseInt(e.target.value, 10) || 10,
                    })
                  }
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("plans.labelTechnology", "Tecnología de Red")}
                </Label>
                <Select
                  value={editingPlan?.technology || "FIBRA_OPTICA"}
                  onValueChange={(val) =>
                    setEditingPlan({
                      ...editingPlan,
                      technology: val as TechnologyType,
                    })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="FIBRA_OPTICA">
                      {t("plans.techFiber", "Fibra Óptica (FTTH)")}
                    </SelectItem>
                    <SelectItem value="MICROONDAS">
                      {t("plans.techWireless", "Microondas (Radioenlace)")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("plans.labelMikrotikProfile", "Perfil RouterOS")}
                </Label>
                <Input
                  maxLength={50}
                  placeholder="ej. profile-50m-res"
                  value={editingPlan?.mikrotikProfile || ""}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      mikrotikProfile: e.target.value,
                    })
                  }
                  className="rounded-xl text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-xl text-xs"
              >
                {t("common.cancel", "Cancelar")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                {isSaving
                  ? t("common.save", "Guardando...")
                  : t("common.save", "Guardar Plan")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Premium Single Delete Confirmation AlertDialog */}
      <AlertDialog
        open={Boolean(deletingPlanId)}
        onOpenChange={(open) => !open && setDeletingPlanId(null)}
      >
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              <span>
                {t(
                  "plans.deleteConfirmTitle",
                  "¿Eliminar este plan de internet definitivamente?"
                )}
              </span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t(
                "plans.deleteConfirmDesc",
                "Esta acción es irreversible y solo se permite si el plan no tiene contratos vinculados."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <AlertDialogCancel className="rounded-xl text-xs">
              {t("common.cancel", "Cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isActionLoading}
              onClick={handleConfirmSingleDelete}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              {isActionLoading
                ? t("common.delete", "Eliminando...")
                : t("common.delete", "Eliminar Definitivamente")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PlansDashboardPage() {
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
          <div className="h-96 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
        </div>
      }
    >
      <PlansTableContent />
    </Suspense>
  );
}
