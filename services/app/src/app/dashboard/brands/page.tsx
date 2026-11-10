"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Copy,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Search,
  Server,
  Globe,
  Clock,
  X,
  RefreshCw,
  Loader2,
  Users,
  Network,
} from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useBrand } from "@/context/brand-context";
import {
  getBrandsPaginated,
  saveBrand,
  toggleBrandStatus,
  deleteBrand,
  bulkToggleBrandsStatus,
  bulkDeleteBrands,
  regenerateBrandApiKey,
} from "@/actions/brands";
import { brandSchema, type BrandInput } from "@/lib/validations/brand";
import type { BrandWithCounts } from "@/types";
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
  DialogDescription,
  DialogFooter,
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

function BrandsTableContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { isSuperAdmin } = useBrand();

  const currentPage = Math.max(
    1,
    parseInt(searchParams.get("page") ?? "1", 10)
  );
  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentHasNodes = searchParams.get("hasNodes") ?? "";

  const [brands, setBrands] = useState<BrandWithCounts[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [inactiveCount, setInactiveCount] = useState<number>(0);
  const [withNodesCount, setWithNodesCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchInput, setSearchInput] = useState<string>(currentSearch);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingBrand, setEditingBrand] = useState<BrandWithCounts | null>(null);
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BrandInput>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: "",
      slug: "",
      legalName: "",
      taxId: "",
      logo: "",
      apiKey: "",
      isActive: true,
      currency: "COP",
      timezone: "America/Bogota",
      locale: "es",
      billingWebhookUrl: "",
      generalWebhookUrl: "",
    },
  });

  const watchCurrency = watch("currency");
  const watchLocale = watch("locale");
  const watchApiKey = watch("apiKey");
  const watchSlug = watch("slug");

  const updateUrlParams = useCallback(
    (updates: {
      page?: number;
      search?: string;
      status?: string;
      hasNodes?: string;
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

      if (updates.hasNodes !== undefined) {
        if (!updates.hasNodes) params.delete("hasNodes");
        else params.set("hasNodes", updates.hasNodes);
      }

      const queryString = params.toString();
      const newPath = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newPath);
    },
    [pathname, router, searchParams]
  );

  const fetchServerBrands = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getBrandsPaginated({
        page: currentPage,
        limit: 10,
        search: currentSearch || undefined,
        status: currentStatus !== "all" ? currentStatus : undefined,
        hasNodes: currentHasNodes || undefined,
      });

      if (res.success && res.data) {
        setBrands(res.data.brands);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setActiveCount(res.data.activeCount);
        setInactiveCount(res.data.inactiveCount);
        setWithNodesCount(res.data.withNodesCount);
      } else {
        toast.error(res.error || t("common.error", "Error al cargar marcas"));
      }
    } catch (_err) {
      toast.error(t("common.error", "Error al consultar marcas"));
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, currentSearch, currentStatus, currentHasNodes, t]);

  useEffect(() => {
    fetchServerBrands();
  }, [fetchServerBrands]);

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

  const isTotalActive =
    currentStatus === "all" && !currentHasNodes && !currentSearch;
  const isActiveFilterActive = currentStatus === "active";
  const isInactiveFilterActive = currentStatus === "inactive";
  const isWithNodesFilterActive = currentHasNodes === "true";

  const handleFilterCardClick = (
    type: "total" | "active" | "inactive" | "nodes"
  ) => {
    if (type === "total") {
      updateUrlParams({ status: "all", hasNodes: "", page: 1 });
    } else if (type === "active") {
      const next = isActiveFilterActive ? "all" : "active";
      updateUrlParams({ status: next, hasNodes: "", page: 1 });
    } else if (type === "inactive") {
      const next = isInactiveFilterActive ? "all" : "inactive";
      updateUrlParams({ status: next, hasNodes: "", page: 1 });
    } else if (type === "nodes") {
      const next = isWithNodesFilterActive ? "" : "true";
      updateUrlParams({ hasNodes: next, page: 1 });
    }
  };

  const isAllChecked = useMemo(
    () =>
      brands.length > 0 &&
      brands.every((b) => selectedBrandIds.includes(b.id)),
    [brands, selectedBrandIds]
  );

  const handleToggleSelectAll = () => {
    if (isAllChecked) {
      setSelectedBrandIds([]);
    } else {
      setSelectedBrandIds(brands.map((b) => b.id));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedBrandIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenCreate = () => {
    setEditingBrand(null);
    const initialApiKey =
      `isp_live_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    reset({
      name: "",
      slug: "",
      legalName: "",
      taxId: "",
      logo: "",
      apiKey: initialApiKey,
      isActive: true,
      currency: "COP",
      timezone: "America/Bogota",
      locale: "es",
      billingWebhookUrl: "",
      generalWebhookUrl: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (brand: BrandWithCounts) => {
    setEditingBrand(brand);
    reset({
      name: brand.name,
      slug: brand.slug,
      legalName: brand.legalName || "",
      taxId: brand.taxId || "",
      logo: brand.logo || "",
      apiKey: brand.apiKey || "",
      isActive: brand.isActive,
      currency: brand.currency || "COP",
      timezone: brand.timezone || "America/Bogota",
      locale: brand.locale || "es",
      billingWebhookUrl: brand.billingWebhookUrl || "",
      generalWebhookUrl: brand.generalWebhookUrl || "",
    });
    setIsDialogOpen(true);
  };

  const handleCopyApiKey = (key: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    toast.success(
      t("brands.apiKeyCopied", "Clave API copiada al portapapeles.")
    );
  };

  const handleModalRegenerateApiKey = async () => {
    if (editingBrand) {
      setIsActionLoading(true);
      try {
        const res = await regenerateBrandApiKey(editingBrand.id);
        if (res.success && res.data) {
          setValue("apiKey", res.data.apiKey);
          toast.success(
            t("brands.keySuccess", "Clave API regenerada exitosamente.")
          );
          fetchServerBrands();
        } else {
          toast.error(
            res.error || t("common.error", "Error al regenerar clave.")
          );
        }
      } catch (_err) {
        toast.error(t("common.errorGeneric", "Error inesperado."));
      } finally {
        setIsActionLoading(false);
      }
    } else {
      const cleanSlug = watchSlug ? watchSlug.trim().toLowerCase() : "brand";
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const generated =
        `isp_live_${cleanSlug}_${Date.now().toString(36)}_${randomSuffix}`;
      setValue("apiKey", generated);
      toast.success(
        t("brands.keySuccess", "Nueva clave API generada exitosamente.")
      );
    }
  };

  const onFormSubmit = async (data: BrandInput) => {
    setIsActionLoading(true);
    try {
      const payload = {
        ...data,
        ...(editingBrand ? { id: editingBrand.id } : {}),
      };

      const res = await saveBrand(payload);

      if (res.success) {
        toast.success(
          t("brands.saveSuccess", "Marca guardada exitosamente.")
        );
        setIsDialogOpen(false);
        fetchServerBrands();
      } else {
        if (res.error?.includes("slug")) {
          setError("slug", { message: res.error });
        }
        toast.error(res.error || t("common.error", "Error al guardar marca."));
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Ocurrió un error inesperado."));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleStatus = async (brand: BrandWithCounts) => {
    try {
      const res = await toggleBrandStatus(brand.id);
      if (res.success) {
        toast.success(
          t("brands.statusSuccess", "Estado de marca actualizado.")
        );
        fetchServerBrands();
      } else {
        toast.error(res.error || t("common.error", "Error al cambiar estado."));
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error inesperado."));
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!deletingBrandId) return;
    setIsActionLoading(true);
    try {
      const res = await deleteBrand(deletingBrandId);
      if (res.success) {
        toast.success(
          t("brands.deleteSuccess", "Marca eliminada exitosamente.")
        );
        setDeletingBrandId(null);
        setSelectedBrandIds((prev) =>
          prev.filter((id) => id !== deletingBrandId)
        );
        fetchServerBrands();
      } else {
        toast.error(
          res.error || t("common.error", "Error al eliminar marca.")
        );
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error inesperado al eliminar."));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkActivate = async () => {
    if (selectedBrandIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await bulkToggleBrandsStatus(selectedBrandIds, true);
      if (res.success) {
        toast.success(
          t("brands.bulkActivateSuccess", "Marcas activadas correctamente.")
        );
        setSelectedBrandIds([]);
        fetchServerBrands();
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
    if (selectedBrandIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await bulkToggleBrandsStatus(selectedBrandIds, false);
      if (res.success) {
        toast.success(
          t("brands.bulkDeactivateSuccess", "Marcas desactivadas correctamente.")
        );
        setSelectedBrandIds([]);
        fetchServerBrands();
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
    if (selectedBrandIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await bulkDeleteBrands(selectedBrandIds);
      if (res.success && res.data) {
        toast.success(
          `${t("brands.bulkDeleteSuccess", "Marcas eliminadas")}: ${
            res.data.deletedCount
          }`
        );
        if (res.data.skippedCount > 0) {
          toast.warning(
            `${res.data.skippedCount} marca(s) no pudieron eliminarse por tener nodos o abonados vinculados.`
          );
        }
        setSelectedBrandIds([]);
        fetchServerBrands();
      } else {
        toast.error(
          res.error || t("common.error", "Error al eliminar marcas en lote.")
        );
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error en eliminación masiva."));
    } finally {
      setIsActionLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div
        className={
          "p-12 text-center rounded-2xl border border-zinc-200 " +
          "dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
        }
      >
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-black text-zinc-900 dark:text-white">
          {t("brands.restrictedTitle", "Acceso Restringido")}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
          {t(
            "brands.restrictedDesc",
            "Solo los usuarios con rol SUPER_ADMIN pueden administrar marcas."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
            {t("brands.title", "Gestión de Marcas")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t(
              "brands.subtitle",
              "Administración de empresas ISP independientes, aislamiento de datos, claves API y webhooks."
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
          <span>{t("brands.newBrand", "Nueva Marca")}</span>
        </Button>
      </div>

      {/* Filter / Metric Cards */}
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
                {t("brands.cardTotalTitle", "Total de Marcas")}
              </span>
              <div className="text-2xl font-black text-zinc-900 dark:text-white">
                {isLoading ? <Skeleton className="h-8 w-12" /> : total}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {t("brands.cardTotalDesc", "Empresas ISP registradas")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Activas */}
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
                {t("brands.cardActiveTitle", "Marcas Activas")}
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {isLoading ? <Skeleton className="h-8 w-12" /> : activeCount}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {t("brands.cardActiveDesc", "Operativas en la plataforma")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Inactivas */}
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
                {t("brands.cardInactiveTitle", "Marcas Inactivas")}
              </span>
              <div className="text-2xl font-black text-zinc-500 dark:text-zinc-400">
                {isLoading ? <Skeleton className="h-8 w-12" /> : inactiveCount}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {t("brands.cardInactiveDesc", "Acceso suspendido o borrador")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Con Nodos */}
        <Card
          onClick={() => handleFilterCardClick("nodes")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isWithNodesFilterActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
                "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
                "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t("brands.cardNodesTitle", "Con Nodos MikroTik")}
              </span>
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
                {isLoading ? <Skeleton className="h-8 w-12" /> : withNodesCount}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {t("brands.cardNodesDesc", "Infraestructura desplegada")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
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
              "brands.searchPlaceholder",
              "Buscar por nombre, slug, razón social o NIT..."
            )}
            className="pl-9 pr-9 h-10 rounded-xl text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={currentStatus}
            onValueChange={(val) => updateUrlParams({ status: val, page: 1 })}
          >
            <SelectTrigger className="h-10 w-full sm:w-40 rounded-xl text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("brands.filterAll", "Todas las Marcas")}
              </SelectItem>
              <SelectItem value="active">
                {t("brands.filterActive", "Activas")}
              </SelectItem>
              <SelectItem value="inactive">
                {t("brands.filterInactive", "Inactivas")}
              </SelectItem>
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
                  aria-label="Seleccionar todas las marcas"
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
                {t("brands.tableBrand", "Marca")}
              </TableHead>
              <TableHead className="text-xs font-bold">
                {t("brands.tableLegal", "Razón Social / NIT")}
              </TableHead>
              <TableHead className="text-xs font-bold">
                {t("brands.tableRegional", "Configuración Regional")}
              </TableHead>
              <TableHead className="text-xs font-bold">
                {t("brands.tableResources", "Recursos Vinculados")}
              </TableHead>
              <TableHead className="text-xs font-bold">
                {t("brands.tableStatus", "Estado")}
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
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-xl" />
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : brands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <Building2 className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    {t("brands.emptyTitle", "No se encontraron marcas")}
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    {t(
                      "brands.emptyDesc",
                      "Ajusta tus filtros de búsqueda o registra una nueva empresa ISP."
                    )}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              brands.map((brand) => {
                const isSelected = selectedBrandIds.includes(brand.id);
                const initial = brand.name[0]?.toUpperCase() || "B";

                const dropdownItems: ActionDropdownItem[] = [
                  {
                    label: t("brands.actionEdit", "Editar Marca"),
                    icon: Edit2,
                    onClick: () => handleOpenEdit(brand),
                  },
                  {
                    label: brand.isActive
                      ? t("brands.actionDeactivate", "Desactivar Marca")
                      : t("brands.actionActivate", "Activar Marca"),
                    icon: brand.isActive ? XCircle : CheckCircle2,
                    variant: brand.isActive ? "default" : "emerald",
                    onClick: () => handleToggleStatus(brand),
                  },
                  {
                    label: t("brands.actionDelete", "Eliminar Marca"),
                    icon: Trash2,
                    variant: "destructive",
                    onClick: () => setDeletingBrandId(brand.id),
                  },
                ];

                return (
                  <TableRow
                    key={brand.id}
                    className={cn(
                      "transition-colors border-zinc-100 dark:border-zinc-800/80",
                      isSelected && "bg-emerald-500/5 dark:bg-emerald-500/10"
                    )}
                  >
                    <TableCell className="p-2 text-center align-middle w-10">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar marca ${brand.name}`}
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(brand.id)}
                        className={
                          "rounded border-zinc-300 dark:border-zinc-700 " +
                          "text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        }
                      />
                    </TableCell>

                    <TableCell className="p-2 text-center align-middle w-10">
                      <ActionsDropdown items={dropdownItems} align="left" />
                    </TableCell>

                    {/* Brand Name & Slug */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            "h-9 w-9 rounded-xl bg-emerald-500/10 border " +
                            "border-emerald-500/30 text-emerald-600 " +
                            "dark:text-emerald-400 font-black text-xs " +
                            "flex items-center justify-center shrink-0"
                          }
                        >
                          {initial}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span
                            className={
                              "font-extrabold text-xs text-zinc-900 " +
                              "dark:text-zinc-100 truncate"
                            }
                          >
                            {brand.name}
                          </span>
                          <span
                            className={
                              "font-mono text-[10px] text-zinc-500 " +
                              "dark:text-zinc-400 truncate"
                            }
                          >
                            {brand.slug}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Legal Name & Tax ID */}
                    <TableCell>
                      <div className="flex flex-col text-xs leading-relaxed">
                        <span
                          className={
                            "font-medium text-zinc-800 dark:text-zinc-200 " +
                            "truncate max-w-[180px]"
                          }
                        >
                          {brand.legalName || "—"}
                        </span>
                        {brand.taxId && (
                          <span className="font-mono text-[11px] text-zinc-500">
                            NIT: {brand.taxId}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Regional Settings */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <Badge
                          variant="secondary"
                          className="font-mono text-[10px] uppercase font-bold"
                        >
                          {brand.currency}
                        </Badge>
                        <span className="text-zinc-400">•</span>
                        <span className="text-zinc-600 dark:text-zinc-400 text-xs">
                          {brand.timezone}
                        </span>
                        <span className="text-zinc-400">•</span>
                        <span className="text-zinc-500 uppercase text-[10px] font-bold">
                          {brand.locale}
                        </span>
                      </div>
                    </TableCell>

                    {/* Linked Resources */}
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={
                            "inline-flex items-center gap-1 font-bold " +
                            "text-sky-600 dark:text-sky-400"
                          }
                          title="Nodos MikroTik"
                        >
                          <Server className="h-3 w-3" />
                          {brand._count?.mikrotikNodes ?? 0}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        <span
                          className={
                            "inline-flex items-center gap-1 font-bold " +
                            "text-indigo-600 dark:text-indigo-400"
                          }
                          title="Abonados / Clientes"
                        >
                          <Network className="h-3 w-3" />
                          {brand._count?.clients ?? 0}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        <span
                          className={
                            "inline-flex items-center gap-1 font-bold " +
                            "text-zinc-600 dark:text-zinc-400"
                          }
                          title="Usuarios con acceso"
                        >
                          <Users className="h-3 w-3" />
                          {brand._count?.users ?? 0}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] font-extrabold uppercase",
                          brand.isActive
                            ? "bg-emerald-500/10 text-emerald-600 " +
                              "dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        )}
                      >
                        {brand.isActive
                          ? t("common.active", "Activa")
                          : t("common.inactive", "Inactiva")}
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
          <PaginationControl
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => updateUrlParams({ page })}
          />
        </div>
      </Card>

      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedBrandIds.length}
        onClearSelection={() => setSelectedBrandIds([])}
        onActivate={handleBulkActivate}
        onDeactivate={handleBulkDeactivate}
        onDelete={handleBulkDelete}
        deleteConfirmationWord="ELIMINAR"
        resourceName={t("brands.nodesCount", "marcas")}
        isLoading={isActionLoading}
      />

      {/* Full CRUD Dialog (Create & Edit) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 dark:text-white">
              {editingBrand
                ? t("brands.modalEditTitle", "Editar Marca")
                : t("brands.modalCreateTitle", "Registrar Nueva Marca")}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              {t(
                "brands.subtitle",
                "Completa los datos de la empresa ISP para la configuración multi-inquilino."
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5 pt-2">
            {/* Section 1: General Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <span>{t("brands.tabGeneral", "Información General")}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="brand-name" className="text-xs font-semibold">
                    {t("brands.fieldName", "Nombre Comercial *")}
                  </Label>
                  <Input
                    id="brand-name"
                    placeholder={t(
                      "brands.fieldNamePlaceholder",
                      "ej. Serkoi Telecom"
                    )}
                    className="rounded-xl text-xs h-9"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="brand-slug" className="text-xs font-semibold">
                    {t("brands.fieldSlug", "Slug Identificador *")}
                  </Label>
                  <Input
                    id="brand-slug"
                    placeholder={t("brands.fieldSlugPlaceholder", "ej. serkoi")}
                    className={cn(
                      "rounded-xl text-xs h-9 font-mono lowercase",
                      errors.slug && "border-rose-500 ring-2 ring-rose-500/20"
                    )}
                    {...register("slug")}
                  />
                  {errors.slug && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {errors.slug.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="brand-legal" className="text-xs font-semibold">
                    {t("brands.fieldLegalName", "Razón Social")}
                  </Label>
                  <Input
                    id="brand-legal"
                    placeholder={t(
                      "brands.fieldLegalNamePlaceholder",
                      "ej. SERKOI S.A.S."
                    )}
                    className="rounded-xl text-xs h-9"
                    {...register("legalName")}
                  />
                  {errors.legalName && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {errors.legalName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="brand-tax" className="text-xs font-semibold">
                    {t("brands.fieldTaxId", "NIT / Identificación Fiscal")}
                  </Label>
                  <Input
                    id="brand-tax"
                    placeholder={t(
                      "brands.fieldTaxIdPlaceholder",
                      "ej. 901234567-1"
                    )}
                    className="rounded-xl text-xs h-9 font-mono"
                    {...register("taxId")}
                  />
                  {errors.taxId && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {errors.taxId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="brand-logo" className="text-xs font-semibold">
                  {t("brands.fieldLogo", "URL del Logotipo")}
                </Label>
                <Input
                  id="brand-logo"
                  placeholder={t(
                    "brands.fieldLogoPlaceholder",
                    "https://misitio.com/logo.png"
                  )}
                  className="rounded-xl text-xs h-9"
                  {...register("logo")}
                />
                {errors.logo && (
                  <p className="text-[11px] text-rose-500 font-medium">
                    {errors.logo.message}
                  </p>
                )}
              </div>
            </div>

            {/* Section 2: Regional Config */}
            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {t("brands.tabRegional", "Configuración Regional")}
                </span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    {t("brands.fieldCurrency", "Moneda *")}
                  </Label>
                  <Select
                    value={watchCurrency}
                    onValueChange={(val) => setValue("currency", val)}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COP">COP ($ - Pesos Col.)</SelectItem>
                      <SelectItem value="USD">USD ($ - Dólar EE.UU.)</SelectItem>
                      <SelectItem value="MXN">MXN ($ - Pesos Mex.)</SelectItem>
                      <SelectItem value="EUR">EUR (€ - Euro)</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.currency && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {errors.currency.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="brand-timezone" className="text-xs font-semibold">
                    {t("brands.fieldTimezone", "Zona Horaria *")}
                  </Label>
                  <Input
                    id="brand-timezone"
                    placeholder="America/Bogota"
                    className="rounded-xl text-xs h-9 font-mono"
                    {...register("timezone")}
                  />
                  {errors.timezone && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {errors.timezone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    {t("brands.fieldLocale", "Idioma Predeterminado *")}
                  </Label>
                  <Select
                    value={watchLocale}
                    onValueChange={(val) => setValue("locale", val)}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español (es)</SelectItem>
                      <SelectItem value="en">English (en)</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.locale && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {errors.locale.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Integrations & Webhooks */}
            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                <span>{t("brands.tabIntegrations", "Webhooks & API")}</span>
              </h4>

              <div className="space-y-3">
                {/* API Key with Copy & Regenerate */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="brand-api-key"
                      className="text-xs font-semibold"
                    >
                      {t("brands.fieldApiKey", "Clave API (X-API-KEY)")}
                    </Label>
                    <div className="flex items-center gap-1.5">
                      {watchApiKey && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyApiKey(watchApiKey)}
                          className={
                            "h-6 px-2 text-[11px] text-zinc-500 " +
                            "hover:text-emerald-600 gap-1"
                          }
                          title={t("brands.copyApiKey", "Copiar Clave")}
                        >
                          <Copy className="h-3 w-3" />
                          <span>{t("brands.copyApiKey", "Copiar")}</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleModalRegenerateApiKey}
                        disabled={isActionLoading}
                        className={
                          "h-6 px-2 text-[11px] text-zinc-600 " +
                          "dark:text-zinc-300 gap-1 rounded-lg"
                        }
                      >
                        <RefreshCw
                          className={cn(
                            "h-3 w-3",
                            isActionLoading && "animate-spin"
                          )}
                        />
                        <span>
                          {t("brands.btnRegenerateKey", "Regenerar")}
                        </span>
                      </Button>
                    </div>
                  </div>
                  <Input
                    id="brand-api-key"
                    value={watchApiKey || ""}
                    readOnly
                    placeholder="isp_live_..."
                    className={
                      "rounded-xl text-xs h-9 font-mono " +
                      "bg-zinc-50 dark:bg-zinc-950/60 select-all"
                    }
                  />
                  <p className="text-[10px] text-zinc-400">
                    {t(
                      "brands.fieldApiKeyDesc",
                      "Clave de autenticación para llamadas de API y servicios externos."
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="brand-billing-webhook"
                    className="text-xs font-semibold"
                  >
                    {t(
                      "brands.fieldBillingWebhook",
                      "Webhook Facturación N8N"
                    )}
                  </Label>
                  <Input
                    id="brand-billing-webhook"
                    placeholder={t(
                      "brands.fieldBillingWebhookPlaceholder",
                      "https://n8n.ejemplo.com/webhook/billing"
                    )}
                    className="rounded-xl text-xs h-9 font-mono"
                    {...register("billingWebhookUrl")}
                  />
                  {errors.billingWebhookUrl && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {errors.billingWebhookUrl.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="brand-general-webhook"
                    className="text-xs font-semibold"
                  >
                    {t("brands.fieldGeneralWebhook", "Webhook General N8N")}
                  </Label>
                  <Input
                    id="brand-general-webhook"
                    placeholder={t(
                      "brands.fieldGeneralWebhookPlaceholder",
                      "https://n8n.ejemplo.com/webhook/events"
                    )}
                    className="rounded-xl text-xs h-9 font-mono"
                    {...register("generalWebhookUrl")}
                  />
                  {errors.generalWebhookUrl && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {errors.generalWebhookUrl.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Dialog Footer */}
            <DialogFooter className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
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
                disabled={isSubmitting || isActionLoading}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
              >
                {isSubmitting || isActionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t("common.save", "Guardando...")}</span>
                  </>
                ) : (
                  <span>{t("common.save", "Guardar Marca")}</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(deletingBrandId)}
        onOpenChange={(open) => !open && setDeletingBrandId(null)}
      >
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              <span>
                {t(
                  "brands.deleteConfirmTitle",
                  "¿Eliminar esta marca definitivamente?"
                )}
              </span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t(
                "brands.deleteConfirmDesc",
                "Esta acción es irreversible y solo se permite si la marca no tiene nodos ni clientes vinculados."
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

export default function BrandsDashboardPage() {
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
      <BrandsTableContent />
    </Suspense>
  );
}
