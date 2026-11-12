"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Network,
  Activity,
  PowerOff,
  Power,
  RefreshCw,
  Search,
  Plus,
  Wifi,
  Server,
  CheckCircle2,
  Radio,
  AlertTriangle,
  List,
  LayoutGrid,
  Edit2,
  Trash2,
  X,
  Router,
  MapPin,
  CalendarClock,
  ClipboardCheck,
  Link2,
  MessageCircle,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useBrand } from "@/context/brand-context";
import { hasPermission } from "@/lib/permissions";
import { useIsMobile } from "@/lib/use-mobile";
import {
  getContractsPaginated,
  saveContract,
  runLiveContractDiagnostic,
  toggleContractSuspension,
  kickContractSessionAction,
  deleteContract,
  bulkToggleContractsSuspension,
  bulkDeleteContracts,
} from "@/actions/contracts";
import { grantContractPromiseAction } from "@/actions/billing";
import { getContractPaymentLinkAction } from "@/actions/portal";
import { getMikrotikNodes } from "@/actions/nodes";
import { getPlans } from "@/actions/plans";
import { getClients } from "@/actions/clients";
import type {
  Contract,
  MikrotikNode,
  Plan,
  Client,
  MikrotikLiveDiagnostic,
  BillingStatus,
  TechnologyType,
} from "@/types";
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
import { ClientSearchSelector } from "@/components/common/client-search-selector";
import {
  ContractExpressDiagnosticCard,
} from "@/components/common/contract-express-diagnostic";
import { ContractAuditModal } from "@/components/contracts/contract-audit-modal";
import {
  ActionsDropdown,
  type ActionDropdownItem,
} from "@/components/ui/actions-dropdown";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { cn } from "@/lib/utils";

interface ContractFormState {
  id?: string;
  brandId: string;
  clientId: string;
  clientLabel?: string;
  contractNumber: string;
  address: string;
  neighborhood: string;
  city: string;
  department: string;
  nodeId: string;
  planId: string;
  technology: TechnologyType;
  pppoeUser: string;
  pppoePassword: string;
  ipAddress: string;
  macAddress: string;
  billingStatus: BillingStatus;
  routerBrand: string;
  routerModel: string;
  routerMac: string;
  antennaType: string;
  antennaMac: string;
  antennaIp: string;
  cableMeters: string;
  opticalPowerRx: string;
  equipmentNotes: string;
}

function formatPlanInfo(
  plan?: {
    name: string;
    rateLimit: string;
    priceCop: number;
    billingDay?: number;
  } | null
): {
  title: string;
  speed: string;
  priceText: string;
  cutoffText: string;
} {
  if (!plan) {
    return {
      title: "Sin plan",
      speed: "N/D",
      priceText: "$0",
      cutoffText: "",
    };
  }

  const rawName = plan.name || "";
  if (rawName.startsWith("PLAN|")) {
    const parts = rawName.split("|");
    const speedPart = parts[1] || plan.rateLimit || "N/D";
    const categoryPart = parts[2] || "Residencial";
    const rawPrice = Number(parts[3] ?? plan.priceCop ?? 0);
    const rawCutoff = parts[4] || String(plan.billingDay || 10);

    const categoryMap: Record<string, string> = {
      Fidelizacion: "Fidelización",
      Residencial: "Residencial",
      Comercial: "Comercial",
      Corporativo: "Corporativo",
      Institucional: "Institucional",
      Dedicado: "Dedicado",
      Cortesia: "Cortesía",
      Pruebas: "Pruebas",
    };

    const cleanCategory = categoryMap[categoryPart] || categoryPart;
    const priceVal = Number.isFinite(rawPrice) ? rawPrice : plan.priceCop;
    const priceText =
      priceVal > 0 ? `$${priceVal.toLocaleString("es-CO")}` : "Cortesía ($0)";
    const cutoffText =
      rawCutoff && rawCutoff !== "0" ? `Corte ${rawCutoff}` : "";

    return {
      title: cleanCategory,
      speed: speedPart,
      priceText,
      cutoffText,
    };
  }

  const priceVal = Number(plan.priceCop ?? 0);
  return {
    title: rawName,
    speed: plan.rateLimit || "N/D",
    priceText:
      priceVal > 0 ? `$${priceVal.toLocaleString("es-CO")}` : "Cortesía ($0)",
    cutoffText: plan.billingDay ? `Corte ${plan.billingDay}` : "",
  };
}

