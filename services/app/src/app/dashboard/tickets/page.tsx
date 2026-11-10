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
  Headphones,
  Plus,
  Search,
  X,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  Loader2,
  List,
  LayoutGrid,
  FileText,
  Power,
  PowerOff,
  User,
  Phone,
  Globe,
  Building2,
} from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  getTicketsPaginated,
  saveSupportTicket,
  updateTicketStatus,
  deleteSupportTicket,
  bulkToggleTicketsStatus,
  bulkDeleteTickets,
} from "@/actions/tickets";
import { getContracts } from "@/actions/contracts";
import type {
  SupportTicket,
  Contract,
  TicketChannel,
  IssueType,
  TicketPriority,
  TicketStatus,
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

interface TicketFormState {
  id?: string;
  contractId: string;
  channel: TicketChannel;
  issueType: IssueType;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
}

const DEFAULT_FORM: TicketFormState = {
  contractId: "",
  channel: "WHATSAPP_AI",
  issueType: "CORTE_TOTAL",
  priority: "MEDIA",
  status: "ABIERTO",
  description: "",
};

function TicketsTableContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeBrandId, activeBrand } = useBrand();

  // URL Synced Parameters
  const currentPage = Number(searchParams.get("page")) || 1;
  const searchQuery = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";
  const priorityFilter = searchParams.get("priority") || "all";
  const channelFilter = searchParams.get("channel") || "all";
  const viewMode = searchParams.get("view") === "grid" ? "grid" : "list";
  const ITEMS_PER_PAGE = 10;

  // Data & Metrics State
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [openCount, setOpenCount] = useState<number>(0);
  const [escalatedCount, setEscalatedCount] = useState<number>(0);
  const [resolvedCount, setResolvedCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchInput, setSearchInput] = useState<string>(searchQuery);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auxiliary Contracts Search & Selection State for Create/Edit Modal
  const [selectedContractForModal, setSelectedContractForModal] =
    useState<Contract | null>(null);
  const [contractSearchTerm, setContractSearchTerm] = useState<string>("");
  const [isSearchingContracts, setIsSearchingContracts] =
    useState<boolean>(false);
  const [contractSearchResults, setContractSearchResults] = useState<
    Contract[]
  >([]);
  const [hasSearchedContracts, setHasSearchedContracts] =
    useState<boolean>(false);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTicket, setEditingTicket] =
    useState<TicketFormState>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Case Dossier / AI Detail Modal State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null
  );

  // Delete Confirmation State
  const [ticketToDelete, setTicketToDelete] = useState<SupportTicket | null>(
    null
  );

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

  const loadTicketsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getTicketsPaginated(
        currentPage,
        ITEMS_PER_PAGE,
        searchQuery,
        statusFilter,
        priorityFilter,
        channelFilter,
        activeBrandId
      );

      if (res.success && res.data) {
        setTickets(res.data.tickets);
        setTotalCount(res.data.totalCount);
        setOpenCount(res.data.openCount);
        setEscalatedCount(res.data.escalatedCount);
        setResolvedCount(res.data.resolvedCount);
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
    priorityFilter,
    channelFilter,
    activeBrandId,
    t,
  ]);

  useEffect(() => {
    loadTicketsData();
  }, [loadTicketsData]);

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
      setSelectedIds(tickets.map((tk) => tk.id));
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
      tickets.length > 0 && tickets.every((tk) => selectedIds.includes(tk.id))
    );
  }, [tickets, selectedIds]);

  // Contract Search and Selection Handlers for Modal
  const handleSearchContractsForModal = async () => {
    if (!contractSearchTerm.trim()) {
      return;
    }
    setIsSearchingContracts(true);
    setHasSearchedContracts(true);
    try {
      const res = await getContracts({
        brandId: activeBrandId,
        search: contractSearchTerm.trim(),
        pageSize: 10,
      });
      if (res.success && res.data) {
        setContractSearchResults(res.data.items);
      } else {
        setContractSearchResults([]);
      }
    } catch (_err) {
      setContractSearchResults([]);
      toast.error("Error al buscar contratos.");
    } finally {
      setIsSearchingContracts(false);
    }
  };

  const handleSelectContract = (contract: Contract) => {
    setSelectedContractForModal(contract);
    setEditingTicket((prev) => ({
      ...prev,
      contractId: contract.id,
    }));
    setContractSearchResults([]);
    setHasSearchedContracts(false);
  };

  const handleClearSelectedContract = () => {
    setSelectedContractForModal(null);
    setEditingTicket((prev) => ({
      ...prev,
      contractId: "",
    }));
    setContractSearchResults([]);
    setHasSearchedContracts(false);
    setContractSearchTerm("");
  };

  const handleOpenCreateModal = () => {
    setSelectedContractForModal(null);
    setContractSearchTerm("");
    setContractSearchResults([]);
    setHasSearchedContracts(false);
    setEditingTicket(DEFAULT_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ticket: SupportTicket) => {
    if (ticket.contract) {
      setSelectedContractForModal(
        ticket.contract as unknown as Contract
      );
    } else {
      setSelectedContractForModal(null);
    }
    setContractSearchTerm("");
    setContractSearchResults([]);
    setHasSearchedContracts(false);
    setEditingTicket({
      id: ticket.id,
      contractId: ticket.contractId,
      channel: ticket.channel,
      issueType: ticket.issueType,
      priority: ticket.priority,
      status: ticket.status,
      description: ticket.description,
    });
    setIsModalOpen(true);
  };

  const handleSaveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedBrandId =
      activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id || "";

    if (!resolvedBrandId) {
      toast.error("Selecciona una marca activa para continuar.");
      return;
    }

    if (
      !editingTicket.contractId ||
      editingTicket.description.trim().length < 5
    ) {
      toast.error(
        "Completa el contrato y una descripción de al menos 5 caracteres."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveSupportTicket({
        ...editingTicket,
        brandId: resolvedBrandId,
      });

      if (res.success) {
        toast.success(
          editingTicket.id
            ? t(
                "tickets.updateSuccess",
                "Ticket de soporte actualizado exitosamente."
              )
            : t("tickets.saveSuccess", "Ticket de soporte creado exitosamente.")
        );
        setIsModalOpen(false);
        loadTicketsData();
      } else {
        toast.error(res.error || "Error al guardar el ticket.");
      }
    } catch (_err) {
      toast.error("Error de red al guardar el ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Ticket Status (Resolve / Reopen)
  const handleToggleStatus = async (ticket: SupportTicket) => {
    const isResolved =
      ticket.status === "RESUELTO" || ticket.status === "CERRADO";
    const nextStatus: TicketStatus = isResolved ? "ABIERTO" : "RESUELTO";
    const res = await updateTicketStatus(ticket.id, nextStatus);
    if (res.success) {
      toast.success(
        t(
          "tickets.statusSuccess",
          "Estado del ticket actualizado correctamente."
        )
      );
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket(null);
      }
      loadTicketsData();
    } else {
      toast.error(res.error || "Error al cambiar el estado del ticket.");
    }
  };

  // Single Delete Handler
  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await deleteSupportTicket(ticketToDelete.id);
      if (res.success) {
        toast.success(
          t("tickets.deleteSuccess", "Ticket eliminado exitosamente")
        );
        setTicketToDelete(null);
        loadTicketsData();
      } else {
        toast.error(res.error || "No se pudo eliminar el ticket.");
      }
    } catch (_err) {
      toast.error("Error al eliminar el ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Actions Handlers
  const handleBulkResolve = async () => {
    const res = await bulkToggleTicketsStatus(selectedIds, "RESUELTO");
    if (res.success) {
      toast.success(
        t(
          "tickets.bulkResolveSuccess",
          "Tickets marcados como resueltos correctamente"
        )
      );
      loadTicketsData();
    } else {
      toast.error(res.error || "Error al resolver tickets en lote.");
    }
  };

  const handleBulkReopen = async () => {
    const res = await bulkToggleTicketsStatus(selectedIds, "ABIERTO");
    if (res.success) {
      toast.success(
        t("tickets.bulkReopenSuccess", "Tickets reabiertos correctamente")
      );
      loadTicketsData();
    } else {
      toast.error(res.error || "Error al reabrir tickets en lote.");
    }
  };

  const handleBulkDelete = async () => {
    const res = await bulkDeleteTickets(selectedIds);
    if (res.success && res.data) {
      toast.success(
        `${res.data.deletedCount} ${t(
          "tickets.bulkDeleteSuccess",
          "Tickets eliminados correctamente"
        )}`
      );
      loadTicketsData();
    } else {
      toast.error(res.error || "Error al eliminar tickets en lote.");
    }
  };

  const buildTicketRowActions = (
    ticket: SupportTicket
  ): ActionDropdownItem[] => {
    const isResolved =
      ticket.status === "RESUELTO" || ticket.status === "CERRADO";
    return [
      {
        label: t("tickets.actionViewDetail", "Ver Expediente & IA"),
        icon: FileText,
        onClick: () => setSelectedTicket(ticket),
      },
      {
        label: t("tickets.actionEdit", "Editar Ticket"),
        icon: Edit2,
        onClick: () => handleOpenEditModal(ticket),
      },
      {
        label: isResolved
          ? t("tickets.actionReopen", "Reabrir Caso")
          : t("tickets.actionResolve", "Marcar Resuelto"),
        icon: isResolved ? PowerOff : Power,
        variant: isResolved ? "default" : "emerald",
        onClick: () => handleToggleStatus(ticket),
      },
      {
        label: t("tickets.actionDelete", "Eliminar Ticket"),
        icon: Trash2,
        variant: "destructive",
        onClick: () => setTicketToDelete(ticket),
      },
    ];
  };

  const renderChannelBadge = (channel: TicketChannel) => {
    switch (channel) {
      case "WHATSAPP_AI":
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-0.5",
              "rounded-full text-[10px] font-bold bg-emerald-500/10",
              "text-emerald-700 dark:text-emerald-300",
              "border border-emerald-500/20"
            )}
          >
            <Bot className="h-3 w-3 text-emerald-500" />
            WhatsApp IA
          </span>
        );
      case "TELEFONO":
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-0.5",
              "rounded-full text-[10px] font-bold bg-zinc-100",
              "dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
              "border border-zinc-200 dark:border-zinc-700"
            )}
          >
            <Phone className="h-3 w-3 text-zinc-500" />
            Teléfono
          </span>
        );
      case "PORTAL":
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-0.5",
              "rounded-full text-[10px] font-bold bg-zinc-100",
              "dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
              "border border-zinc-200 dark:border-zinc-700"
            )}
          >
            <Globe className="h-3 w-3 text-zinc-500" />
            Portal Web
          </span>
        );
      default:
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-0.5",
              "rounded-full text-[10px] font-bold bg-zinc-100",
              "dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
              "border border-zinc-200 dark:border-zinc-700"
            )}
          >
            <Building2 className="h-3 w-3 text-zinc-500" />
            Presencial
          </span>
        );
    }
  };

  const renderPriorityBadge = (priority: TicketPriority) => {
    const isCritical = priority === "CRITICA" || priority === "ALTA";
    return (
      <span
        className={cn(
          "px-2 py-0.5 rounded-md text-[10px] font-extrabold",
          isCritical
            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            : priority === "MEDIA"
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
        )}
      >
        {priority}
      </span>
    );
  };

  const renderStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "TRANSFERIDO_HUMANO":
        return (
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full",
              "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              "border border-amber-500/20 gap-1 animate-pulse"
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            HUMANO
          </Badge>
        );
      case "RESUELTO":
      case "CERRADO":
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
            {status}
          </Badge>
        );
      default:
        return (
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full",
              "bg-sky-500/10 text-sky-600 dark:text-sky-400",
              "border border-sky-500/20 gap-1"
            )}
          >
            <Clock className="h-3 w-3" />
            {status.replace(/_/g, " ")}
          </Badge>
        );
    }
  };

  // Active Filter States for the 4 Metric Cards
  const isTotalCardActive =
    statusFilter === "all" &&
    priorityFilter === "all" &&
    channelFilter === "all";
  const isOpenCardActive =
    statusFilter === "OPEN_GROUP" || statusFilter === "ABIERTO";
  const isEscalatedCardActive = statusFilter === "TRANSFERIDO_HUMANO";
  const isResolvedCardActive =
    statusFilter === "RESOLVED_GROUP" || statusFilter === "RESUELTO";

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
            {t("tickets.title", "Mesa de Ayuda & Casos IA")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {t(
              "tickets.subtitle",
              "Casos de soporte técnico escalados por el Agente de WhatsApp y visitas técnicas."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className={cn(
              "rounded-xl gap-2 text-xs font-semibold bg-emerald-600",
              "hover:bg-emerald-700 text-white shadow-xs"
            )}
          >
            <Plus className="h-4 w-4" />
            {t("tickets.newTicket", "Nuevo Ticket")}
          </Button>
        </div>
      </div>

      {/* Filter Metric Cards Standard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total de Tickets */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: "all",
              priority: "all",
              channel: "all",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isTotalCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn(
                  "text-xs font-bold text-zinc-500 dark:text-zinc-400",
                  "uppercase tracking-wider"
                )}
              >
                {t("tickets.cardTotalTitle", "Total de Tickets")}
              </p>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                {isLoading ? <Skeleton className="h-8 w-14" /> : totalCount}
              </h3>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                {t("tickets.cardTotalDesc", "Casos registrados en soporte")}
              </p>
            </div>
            <div
              className={cn(
                "p-2.5 sm:p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800",
                "text-zinc-600 dark:text-zinc-300"
              )}
            >
              <Headphones className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Abiertos / En Curso */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isOpenCardActive ? "all" : "OPEN_GROUP",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isOpenCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn(
                  "text-xs font-bold text-sky-600",
                  "dark:text-sky-400 uppercase tracking-wider"
                )}
              >
                {t("tickets.cardOpenTitle", "Abiertos / En Curso")}
              </p>
              <h3 className="text-2xl font-black text-sky-600 dark:text-sky-400">
                {isLoading ? <Skeleton className="h-8 w-14" /> : openCount}
              </h3>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                {t("tickets.cardOpenDesc", "En atención o diagnóstico")}
              </p>
            </div>
            <div
              className={cn(
                "p-2.5 sm:p-3 rounded-xl bg-sky-500/10",
                "text-sky-600 dark:text-sky-400"
              )}
            >
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Escalados a Humano */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isEscalatedCardActive ? "all" : "TRANSFERIDO_HUMANO",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isEscalatedCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn(
                  "text-xs font-bold text-amber-600",
                  "dark:text-amber-400 uppercase tracking-wider"
                )}
              >
                {t("tickets.cardEscalatedTitle", "Escalados a Humano")}
              </p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {isLoading ? <Skeleton className="h-8 w-14" /> : escalatedCount}
              </h3>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                {t(
                  "tickets.cardEscalatedDesc",
                  "Requieren intervención humana"
                )}
              </p>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Casos Resueltos */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isResolvedCardActive ? "all" : "RESOLVED_GROUP",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isResolvedCardActive ? cardActiveClasses : cardInactiveClasses
          )}
        >
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className={cn(
                  "text-xs font-bold text-emerald-600",
                  "dark:text-emerald-400 uppercase tracking-wider"
                )}
              >
                {t("tickets.cardResolvedTitle", "Casos Resueltos")}
              </p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {isLoading ? <Skeleton className="h-8 w-14" /> : resolvedCount}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t("tickets.cardResolvedDesc", "Solucionados o cerrados")}
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
              "tickets.searchPlaceholder",
              "Buscar por ticket, contrato, PPPoE, titular, documento o descripción..."
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
                  "tickets.filterStatusAll",
                  "Todos los Estados"
                )}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="all">
                {t("tickets.filterStatusAll", "Todos los Estados")}
              </SelectItem>
              <SelectItem value="TRANSFERIDO_HUMANO">
                {t("tickets.filterEscalated", "Traspasos a Humano")}
              </SelectItem>
              <SelectItem value="ABIERTO">
                {t("tickets.filterOpen", "Abiertos")}
              </SelectItem>
              <SelectItem value="EN_DIAGNOSTICO_IA">
                {t("tickets.filterAiDiag", "En Diagnóstico IA")}
              </SelectItem>
              <SelectItem value="VISITA_AGENDADA">
                {t("tickets.filterVisit", "Visita Agendada")}
              </SelectItem>
              <SelectItem value="RESUELTO">
                {t("tickets.filterResolved", "Resueltos")}
              </SelectItem>
              <SelectItem value="CERRADO">
                {t("tickets.filterClosed", "Cerrados")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select
            value={priorityFilter}
            onValueChange={(val) => updateUrlParams({ priority: val, page: 1 })}
          >
            <SelectTrigger
              className={cn(
                "w-full sm:w-40 rounded-xl text-xs h-10",
                "border-zinc-200 dark:border-zinc-800 bg-white",
                "dark:bg-zinc-900/60 font-medium"
              )}
            >
              <SelectValue
                placeholder={t(
                  "tickets.filterPriorityAll",
                  "Todas las Prioridades"
                )}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="all">
                {t("tickets.filterPriorityAll", "Todas las Prioridades")}
              </SelectItem>
              <SelectItem value="CRITICA">Crítica</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="MEDIA">Media</SelectItem>
              <SelectItem value="BAJA">Baja</SelectItem>
            </SelectContent>
          </Select>

          {/* Channel Filter */}
          <Select
            value={channelFilter}
            onValueChange={(val) => updateUrlParams({ channel: val, page: 1 })}
          >
            <SelectTrigger
              className={cn(
                "w-full sm:w-40 rounded-xl text-xs h-10",
                "border-zinc-200 dark:border-zinc-800 bg-white",
                "dark:bg-zinc-900/60 font-medium"
              )}
            >
              <SelectValue
                placeholder={t(
                  "tickets.filterChannelAll",
                  "Todos los Canales"
                )}
              />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="all">
                {t("tickets.filterChannelAll", "Todos los Canales")}
              </SelectItem>
              <SelectItem value="WHATSAPP_AI">WhatsApp IA</SelectItem>
              <SelectItem value="TELEFONO">Teléfono</SelectItem>
              <SelectItem value="PORTAL">Portal Web</SelectItem>
              <SelectItem value="PRESENCIAL">Presencial</SelectItem>
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
              title={t("tickets.viewList", "Vista Lista")}
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
              title={t("tickets.viewGrid", "Vista Tarjetas")}
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
                  {t("tickets.tableTicket", "Ticket #")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("tickets.tableChannel", "Canal")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("tickets.tableSubscriber", "Abonado & Contrato")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("tickets.tableIssue", "Motivo / Falla")}
                </TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">
                  {t("tickets.tablePriority", "Prioridad")}
                </TableHead>
                <TableHead
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    "text-center"
                  )}
                >
                  {t("tickets.tableStatus", "Estado")}
                </TableHead>
                <TableHead
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    "text-right"
                  )}
                >
                  {t("tickets.tableDate", "Fecha Apertura")}
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
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-md" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-5 w-20 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-20 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : tickets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-64 text-center p-8 space-y-3"
                  >
                    <div
                      className={cn(
                        "p-3 w-12 h-12 rounded-2xl bg-zinc-100",
                        "dark:bg-zinc-800 text-zinc-400 mx-auto flex",
                        "items-center justify-center"
                      )}
                    >
                      <Headphones className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {t(
                        "tickets.emptyTitle",
                        "No se encontraron tickets de soporte"
                      )}
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      {t(
                        "tickets.emptyDesc",
                        "Ajusta tus filtros de búsqueda o registra un nuevo caso de atención."
                      )}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((tk) => {
                  const isSelected = selectedIds.includes(tk.id);
                  const rowActions = buildTicketRowActions(tk);

                  return (
                    <TableRow
                      key={tk.id}
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
                            handleSelectOne(tk.id, e.target.checked)
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

                      {/* Ticket Number */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(tk)}
                          className={cn(
                            "font-mono font-extrabold text-xs text-emerald-600",
                            "dark:text-emerald-400 hover:underline cursor-pointer"
                          )}
                        >
                          #{tk.ticketNumber}
                        </button>
                      </TableCell>

                      {/* Channel */}
                      <TableCell>{renderChannelBadge(tk.channel)}</TableCell>

                      {/* Subscriber & Contract */}
                      <TableCell>
                        <div className="flex flex-col max-w-[200px]">
                          <span
                            className={cn(
                              "font-bold text-xs text-zinc-900",
                              "dark:text-zinc-100 truncate"
                            )}
                          >
                            {tk.contract?.client?.fullName}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400 truncate">
                            Contrato #{tk.contract?.contractNumber}
                          </span>
                        </div>
                      </TableCell>

                      {/* Issue Type & Description */}
                      <TableCell>
                        <div className="flex flex-col max-w-[240px]">
                          <span
                            className={cn(
                              "font-semibold text-xs text-zinc-800",
                              "dark:text-zinc-200"
                            )}
                          >
                            {tk.issueType.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] text-zinc-500 truncate">
                            {tk.description}
                          </span>
                        </div>
                      </TableCell>

                      {/* Priority */}
                      <TableCell>{renderPriorityBadge(tk.priority)}</TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {renderStatusBadge(tk.status)}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-right font-mono text-zinc-500 text-[11px]">
                        {new Date(tk.createdAt).toLocaleDateString("es-CO", {
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
          ) : tickets.length === 0 ? (
            <div
              className={cn(
                "p-12 text-center rounded-2xl border",
                "border-dashed border-zinc-300 dark:border-zinc-800"
              )}
            >
              <Headphones className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {t(
                  "tickets.emptyTitle",
                  "No se encontraron tickets de soporte"
                )}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 mb-4">
                {t(
                  "tickets.emptyDesc",
                  "Ajusta tus filtros de búsqueda o registra un nuevo caso de atención."
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
                {t("tickets.newTicket", "Nuevo Ticket")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tickets.map((tk) => {
                const isSelected = selectedIds.includes(tk.id);
                const rowActions = buildTicketRowActions(tk);

                return (
                  <div
                    key={tk.id}
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
                      {/* Top Bar: Checkbox + ActionsDropdown + TicketCode + Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              handleSelectOne(tk.id, e.target.checked)
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
                            #{tk.ticketNumber}
                          </span>
                        </div>

                        {renderStatusBadge(tk.status)}
                      </div>

                      {/* Subscriber Name & Contract */}
                      <h3
                        className={cn(
                          "text-base font-black text-zinc-900",
                          "dark:text-white leading-tight truncate"
                        )}
                      >
                        {tk.contract?.client?.fullName}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                        Contrato #{tk.contract?.contractNumber} —{" "}
                        {tk.contract?.address}
                      </p>

                      {/* Case Summary Box */}
                      <div
                        className={cn(
                          "mt-4 p-3 rounded-xl bg-zinc-50",
                          "dark:bg-zinc-950/60 border border-zinc-200/70",
                          "dark:border-zinc-800/80 space-y-2 text-xs"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Canal:</span>
                          {renderChannelBadge(tk.channel)}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Motivo / Falla:</span>
                          <span
                            className={cn(
                              "font-bold text-zinc-800",
                              "dark:text-zinc-200"
                            )}
                          >
                            {tk.issueType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Prioridad:</span>
                          {renderPriorityBadge(tk.priority)}
                        </div>
                        <div
                          className={cn(
                            "pt-2 border-t border-zinc-200/50",
                            "dark:border-zinc-800/50"
                          )}
                        >
                          <p
                            className={cn(
                              "text-[11px] text-zinc-600 dark:text-zinc-400",
                              "line-clamp-2 font-mono"
                            )}
                          >
                            {tk.description}
                          </p>
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
                        onClick={() => handleOpenEditModal(tk)}
                        className="text-xs font-semibold rounded-xl"
                      >
                        {t("common.edit", "Editar")}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedTicket(tk)}
                        className={cn(
                          "rounded-xl gap-1.5 text-xs font-bold",
                          "border-emerald-500/30 text-emerald-600",
                          "dark:text-emerald-400 hover:bg-emerald-500/10"
                        )}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {t("tickets.actionViewDetail", "Ver Caso")}
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
        onActivate={handleBulkResolve}
        onDeactivate={handleBulkReopen}
        onDelete={handleBulkDelete}
        resourceName="tickets"
      />

      {/* Case Dossier & AI Diagnostic Modal */}
      <Dialog
        open={Boolean(selectedTicket)}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      >
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Headphones className="h-5 w-5 text-emerald-500" />
              {t(
                "tickets.modalDetailTitle",
                "Expediente del Caso & Diagnóstico IA"
              )}
            </DialogTitle>
            <DialogDescription>
              Ticket{" "}
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                #{selectedTicket?.ticketNumber}
              </span>{" "}
              — Registrado el{" "}
              {selectedTicket &&
                new Date(selectedTicket.createdAt).toLocaleString("es-CO")}
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4 text-xs">
              <div
                className={cn(
                  "p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60",
                  "border border-zinc-200 dark:border-zinc-800 space-y-2"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    Titular:
                  </span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedTicket.contract?.client?.fullName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Teléfono / Dirección:</span>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {selectedTicket.contract?.client?.phonePrimary} |{" "}
                    {selectedTicket.contract?.address}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Contrato & Nodo:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    #{selectedTicket.contract?.contractNumber} (
                    {selectedTicket.contract?.node?.name || "RouterOS"})
                  </span>
                </div>
                <div
                  className={cn(
                    "flex items-center justify-between pt-2",
                    "border-t border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {renderChannelBadge(selectedTicket.channel)}
                    {renderPriorityBadge(selectedTicket.priority)}
                  </div>
                  {renderStatusBadge(selectedTicket.status)}
                </div>
              </div>

              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Bitácora y Descripción del Caso (Agente IA / Operador):
                </span>
                <div
                  className={cn(
                    "p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900",
                    "border border-zinc-200 dark:border-zinc-800",
                    "whitespace-pre-line text-zinc-800 dark:text-zinc-200",
                    "font-mono text-[11px] max-h-48 overflow-y-auto"
                  )}
                >
                  {selectedTicket.description}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedTicket(null)}
              className="rounded-xl text-xs"
            >
              Cerrar
            </Button>
            {selectedTicket && (
              <Button
                type="button"
                onClick={() => handleToggleStatus(selectedTicket)}
                className={cn(
                  "rounded-xl text-xs font-bold text-white",
                  selectedTicket.status === "RESUELTO" ||
                    selectedTicket.status === "CERRADO"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {selectedTicket.status === "RESUELTO" ||
                selectedTicket.status === "CERRADO"
                  ? t("tickets.actionReopen", "Reabrir Caso")
                  : t("tickets.actionResolve", "Marcar Resuelto")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Support Ticket Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Headphones className="h-5 w-5 text-emerald-500" />
              {editingTicket.id
                ? t("tickets.modalEditTitle", "Editar Ticket de Soporte")
                : t(
                    "tickets.modalCreateTitle",
                    "Registrar Nuevo Ticket de Soporte"
                  )}
            </DialogTitle>
            <DialogDescription>
              {editingTicket.id
                ? "Actualiza la prioridad, estado o bitácora técnica del ticket."
                : "Registra un caso de soporte asociado a un contrato activo."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTicket} className="space-y-3.5 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>
                  {t("tickets.labelContract", "Contrato de Servicio *")}
                </span>
                {selectedContractForModal && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Abonado seleccionado
                  </span>
                )}
              </Label>

              {selectedContractForModal ? (
                /* Selected Contract Confirmation Card */
                <div className="p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-zinc-900 dark:text-white truncate">
                          {selectedContractForModal.client?.fullName ||
                            "Cliente sin nombre"}
                        </span>
                        {selectedContractForModal.client?.clientCode && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] py-0 px-1.5 font-mono text-emerald-600 bg-emerald-500/10"
                          >
                            ID: #{selectedContractForModal.client.clientCode}
                          </Badge>
                        )}
                        {selectedContractForModal.client?.documentNumber && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 font-mono"
                          >
                            CC: {selectedContractForModal.client.documentNumber}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          #{selectedContractForModal.contractNumber}
                        </span>
                        {selectedContractForModal.pppoeUser && (
                          <>
                            <span>&bull;</span>
                            <span className="font-mono">
                              {selectedContractForModal.pppoeUser}
                            </span>
                          </>
                        )}
                        {selectedContractForModal.plan?.name && (
                          <>
                            <span>&bull;</span>
                            <span>{selectedContractForModal.plan.name}</span>
                          </>
                        )}
                      </div>
                      {selectedContractForModal.address && (
                        <p className="text-[11px] text-zinc-500 truncate">
                          {selectedContractForModal.address}
                          {selectedContractForModal.node?.name
                            ? ` (${selectedContractForModal.node.name})`
                            : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelectedContract}
                    className="h-7 text-xs text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg px-2 shrink-0"
                    title="Cambiar o buscar otro abonado"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cambiar
                  </Button>
                </div>
              ) : (
                /* Search Box & Results List */
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-2.5" />
                      <Input
                        value={contractSearchTerm}
                        onChange={(e) =>
                          setContractSearchTerm(e.target.value)
                        }
                        placeholder="Buscar por nombre, cédula, # contrato o PPPoE..."
                        className="h-8 pl-8 pr-7 rounded-xl text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSearchContractsForModal();
                          }
                        }}
                      />
                      {contractSearchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setContractSearchTerm("");
                            setContractSearchResults([]);
                            setHasSearchedContracts(false);
                          }}
                          className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        isSearchingContracts || !contractSearchTerm.trim()
                      }
                      onClick={handleSearchContractsForModal}
                      className="h-8 rounded-xl text-xs px-3 shrink-0"
                    >
                      {isSearchingContracts ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Search className="h-3.5 w-3.5 mr-1" />
                          Buscar
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Search Results Dropdown / Panel */}
                  {contractSearchResults.length > 0 && (
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
                      {contractSearchResults.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectContract(c)}
                          className="p-2.5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {c.client?.clientCode && (
                                <span className="text-[10px] text-emerald-600 font-mono font-bold">
                                  #{c.client.clientCode} &bull;
                                </span>
                              )}
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                {c.client?.fullName || "Abonado"}
                              </span>
                              {c.client?.documentNumber && (
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  (CC: {c.client.documentNumber})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                #{c.contractNumber}
                              </span>
                              {c.pppoeUser && (
                                <>
                                  <span>&bull;</span>
                                  <span className="font-mono">
                                    {c.pppoeUser}
                                  </span>
                                </>
                              )}
                              {c.address && (
                                <>
                                  <span>&bull;</span>
                                  <span className="truncate max-w-[180px]">
                                    {c.address}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shrink-0 font-semibold"
                          >
                            Seleccionar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasSearchedContracts &&
                    !isSearchingContracts &&
                    contractSearchResults.length === 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        No se encontraron abonados con &quot;
                        {contractSearchTerm}&quot;. Prueba con el nombre,
                        cédula o usuario PPPoE.
                      </p>
                    )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("tickets.labelChannel", "Canal de Atención")}
                </Label>
                <Select
                  value={editingTicket.channel}
                  onValueChange={(val) =>
                    setEditingTicket({
                      ...editingTicket,
                      channel: val as TicketChannel,
                    })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="WHATSAPP_AI">WhatsApp IA</SelectItem>
                    <SelectItem value="TELEFONO">Teléfono</SelectItem>
                    <SelectItem value="PORTAL">Portal Web</SelectItem>
                    <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("tickets.labelIssueType", "Tipo de Falla / Motivo")}
                </Label>
                <Select
                  value={editingTicket.issueType}
                  onValueChange={(val) =>
                    setEditingTicket({
                      ...editingTicket,
                      issueType: val as IssueType,
                    })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="CORTE_TOTAL">Corte Total</SelectItem>
                    <SelectItem value="LENTITUD">
                      Lentitud / Intermitencia
                    </SelectItem>
                    <SelectItem value="FALLA_FISICA_LOS">
                      Falla Física LOS (Fibra)
                    </SelectItem>
                    <SelectItem value="CAMBIO_WIFI">
                      Cambio Clave WiFi
                    </SelectItem>
                    <SelectItem value="CARTERA">Facturación / Mora</SelectItem>
                    <SelectItem value="OTRO">Otro Motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("tickets.labelPriority", "Prioridad")}
                </Label>
                <Select
                  value={editingTicket.priority}
                  onValueChange={(val) =>
                    setEditingTicket({
                      ...editingTicket,
                      priority: val as TicketPriority,
                    })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="BAJA">Baja</SelectItem>
                    <SelectItem value="MEDIA">Media</SelectItem>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="CRITICA">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {t("tickets.labelStatus", "Estado del Caso")}
                </Label>
                <Select
                  value={editingTicket.status}
                  onValueChange={(val) =>
                    setEditingTicket({
                      ...editingTicket,
                      status: val as TicketStatus,
                    })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ABIERTO">Abierto</SelectItem>
                    <SelectItem value="EN_DIAGNOSTICO_IA">
                      En Diagnóstico IA
                    </SelectItem>
                    <SelectItem value="TRANSFERIDO_HUMANO">
                      Transferido a Humano
                    </SelectItem>
                    <SelectItem value="VISITA_AGENDADA">
                      Visita Agendada
                    </SelectItem>
                    <SelectItem value="RESUELTO">Resuelto</SelectItem>
                    <SelectItem value="CERRADO">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">
                {t(
                  "tickets.labelDescription",
                  "Descripción / Bitácora del Caso *"
                )}
              </Label>
              <textarea
                required
                rows={4}
                placeholder="Describe el reporte del abonado o diagnóstico realizado..."
                value={editingTicket.description}
                onChange={(e) =>
                  setEditingTicket({
                    ...editingTicket,
                    description: e.target.value,
                  })
                }
                className={cn(
                  "w-full rounded-xl border border-zinc-200 dark:border-zinc-800",
                  "bg-transparent px-3 py-2 text-xs font-mono shadow-2xs",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                )}
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
                ) : editingTicket.id ? (
                  t("common.saveChanges", "Guardar Cambios")
                ) : (
                  t("tickets.newTicket", "Registrar Ticket")
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Premium Delete Confirmation AlertDialog */}
      <AlertDialog
        open={Boolean(ticketToDelete)}
        onOpenChange={(open) => !open && setTicketToDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                "tickets.deleteConfirmTitle",
                "¿Eliminar este ticket de soporte definitivamente?"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "tickets.deleteConfirmDesc",
                "Esta acción eliminará el caso y sus visitas técnicas."
              )}
              {ticketToDelete && (
                <span className="block mt-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  #{ticketToDelete.ticketNumber} —{" "}
                  {ticketToDelete.contract?.client?.fullName} (
                  {ticketToDelete.issueType.replace(/_/g, " ")})
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
              {t("tickets.actionDelete", "Eliminar Ticket")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TicketsDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-10 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
      <TicketsTableContent />
    </Suspense>
  );
}
