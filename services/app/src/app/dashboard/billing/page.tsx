"use client";

import React, {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Receipt,
  Plus,
  Search,
  X,
  DollarSign,
  CreditCard,
  CheckCircle2,
  Clock,
  Ban,
  Edit2,
  Trash2,
  Loader2,
  List,
  LayoutGrid,
  FileText,
  Power,
  PowerOff,
  User,
  UploadCloud,
} from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { useTranslation } from "@/components/providers/i18n-provider";
import { ReconciliationModal } from "@/components/billing/reconciliation-modal";
import {
  getPaymentsPaginated,
  savePayment,
  togglePaymentStatus,
  deletePayment,
  bulkTogglePaymentsStatus,
  bulkDeletePayments,
} from "@/actions/billing";
import { getContracts } from "@/actions/contracts";
import type {
  Payment,
  Contract,
  PaymentMethod,
  PaymentStatus,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ActionsDropdown,
  type ActionDropdownItem,
} from "@/components/ui/actions-dropdown";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { PaginationControl } from "@/components/ui/pagination-control";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PaymentFormState {
  id?: string;
  contractId: string;
  periodBilled: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  externalReference: string;
  notes: string;
}

const getDefaultPeriod = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
};

const DEFAULT_FORM: PaymentFormState = {
  contractId: "",
  periodBilled: getDefaultPeriod(),
  amount: 50000,
  paymentMethod: "NEQUI",
  status: "APROBADO",
  externalReference: "",
  notes: "",
};

function BillingTableContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeBrandId, activeBrand } = useBrand();
  const effectiveBrandId =
    activeBrand?.id || (activeBrandId !== "ALL" ? activeBrandId : undefined);

  // URL Synced Parameters
  const currentPage = Number(searchParams.get("page")) || 1;
  const searchQuery = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";
  const methodFilter = searchParams.get("method") || "all";
  const viewMode = searchParams.get("view") === "grid" ? "grid" : "list";
  const ITEMS_PER_PAGE = 10;

  // Data & Metrics State
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [voidedCount, setVoidedCount] = useState<number>(0);
  const [totalApprovedAmount, setTotalApprovedAmount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchInput, setSearchInput] = useState<string>(searchQuery);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auxiliary Contracts List for Create/Edit Modal
  const [contractsList, setContractsList] = useState<Contract[]>([]);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] =
    useState<boolean>(false);
  const [editingPayment, setEditingPayment] =
    useState<PaymentFormState>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Digital Receipt Preview Modal State
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);

  // Delete Confirmation State
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  const createQueryString = useCallback(
    (params: Record<string, string | number | null>) => {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(params)) {
        if (
          value === null ||
          value === "" ||
          value === "all" ||
          value === "ALL" ||
          (key === "view" && value === "list")
        ) {
          newSearchParams.delete(key);
        } else {
          newSearchParams.set(key, String(value));
        }
      }
      return newSearchParams.toString();
    },
    [searchParams]
  );

  const updateUrlParams = useCallback(
    (params: Record<string, string | number | null>) => {
      const qs = createQueryString(params);
      router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [createQueryString, pathname, router]
  );

  // Sync search input with URL
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const loadPaymentsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getPaymentsPaginated(
        currentPage,
        ITEMS_PER_PAGE,
        searchQuery,
        statusFilter,
        methodFilter,
        activeBrandId
      );

      if (res.success && res.data) {
        setPayments(res.data.payments);
        setTotalCount(res.data.totalCount);
        setApprovedCount(res.data.approvedCount);
        setPendingCount(res.data.pendingCount);
        setVoidedCount(res.data.voidedCount);
        setTotalApprovedAmount(res.data.totalApprovedAmount);
        setTotalPages(res.data.totalPages);
        setSelectedIds([]);
      } else {
        toast.error(res.error || t("common.errorGeneric", "Error"));
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Ocurrió un error inesperado"));
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    searchQuery,
    statusFilter,
    methodFilter,
    activeBrandId,
    t,
  ]);

  useEffect(() => {
    loadPaymentsData();
  }, [loadPaymentsData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ search: searchInput.trim(), page: 1 });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateUrlParams({ search: null, page: 1 });
  };

  // Multi-selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(payments.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const isAllSelected = useMemo(() => {
    return (
      payments.length > 0 && payments.every((p) => selectedIds.includes(p.id))
    );
  }, [payments, selectedIds]);

  // Open Create / Edit Dialog
  const ensureContractsLoaded = async (): Promise<Contract[]> => {
    const res = await getContracts({
      brandId: activeBrandId,
      pageSize: 50,
    });
    if (res.success && res.data) {
      setContractsList(res.data.items);
      return res.data.items;
    }
    return [];
  };

  const handleOpenCreateModal = async () => {
    const list = await ensureContractsLoaded();
    const firstContract = list[0];
    setEditingPayment({
      ...DEFAULT_FORM,
      contractId: firstContract?.id || "",
      amount: firstContract?.plan?.priceCop || 50000,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (payment: Payment) => {
    await ensureContractsLoaded();
    setEditingPayment({
      id: payment.id,
      contractId: payment.contractId,
      periodBilled: payment.periodBilled,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      externalReference: payment.externalReference || "",
      notes: payment.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedBrandId =
      activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id || "";

    if (!resolvedBrandId) {
      toast.error("Selecciona una marca activa para continuar.");
      return;
    }

    if (!editingPayment.contractId || editingPayment.amount <= 0) {
      toast.error("Completa el contrato y un monto válido mayor a 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await savePayment({
        ...editingPayment,
        brandId: resolvedBrandId,
        externalReference: editingPayment.externalReference || null,
        notes: editingPayment.notes || null,
      });

      if (res.success) {
        toast.success(
          editingPayment.id
            ? t(
                "billing.updateSuccess",
                "Registro de pago actualizado exitosamente."
              )
            : t(
                "billing.saveSuccess",
                "Pago registrado exitosamente. Servicio verificado en router."
              )
        );
        setIsModalOpen(false);
        loadPaymentsData();
      } else {
        toast.error(res.error || "Error al guardar el registro de pago.");
      }
    } catch (_err) {
      toast.error("Error de red al guardar el pago.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Payment Status (Approve / Void)
  const handleToggleStatus = async (payment: Payment) => {
    const nextStatus: PaymentStatus =
      payment.status === "APROBADO" ? "ANULADO" : "APROBADO";
    const res = await togglePaymentStatus(payment.id, nextStatus);
    if (res.success) {
      toast.success(
        t(
          "billing.statusSuccess",
          "Estado del pago actualizado correctamente."
        )
      );
      loadPaymentsData();
    } else {
      toast.error(res.error || "Error al cambiar el estado del pago.");
    }
  };

  // Single Delete Handler
  const handleConfirmDelete = async () => {
    if (!paymentToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await deletePayment(paymentToDelete.id);
      if (res.success) {
        toast.success(
          t("billing.deleteSuccess", "Registro de pago eliminado exitosamente")
        );
        setPaymentToDelete(null);
        loadPaymentsData();
      } else {
        toast.error(res.error || "No se pudo eliminar el registro de pago.");
      }
    } catch (_err) {
      toast.error("Error al eliminar el registro de pago.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Actions Handlers
  const handleBulkApprove = async () => {
    const res = await bulkTogglePaymentsStatus(selectedIds, "APROBADO");
    if (res.success) {
      toast.success(
        t("billing.bulkApproveSuccess", "Pagos aprobados correctamente")
      );
      loadPaymentsData();
    } else {
      toast.error(res.error || "Error al aprobar pagos en lote.");
    }
  };

  const handleBulkVoid = async () => {
    const res = await bulkTogglePaymentsStatus(selectedIds, "ANULADO");
    if (res.success) {
      toast.success(
        t("billing.bulkVoidSuccess", "Pagos anulados correctamente")
      );
      loadPaymentsData();
    } else {
      toast.error(res.error || "Error al anular pagos en lote.");
    }
  };

  const handleBulkDelete = async () => {
    const res = await bulkDeletePayments(selectedIds);
    if (res.success && res.data) {
      toast.success(
        `${res.data.deletedCount} ${t(
          "billing.bulkDeleteSuccess",
          "Registros de pago eliminados correctamente"
        )}`
      );
      loadPaymentsData();
    } else {
      toast.error(res.error || "Error al eliminar pagos en lote.");
    }
  };

  const buildPaymentRowActions = (payment: Payment): ActionDropdownItem[] => {
    const isApproved = payment.status === "APROBADO";
    return [
      {
        label: t("billing.actionViewReceipt", "Ver Recibo Digital"),
        icon: FileText,
        onClick: () => setReceiptPayment(payment),
      },
      {
        label: t("billing.actionEdit", "Editar Recaudo"),
        icon: Edit2,
        onClick: () => handleOpenEditModal(payment),
      },
      {
        label: isApproved
          ? t("billing.actionVoid", "Anular Recibo")
          : t("billing.actionApprove", "Aprobar Pago"),
        icon: isApproved ? PowerOff : Power,
        variant: isApproved ? "default" : "emerald",
        onClick: () => handleToggleStatus(payment),
      },
      {
        label: t("billing.actionDelete", "Eliminar Registro"),
        icon: Trash2,
        variant: "destructive",
        onClick: () => setPaymentToDelete(payment),
      },
    ];
  };

  const renderStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "APROBADO":
        return (
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full",
              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              "border border-emerald-500/20 gap-1"
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            APROBADO
          </Badge>
        );
      case "PENDIENTE":
        return (
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full",
              "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              "border border-amber-500/20 gap-1"
            )}
          >
            <Clock className="h-3 w-3" />
            PENDIENTE
          </Badge>
        );
      case "ANULADO":
      case "RECHAZADO":
        return (
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full",
              "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              "border border-rose-500/20 gap-1"
            )}
          >
            <Ban className="h-3 w-3" />
            {status}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Active Filter States for the 4 Metric Cards
  const isTotalCardActive = statusFilter === "all" && methodFilter === "all";
  const isApprovedCardActive = statusFilter === "APROBADO";
  const isPendingCardActive = statusFilter === "PENDIENTE";
  const isVoidedCardActive =
    statusFilter === "VOIDED" ||
    statusFilter === "ANULADO" ||
    statusFilter === "RECHAZADO";

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
            {t("billing.title", "Facturación & Recaudos")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {t(
              "billing.subtitle",
              "Registro de cobros, reactivación en MikroTik y recibos digitales."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsReconcileModalOpen(true)}
            className={cn(
              "rounded-xl gap-2 text-xs font-semibold border-zinc-200",
              "dark:border-zinc-800 shadow-xs"
            )}
          >
            <UploadCloud className="h-4 w-4 text-emerald-500" />
            {t("billing.reconcileBtn", "Conciliar Archivo")}
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className={cn(
              "rounded-xl gap-2 text-xs font-semibold bg-emerald-600",
              "hover:bg-emerald-700 text-white shadow-xs"
            )}
          >
            <Plus className="h-4 w-4" />
            {t("billing.newPayment", "Registrar Recaudo")}
          </Button>
        </div>
      </div>

      {/* Filter Metric Cards Standard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Recaudos */}
        <Card
          onClick={() =>
            updateUrlParams({ status: "all", method: "all", page: 1 })
          }
          className={cn(
            cardBaseClasses,
            isTotalCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn(
                  "text-xs font-bold text-zinc-500 dark:text-zinc-400",
                  "uppercase tracking-wider"
                )}
              >
                {t("billing.cardTotalTitle", "Total de Recaudos")}
              </p>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                {isLoading ? <Skeleton className="h-8 w-14" /> : totalCount}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t("billing.cardTotalDesc", "Transacciones registradas")}
              </p>
            </div>
            <div
              className={cn(
                "p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800",
                "text-zinc-600 dark:text-zinc-300"
              )}
            >
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Pagos Aprobados */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isApprovedCardActive ? "all" : "APROBADO",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isApprovedCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn(
                  "text-xs font-bold text-emerald-600",
                  "dark:text-emerald-400 uppercase tracking-wider"
                )}
              >
                {t("billing.cardApprovedTitle", "Pagos Aprobados")}
              </p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {isLoading ? <Skeleton className="h-8 w-14" /> : approvedCount}
              </h3>
              <p className="text-[11px] font-mono font-semibold text-zinc-400">
                ${Number(totalApprovedAmount).toLocaleString("es-CO")} COP
              </p>
            </div>
            <div
              className={cn(
                "p-3 rounded-xl bg-emerald-500/10",
                "text-emerald-600 dark:text-emerald-400"
              )}
            >
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Pagos Pendientes */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isPendingCardActive ? "all" : "PENDIENTE",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isPendingCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn(
                  "text-xs font-bold text-amber-600",
                  "dark:text-amber-400 uppercase tracking-wider"
                )}
              >
                {t("billing.cardPendingTitle", "Pagos Pendientes")}
              </p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {isLoading ? <Skeleton className="h-8 w-14" /> : pendingCount}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t("billing.cardPendingDesc", "En validación bancaria")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Anulados / Rechazados */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isVoidedCardActive ? "all" : "VOIDED",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isVoidedCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">
                {t("billing.cardVoidedTitle", "Anulados / Rechazados")}
              </p>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {isLoading ? <Skeleton className="h-8 w-14" /> : voidedCount}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t("billing.cardVoidedDesc", "Recibos sin efecto contable")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
              <Ban className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar with Icon-Only View Switcher */}
      <div
        className={cn(
          "flex flex-col md:flex-row gap-3 items-stretch",
          "md:items-center justify-between"
        )}
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
              "billing.searchPlaceholder",
              "Buscar por recibo, contrato, titular, documento, periodo o referencia..."
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

        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val) => updateUrlParams({ status: val, page: 1 })}
          >
            <SelectTrigger
              className={cn(
                "w-full sm:w-44 rounded-xl text-xs h-10",
                "border-zinc-200 dark:border-zinc-800 bg-white",
                "dark:bg-zinc-900/60 font-medium"
              )}
            >
              <SelectValue
                placeholder={t(
                  "billing.filterStatusAll",
                  "Todos los Estados"
                )}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="all">
                {t("billing.filterStatusAll", "Todos los Estados")}
              </SelectItem>
              <SelectItem value="APROBADO">
                {t("billing.filterApproved", "Aprobados")}
              </SelectItem>
              <SelectItem value="PENDIENTE">
                {t("billing.filterPending", "Pendientes")}
              </SelectItem>
              <SelectItem value="VOIDED">
                {t("billing.filterVoided", "Anulados / Rechazados")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Method Filter */}
          <Select
            value={methodFilter}
            onValueChange={(val) => updateUrlParams({ method: val, page: 1 })}
          >
            <SelectTrigger
              className={cn(
                "w-full sm:w-40 rounded-xl text-xs h-10",
                "border-zinc-200 dark:border-zinc-800 bg-white",
                "dark:bg-zinc-900/60 font-medium"
              )}
            >
              <SelectValue
                placeholder={t("billing.filterMethodAll", "Todos los Medios")}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="all">
                {t("billing.filterMethodAll", "Todos los Medios")}
              </SelectItem>
              <SelectItem value="EFECTIVO">Efectivo</SelectItem>
              <SelectItem value="EFECTY">Efecty</SelectItem>
              <SelectItem value="NEQUI">Nequi</SelectItem>
              <SelectItem value="DAVIPLATA">Daviplata</SelectItem>
              <SelectItem value="BANCOLOMBIA">Bancolombia</SelectItem>
              <SelectItem value="PAYU">PayU</SelectItem>
              <SelectItem value="OTRO">Otro</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode Switcher: List vs Grid (Icon-Only Standard) */}
          <div
            className={cn(
              "flex items-center p-1 rounded-xl bg-zinc-100",
              "dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60"
            )}
          >
            <button
              type="button"
              onClick={() => updateUrlParams({ view: "list" })}
              title={t("billing.viewList", "Vista Lista")}
              className={cn(
                "p-1.5 rounded-lg text-xs transition-all flex items-center gap-1",
                viewMode === "list"
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
              title={t("billing.viewGrid", "Vista Tarjetas")}
              className={cn(
                "p-1.5 rounded-lg text-xs transition-all flex items-center gap-1",
                viewMode === "grid"
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
      {viewMode === "list" ? (
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
                  {t("billing.tableReceipt", "Recibo / Factura")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("billing.tableContract", "Contrato & Titular")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("billing.tablePeriod", "Periodo Facturado")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("billing.tableAmount", "Monto Pagado")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("billing.tableMethod", "Medio de Pago")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("billing.tableReference", "Referencia / Notas")}
                </TableHead>
                <TableHead
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    "text-center"
                  )}
                >
                  {t("billing.tableStatus", "Estado")}
                </TableHead>
                <TableHead
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    "text-right"
                  )}
                >
                  {t("billing.tableDate", "Fecha Registro")}
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
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-5 w-20 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-20 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-64 text-center p-8 space-y-3"
                  >
                    <div
                      className={cn(
                        "p-3 w-12 h-12 rounded-2xl bg-zinc-100",
                        "dark:bg-zinc-800 text-zinc-400 mx-auto flex",
                        "items-center justify-center"
                      )}
                    >
                      <Receipt className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {t(
                        "billing.emptyTitle",
                        "No se encontraron registros de pago"
                      )}
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      {t(
                        "billing.emptyDesc",
                        "Ajusta tus filtros de búsqueda o registra un nuevo recaudo."
                      )}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const rowActions = buildPaymentRowActions(p);

                  return (
                    <TableRow
                      key={p.id}
                      className={cn(
                        "transition-colors border-b border-zinc-100",
                        "dark:border-zinc-800/60",
                        isSelected
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                          : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30"
                      )}
                    >
                      {/* Checkbox */}
                      <TableCell className="p-2 text-center align-middle w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            handleSelectOne(p.id, e.target.checked)
                          }
                          className={cn(
                            "rounded border-zinc-300 dark:border-zinc-700",
                            "text-emerald-600 focus:ring-emerald-500 h-4 w-4",
                            "accent-emerald-600 cursor-pointer"
                          )}
                        />
                      </TableCell>

                      {/* ActionsDropdown */}
                      <TableCell className="p-2 text-center align-middle w-10">
                        <ActionsDropdown align="left" items={rowActions} />
                      </TableCell>

                      {/* Receipt / Invoice */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setReceiptPayment(p)}
                          className={cn(
                            "font-mono font-extrabold text-xs text-emerald-600",
                            "dark:text-emerald-400 hover:underline cursor-pointer"
                          )}
                        >
                          {p.invoiceNumber || `#${p.receiptNumber}`}
                        </button>
                      </TableCell>

                      {/* Contract & Subscriber */}
                      <TableCell>
                        <div className="flex flex-col max-w-[200px]">
                          <span
                            className={cn(
                              "font-bold text-xs text-zinc-900",
                              "dark:text-zinc-100 truncate"
                            )}
                          >
                            {p.contract?.client?.fullName}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400 truncate">
                            Contrato #{p.contract?.contractNumber}
                          </span>
                        </div>
                      </TableCell>

                      {/* Period Billed */}
                      <TableCell>
                        <span
                          className={cn(
                            "font-mono text-xs font-semibold",
                            "text-zinc-700 dark:text-zinc-300"
                          )}
                        >
                          {p.periodBilled}
                        </span>
                      </TableCell>

                      {/* Amount Paid */}
                      <TableCell>
                        <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
                          ${Number(p.amount).toLocaleString("es-CO")} COP
                        </span>
                      </TableCell>

                      {/* Payment Method */}
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1",
                            "rounded-full text-[10px] font-extrabold",
                            "bg-zinc-100 dark:bg-zinc-800 text-zinc-700",
                            "dark:text-zinc-300 border border-zinc-200",
                            "dark:border-zinc-700"
                          )}
                        >
                          <CreditCard className="h-3 w-3 text-zinc-500" />
                          {p.paymentMethod}
                        </span>
                      </TableCell>

                      {/* Reference / Notes */}
                      <TableCell>
                        <div className="flex flex-col max-w-[160px]">
                          <span
                            className={cn(
                              "font-mono text-[11px] text-zinc-700",
                              "dark:text-zinc-300 truncate"
                            )}
                          >
                            {p.externalReference || "En taquilla / efectivo"}
                          </span>
                          {p.notes && (
                            <span className="text-[10px] text-zinc-400 truncate">
                              {p.notes}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {renderStatusBadge(p.status)}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-right font-mono text-zinc-500 text-[11px]">
                        {new Date(p.createdAt).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Grid / Cards View */
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div
              className={cn(
                "p-12 text-center rounded-2xl border",
                "border-dashed border-zinc-300 dark:border-zinc-800"
              )}
            >
              <Receipt className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {t("billing.emptyTitle", "No se encontraron registros de pago")}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 mb-4">
                {t(
                  "billing.emptyDesc",
                  "Ajusta tus filtros de búsqueda o registra un nuevo recaudo."
                )}
              </p>
              <Button
                onClick={handleOpenCreateModal}
                size="sm"
                className={cn(
                  "rounded-xl bg-emerald-600 hover:bg-emerald-700",
                  "text-white text-xs font-semibold"
                )}
              >
                {t("billing.newPayment", "Registrar Recaudo")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {payments.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                const rowActions = buildPaymentRowActions(p);

                return (
                  <div
                    key={p.id}
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
                      {/* Top Bar: Checkbox + ActionsDropdown + ReceiptCode + Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              handleSelectOne(p.id, e.target.checked)
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
                              "font-mono bg-emerald-500/10 text-emerald-600",
                              "dark:text-emerald-400 border border-emerald-500/20"
                            )}
                          >
                            {p.invoiceNumber || `#${p.receiptNumber}`}
                          </span>
                        </div>

                        {renderStatusBadge(p.status)}
                      </div>

                      {/* Client Name & Amount */}
                      <h3
                        className={cn(
                          "text-base font-black text-zinc-900",
                          "dark:text-white leading-tight truncate"
                        )}
                      >
                        {p.contract?.client?.fullName}
                      </h3>
                      <p
                        className={cn(
                          "text-xs font-mono text-emerald-600",
                          "dark:text-emerald-400 font-extrabold mt-1"
                        )}
                      >
                        ${Number(p.amount).toLocaleString("es-CO")} COP
                      </p>

                      {/* Payment Telemetry Box */}
                      <div
                        className={cn(
                          "mt-4 p-3 rounded-xl bg-zinc-50",
                          "dark:bg-zinc-950/60 border border-zinc-200/70",
                          "dark:border-zinc-800/80 space-y-2 text-xs"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Contrato:</span>
                          <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                            #{p.contract?.contractNumber}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">
                            Periodo Facturado:
                          </span>
                          <span
                            className={cn(
                              "font-mono font-semibold",
                              "text-zinc-700 dark:text-zinc-300"
                            )}
                          >
                            {p.periodBilled}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Medio de Pago:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {p.paymentMethod}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex justify-between items-center pt-1",
                            "border-t border-zinc-200/50 dark:border-zinc-800/50"
                          )}
                        >
                          <span className="text-zinc-500">Referencia:</span>
                          <span
                            className={cn(
                              "font-mono text-zinc-700 dark:text-zinc-300",
                              "truncate max-w-[150px]"
                            )}
                          >
                            {p.externalReference || "En taquilla / efectivo"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div
                      className={cn(
                        "mt-4 pt-4 border-t border-zinc-100",
                        "dark:border-zinc-800/60 flex items-center",
                        "justify-between gap-2"
                      )}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(p)}
                        className="text-xs font-semibold rounded-xl"
                      >
                        {t("common.edit", "Editar")}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReceiptPayment(p)}
                        className={cn(
                          "rounded-xl gap-1.5 text-xs font-bold",
                          "border-emerald-500/30 text-emerald-600",
                          "dark:text-emerald-400 hover:bg-emerald-500/10"
                        )}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {t("billing.actionViewReceipt", "Ver Recibo")}
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

      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        onActivate={handleBulkApprove}
        onDeactivate={handleBulkVoid}
        onDelete={handleBulkDelete}
        resourceName="pagos"
      />

      {/* Digital Receipt Preview Modal */}
      <Dialog
        open={Boolean(receiptPayment)}
        onOpenChange={(open) => !open && setReceiptPayment(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <FileText className="h-5 w-5 text-emerald-500" />
              {t("billing.modalReceiptTitle", "Comprobante Digital de Pago")}
            </DialogTitle>
            <DialogDescription>
              Recibo oficial emitido por{" "}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {activeBrand?.name || "KONTROL ISP"}
              </span>
            </DialogDescription>
          </DialogHeader>

          {receiptPayment && (
            <div className="space-y-4 text-xs">
              <div
                className={cn(
                  "p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30",
                  "flex items-center justify-between"
                )}
              >
                <div>
                  <span
                    className={cn(
                      "text-[10px] uppercase font-bold",
                      "text-emerald-700 dark:text-emerald-300 block"
                    )}
                  >
                    Comprobante N°
                  </span>
                  <span
                    className={cn(
                      "font-mono text-base font-black",
                      "text-emerald-700 dark:text-emerald-300"
                    )}
                  >
                    {receiptPayment.invoiceNumber ||
                      `#${receiptPayment.receiptNumber}`}
                  </span>
                </div>
                {renderStatusBadge(receiptPayment.status)}
              </div>

              <div
                className={cn(
                  "p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60",
                  "border border-zinc-200 dark:border-zinc-800 space-y-2.5"
                )}
              >
                <div className="flex justify-between">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    Titular:
                  </span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {receiptPayment.contract?.client?.fullName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Documento:</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">
                    {receiptPayment.contract?.client?.documentNumber || "N/D"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Contrato de Servicio:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    #{receiptPayment.contract?.contractNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Periodo Facturado:</span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {receiptPayment.periodBilled}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Medio de Pago:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {receiptPayment.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ref. Transacción:</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {receiptPayment.externalReference ||
                      "En taquilla / efectivo"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Fecha y Hora:</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {new Date(receiptPayment.createdAt).toLocaleString("es-CO")}
                  </span>
                </div>
                {receiptPayment.notes && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block mb-0.5">
                      Observaciones:
                    </span>
                    <p className="text-zinc-700 dark:text-zinc-300">
                      {receiptPayment.notes}
                    </p>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "p-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-950",
                  "border border-zinc-800 flex items-center justify-between"
                )}
              >
                <span className="text-xs uppercase font-bold text-zinc-400">
                  Total Pagado
                </span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  ${Number(receiptPayment.amount).toLocaleString("es-CO")} COP
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReceiptPayment(null)}
              className="rounded-xl text-xs"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Payment Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              {editingPayment.id
                ? t("billing.modalEditTitle", "Editar Registro de Pago")
                : t("billing.modalCreateTitle", "Registrar Recaudo / Pago")}
            </DialogTitle>
            <DialogDescription>
              {editingPayment.id
                ? "Actualiza la información contable o el estado del comprobante."
                : "Registra un cobro y reactiva automáticamente en MikroTik."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePayment} className="space-y-3.5 mt-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t("billing.labelContract", "Contrato de Servicio *")}
              </Label>
              <Select
                value={editingPayment.contractId}
                onValueChange={(val) => {
                  const selected = contractsList.find((c) => c.id === val);
                  setEditingPayment({
                    ...editingPayment,
                    contractId: val,
                    amount:
                      !editingPayment.id && selected?.plan?.priceCop
                        ? selected.plan.priceCop
                        : editingPayment.amount,
                  });
                }}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Seleccionar contrato..." />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  {contractsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      #{c.contractNumber} — {c.client?.fullName} (
                      {c.plan?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("billing.labelPeriod", "Periodo Facturado *")}
                </Label>
                <Input
                  required
                  placeholder="ej. 2026-11"
                  value={editingPayment.periodBilled}
                  onChange={(e) =>
                    setEditingPayment({
                      ...editingPayment,
                      periodBilled: e.target.value,
                    })
                  }
                  className="rounded-xl text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("billing.labelAmount", "Monto ($ COP) *")}
                </Label>
                <Input
                  type="number"
                  required
                  value={editingPayment.amount}
                  onChange={(e) =>
                    setEditingPayment({
                      ...editingPayment,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="rounded-xl text-xs h-9 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("billing.labelMethod", "Medio de Pago")}
                </Label>
                <Select
                  value={editingPayment.paymentMethod}
                  onValueChange={(val) =>
                    setEditingPayment({
                      ...editingPayment,
                      paymentMethod: val as PaymentMethod,
                    })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem value="EFECTY">Efecty</SelectItem>
                    <SelectItem value="NEQUI">Nequi</SelectItem>
                    <SelectItem value="DAVIPLATA">Daviplata</SelectItem>
                    <SelectItem value="BANCOLOMBIA">Bancolombia</SelectItem>
                    <SelectItem value="PAYU">PayU</SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("billing.labelStatus", "Estado del Pago")}
                </Label>
                <Select
                  value={editingPayment.status}
                  onValueChange={(val) =>
                    setEditingPayment({
                      ...editingPayment,
                      status: val as PaymentStatus,
                    })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="APROBADO">Aprobado</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                    <SelectItem value="ANULADO">Anulado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t(
                  "billing.labelReference",
                  "Ref. Transacción / Comprobante"
                )}
              </Label>
              <Input
                placeholder="ej. M1042981"
                value={editingPayment.externalReference}
                onChange={(e) =>
                  setEditingPayment({
                    ...editingPayment,
                    externalReference: e.target.value,
                  })
                }
                className="rounded-xl text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t("billing.labelNotes", "Observaciones")}
              </Label>
              <Input
                placeholder="ej. Pago puntual en oficina central"
                value={editingPayment.notes}
                onChange={(e) =>
                  setEditingPayment({
                    ...editingPayment,
                    notes: e.target.value,
                  })
                }
                className="rounded-xl text-xs h-9"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl text-xs"
              >
                {t("common.cancel", "Cancelar")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "bg-emerald-600 hover:bg-emerald-700 text-white",
                  "rounded-xl text-xs font-bold"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Guardando...
                  </>
                ) : editingPayment.id ? (
                  t("common.saveChanges", "Guardar Cambios")
                ) : (
                  "Confirmar Pago & Reactivar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Premium Delete Confirmation AlertDialog */}
      <AlertDialog
        open={Boolean(paymentToDelete)}
        onOpenChange={(open) => !open && setPaymentToDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                "billing.deleteConfirmTitle",
                "¿Eliminar este registro de pago definitivamente?"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "billing.deleteConfirmDesc",
                "Esta acción eliminará el comprobante del historial contable de forma permanente."
              )}
              {paymentToDelete && (
                <span className="block mt-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  {paymentToDelete.invoiceNumber ||
                    `#${paymentToDelete.receiptNumber}`}{" "}
                  — {paymentToDelete.contract?.client?.fullName} ($
                  {Number(paymentToDelete.amount).toLocaleString("es-CO")} COP)
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">
              {t("common.cancel", "Cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs"
            >
              {t("billing.actionDelete", "Eliminar Registro")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reconciliation Modal */}
      <ReconciliationModal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
        brandId={effectiveBrandId}
        onSuccess={loadPaymentsData}
      />
    </div>
  );
}

export default function BillingDashboardPage() {
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
      <BillingTableContent />
    </Suspense>
  );
}