function formatEquipmentSummary(c: Contract): string | null {
  const eq = c.equipment;
  if (!eq) return null;
  const parts: string[] = [];
  if (eq.routerBrand) {
    parts.push(
      eq.routerModel ? `${eq.routerBrand} ${eq.routerModel}` : eq.routerBrand
    );
  }
  if (eq.antennaType) {
    parts.push(eq.antennaType);
  } else if (eq.routerMac) {
    parts.push(eq.routerMac);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ContractsTableContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const { activeBrandId, activeBrand } = useBrand();

  const userRoles = session?.user?.roles ?? [];
  const isAdmin =
    userRoles.includes("SUPER_ADMIN") || userRoles.includes("ADMIN");
  const canManageContracts = hasPermission(
    session?.user,
    "contracts:manage"
  );
  const canDeleteContracts = hasPermission(
    session?.user,
    "contracts:delete"
  );
  const canManageBilling = hasPermission(
    session?.user,
    "billing:manage"
  );

  const currentPage = Math.max(
    1,
    parseInt(searchParams.get("page") ?? "1", 10)
  );
  const currentSearch = searchParams.get("search") ?? "";
  const currentNode = searchParams.get("node") ?? "all";
  const currentStatus = searchParams.get("status") ?? "ACTIVO";
  const currentTech = searchParams.get("technology") ?? "all";
  const isMobile = useIsMobile();
  const rawView = searchParams.get("view");
  const currentView = (
    rawView ?? (isMobile ? "grid" : "list")
  ) as "list" | "grid";

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [nodes, setNodes] = useState<MikrotikNode[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clientsList, setClientsList] = useState<Client[]>([]);

  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [warningCount, setWarningCount] = useState<number>(0);
  const [suspendedCount, setSuspendedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchInput, setSearchInput] = useState<string>(currentSearch);
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>(
    []
  );

  // Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  // Create / Edit Modal State
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingContract, setEditingContract] =
    useState<ContractFormState | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Live Diagnostic Modal State
  const [diagModalOpen, setDiagModalOpen] = useState<boolean>(false);
  const [activeContractDiag, setActiveContractDiag] =
    useState<Contract | null>(null);
  const [diagnosticResult, setDiagnosticResult] =
    useState<MikrotikLiveDiagnostic | null>(null);
  const [diagLoading, setDiagLoading] = useState<boolean>(false);

  // Delete & Row Actions State
  const [deletingContractId, setDeletingContractId] = useState<
    string | null
  >(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Payment Promise Modal State
  const [promiseContract, setPromiseContract] = useState<Contract | null>(null);
  const [promiseHours, setPromiseHours] = useState<number>(24);
  const [promiseNotes, setPromiseNotes] = useState<string>("");
  const [promiseOverrideLimit, setPromiseOverrideLimit] =
    useState<boolean>(false);
  const [isSubmittingPromise, setIsSubmittingPromise] =
    useState<boolean>(false);

  const handleOpenPromiseModal = (contract: Contract) => {
    setPromiseContract(contract);
    setPromiseHours(24);
    setPromiseNotes("");
    setPromiseOverrideLimit(false);
  };

  const handleConfirmPromise = async () => {
    if (!promiseContract) return;
    setIsSubmittingPromise(true);
    try {
      const res = await grantContractPromiseAction({
        contractId: promiseContract.id,
        hours: promiseHours,
        notes: promiseNotes.trim() || undefined,
        overrideLimit: promiseOverrideLimit,
      });
      if (res.success && res.data) {
        toast.success(
          `${t("contracts.promiseSuccess", "Prórroga concedida exitosamente.")} ` +
            `#${res.data.contractNumber} (${res.data.hours}h).`
        );
        setPromiseContract(null);
        loadContracts();
      } else {
        toast.error(res.error || "No se pudo conceder la prórroga de pago.");
      }
    } catch (_err) {
      toast.error("Error al otorgar la prórroga.");
    } finally {
      setIsSubmittingPromise(false);
    }
  };

  const handleCopyPaymentLink = async (contractId: string) => {
    try {
      const res = await getContractPaymentLinkAction(contractId);
      if (res.success && res.data?.url) {
        await navigator.clipboard.writeText(res.data.url);
        toast.success(
          t(
            "contracts.paymentLinkCopied",
            "Link Mágico de Pago copiado al portapapeles."
          )
        );
      } else {
        toast.error(res.error || "No se pudo generar el enlace de pago.");
      }
    } catch {
      toast.error("Error al copiar el enlace de pago.");
    }
  };

  const handleSendPaymentLinkWhatsApp = async (contract: Contract) => {
    try {
      const res = await getContractPaymentLinkAction(contract.id);
      if (res.success && res.data?.url) {
        const phone =
          contract.client?.phonePrimary?.replace(/\D/g, "") || "";
        const clientName = contract.client?.fullName || "Abonado";
        const message =
          `Hola ${clientName}, te compartimos tu enlace de pago sin ` +
          `contraseñas para tu servicio de internet: ${res.data.url}`;
        const cleanPhone = phone.startsWith("57") ? phone.slice(2) : phone;
        const waUrl = phone
          ? `https://wa.me/57${cleanPhone}?text=${encodeURIComponent(message)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank");
      } else {
        toast.error(res.error || "No se pudo generar el enlace de pago.");
      }
    } catch {
      toast.error("Error al abrir WhatsApp.");
    }
  };

  const updateUrlParams = useCallback(
    (updates: {
      page?: number;
      search?: string;
      node?: string;
      status?: string;
      technology?: string;
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

      if (updates.node !== undefined) {
        if (
          updates.node === "all" ||
          updates.node === "ALL" ||
          !updates.node
        ) {
          params.delete("node");
        } else {
          params.set("node", updates.node);
        }
      }

      if (updates.status !== undefined) {
        if (!updates.status) {
          params.delete("status");
        } else {
          params.set("status", updates.status);
        }
      }

      if (updates.technology !== undefined) {
        if (updates.technology === "all" || !updates.technology) {
          params.delete("technology");
        } else {
          params.set("technology", updates.technology);
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

  const loadContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getContractsPaginated({
        brandId: activeBrandId,
        page: currentPage,
        limit: 10,
        search: currentSearch,
        nodeId: currentNode,
        billingStatus: currentStatus,
        technology: currentTech,
      });

      if (res.success && res.data) {
        setContracts(res.data.contracts);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setActiveCount(res.data.activeCount);
        setWarningCount(res.data.warningCount);
        setSuspendedCount(res.data.suspendedCount);
      } else {
        toast.error(res.error || "Error al consultar contratos.");
      }
    } catch (_err) {
      toast.error("Error de comunicación.");
    } finally {
      setIsLoading(false);
    }
  }, [
    activeBrandId,
    currentPage,
    currentSearch,
    currentNode,
    currentStatus,
    currentTech,
  ]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    async function fetchCatalogs() {
      const [nodesRes, plansRes, clientsRes] = await Promise.all([
        getMikrotikNodes(activeBrandId),
        getPlans(activeBrandId),
        getClients({ brandId: activeBrandId, pageSize: 50 }),
      ]);
      if (nodesRes.success && nodesRes.data) {
        setNodes(nodesRes.data);
      }
      if (plansRes.success && plansRes.data) {
        setPlans(plansRes.data);
      }
      if (clientsRes.success && clientsRes.data) {
        setClientsList(clientsRes.data.items);
      }
    }
    fetchCatalogs();
  }, [activeBrandId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ search: searchInput, page: 1 });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateUrlParams({ search: "", page: 1 });
  };

  const handleOpenCreate = () => {
    const defaultBrandId =
      activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id || "";
    setEditingContract({
      brandId: defaultBrandId,
      clientId: "",
      clientLabel: "",
      contractNumber: `SER-${Math.floor(1000 + Math.random() * 9000)}`,
      address: "",
      neighborhood: "",
      city: "Soacha",
      department: "Cundinamarca",
      nodeId: nodes[0]?.id || "",
      planId: plans[0]?.id || "",
      technology: "FIBRA_OPTICA",
      pppoeUser: "",
      pppoePassword: "",
      ipAddress: "",
      macAddress: "",
      billingStatus: "ACTIVO",
      routerBrand: "",
      routerModel: "",
      routerMac: "",
      antennaType: "",
      antennaMac: "",
      antennaIp: "",
      cableMeters: "0",
      opticalPowerRx: "",
      equipmentNotes: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (c: Contract) => {
    const docText = c.client?.documentNumber
      ? ` — ${c.client.documentType || "CC"} ${c.client.documentNumber}`
      : "";
    setEditingContract({
      id: c.id,
      brandId: c.brandId,
      clientId: c.clientId,
      clientLabel: `${c.client?.fullName || "Titular Asignado"}${docText}`,
      contractNumber: c.contractNumber,
      address: c.address,
      neighborhood: c.neighborhood || "",
      city: c.city || "Soacha",
      department: c.department || "Cundinamarca",
      nodeId: c.nodeId,
      planId: c.planId,
      technology: c.technology,
      pppoeUser: c.pppoeUser,
      pppoePassword: c.pppoePassword || "",
      ipAddress: c.ipAddress || "",
      macAddress: c.macAddress || "",
      billingStatus: c.billingStatus,
      routerBrand: c.equipment?.routerBrand || "",
      routerModel: c.equipment?.routerModel || "",
      routerMac: c.equipment?.routerMac || "",
      antennaType: c.equipment?.antennaType || "",
      antennaMac: c.equipment?.antennaMac || "",
      antennaIp: c.equipment?.antennaIp || "",
      cableMeters:
        c.equipment?.cableMeters !== null &&
        c.equipment?.cableMeters !== undefined
          ? String(c.equipment.cableMeters)
          : "0",
      opticalPowerRx:
        c.equipment?.opticalPowerRx !== null &&
        c.equipment?.opticalPowerRx !== undefined
          ? String(c.equipment.opticalPowerRx)
          : "",
      equipmentNotes: c.equipment?.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleReleaseEquipment = () => {
    if (!editingContract) return;
    setEditingContract({
      ...editingContract,
      billingStatus: "RETIRADO",
      routerBrand: "",
      routerModel: "",
      routerMac: "",
      antennaType: "",
      antennaMac: "",
      antennaIp: "",
      cableMeters: "0",
      opticalPowerRx: "",
      equipmentNotes: editingContract.equipmentNotes
        ? `${editingContract.equipmentNotes} | [Equipo liberado / Baja CPE]`
        : "[Equipo liberado / Baja CPE]",
    });
    toast.info(
      "Campos de equipo CPE liberados y estado cambiado a RETIRADO. " +
        "Pulsa Guardar Contrato para confirmar."
    );
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingContract?.clientId ||
      !editingContract?.contractNumber ||
      !editingContract?.nodeId ||
      !editingContract?.planId ||
      !editingContract?.pppoeUser ||
      !editingContract?.address
    ) {
      toast.error("Por favor completa los campos obligatorios.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...editingContract,
        brandId:
          editingContract.brandId ||
          (activeBrandId !== "ALL" ? activeBrandId : activeBrand?.id),
        cableMeters:
          editingContract.cableMeters.trim() !== ""
            ? parseInt(editingContract.cableMeters, 10)
            : 0,
        opticalPowerRx:
          editingContract.opticalPowerRx.trim() !== ""
            ? parseFloat(editingContract.opticalPowerRx)
            : null,
      };

      const res = await saveContract(payload);
      if (res.success) {
        toast.success(
          t("contracts.saveSuccess", "Contrato guardado exitosamente.")
        );
        setIsDialogOpen(false);
        loadContracts();
      } else {
        toast.error(res.error || "Error al guardar contrato.");
      }
    } catch (_err) {
      toast.error("Error al procesar solicitud.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunDiagnostic = async (contract: Contract) => {
    setActiveContractDiag(contract);
    setDiagnosticResult(null);
    setDiagModalOpen(true);
    setDiagLoading(true);

    try {
      const res = await runLiveContractDiagnostic(contract.id);
      if (res.success && res.data) {
        setDiagnosticResult(res.data);
      } else {
        toast.error(res.error || "Fallo en diagnóstico de MikroTik.");
      }
    } catch (_err) {
      toast.error("Error al ejecutar diagnóstico.");
    } finally {
      setDiagLoading(false);
    }
  };

  const handleToggleSuspension = async (
    contract: Contract,
    suspend: boolean
  ) => {
    setIsActionLoading(true);
    try {
      const res = await toggleContractSuspension(contract.id, suspend);
      if (res.success) {
        toast.success(
          suspend
            ? `Contrato #${contract.contractNumber} suspendido en MikroTik.`
            : `Contrato #${contract.contractNumber} reactivado en MikroTik.`
        );
        loadContracts();
      } else {
        toast.error(res.error || "Error al modificar estado de corte.");
      }
    } catch (_err) {
      toast.error("Fallo al contactar el router.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleKickSession = async (contract: Contract) => {
    setIsActionLoading(true);
    try {
      const res = await kickContractSessionAction(contract.id);
      if (res.success) {
        toast.success(res.data?.message || "Sesión PPPoE reiniciada.");
        loadContracts();
      } else {
        toast.error(res.error || "No se pudo reiniciar la sesión.");
      }
    } catch (_err) {
      toast.error("Error al reiniciar sesión.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingContractId) return;
    setIsActionLoading(true);
    try {
      const res = await deleteContract(deletingContractId);
      if (res.success) {
        toast.success(
          t("contracts.deleteSuccess", "Contrato eliminado exitosamente.")
        );
        setDeletingContractId(null);
        setSelectedContractIds((prev) =>
          prev.filter((id) => id !== deletingContractId)
        );
        loadContracts();
      } else {
        toast.error(res.error || "Error al eliminar contrato.");
      }
    } catch (_err) {
      toast.error("Error al procesar eliminación.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContractIds(contracts.map((c) => c.id));
    } else {
      setSelectedContractIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedContractIds((prev) => [...prev, id]);
    } else {
      setSelectedContractIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const isAllSelected = useMemo(() => {
    return (
      contracts.length > 0 &&
      contracts.every((c) => selectedContractIds.includes(c.id))
    );
  }, [contracts, selectedContractIds]);

  const handleBulkActivate = async () => {
    setIsActionLoading(true);
    try {
      const res = await bulkToggleContractsSuspension(
        selectedContractIds,
        false
      );
      if (res.success) {
        toast.success(
          t(
            "contracts.bulkActivateSuccess",
            "Contratos reactivados correctamente."
          )
        );
        setSelectedContractIds([]);
        loadContracts();
      } else {
        toast.error(res.error || "Error al reactivar contratos.");
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
      const res = await bulkToggleContractsSuspension(
        selectedContractIds,
        true
      );
      if (res.success) {
        toast.success(
          t(
            "contracts.bulkDeactivateSuccess",
            "Contratos suspendidos correctamente."
          )
        );
        setSelectedContractIds([]);
        loadContracts();
      } else {
        toast.error(res.error || "Error al suspender contratos.");
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
      const res = await bulkDeleteContracts(selectedContractIds);
      if (res.success && res.data) {
        if (res.data.deletedCount > 0) {
          toast.success(
            `${t("contracts.bulkDeleteSuccess", "Contratos eliminados")}: ${
              res.data.deletedCount
            }`
          );
        }
        if (res.data.skippedCount > 0) {
          toast.warning(
            `${res.data.skippedCount} ${t(
              "contracts.bulkDeleteSkippedWarning",
              "contrato(s) no pudieron eliminarse por tener pagos o tickets vinculados."
            )}`
          );
        }
        setSelectedContractIds([]);
        loadContracts();
      } else {
        toast.error(
          res.error || "Error al eliminar contratos seleccionados."
        );
      }
    } catch (_err) {
      toast.error("Error al procesar eliminación masiva.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const isTotalCardActive =
    currentStatus === "all" &&
    currentNode === "all" &&
    currentTech === "all";
  const isActiveCardActive = currentStatus === "ACTIVO";
  const isWarningCardActive = currentStatus === "AVISO_VENCIMIENTO";
  const isSuspendedCardActive = currentStatus === "SUSPENDIDO_MORA";

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
            {t("contracts.title", "Contratos & Enlaces MikroTik")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {t(
              "contracts.subtitle",
              "Control de aprovisionamiento en vivo, sesiones activas " +
                "PPPoE, suspensión y reconexión por nodo."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAuditModalOpen(true)}
              className={cn(
                "rounded-xl gap-2 text-xs font-semibold border-emerald-500/30",
                "hover:border-emerald-500/60 hover:bg-emerald-500/10",
                "text-emerald-600 dark:text-emerald-400"
              )}
            >
              <ClipboardCheck className="h-4 w-4" />
              {t("contracts.auditButton", "Auditar vs MikroTik")}
            </Button>
          )}

          {canManageContracts && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className={cn(
                "rounded-xl gap-2 text-xs font-semibold bg-emerald-600",
                "hover:bg-emerald-700 text-white shadow-xs"
              )}
            >
              <Plus className="h-4 w-4" />
              {t("contracts.newContract", "Nuevo Contrato")}
            </Button>
          )}
        </div>
      </div>

      {/* Filter Metric Cards Standard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Contratos */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: "all",
              node: "all",
              technology: "all",
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
                {t("contracts.cardTotalTitle", "Total de Contratos")}
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
                {t("contracts.cardTotalDesc", "Enlaces registrados en red")}
              </p>
            </div>
            <div
              className={cn(
                "p-2 sm:p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800",
                "text-zinc-600 dark:text-zinc-300 shrink-0"
              )}
            >
              <Network className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Enlaces Activos */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isActiveCardActive ? "all" : "ACTIVO",
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
                {t("contracts.cardActiveTitle", "Enlaces Activos")}
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
                {t("contracts.cardActiveDesc", "Suscripciones al día")}
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

        {/* Aviso Vencimiento */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isWarningCardActive ? "all" : "AVISO_VENCIMIENTO",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isWarningCardActive ? cardActiveClasses : cardInactiveClasses
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
                {t("contracts.cardWarningTitle", "Aviso Vencimiento")}
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
                  warningCount
                )}
              </h3>
              <p
                className={cn(
                  "text-[10px] sm:text-[11px] text-zinc-400 truncate",
                  "max-w-[100px] sm:max-w-none"
                )}
              >
                {t("contracts.cardWarningDesc", "Próximos a fecha de corte")}
              </p>
            </div>
            <div
              className={cn(
                "p-2 sm:p-3 rounded-xl bg-amber-500/10 text-amber-600",
                "dark:text-amber-400 shrink-0"
              )}
            >
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Suspendidos por Mora */}
        <Card
          onClick={() =>
            updateUrlParams({
              status: isSuspendedCardActive ? "all" : "SUSPENDIDO_MORA",
              page: 1,
            })
          }
          className={cn(
            cardBaseClasses,
            isSuspendedCardActive ? cardActiveClasses : cardInactiveClasses
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
                {t("contracts.cardSuspendedTitle", "Suspendidos Mora")}
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
                  suspendedCount
                )}
              </h3>
              <p
                className={cn(
                  "text-[10px] sm:text-[11px] text-zinc-400 truncate",
                  "max-w-[100px] sm:max-w-none"
                )}
              >
                {t("contracts.cardSuspendedDesc", "Cortados en RouterOS")}
              </p>
            </div>
            <div
              className={cn(
                "p-2 sm:p-3 rounded-xl bg-rose-500/10 text-rose-500",
                "shrink-0"
              )}
            >
              <PowerOff className="h-4 w-4 sm:h-5 sm:w-5" />
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
                  "contracts.searchPlaceholder",
                  "Buscar por contrato (ej. SER-1042), PPPoE, titular o IP..."
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
                title={t("contracts.viewList", "Vista Lista")}
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
                title={t("contracts.viewGrid", "Vista Tarjetas")}
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
            {/* Node Filter */}
            <div className="w-full sm:w-44">
              <Select
                value={currentNode}
                onValueChange={(val) => updateUrlParams({ node: val, page: 1 })}
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
                      "contracts.filterNodesAll",
                      "Todos los Nodos"
                    )}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">
                    {t("contracts.filterNodesAll", "Todos los Nodos")}
                  </SelectItem>
                  {nodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-40">
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
                    placeholder={t(
                      "contracts.filterStatusAll",
                      "Todos los Estados"
                    )}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">
                    {t("contracts.filterStatusAll", "Todos los Estados")}
                  </SelectItem>
                  <SelectItem value="ACTIVO">
                    {t("contracts.filterActive", "Activos (Al Día)")}
                  </SelectItem>
                  <SelectItem value="AVISO_VENCIMIENTO">
                    {t("contracts.filterWarning", "Aviso Vencimiento")}
                  </SelectItem>
                  <SelectItem value="SUSPENDIDO_MORA">
                    {t("contracts.filterSuspended", "Suspendidos Mora")}
                  </SelectItem>
                  <SelectItem value="CORTESIA">
                    {t("contracts.filterCourtesy", "Cortesía")}
                  </SelectItem>
                  <SelectItem value="RETIRADO">
                    {t("contracts.filterRetired", "Retirados")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Technology Filter */}
            <div className="col-span-2 sm:col-span-1 w-full sm:w-40">
              <Select
                value={currentTech}
                onValueChange={(val) =>
                  updateUrlParams({ technology: val, page: 1 })
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
                      "contracts.filterTechAll",
                      "Todas las Tecnologías"
                    )}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">
                    {t("contracts.filterTechAll", "Todas las Tecnologías")}
                  </SelectItem>
                  <SelectItem value="FIBRA_OPTICA">
                    {t("contracts.filterFiber", "Fibra Óptica")}
                  </SelectItem>
                  <SelectItem value="MICROONDAS">
                    {t("contracts.filterWireless", "Microondas")}
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

                <TableHead
                  className="text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  {t("contracts.tableContract", "Contrato & PPPoE")}
                </TableHead>
                <TableHead
                  className="text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  {t("contracts.tableClient", "Titular & Dirección")}
                </TableHead>
                <TableHead
                  className="text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  {t("contracts.tableNode", "Nodo & Equipo CPE")}
                </TableHead>
                <TableHead
                  className="text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  {t("contracts.tablePlan", "Plan / Velocidad")}
                </TableHead>
                <TableHead
                  className="text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  {t("contracts.tableTech", "Tecnología")}
                </TableHead>
                <TableHead
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    "text-center whitespace-nowrap"
                  )}
                >
                  {t("contracts.tableStatus", "Estado Cartera")}
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
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36 mb-1" />
                      <Skeleton className="h-3 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-28 rounded-lg" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-5 w-20 mx-auto rounded-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : contracts.length === 0 ? (
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
                      <Network className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                      {t("contracts.emptyTitle", "No se encontraron contratos")}
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      {t(
                        "contracts.emptyDesc",
                        "Ajusta tus filtros de búsqueda o registra un " +
                          "nuevo enlace de servicio."
                      )}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map((c) => {
                  const isSelected = selectedContractIds.includes(c.id);
                  const isSuspended = c.billingStatus === "SUSPENDIDO_MORA";
                  const hasHistory =
                    (c._count?.payments ?? 0) > 0 ||
                    (c._count?.tickets ?? 0) > 0;
                  const planInfo = formatPlanInfo(c.plan);
                  const equipSummary = formatEquipmentSummary(c);

                  const rowActions: ActionDropdownItem[] = [
                    {
                      label: t(
                        "contracts.actionDiagnostic",
                        "Diagnóstico & Equipo CPE"
                      ),
                      icon: Activity,
                      onClick: () => handleRunDiagnostic(c),
                    },
                    {
                      label: t(
                        "contracts.actionKick",
                        "Reiniciar Sesión PPPoE"
                      ),
                      icon: RefreshCw,
                      onClick: () => handleKickSession(c),
                    },
                    {
                      label: t(
                        "contracts.actionCopyPaymentLink",
                        "Copiar Link de Pago"
                      ),
                      icon: Link2,
                      onClick: () => handleCopyPaymentLink(c.id),
                    },
                    {
                      label: t(
                        "contracts.actionSendPaymentLink",
                        "Enviar Link por WhatsApp"
                      ),
                      icon: MessageCircle,
                      onClick: () => handleSendPaymentLinkWhatsApp(c),
                    },
                    ...(canManageBilling
                      ? [
                          {
                            label: t(
                              "contracts.actionPromise",
                              "Conceder Prórroga de Pago"
                            ),
                            icon: CalendarClock,
                            onClick: () => handleOpenPromiseModal(c),
                          },
                        ]
                      : []),
                    ...(canManageContracts
                      ? [
                          {
                            label: t(
                              "contracts.actionEdit",
                              "Editar Contrato"
                            ),
                            icon: Edit2,
                            onClick: () => handleOpenEdit(c),
                          },
                          {
                            label: isSuspended
                              ? t(
                                  "contracts.actionReactivate",
                                  "Reactivar Servicio"
                                )
                              : t(
                                  "contracts.actionSuspend",
                                  "Suspender por Mora (Cortar)"
                                ),
                            icon: isSuspended ? Power : PowerOff,
                            variant: (isSuspended ? "emerald" : "default") as
                              | "emerald"
                              | "default",
                            onClick: () =>
                              handleToggleSuspension(c, !isSuspended),
                          },
                        ]
                      : []),
                    ...(canDeleteContracts
                      ? [
                          {
                            label: t(
                              "contracts.actionDelete",
                              "Eliminar Contrato"
                            ),
                            icon: Trash2,
                            variant: "destructive" as const,
                            onClick: () => setDeletingContractId(c.id),
                            disabled: hasHistory,
                          },
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

                      {/* Contract Number & PPPoE */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded font-mono font-extrabold text-[11px]",
                                "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                "border border-emerald-500/20"
                              )}
                            >
                              #{c.contractNumber}
                            </span>
                            {c.ipAddress && (
                              <span
                                className={cn(
                                  "text-[10px] font-mono text-zinc-400",
                                  "dark:text-zinc-500"
                                )}
                              >
                                {c.ipAddress}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "font-mono text-[11px] font-medium text-zinc-600",
                              "dark:text-zinc-300 truncate max-w-[210px]"
                            )}
                            title={c.pppoeUser}
                          >
                            {c.pppoeUser}
                          </span>
                        </div>
                      </TableCell>

                      {/* Client & Address */}
                      <TableCell className="min-w-[220px] max-w-[270px]">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={cn(
                              "font-bold text-xs text-zinc-900",
                              "dark:text-zinc-100 truncate"
                            )}
                            title={c.client?.fullName}
                          >
                            {c.client?.clientCode && (
                              <span
                                className={cn(
                                  "text-emerald-600 dark:text-emerald-400",
                                  "mr-1 font-mono"
                                )}
                              >
                                #{c.client.clientCode} &bull;
                              </span>
                            )}
                            {c.client?.fullName}
                          </span>
                          <div
                            className={cn(
                              "flex items-center gap-1 text-[11px]",
                              "text-zinc-400 truncate"
                            )}
                            title={`${c.address} (${c.city})`}
                          >
                            <MapPin className="h-3 w-3 shrink-0 text-zinc-400" />
                            <span className="truncate">{c.address}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Assigned Node & CPE Equipment */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5",
                              "rounded-md text-[10px] font-extrabold font-mono",
                              "bg-zinc-100 dark:bg-zinc-800 text-zinc-700",
                              "dark:text-zinc-300 border border-zinc-200",
                              "dark:border-zinc-700 whitespace-nowrap"
                            )}
                            title={c.node?.name}
                          >
                            <Server className="h-3 w-3 text-emerald-500 shrink-0" />
                            <span>{c.node?.code || c.node?.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRunDiagnostic(c)}
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px]",
                              "text-zinc-500 hover:text-emerald-600",
                              "dark:text-zinc-400 dark:hover:text-emerald-400",
                              "transition-colors cursor-pointer"
                            )}
                            title="Inspeccionar equipo CPE y sesión MikroTik"
                          >
                            <Router className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[165px]">
                              {equipSummary || "Inspeccionar MikroTik / CPE"}
                            </span>
                          </button>
                        </div>
                      </TableCell>

                      {/* Plan & Speed */}
                      <TableCell className="whitespace-nowrap">
                        <div
                          className="flex flex-col gap-0.5 text-xs whitespace-nowrap"
                          title={c.plan?.name}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">
                              {planInfo.title}
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-500">
                              · {planInfo.priceText}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "px-1.5 py-0.2 rounded text-[10px] font-mono font-extrabold",
                                "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {planInfo.speed}
                            </span>
                            {planInfo.cutoffText && (
                              <span className="text-[10px] text-zinc-400">
                                {planInfo.cutoffText}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Technology */}
                      <TableCell className="whitespace-nowrap">
                        {c.technology === "FIBRA_OPTICA" ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5",
                              "rounded-full text-[10px] font-bold whitespace-nowrap",
                              "bg-sky-500/10 text-sky-600 dark:text-sky-400",
                              "border-sky-500/20"
                            )}
                          >
                            <Radio className="h-3 w-3 shrink-0" />
                            <span>Fibra Óptica</span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5",
                              "rounded-full text-[10px] font-bold whitespace-nowrap",
                              "bg-amber-500/10 text-amber-600",
                              "dark:text-amber-400 border-amber-500/20"
                            )}
                          >
                            <Wifi className="h-3 w-3 shrink-0" />
                            <span>Microondas</span>
                          </Badge>
                        )}
                      </TableCell>

                      {/* Billing Status */}
                      <TableCell className="text-center whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] font-extrabold uppercase px-2.5 py-0.5",
                            "rounded-full whitespace-nowrap",
                            c.billingStatus === "ACTIVO"
                              ? "bg-emerald-500/10 text-emerald-600 " +
                                  "dark:text-emerald-400 " +
                                  "border border-emerald-500/20"
                              : c.billingStatus === "SUSPENDIDO_MORA"
                              ? "bg-rose-500/10 text-rose-600 " +
                                "dark:text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 " +
                                "dark:text-amber-400 border border-amber-500/20"
                          )}
                        >
                          {c.billingStatus.replace("_", " ")}
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
                    "h-64 rounded-2xl bg-zinc-100 dark:bg-zinc-900",
                    "animate-pulse border border-zinc-200 dark:border-zinc-800"
                  )}
                />
              ))}
            </div>
          ) : contracts.length === 0 ? (
            <div
              className={cn(
                "p-12 text-center rounded-2xl border",
                "border-dashed border-zinc-300 dark:border-zinc-800"
              )}
            >
              <Network className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {t("contracts.emptyTitle", "No se encontraron contratos")}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 mb-4">
                {t(
                  "contracts.emptyDesc",
                  "Ajusta tus filtros de búsqueda o registra un " +
                    "nuevo enlace de servicio."
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
                {t("contracts.newContract", "Nuevo Contrato")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {contracts.map((c) => {
                const isSelected = selectedContractIds.includes(c.id);
                const isSuspended = c.billingStatus === "SUSPENDIDO_MORA";
                const hasHistory =
                  (c._count?.payments ?? 0) > 0 ||
                  (c._count?.tickets ?? 0) > 0;

                const rowActions: ActionDropdownItem[] = [
                  {
                    label: t(
                      "contracts.actionDiagnostic",
                      "Diagnóstico en Vivo"
                    ),
                    icon: Activity,
                    onClick: () => handleRunDiagnostic(c),
                  },
                  {
                    label: t(
                      "contracts.actionKick",
                      "Reiniciar Sesión PPPoE"
                    ),
                    icon: RefreshCw,
                    onClick: () => handleKickSession(c),
                  },
                  {
                    label: t(
                      "contracts.actionCopyPaymentLink",
                      "Copiar Link de Pago"
                    ),
                    icon: Link2,
                    onClick: () => handleCopyPaymentLink(c.id),
                  },
                  {
                    label: t(
                      "contracts.actionSendPaymentLink",
                      "Enviar Link por WhatsApp"
                    ),
                    icon: MessageCircle,
                    onClick: () => handleSendPaymentLinkWhatsApp(c),
                  },
                  ...(canManageBilling
                    ? [
                        {
                          label: t(
                            "contracts.actionPromise",
                            "Conceder Prórroga de Pago"
                          ),
                          icon: CalendarClock,
                          onClick: () => handleOpenPromiseModal(c),
                        },
                      ]
                    : []),
                  ...(canManageContracts
                    ? [
                        {
                          label: t(
                            "contracts.actionEdit",
                            "Editar Contrato"
                          ),
                          icon: Edit2,
                          onClick: () => handleOpenEdit(c),
                        },
                        {
                          label: isSuspended
                            ? t(
                                "contracts.actionReactivate",
                                "Reactivar Servicio"
                              )
                            : t(
                                "contracts.actionSuspend",
                                "Suspender por Mora (Cortar)"
                              ),
                          icon: isSuspended ? Power : PowerOff,
                          variant: (isSuspended ? "emerald" : "default") as
                            | "emerald"
                            | "default",
                          onClick: () =>
                            handleToggleSuspension(c, !isSuspended),
                        },
                      ]
                    : []),
                  ...(canDeleteContracts
                    ? [
                        {
                          label: t(
                            "contracts.actionDelete",
                            "Eliminar Contrato"
                          ),
                          icon: Trash2,
                          variant: "destructive" as const,
                          onClick: () => setDeletingContractId(c.id),
                          disabled: hasHistory,
                        },
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
                      {/* Top Bar: Checkbox + ActionsDropdown + ContractCode + Status */}
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
                              "font-mono bg-emerald-500/10 text-emerald-600",
                              "dark:text-emerald-400 border border-emerald-500/20"
                            )}
                          >
                            #{c.contractNumber}
                          </span>
                        </div>

                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full",
                            c.billingStatus === "ACTIVO"
                              ? "bg-emerald-500/10 text-emerald-600 " +
                                  "dark:text-emerald-400 " +
                                  "border border-emerald-500/20"
                              : c.billingStatus === "SUSPENDIDO_MORA"
                              ? "bg-rose-500/10 text-rose-600 " +
                                "dark:text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 " +
                                "dark:text-amber-400 border border-amber-500/20"
                          )}
                        >
                          {c.billingStatus.replace("_", " ")}
                        </Badge>
                      </div>

                      {/* Client Name & Address */}
                      <h3
                        className={cn(
                          "text-base font-black text-zinc-900",
                          "dark:text-white leading-tight truncate"
                        )}
                      >
                        {c.client?.fullName}
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
                          {c.city}
                        </span>
                      </div>

                      {/* Direct Contact Buttons */}
                      {c.client?.phonePrimary && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <a
                            href={`tel:${c.client.phonePrimary}`}
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
                          <button
                            type="button"
                            onClick={() => handleSendPaymentLinkWhatsApp(c)}
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
                          </button>
                        </div>
                      )}

                      {/* Link Telemetry Box */}
                      <div
                        className={cn(
                          "mt-3 p-3 rounded-xl bg-zinc-50",
                          "dark:bg-zinc-950/60 border border-zinc-200/70",
                          "dark:border-zinc-800/80 space-y-2 text-xs"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">PPPoE / IP:</span>
                          <span
                            className={cn(
                              "font-mono font-bold text-zinc-800",
                              "dark:text-zinc-200"
                            )}
                          >
                            {c.pppoeUser}
                            {c.ipAddress ? ` (${c.ipAddress})` : ""}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Nodo RouterOS:</span>
                          <span
                            className={cn(
                              "font-bold text-zinc-700 dark:text-zinc-300",
                              "truncate max-w-[150px]"
                            )}
                          >
                            {c.node?.name}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">Plan Contratado:</span>
                          <span
                            className={cn(
                              "font-bold text-emerald-600",
                              "dark:text-emerald-400"
                            )}
                          >
                            {c.plan?.name} ({c.plan?.rateLimit})
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex justify-between items-center pt-1",
                            "border-t border-zinc-200/50 dark:border-zinc-800/50"
                          )}
                        >
                          <span className="text-zinc-500">Tecnología:</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                            {c.technology === "FIBRA_OPTICA"
                              ? "Fibra Óptica"
                              : "Microondas"}
                          </span>
                        </div>
                      </div>

                      {/* Main Action: Live Diagnostic */}
                      <Button
                        size="sm"
                        onClick={() => handleRunDiagnostic(c)}
                        className={cn(
                          "w-full rounded-xl gap-1.5 text-xs font-bold mt-3",
                          "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        )}
                      >
                        <Activity className="h-3.5 w-3.5" />
                        {t(
                          "contracts.actionDiagnosticBtn",
                          "Diagnóstico en Vivo"
                        )}
                      </Button>
                    </div>

                    {/* Actions Footer */}
                    {canManageContracts && (
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
        selectedCount={selectedContractIds.length}
        onClearSelection={() => setSelectedContractIds([])}
        onActivate={handleBulkActivate}
        onDeactivate={handleBulkDeactivate}
        onDelete={canDeleteContracts ? handleBulkDelete : undefined}
        resourceName="contratos"
        isLoading={isActionLoading}
      />

      {/* Create / Edit Contract Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              {editingContract?.id
                ? t(
                    "contracts.modalEditTitle",
                    "Editar Contrato & Equipo CPE"
                  )
                : t("contracts.modalCreateTitle", "Registrar Nuevo Contrato")}
            </DialogTitle>
          </DialogHeader>

          {editingContract && (
            <form onSubmit={handleSaveContract} className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  {editingContract.id ? (
                    <>
                      <Label className="text-xs font-bold">
                        {t("contracts.labelClient", "Titular / Abonado *")}
                      </Label>
                      <div
                        className={cn(
                          "h-9 px-3 rounded-xl border border-zinc-200",
                          "dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900",
                          "flex items-center justify-between gap-2 text-xs"
                        )}
                      >
                        <span
                          className="font-bold text-zinc-800 dark:text-zinc-200 truncate"
                          title={editingContract.clientLabel}
                        >
                          {editingContract.clientLabel}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0 font-mono"
                        >
                          Titular Fijo
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <ClientSearchSelector
                      clients={clientsList}
                      selectedClientId={editingContract.clientId}
                      onSelect={(client) => {
                        setEditingContract({
                          ...editingContract,
                          clientId: client?.id || "",
                          clientLabel: client?.fullName || "",
                          address:
                            client?.address || editingContract.address,
                          city: client?.city || editingContract.city,
                        });
                      }}
                      onSearchServer={async (query) => {
                        const res = await getClients({
                          brandId: activeBrandId,
                          search: query,
                          pageSize: 10,
                        });
                        return res.success && res.data ? res.data.items : [];
                      }}
                      label={t("contracts.labelClient", "Titular / Abonado")}
                      required
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {t(
                      "contracts.labelContractNumber",
                      "Número de Contrato *"
                    )}
                  </Label>
                  {editingContract.id ? (
                    <div
                      className={cn(
                        "h-9 px-3 rounded-xl border border-zinc-200",
                        "dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900",
                        "flex items-center font-mono font-bold text-xs",
                        "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      #{editingContract.contractNumber}
                    </div>
                  ) : (
                    <Input
                      required
                      maxLength={50}
                      placeholder="ej. SER-1042"
                      value={editingContract.contractNumber}
                      onChange={(e) =>
                        setEditingContract({
                          ...editingContract,
                          contractNumber: e.target.value.toUpperCase(),
                        })
                      }
                      className="rounded-xl text-xs h-9 font-mono uppercase"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {t("contracts.labelNode", "Nodo MikroTik *")}
                  </Label>
                  <Select
                    value={editingContract.nodeId}
                    onValueChange={(val) =>
                      setEditingContract({
                        ...editingContract,
                        nodeId: val,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs">
                      <SelectValue placeholder="Seleccionar nodo..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs">
                      {nodes.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.name} ({n.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {t("contracts.labelPlan", "Plan de Internet *")}
                  </Label>
                  <Select
                    value={editingContract.planId}
                    onValueChange={(val) =>
                      setEditingContract({
                        ...editingContract,
                        planId: val,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs">
                      <SelectValue placeholder="Seleccionar plan..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs max-h-60">
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.rateLimit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {t("contracts.labelTechnology", "Tecnología")}
                  </Label>
                  <Select
                    value={editingContract.technology}
                    onValueChange={(val) =>
                      setEditingContract({
                        ...editingContract,
                        technology: val as TechnologyType,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs">
                      <SelectItem value="FIBRA_OPTICA">
                        Fibra Óptica (FTTH)
                      </SelectItem>
                      <SelectItem value="MICROONDAS">
                        Microondas (Radioenlace)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {t("contracts.labelBillingStatus", "Estado de Cartera")}
                  </Label>
                  <Select
                    value={editingContract.billingStatus}
                    onValueChange={(val) =>
                      setEditingContract({
                        ...editingContract,
                        billingStatus: val as BillingStatus,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs">
                      <SelectItem value="ACTIVO">Activo (Al Día)</SelectItem>
                      <SelectItem value="AVISO_VENCIMIENTO">
                        Aviso Vencimiento
                      </SelectItem>
                      <SelectItem value="SUSPENDIDO_MORA">
                        Suspendido por Mora
                      </SelectItem>
                      <SelectItem value="CORTESIA">Cortesía</SelectItem>
                      <SelectItem value="RETIRADO">
                        Retirado (Baja de Servicio)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {t("contracts.labelPppoeUser", "Usuario PPPoE *")}
                  </Label>
                  <Input
                    required
                    maxLength={60}
                    placeholder="ej. carlos.gonzalez"
                    value={editingContract.pppoeUser}
                    onChange={(e) =>
                      setEditingContract({
                        ...editingContract,
                        pppoeUser: e.target.value,
                      })
                    }
                    className="rounded-xl text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {t("contracts.labelPppoePassword", "Password PPPoE")}
                  </Label>
                  <Input
                    maxLength={60}
                    placeholder="Password secret..."
                    value={editingContract.pppoePassword}
                    onChange={(e) =>
                      setEditingContract({
                        ...editingContract,
                        pppoePassword: e.target.value,
                      })
                    }
                    className="rounded-xl text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {t("contracts.labelIpAddress", "IP Asignada (Opcional)")}
                  </Label>
                  <Input
                    maxLength={45}
                    placeholder="ej. 10.10.20.14"
                    value={editingContract.ipAddress}
                    onChange={(e) =>
                      setEditingContract({
                        ...editingContract,
                        ipAddress: e.target.value,
                      })
                    }
                    className="rounded-xl text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs font-bold">
                    {t(
                      "contracts.labelAddress",
                      "Dirección de Instalación *"
                    )}
                  </Label>
                  <Input
                    required
                    maxLength={150}
                    placeholder="ej. Cra 5 # 12-34 Apto 302"
                    value={editingContract.address}
                    onChange={(e) =>
                      setEditingContract({
                        ...editingContract,
                        address: e.target.value,
                      })
                    }
                    className="rounded-xl text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {t("contracts.labelNeighborhood", "Barrio / Vereda")}
                  </Label>
                  <Input
                    maxLength={80}
                    placeholder="ej. Centro"
                    value={editingContract.neighborhood}
                    onChange={(e) =>
                      setEditingContract({
                        ...editingContract,
                        neighborhood: e.target.value,
                      })
                    }
                    className="rounded-xl text-xs h-9"
                  />
                </div>
              </div>

              {/* Complete CPE Equipment Section */}
              <div
                className={cn(
                  "pt-3 border-t border-zinc-100",
                  "dark:border-zinc-800 space-y-3"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-extrabold uppercase tracking-wider",
                      "text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
                    )}
                  >
                    <Router className="h-3.5 w-3.5 text-emerald-500" />
                    Equipo Contratado / Inventario en Sitio (CPE)
                  </span>

                  {editingContract.id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReleaseEquipment}
                      className={cn(
                        "h-7 px-2.5 text-[11px] font-bold rounded-lg",
                        "border-rose-500/30 text-rose-600 dark:text-rose-400",
                        "hover:bg-rose-500/10"
                      )}
                    >
                      <PowerOff className="h-3 w-3 mr-1" />
                      Dar de Baja / Liberar Equipo CPE
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">
                      {t("contracts.labelRouterBrand", "Marca ONU / Router")}
                    </Label>
                    <Input
                      maxLength={60}
                      placeholder="ej. Huawei, Tp-link, Dlink"
                      value={editingContract.routerBrand}
                      onChange={(e) =>
                        setEditingContract({
                          ...editingContract,
                          routerBrand: e.target.value,
                        })
                      }
                      className="rounded-xl text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">
                      {t("contracts.labelRouterModel", "Modelo Equipo")}
                    </Label>
                    <Input
                      maxLength={60}
                      placeholder="ej. HG8145V5, Archer C5"
                      value={editingContract.routerModel}
                      onChange={(e) =>
                        setEditingContract({
                          ...editingContract,
                          routerModel: e.target.value,
                        })
                      }
                      className="rounded-xl text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">
                      MAC Router / Tipo ONT
                    </Label>
                    <Input
                      maxLength={30}
                      placeholder="ej. C4:E9:84:5C:72:CE o ONT VSOL"
                      value={editingContract.routerMac}
                      onChange={(e) =>
                        setEditingContract({
                          ...editingContract,
                          routerMac: e.target.value,
                        })
                      }
                      className="rounded-xl text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">
                      Antena (Radioenlace)
                    </Label>
                    <Input
                      maxLength={60}
                      placeholder="ej. LiteBeam M5"
                      value={editingContract.antennaType}
                      onChange={(e) =>
                        setEditingContract({
                          ...editingContract,
                          antennaType: e.target.value,
                        })
                      }
                      className="rounded-xl text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">IP Antena</Label>
                    <Input
                      maxLength={45}
                      placeholder="ej. 192.168.37.161"
                      value={editingContract.antennaIp}
                      onChange={(e) =>
                        setEditingContract({
                          ...editingContract,
                          antennaIp: e.target.value,
                        })
                      }
                      className="rounded-xl text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">
                      Metros de Cable
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="ej. 120"
                      value={editingContract.cableMeters}
                      onChange={(e) =>
                        setEditingContract({
                          ...editingContract,
                          cableMeters: e.target.value,
                        })
                      }
                      className="rounded-xl text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">
                      {t(
                        "contracts.labelOpticalPower",
                        "Potencia Rx (dBm)"
                      )}
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="ej. -21.5"
                      value={editingContract.opticalPowerRx}
                      onChange={(e) =>
                        setEditingContract({
                          ...editingContract,
                          opticalPowerRx: e.target.value,
                        })
                      }
                      className="rounded-xl text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    Notas de Instalación / Observaciones del Técnico
                  </Label>
                  <Input
                    maxLength={500}
                    placeholder="ej. Instala Felipe | Migración de fibra..."
                    value={editingContract.equipmentNotes}
                    onChange={(e) =>
                      setEditingContract({
                        ...editingContract,
                        equipmentNotes: e.target.value,
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
                  {isSaving ? "Guardando..." : "Guardar Contrato"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Live Diagnostic & Contracted Equipment Modal */}
      <Dialog open={diagModalOpen} onOpenChange={setDiagModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              {t(
                "contracts.actionDiagnostic",
                "Diagnóstico MikroTik & Equipo Contratado"
              )}
            </DialogTitle>
          </DialogHeader>

          {activeContractDiag && (
            <div className="space-y-4 mt-2">
              <div
                className={cn(
                  "p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60",
                  "border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold text-sm text-zinc-900 dark:text-zinc-50">
                    Contrato #{activeContractDiag.contractNumber} —{" "}
                    {activeContractDiag.client?.fullName}
                  </div>
                  {diagnosticResult?.latencyMs !== undefined && (
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-md font-mono text-[10px] font-bold",
                        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      API: {diagnosticResult.latencyMs} ms
                    </span>
                  )}
                </div>
                <div className="text-zinc-500">
                  Nodo:{" "}
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    {activeContractDiag.node?.name} (
                    {diagnosticResult
                      ? `${diagnosticResult.targetHost}:${diagnosticResult.targetPort}`
                      : activeContractDiag.node?.code}
                    )
                  </span>{" "}
                  | PPPoE:{" "}
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {activeContractDiag.pppoeUser}
                  </span>
                </div>
              </div>

              <ContractExpressDiagnosticCard
                contract={activeContractDiag}
                diagnostic={diagnosticResult}
                isLoading={diagLoading}
                onRefresh={() => handleRunDiagnostic(activeContractDiag)}
              />

              {/* Contracted Equipment (CPE Inventory) Section */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h5
                    className={cn(
                      "text-[11px] font-extrabold uppercase tracking-wider",
                      "text-zinc-500 flex items-center gap-1.5"
                    )}
                  >
                    <Router className="h-3.5 w-3.5 text-emerald-500" />
                    Equipo Contratado / Inventario en Sitio (CPE)
                  </h5>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDiagModalOpen(false);
                      handleOpenEdit(activeContractDiag);
                    }}
                    className="h-7 px-2.5 text-[11px] font-bold text-emerald-600 rounded-lg"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Editar Equipo
                  </Button>
                </div>

                {activeContractDiag.equipment ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div
                        className={cn(
                          "p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60",
                          "border border-zinc-200 dark:border-zinc-800"
                        )}
                      >
                        <span className="text-zinc-500 text-[10px]">
                          Marca / Modelo Router:
                        </span>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          {activeContractDiag.equipment.routerBrand || "N/D"}{" "}
                          {activeContractDiag.equipment.routerModel || ""}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60",
                          "border border-zinc-200 dark:border-zinc-800"
                        )}
                      >
                        <span className="text-zinc-500 text-[10px]">
                          MAC Router / ONT:
                        </span>
                        <p
                          className={cn(
                            "font-bold text-zinc-900 dark:text-zinc-100",
                            "font-mono mt-0.5 truncate"
                          )}
                        >
                          {activeContractDiag.equipment.routerMac || "N/D"}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60",
                          "border border-zinc-200 dark:border-zinc-800"
                        )}
                      >
                        <span className="text-zinc-500 text-[10px]">
                          Antena / Radioenlace:
                        </span>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          {activeContractDiag.equipment.antennaType || "N/A"}
                          {activeContractDiag.equipment.antennaIp
                            ? ` (${activeContractDiag.equipment.antennaIp})`
                            : ""}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60",
                          "border border-zinc-200 dark:border-zinc-800"
                        )}
                      >
                        <span className="text-zinc-500 text-[10px]">
                          Cable / Potencia Rx:
                        </span>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {activeContractDiag.equipment.cableMeters
                            ? `${activeContractDiag.equipment.cableMeters} m`
                            : "0 m"}
                          {activeContractDiag.equipment.opticalPowerRx
                            ? ` · ${activeContractDiag.equipment.opticalPowerRx} dBm`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {activeContractDiag.equipment.notes && (
                      <div
                        className={cn(
                          "p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60",
                          "border border-zinc-200 dark:border-zinc-800 text-[11px]",
                          "text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">
                          Notas de Instalación:{" "}
                        </span>
                        {activeContractDiag.equipment.notes}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "p-4 rounded-xl border border-dashed",
                      "border-zinc-300 dark:border-zinc-800 text-center",
                      "text-xs text-zinc-500"
                    )}
                  >
                    Este contrato aún no tiene equipo CPE registrado en
                    inventario.
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "pt-3 flex justify-end gap-2 border-t",
                  "border-zinc-100 dark:border-zinc-800"
                )}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDiagModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Promise Dialog */}
      <Dialog
        open={Boolean(promiseContract)}
        onOpenChange={(open) => !open && setPromiseContract(null)}
      >
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <CalendarClock className="h-5 w-5 text-emerald-600" />
              {t("contracts.promiseModalTitle", "Conceder Prórroga de Pago")}
            </DialogTitle>
            <p className="text-xs text-zinc-500">
              {t(
                "contracts.promiseModalDesc",
                "Reactiva el servicio temporalmente en MikroTik y genera ticket auditado."
              )}
            </p>
          </DialogHeader>

          {promiseContract && (
            <div className="space-y-4 py-2">
              <div className={cn(
                "p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border",
                "border-zinc-200 dark:border-zinc-700/60 text-xs space-y-1.5"
              )}>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Contrato:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    #{promiseContract.contractNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Abonado / Titular:</span>
                  <span
                    className={cn(
                      "font-semibold text-zinc-900 dark:text-zinc-100",
                      "truncate max-w-[200px]"
                    )}
                  >
                    {promiseContract.client?.fullName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">PPPoE:</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {promiseContract.pppoeUser}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("contracts.promiseHoursLabel", "Horas de Prórroga")}
                </Label>
                <Select
                  value={String(promiseHours)}
                  onValueChange={(val) => setPromiseHours(Number(val))}
                >
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="24">24 Horas (1 Día - Estándar)</SelectItem>
                    <SelectItem value="48">48 Horas (2 Días)</SelectItem>
                    <SelectItem value="72">72 Horas (3 Días)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t(
                    "contracts.promiseNotesLabel",
                    "Observaciones / Justificación"
                  )}
                </Label>
                <Input
                  value={promiseNotes}
                  onChange={(e) => setPromiseNotes(e.target.value)}
                  placeholder="Ej. Promesa de pago acordada por WhatsApp."
                  className="rounded-xl text-xs h-9"
                  maxLength={250}
                />
              </div>

              <div
                className={cn(
                  "p-2.5 rounded-xl border text-[11px] leading-relaxed",
                  "bg-amber-500/10 border-amber-500/20 text-amber-700",
                  "dark:text-amber-400"
                )}
              >
                {t(
                  "contracts.promisePolicyNotice",
                  "Política: Máximo 1 prórroga cada 30 días. No se " +
                    "permiten prórrogas si ya existe una activa en curso."
                )}
              </div>

              {isAdmin && (
                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="overrideLimitCheckbox"
                    checked={promiseOverrideLimit}
                    onChange={(e) =>
                      setPromiseOverrideLimit(e.target.checked)
                    }
                    className={cn(
                      "mt-0.5 rounded border-zinc-300",
                      "dark:border-zinc-700 text-emerald-600",
                      "focus:ring-emerald-500 h-4 w-4 accent-emerald-600",
                      "cursor-pointer"
                    )}
                  />
                  <label
                    htmlFor="overrideLimitCheckbox"
                    className="text-xs cursor-pointer select-none"
                  >
                    <span
                      className={cn(
                        "font-semibold text-zinc-800",
                        "dark:text-zinc-200 block"
                      )}
                    >
                      {t(
                        "contracts.promiseOverrideTitle",
                        "Excepción administrativa (Override)"
                      )}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                      {t(
                        "contracts.promiseOverrideDesc",
                        "Concede prórroga extraordinaria aunque ya haya " +
                          "usado la del mes. Requiere justificación " +
                          "(mínimo 10 caracteres)."
                      )}
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          <div
            className={cn(
              "flex items-center justify-end gap-2 pt-3",
              "border-t border-zinc-100 dark:border-zinc-800"
            )}
          >
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingPromise}
              onClick={() => setPromiseContract(null)}
              className="rounded-xl text-xs"
            >
              {t("common.cancel", "Cancelar")}
            </Button>
            <Button
              type="button"
              disabled={isSubmittingPromise}
              onClick={handleConfirmPromise}
              className={cn(
                "bg-emerald-600 hover:bg-emerald-700 text-white",
                "rounded-xl text-xs font-bold"
              )}
            >
              {isSubmittingPromise
                ? "Reactivando..."
                : t("contracts.promiseSubmitBtn", "Conceder Prórroga Ahora")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Premium Individual Delete AlertDialog */}
      <AlertDialog
        open={Boolean(deletingContractId)}
        onOpenChange={(open) => !open && setDeletingContractId(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-rose-600">
              {t(
                "contracts.deleteConfirmTitle",
                "¿Eliminar este contrato definitivamente?"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-600 dark:text-zinc-400">
              {t(
                "contracts.deleteConfirmDesc",
                "Esta acción es irreversible y solo se permite si el " +
                  "contrato no posee pagos ni tickets de soporte registrados."
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
                : t("contracts.actionDelete", "Eliminar Contrato")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Auditoría y Conciliación MikroTik */}
      <ContractAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        nodes={nodes}
        onAuditApplied={loadContracts}
      />
    </div>
  );
}

export default function ContractsDashboardPage() {
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
      <ContractsTableContent />
    </Suspense>
  );
}
