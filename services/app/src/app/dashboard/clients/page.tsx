"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  X,
  Phone,
  Mail,
  MapPin,
  Network,
  CheckCircle2,
  XCircle,
  Unlink,
  List,
  LayoutGrid,
  Edit2,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useBrand } from "@/context/brand-context";
import { hasPermission } from "@/lib/permissions";
import { useIsMobile } from "@/lib/use-mobile";
import {
  getClientsPaginated,
  saveClient,
  toggleClientStatus,
  deleteClient,
  bulkToggleClientsStatus,
  bulkDeleteClients,
} from "@/actions/clients";
import type { Client, DocumentType } from "@/types";
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

function ClientsTableContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const { activeBrandId, activeBrand } = useBrand();

  const canManageClients = hasPermission(
    session?.user,
    "clients:manage"
  );
  const canDeleteClients = hasPermission(
    session?.user,
    "clients:delete"
  );

  const currentPage = Math.max(
    1,
    parseInt(searchParams.get("page") ?? "1", 10)
  );
  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "active";
  const currentDocType = searchParams.get("documentType") ?? "all";
  const currentHasContracts = searchParams.get("hasContracts") ?? "";
  const isMobile = useIsMobile();
  const rawView = searchParams.get("view");
  const currentView = (
    rawView ?? (isMobile ? "grid" : "list")
  ) as "list" | "grid";

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [inactiveCount, setInactiveCount] = useState<number>(0);
  const [withoutContractsCount, setWithoutContractsCount] =
    useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchInput, setSearchInput] = useState<string>(currentSearch);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  // Dialog State (Create / Edit)
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] =
    useState<Partial<Client> | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete Confirmation State (Premium AlertDialog)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(
    null
  );
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const updateUrlParams = useCallback(
    (updates: {
      page?: number;
      search?: string;
      status?: string;
      documentType?: string;
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
        if (!updates.status) {
          params.delete("status");
        } else {
          params.set("status", updates.status);
        }
      }

      if (updates.documentType !== undefined) {
        if (updates.documentType === "all" || !updates.documentType) {
          params.delete("documentType");
        } else {
          params.set("documentType", updates.documentType);
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
        if (!updates.view) {
          params.delete("view");
        } else {
          params.set("view", updates.view);
        }
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getClientsPaginated({
        brandId: activeBrandId,
        page: currentPage,
        limit: 10,
        search: currentSearch,
        status: currentStatus,
        documentType: currentDocType,
        hasContracts: currentHasContracts,
      });

      if (res.success && res.data) {
        setClients(res.data.clients);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setActiveCount(res.data.activeCount);
        setInactiveCount(res.data.inactiveCount);
        setWithoutContractsCount(res.data.withoutContractsCount);
      } else {
        toast.error(res.error || "Error al cargar abonados.");
      }
    } catch (_err) {
      toast.error("Error al consultar abonados.");
    } finally {
      setIsLoading(false);
    }
  }, [
    activeBrandId,
    currentPage,
    currentSearch,
    currentStatus,
    currentDocType,
    currentHasContracts,
  ]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

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

  const handleOpenCreate = () => {
    setEditingClient({
      brandId: activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id || "",
      documentType: "CC",
      city: "Soacha",
      department: "Cundinamarca",
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setIsDialogOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingClient?.fullName ||
      !editingClient?.documentNumber ||
      !editingClient?.phonePrimary
    ) {
      toast.error("Por favor completa los campos obligatorios.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...editingClient,
        brandId:
          editingClient.brandId ||
          (activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id),
      };

      const res = await saveClient(payload);
      if (res.success) {
        toast.success(
          t("clients.saveSuccess", "Titular guardado exitosamente.")
        );
        setIsDialogOpen(false);
        loadClients();
      } else {
        toast.error(res.error || "Error al guardar titular.");
      }
    } catch (_err) {
      toast.error("Error al procesar solicitud.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (client: Client) => {
    setIsActionLoading(true);
    try {
      const res = await toggleClientStatus(client.id);
      if (res.success) {
        toast.success(
          t("clients.statusSuccess", "Estado del titular actualizado.")
        );
        loadClients();
      } else {
        toast.error(res.error || "Error al cambiar estado del titular.");
      }
    } catch (_err) {
      toast.error("Error al actualizar titular.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingClientId) return;
    setIsActionLoading(true);
    try {
      const res = await deleteClient(deletingClientId);
      if (res.success) {
        toast.success(
          t("clients.deleteSuccess", "Titular eliminado exitosamente.")
        );
        setDeletingClientId(null);
        setSelectedClientIds((prev) =>
          prev.filter((id) => id !== deletingClientId)
        );
        loadClients();
      } else {
        toast.error(res.error || "Error al eliminar titular.");
      }
    } catch (_err) {
      toast.error("Error al procesar eliminación.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClientIds(clients.map((c) => c.id));
    } else {
      setSelectedClientIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedClientIds((prev) => [...prev, id]);
    } else {
      setSelectedClientIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const isAllSelected = useMemo(() => {
    return (
      clients.length > 0 &&
      clients.every((c) => selectedClientIds.includes(c.id))
    );
  }, [clients, selectedClientIds]);

  const handleBulkActivate = async () => {
    setIsActionLoading(true);
    try {
      const res = await bulkToggleClientsStatus(selectedClientIds, true);
      if (res.success) {
        toast.success(
          t("clients.bulkActivateSuccess", "Titulares activados correctamente.")
        );
        setSelectedClientIds([]);
        loadClients();
      } else {
        toast.error(res.error || "Error al activar titulares.");
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
      const res = await bulkToggleClientsStatus(selectedClientIds, false);
      if (res.success) {
        toast.success(
          t(
            "clients.bulkDeactivateSuccess",
            "Titulares desactivados correctamente."
          )
        );
        setSelectedClientIds([]);
        loadClients();
      } else {
        toast.error(res.error || "Error al desactivar titulares.");
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
      const res = await bulkDeleteClients(selectedClientIds);
      if (res.success && res.data) {
        if (res.data.deletedCount > 0) {
          toast.success(
            `${t("clients.bulkDeleteSuccess", "Titulares eliminados")}: ${
              res.data.deletedCount
            }`
          );
        }
        if (res.data.skippedCount > 0) {
          toast.warning(
            `${res.data.skippedCount} ${t(
              "clients.bulkDeleteSkippedWarning",
              "titular(es) no pudieron eliminarse por tener contratos vinculados."
            )}`
          );
        }
        setSelectedClientIds([]);
        loadClients();
      } else {
        toast.error(res.error || "Error al eliminar titulares seleccionados.");
      }
    } catch (_err) {
      toast.error("Error al procesar eliminación masiva.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const isTotalCardActive =
    currentStatus === "all" &&
    currentDocType === "all" &&
    !currentHasContracts;
  const isActiveCardActive = currentStatus === "active";
  const isInactiveCardActive = currentStatus === "inactive";
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
            className={cn(
              "text-xl sm:text-2xl font-black text-zinc-900",
              "dark:text-zinc-50 tracking-tight"
            )}
          >
            {t("clients.title", "Abonados / Clientes")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {t(
              "clients.subtitle",
              "Padrón de personas o empresas suscritas. Cada titular " +
                "puede poseer 1 o varios contratos de servicio."
            )}
          </p>
        </div>

        {canManageClients && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className={cn(
                "rounded-xl gap-2 text-xs font-semibold bg-emerald-600",
                "hover:bg-emerald-700 text-white shadow-xs"
              )}
            >
              <Plus className="h-4 w-4" />
              {t("clients.newClient", "Nuevo Titular")}
            </Button>
          </div>
        )}
      </div>

      {/* Filter Metric Cards Standard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Abonados */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: "all",
              documentType: "all",
              hasContracts: "",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isTotalCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div className="space-y-0.5 sm:space-y-1">
              <p
                className={cn(
                  "text-[10px] sm:text-xs font-bold text-zinc-500",
                  "dark:text-zinc-400 uppercase tracking-wider"
                )}
              >
                {t("clients.cardTotalTitle", "Total de Abonados")}
              </p>
              <h3
                className={cn(
                  "text-xl sm:text-2xl font-black text-zinc-900",
                  "dark:text-white"
                )}
              >
                {isLoading ? (
                  <Skeleton className="h-7 w-12 sm:h-8 sm:w-14" />
                ) : (
                  total
                )}
              </h3>
              <p
                className={cn(
                  "text-[10px] sm:text-[11px] text-zinc-400 truncate",
                  "max-w-[100px] sm:max-w-none"
                )}
              >
                {t(
                  "clients.cardTotalDesc",
                  "Titulares registrados en la marca"
                )}
              </p>
            </div>
            <div
              className={cn(
                "p-2 sm:p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800",
                "text-zinc-600 dark:text-zinc-300 shrink-0"
              )}
            >
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Abonados Activos */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isActiveCardActive ? "all" : "active",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isActiveCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div className="space-y-0.5 sm:space-y-1">
              <p
                className={cn(
                  "text-[10px] sm:text-xs font-bold text-emerald-600",
                  "dark:text-emerald-400 uppercase tracking-wider"
                )}
              >
                {t("clients.cardActiveTitle", "Abonados Activos")}
              </p>
              <h3
                className={cn(
                  "text-xl sm:text-2xl font-black text-emerald-600",
                  "dark:text-emerald-400"
                )}
              >
                {isLoading ? (
                  <Skeleton className="h-7 w-12 sm:h-8 sm:w-14" />
                ) : (
                  activeCount
                )}
              </h3>
              <p
                className={cn(
                  "text-[10px] sm:text-[11px] text-zinc-400 truncate",
                  "max-w-[100px] sm:max-w-none"
                )}
              >
                {t("clients.cardActiveDesc", "Cuentas habilitadas en sistema")}
              </p>
            </div>
            <div
              className={cn(
                "p-2 sm:p-3 rounded-xl bg-emerald-500/10",
                "text-emerald-600 dark:text-emerald-400 shrink-0"
              )}
            >
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Abonados Inactivos */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isInactiveCardActive ? "all" : "inactive",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isInactiveCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div className="space-y-0.5 sm:space-y-1">
              <p
                className={cn(
                  "text-[10px] sm:text-xs font-bold text-rose-500",
                  "uppercase tracking-wider"
                )}
              >
                {t("clients.cardInactiveTitle", "Abonados Inactivos")}
              </p>
              <h3
                className={cn(
                  "text-xl sm:text-2xl font-black text-rose-600",
                  "dark:text-rose-400"
                )}
              >
                {isLoading ? (
                  <Skeleton className="h-7 w-12 sm:h-8 sm:w-14" />
                ) : (
                  inactiveCount
                )}
              </h3>
              <p
                className={cn(
                  "text-[10px] sm:text-[11px] text-zinc-400 truncate",
                  "max-w-[100px] sm:max-w-none"
                )}
              >
                {t(
                  "clients.cardInactiveDesc",
                  "Titulares dados de baja o inactivos"
                )}
              </p>
            </div>
            <div
              className={cn(
                "p-2 sm:p-3 rounded-xl bg-rose-500/10 text-rose-500",
                "shrink-0"
              )}
            >
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
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
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div className="space-y-0.5 sm:space-y-1">
              <p
                className={cn(
                  "text-[10px] sm:text-xs font-bold text-amber-600",
                  "dark:text-amber-400 uppercase tracking-wider"
                )}
              >
                {t("clients.cardWithoutContractsTitle", "Sin Contratos")}
              </p>
              <h3
                className={cn(
                  "text-xl sm:text-2xl font-black text-amber-600",
                  "dark:text-amber-400"
                )}
              >
                {isLoading ? (
                  <Skeleton className="h-7 w-12 sm:h-8 sm:w-14" />
                ) : (
                  withoutContractsCount
                )}
              </h3>
              <p
                className={cn(
                  "text-[10px] sm:text-[11px] text-zinc-400 truncate",
                  "max-w-[100px] sm:max-w-none"
                )}
              >
                {t(
                  "clients.cardWithoutContractsDesc",
                  "Titulares sin servicios asignados"
                )}
              </p>
            </div>
            <div
              className={cn(
                "p-2 sm:p-3 rounded-xl bg-amber-500/10 text-amber-600",
                "dark:text-amber-400 shrink-0"
              )}
            >
              <Unlink className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar with View Switcher */}
      <div className="space-y-2.5">
        <div
          className={cn(
            "flex flex-col lg:flex-row gap-2.5 items-stretch",
            "lg:items-center justify-between"
          )}
        >
          {/* Search Bar + View Mode Switcher */}
          <div className="flex items-center gap-2 flex-1">
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
                  "clients.searchPlaceholder",
                  "Buscar por nombre, documento, teléfono, correo o contrato..."
                )}
                className={cn(
                  "pl-9 pr-9 rounded-xl text-xs h-10 border-zinc-200",
                  "dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
                )}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2",
                    "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  )}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>

            {/* View Mode Switcher: List vs Grid */}
            <div
              className={cn(
                "flex items-center p-1 rounded-xl bg-zinc-100 shrink-0",
                "dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60"
              )}
            >
              <button
                type="button"
                onClick={() => updateUrlParams({ view: "list" })}
                title={t("clients.viewList", "Vista Lista")}
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
                title={t("clients.viewGrid", "Vista Tarjetas")}
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

          {/* Select Dropdown Filters */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-center">
            {/* Document Type Filter */}
            <div className="w-full sm:w-44">
              <Select
                value={currentDocType}
                onValueChange={(val) =>
                  updateUrlParams({ documentType: val, page: 1 })
                }
              >
                <SelectTrigger
                  className={cn(
                    "w-full rounded-xl text-xs h-10",
                    "border-zinc-200 dark:border-zinc-800 bg-white",
                    "dark:bg-zinc-900/60 font-medium"
                  )}
                >
                  <SelectValue
                    placeholder={t(
                      "clients.filterDocAll",
                      "Todos los Documentos"
                    )}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">
                    {t("clients.filterDocAll", "Todos los Documentos")}
                  </SelectItem>
                  <SelectItem value="CC">CC (Cédula)</SelectItem>
                  <SelectItem value="NIT">NIT (Empresa)</SelectItem>
                  <SelectItem value="CE">CE (Extranjería)</SelectItem>
                  <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-36">
              <Select
                value={currentStatus}
                onValueChange={(val) =>
                  updateUrlParams({ status: val, page: 1 })
                }
              >
                <SelectTrigger
                  className={cn(
                    "w-full rounded-xl text-xs h-10",
                    "border-zinc-200 dark:border-zinc-800 bg-white",
                    "dark:bg-zinc-900/60 font-medium"
                  )}
                >
                  <SelectValue
                    placeholder={t("clients.filterAll", "Todos los Estados")}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">
                    {t("clients.filterAll", "Todos los Estados")}
                  </SelectItem>
                  <SelectItem value="active">
                    {t("clients.filterActive", "Activos")}
                  </SelectItem>
                  <SelectItem value="inactive">
                    {t("clients.filterInactive", "Inactivos")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contracts Filter */}
            <div className="col-span-2 sm:col-span-1 w-full sm:w-44">
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
                  className={cn(
                    "w-full rounded-xl text-xs h-10",
                    "border-zinc-200 dark:border-zinc-800 bg-white",
                    "dark:bg-zinc-900/60 font-medium"
                  )}
                >
                  <SelectValue
                    placeholder={t(
                      "clients.filterContractsAll",
                      "Todos los Contratos"
                    )}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">
                    {t("clients.filterContractsAll", "Todos los Contratos")}
                  </SelectItem>
                  <SelectItem value="false">
                    {t(
                      "clients.filterWithoutContracts",
                      "Sin Contratos (Libres)"
                    )}
                  </SelectItem>
                  <SelectItem value="true">
                    {t(
                      "clients.filterWithContracts",
                      "Con Contratos Vinculados"
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Grid */}
      {currentView === "list" ? (
        <div
          className={cn(
            "rounded-2xl border border-zinc-200 dark:border-zinc-800",
            "bg-white dark:bg-zinc-900/60 overflow-hidden shadow-xs"
          )}
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
                    className={cn(
                      "rounded border-zinc-300 dark:border-zinc-700",
                      "text-emerald-600 focus:ring-emerald-500 h-4 w-4",
                      "accent-emerald-600 cursor-pointer"
                    )}
                  />
                </TableHead>

                {/* ActionsDropdown empty header */}
                <TableHead className="w-10 p-2 text-center"></TableHead>

                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("clients.tableClient", "Titular & Notas")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("clients.tableDocument", "Identificación")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("clients.tableContact", "Contacto")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("clients.tableLocation", "Ubicación")}
                </TableHead>
                <TableHead
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    "text-center"
                  )}
                >
                  {t("clients.tableContracts", "Contratos")}
                </TableHead>
                <TableHead
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    "text-center"
                  )}
                >
                  {t("clients.tableStatus", "Estado")}
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
                      <Skeleton className="h-4 w-36 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-64 text-center p-8 space-y-3"
                  >
                    <div
                      className={cn(
                        "p-3 w-12 h-12 rounded-2xl bg-zinc-100",
                        "dark:bg-zinc-800 text-zinc-400 mx-auto flex",
                        "items-center justify-center"
                      )}
                    >
                      <Users className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {t("clients.emptyTitle", "No se encontraron abonados")}
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      {t(
                        "clients.emptyDesc",
                        "Ajusta tus filtros de búsqueda o registra un " +
                          "nuevo titular."
                      )}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((c) => {
                  const isSelected = selectedClientIds.includes(c.id);
                  const contractsCount = c.contractsCount ?? 0;

                  const rowActions: ActionDropdownItem[] = [
                    {
                      label: t("clients.actionViewContracts", "Ver Contratos"),
                      icon: Network,
                      onClick: () =>
                        router.push(
                          `/dashboard/contracts?search=${c.documentNumber}`
                        ),
                    },
                    ...(canManageClients
                      ? [
                          {
                            label: t("clients.actionEdit", "Editar Titular"),
                            icon: Edit2,
                            onClick: () => handleOpenEdit(c),
                          },
                          {
                            label: c.isActive
                              ? t(
                                  "clients.actionDeactivate",
                                  "Desactivar Titular"
                                )
                              : t("clients.actionActivate", "Activar Titular"),
                            icon: c.isActive ? XCircle : CheckCircle2,
                            variant: (c.isActive ? "default" : "emerald") as
                              | "default"
                              | "emerald",
                            onClick: () => handleToggleStatus(c),
                          },
                          ...(canDeleteClients
                            ? [
                                {
                                  label: t(
                                    "clients.actionDelete",
                                    "Eliminar Titular"
                                  ),
                                  icon: Trash2,
                                  variant: "destructive" as const,
                                  onClick: () => setDeletingClientId(c.id),
                                  disabled: contractsCount > 0,
                                },
                              ]
                            : []),
                        ]
                      : []),
                  ];

                  return (
                    <TableRow
                      key={c.id}
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
                            handleSelectRow(c.id, e.target.checked)
                          }
                          className={cn(
                            "rounded border-zinc-300 dark:border-zinc-700",
                            "text-emerald-600 focus:ring-emerald-500 h-4 w-4",
                            "accent-emerald-600 cursor-pointer"
                          )}
                        />
                      </TableCell>

                      {/* ActionsDropdown cell */}
                      <TableCell className="p-2 text-center align-middle w-10">
                        <ActionsDropdown align="left" items={rowActions} />
                      </TableCell>

                      {/* FullName & Address/Notes */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              "font-bold text-xs text-zinc-900",
                              "dark:text-zinc-100"
                            )}
                          >
                            {c.clientCode && (
                              <span
                                className={cn(
                                  "text-emerald-600 dark:text-emerald-400",
                                  "mr-1 font-mono"
                                )}
                              >
                                #{c.clientCode} &bull;
                              </span>
                            )}
                            {c.fullName}
                          </span>
                          {c.address && (
                            <span
                              className={cn(
                                "text-[11px] text-zinc-400 truncate max-w-[200px]"
                              )}
                            >
                              {c.address}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Identification */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-extrabold",
                              "bg-zinc-100 dark:bg-zinc-800 text-zinc-600",
                              "dark:text-zinc-300 border border-zinc-200",
                              "dark:border-zinc-700"
                            )}
                          >
                            {c.documentType}
                          </span>
                          <span className="font-bold text-zinc-700 dark:text-zinc-200">
                            {c.documentNumber}
                          </span>
                        </div>
                      </TableCell>

                      {/* Contact Info */}
                      <TableCell>
                        <div className="flex flex-col space-y-0.5 text-xs">
                          <div
                            className={cn(
                              "flex items-center gap-1.5 text-zinc-700",
                              "dark:text-zinc-300"
                            )}
                          >
                            <Phone className="h-3 w-3 text-zinc-400 shrink-0" />
                            <span>{c.phonePrimary}</span>
                          </div>
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">
                                {c.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Location */}
                      <TableCell>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 text-xs",
                            "text-zinc-600 dark:text-zinc-400"
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate max-w-[160px]">
                            {c.city}, {c.department}
                          </span>
                        </div>
                      </TableCell>

                      {/* Contracts Count */}
                      <TableCell className="text-center">
                        <Link
                          href={`/dashboard/contracts?search=${c.documentNumber}`}
                        >
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[11px] font-bold px-2.5 py-0.5 rounded-full " +
                                "inline-flex items-center gap-1 transition-colors",
                              contractsCount > 0
                                ? "bg-emerald-500/10 text-emerald-600 " +
                                    "dark:text-emerald-400 border " +
                                    "border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 " +
                                    "dark:text-amber-400 border " +
                                    "border-amber-500/20 hover:bg-amber-500/20"
                            )}
                          >
                            <Network className="h-3 w-3" />
                            {contractsCount}{" "}
                            {contractsCount === 1 ? "contrato" : "contratos"}
                          </Badge>
                        </Link>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        <Badge
                          variant={c.isActive ? "default" : "secondary"}
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            c.isActive
                              ? "bg-emerald-500/10 text-emerald-600 " +
                                  "dark:text-emerald-400 " +
                                  "border border-emerald-500/20"
                              : "bg-zinc-200 text-zinc-600 " +
                                  "dark:bg-zinc-800 dark:text-zinc-400"
                          )}
                        >
                          {c.isActive ? "ACTIVO" : "INACTIVO"}
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
        /* Grid of Cards */
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-56 rounded-2xl bg-zinc-100 dark:bg-zinc-900",
                    "animate-pulse border border-zinc-200 dark:border-zinc-800"
                  )}
                />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div
              className={cn(
                "p-12 text-center rounded-2xl border",
                "border-dashed border-zinc-300 dark:border-zinc-800"
              )}
            >
              <Users className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {t("clients.emptyTitle", "No se encontraron abonados")}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 mb-4">
                {t(
                  "clients.emptyDesc",
                  "Ajusta tus filtros de búsqueda o registra un " +
                    "nuevo titular."
                )}
              </p>
              <Button
                onClick={handleOpenCreate}
                size="sm"
                className={cn(
                  "rounded-xl bg-emerald-600 hover:bg-emerald-700",
                  "text-white text-xs font-semibold"
                )}
              >
                {t("clients.newClient", "Nuevo Titular")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {clients.map((c) => {
                const isSelected = selectedClientIds.includes(c.id);
                const contractsCount = c.contractsCount ?? 0;

                const rowActions: ActionDropdownItem[] = [
                  {
                    label: t("clients.actionViewContracts", "Ver Contratos"),
                    icon: Network,
                    onClick: () =>
                      router.push(
                        `/dashboard/contracts?search=${c.documentNumber}`
                      ),
                  },
                  ...(canManageClients
                    ? [
                        {
                          label: t("clients.actionEdit", "Editar Titular"),
                          icon: Edit2,
                          onClick: () => handleOpenEdit(c),
                        },
                        {
                          label: c.isActive
                            ? t(
                                "clients.actionDeactivate",
                                "Desactivar Titular"
                              )
                            : t("clients.actionActivate", "Activar Titular"),
                          icon: c.isActive ? XCircle : CheckCircle2,
                          variant: (c.isActive ? "default" : "emerald") as
                            | "default"
                            | "emerald",
                          onClick: () => handleToggleStatus(c),
                        },
                        ...(canDeleteClients
                          ? [
                              {
                                label: t(
                                  "clients.actionDelete",
                                  "Eliminar Titular"
                                ),
                                icon: Trash2,
                                variant: "destructive" as const,
                                onClick: () => setDeletingClientId(c.id),
                                disabled: contractsCount > 0,
                              },
                            ]
                          : []),
                      ]
                    : []),
                ];

                return (
                  <div
                    key={c.id}
                    className={cn(
                      "p-5 rounded-2xl border transition-all duration-200",
                      "flex flex-col justify-between bg-white",
                      "dark:bg-zinc-900/90 shadow-xs hover:shadow-md",
                      isSelected
                        ? "ring-2 ring-emerald-500 bg-emerald-50/30 " +
                            "dark:bg-emerald-950/20 border-emerald-500"
                        : "border-zinc-200 dark:border-zinc-800"
                    )}
                  >
                    <div>
                      {/* Top Bar: Checkbox + ActionsDropdown + Document + Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              handleSelectRow(c.id, e.target.checked)
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
                              "px-2 py-0.5 rounded-lg text-[10px] font-extrabold",
                              "font-mono bg-zinc-100 dark:bg-zinc-800",
                              "text-zinc-600 dark:text-zinc-300",
                              "border border-zinc-200 dark:border-zinc-700"
                            )}
                          >
                            {c.documentType}: {c.documentNumber}
                          </span>
                        </div>

                        <Badge
                          variant={c.isActive ? "default" : "secondary"}
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            c.isActive
                              ? "bg-emerald-500/10 text-emerald-600 " +
                                  "dark:text-emerald-400 " +
                                  "border border-emerald-500/20"
                              : "bg-zinc-200 text-zinc-600 " +
                                  "dark:bg-zinc-800 dark:text-zinc-400"
                          )}
                        >
                          {c.isActive ? "ACTIVO" : "INACTIVO"}
                        </Badge>
                      </div>

                      {/* Subscriber Name & Location */}
                      <h3
                        className={cn(
                          "text-base font-black text-zinc-900",
                          "dark:text-white leading-tight"
                        )}
                      >
                        {c.fullName}
                      </h3>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-xs",
                          "text-zinc-500 dark:text-zinc-400 mt-1"
                        )}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {c.address ? `${c.address} - ` : ""}
                          {c.city}, {c.department}
                        </span>
                      </div>

                      {/* Direct Contact Buttons */}
                      {c.phonePrimary && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <a
                            href={`tel:${c.phonePrimary}`}
                            className={cn(
                              "flex items-center justify-center gap-1.5 py-1.5 px-2",
                              "rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200",
                              "dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700",
                              "dark:text-zinc-200 transition-colors"
                            )}
                          >
                            <Phone className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{t("common.call", "Llamar")}</span>
                          </a>
                          <a
                            href={`https://wa.me/57${c.phonePrimary.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center justify-center gap-1.5 py-1.5 px-2",
                              "rounded-xl text-xs font-semibold bg-emerald-500/10",
                              "hover:bg-emerald-500/20 text-emerald-600",
                              "dark:text-emerald-400 border border-emerald-500/20",
                              "transition-colors"
                            )}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      )}

                      {/* Details Box */}
                      <div
                        className={cn(
                          "mt-3 p-3 rounded-xl bg-zinc-50",
                          "dark:bg-zinc-950/60 border border-zinc-200/70",
                          "dark:border-zinc-800/80 space-y-2 text-xs"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">
                            {t("clients.phoneLabel", "Teléfono")}:
                          </span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {c.phonePrimary}
                          </span>
                        </div>
                        {c.email && (
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500">
                              {t("clients.emailLabel", "Correo")}:
                            </span>
                            <span
                              className={cn(
                                "text-zinc-700 dark:text-zinc-300",
                                "truncate max-w-[160px]"
                              )}
                            >
                              {c.email}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Main Action: Link to Contracts & Diagnostic */}
                      <Link
                        href={`/dashboard/contracts?search=${encodeURIComponent(
                          c.documentNumber
                        )}`}
                        className="mt-3 block"
                      >
                        <Button
                          size="sm"
                          className={cn(
                            "w-full rounded-xl gap-1.5 text-xs font-bold",
                            "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          )}
                        >
                          <Network className="h-3.5 w-3.5" />
                          {contractsCount === 0
                            ? t("clients.noContractsBtn", "Sin Enlaces")
                            : `${t(
                                "clients.viewContractsBtn",
                                "Ver Enlaces"
                              )} (${contractsCount})`}
                        </Button>
                      </Link>
                    </div>

                    {/* Actions Footer */}
                    {canManageClients && (
                      <div
                        className={cn(
                          "mt-3 pt-3 border-t border-zinc-100",
                          "dark:border-zinc-800/60 flex items-center justify-end"
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(c)}
                          className={cn(
                            "text-xs font-semibold rounded-xl text-zinc-600",
                            "dark:text-zinc-400"
                          )}
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          {t("common.edit", "Editar")}
                        </Button>
                      </div>
                    )}
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
        selectedCount={selectedClientIds.length}
        onClearSelection={() => setSelectedClientIds([])}
        onActivate={handleBulkActivate}
        onDeactivate={handleBulkDeactivate}
        onDelete={canDeleteClients ? handleBulkDelete : undefined}
        resourceName="titulares"
        isLoading={isActionLoading}
      />

      {/* Create / Edit Client Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              {editingClient?.id
                ? t("clients.modalEditTitle", "Editar Titular / Abonado")
                : t("clients.modalCreateTitle", "Registrar Nuevo Titular")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveClient} className="space-y-3.5 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("clients.labelDocType", "Tipo Doc.")}
                </Label>
                <Select
                  value={editingClient?.documentType || "CC"}
                  onValueChange={(val) =>
                    setEditingClient({
                      ...editingClient,
                      documentType: val as DocumentType,
                    })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="CC">CC (Cédula)</SelectItem>
                    <SelectItem value="NIT">NIT (Empresa)</SelectItem>
                    <SelectItem value="CE">CE (Extranjería)</SelectItem>
                    <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs font-bold">
                  {t("clients.labelDocNumber", "Número de Documento *")}
                </Label>
                <Input
                  required
                  maxLength={25}
                  placeholder="ej. 1024567890"
                  value={editingClient?.documentNumber || ""}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      documentNumber: e.target.value,
                    })
                  }
                  className="rounded-xl text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t(
                  "clients.labelFullName",
                  "Nombre Completo o Razón Social *"
                )}
              </Label>
              <Input
                required
                maxLength={120}
                placeholder="ej. Juan Carlos González"
                value={editingClient?.fullName || ""}
                onChange={(e) =>
                  setEditingClient({
                    ...editingClient,
                    fullName: e.target.value,
                  })
                }
                className="rounded-xl text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("clients.labelPhonePrimary", "Teléfono Principal *")}
                </Label>
                <Input
                  required
                  maxLength={20}
                  placeholder="ej. 3101234567"
                  value={editingClient?.phonePrimary || ""}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      phonePrimary: e.target.value,
                    })
                  }
                  className="rounded-xl text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("clients.labelPhoneSecondary", "Teléfono Secundario")}
                </Label>
                <Input
                  maxLength={20}
                  placeholder="ej. 3159876543"
                  value={editingClient?.phoneSecondary || ""}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      phoneSecondary: e.target.value,
                    })
                  }
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t("clients.labelEmail", "Correo Electrónico")}
              </Label>
              <Input
                type="email"
                maxLength={100}
                placeholder="ej. cliente@gmail.com"
                value={editingClient?.email || ""}
                onChange={(e) =>
                  setEditingClient({
                    ...editingClient,
                    email: e.target.value,
                  })
                }
                className="rounded-xl text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t("clients.labelAddress", "Dirección Fiscal / Principal")}
              </Label>
              <Input
                maxLength={150}
                placeholder="ej. Cra 5 # 12-34"
                value={editingClient?.address || ""}
                onChange={(e) =>
                  setEditingClient({
                    ...editingClient,
                    address: e.target.value,
                  })
                }
                className="rounded-xl text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("clients.labelCity", "Ciudad")}
                </Label>
                <Input
                  maxLength={60}
                  value={editingClient?.city || "Soacha"}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      city: e.target.value,
                    })
                  }
                  className="rounded-xl text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("clients.labelDepartment", "Departamento")}
                </Label>
                <Input
                  maxLength={60}
                  value={editingClient?.department || "Cundinamarca"}
                  onChange={(e) =>
                    setEditingClient({
                      ...editingClient,
                      department: e.target.value,
                    })
                  }
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <div
              className={cn(
                "pt-3 flex justify-end gap-2 border-t",
                "border-zinc-100 dark:border-zinc-800"
              )}
            >
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
                className={cn(
                  "rounded-xl bg-emerald-600 hover:bg-emerald-700",
                  "text-white text-xs font-bold"
                )}
              >
                {isSaving ? "Guardando..." : "Guardar Titular"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Premium Individual Delete AlertDialog */}
      <AlertDialog
        open={Boolean(deletingClientId)}
        onOpenChange={(open) => !open && setDeletingClientId(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-rose-600">
              {t(
                "clients.deleteConfirmTitle",
                "¿Eliminar este titular definitivamente?"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-600 dark:text-zinc-400">
              {t(
                "clients.deleteConfirmDesc",
                "Esta acción es irreversible y solo se permite si el " +
                  "titular no tiene contratos de servicio vinculados."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              disabled={isActionLoading}
              className="rounded-xl text-xs"
            >
              {t("common.cancel", "Cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isActionLoading}
              onClick={handleDeleteConfirm}
              className={cn(
                "rounded-xl bg-rose-600 hover:bg-rose-700",
                "text-white text-xs font-bold"
              )}
            >
              {isActionLoading
                ? "Eliminando..."
                : t("clients.actionDelete", "Eliminar Titular")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ClientsDashboardPage() {
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
      <ClientsTableContent />
    </Suspense>
  );
}
