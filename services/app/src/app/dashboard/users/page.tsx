"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useBrand } from "@/context/brand-context";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Filter,
  UserCheck,
  Building2,
  AlertTriangle,
  Headphones,
  Receipt,
  Wrench,
  X,
} from "lucide-react";
import type { RoleName } from "@/types";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  bulkDeleteUsers,
  bulkToggleUsersStatus,
  type UserWithRoles,
} from "@/actions/auth";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

function UsersTableContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { activeBrandId, brands, activeBrand } = useBrand();

  const currentPage = Math.max(
    1,
    parseInt(searchParams.get("page") ?? "1", 10)
  );
  const currentSearch = searchParams.get("search") ?? "";
  const currentRole = searchParams.get("role") ?? "all";
  const currentStatus = searchParams.get("status") ?? "all";

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activeCount, setActiveCount] = useState(0);
  const [adminsCount, setAdminsCount] = useState(0);
  const [techniciansCount, setTechniciansCount] = useState(0);
  const [billingCount, setBillingCount] = useState(0);
  const [supportCount, setSupportCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.roles?.includes("SUPER_ADMIN");

  const updateUrlParams = useCallback(
    (updates: {
      page?: number;
      search?: string;
      role?: string;
      status?: string;
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

      if (updates.role !== undefined) {
        if (updates.role === "all") params.delete("role");
        else params.set("role", updates.role);
      }

      if (updates.status !== undefined) {
        if (updates.status === "all") params.delete("status");
        else params.set("status", updates.status);
      }

      const queryString = params.toString();
      const newPath = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newPath);
    },
    [pathname, router, searchParams]
  );

  const fetchServerUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getUsers({
        page: currentPage,
        limit: 10,
        search: currentSearch || undefined,
        role: currentRole !== "all" ? currentRole : undefined,
        status: currentStatus !== "all" ? currentStatus : undefined,
        brandId: isSuperAdmin ? activeBrandId : undefined,
      });

      if (res.success && res.data) {
        setUsers(res.data.users);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setActiveCount(res.data.activeCount);
        setAdminsCount(res.data.adminsCount);
        setTechniciansCount(
          res.data.techniciansCount ?? res.data.operatorsCount ?? 0
        );
        setBillingCount(res.data.billingCount ?? 0);
        setSupportCount(res.data.supportCount ?? 0);
      } else {
        toast.error(
          res.error ?? t("users.errorFetch", "Error al cargar usuarios")
        );
      }
    } catch (_err) {
      toast.error(t("users.errorFetch", "Error al cargar usuarios"));
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    currentSearch,
    currentRole,
    currentStatus,
    activeBrandId,
    isSuperAdmin,
    t,
  ]);

  useEffect(() => {
    fetchServerUsers();
  }, [fetchServerUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ search: searchInput, page: 1 });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateUrlParams({ search: "", page: 1 });
  };

  const handleRoleFilterChange = (roleValue: string) => {
    updateUrlParams({ role: roleValue, page: 1 });
  };

  const isTotalActive = currentRole === "all" && currentStatus === "all";
  const isActiveStatusActive = currentStatus === "active";
  const isAdminsActive = currentRole === "ADMIN";
  const isTechniciansActive =
    currentRole === "TECHNICIAN" || currentRole === "USER";
  const isBillingActive = currentRole === "BILLING";
  const isSupportActive = currentRole === "SUPPORT";

  const handleFilterCardClick = (
    type: "total" | "active" | "admin" | "technician" | "billing" | "support"
  ) => {
    if (type === "total") {
      updateUrlParams({ role: "all", status: "all", page: 1 });
    } else if (type === "active") {
      const next = isActiveStatusActive ? "all" : "active";
      updateUrlParams({ status: next, page: 1 });
    } else if (type === "admin") {
      const next = isAdminsActive ? "all" : "ADMIN";
      updateUrlParams({ role: next, page: 1 });
    } else if (type === "technician") {
      const next = isTechniciansActive ? "all" : "TECHNICIAN";
      updateUrlParams({ role: next, page: 1 });
    } else if (type === "billing") {
      const next = isBillingActive ? "all" : "BILLING";
      updateUrlParams({ role: next, page: 1 });
    } else if (type === "support") {
      const next = isSupportActive ? "all" : "SUPPORT";
      updateUrlParams({ role: next, page: 1 });
    }
  };

  const isUserSelectable = useCallback(
    (u: UserWithRoles) => {
      const isSuper =
        u.roles?.includes("SUPER_ADMIN") ||
        u.email === "admin@remotemonkeys.ai";
      const isSelf = u.id === session?.user?.id;
      return !isSuper && !isSelf;
    },
    [session?.user?.id]
  );

  const selectableUsers = useMemo(
    () => users.filter(isUserSelectable),
    [users, isUserSelectable]
  );

  const isAllSelectableChecked =
    selectableUsers.length > 0 &&
    selectableUsers.every((u) => selectedUserIds.includes(u.id));

  const toggleSelectAll = () => {
    if (isAllSelectableChecked) {
      setSelectedUserIds((prev) =>
        prev.filter((id) => !selectableUsers.some((u) => u.id === id))
      );
    } else {
      const newIds = selectableUsers.map((u) => u.id);
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...newIds])));
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const createForm = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roleName: "TECHNICIAN",
      brandId: activeBrandId !== "ALL" ? activeBrandId : null,
    },
  });

  const updateForm = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roleName: "TECHNICIAN",
      isActive: true,
      brandId: null,
    },
  });

  useEffect(() => {
    if (editingUser) {
      let userRole = (editingUser.roles?.[0] ?? "TECHNICIAN") as RoleName;
      if (userRole === ("USER" as string)) userRole = "TECHNICIAN";
      updateForm.reset({
        name: editingUser.name ?? "",
        email: editingUser.email ?? "",
        password: "",
        roleName: userRole,
        isActive: editingUser.isActive ?? true,
        brandId: editingUser.brandId ?? null,
      });
    }
  }, [editingUser, updateForm]);

  const handleCreateSubmit = async (data: CreateUserInput) => {
    setIsActionLoading(true);
    try {
      const res = await createUser({
        name: data.name,
        email: data.email,
        password: data.password,
        roleName: data.roleName,
        brandId: data.brandId,
      });

      if (res.success) {
        toast.success(t("users.createSuccess", "Usuario creado correctamente"));
        setIsCreateOpen(false);
        createForm.reset();
        fetchServerUsers();
      } else {
        if (res.error === "EMAIL_EXISTS") {
          createForm.setError("email", {
            type: "manual",
            message: t(
              "users.emailExists",
              "Este correo electrónico ya está registrado"
            ),
          });
        } else {
          toast.error(res.error ?? t("common.errorGeneric", "Error inesperado"));
        }
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error inesperado"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateSubmit = async (data: UpdateUserInput) => {
    if (!editingUser) return;
    setIsActionLoading(true);
    try {
      const res = await updateUser(editingUser.id, {
        name: data.name,
        email: data.email,
        password: data.password || undefined,
        roleName: data.roleName,
        isActive: data.isActive,
        brandId: data.brandId,
      });

      if (res.success) {
        toast.success(
          t("users.updateSuccess", "Usuario actualizado correctamente")
        );
        setEditingUser(null);
        fetchServerUsers();
      } else {
        if (res.error === "EMAIL_EXISTS") {
          updateForm.setError("email", {
            type: "manual",
            message: t(
              "users.emailExists",
              "Este correo electrónico ya está registrado"
            ),
          });
        } else {
          toast.error(res.error ?? t("common.errorGeneric", "Error inesperado"));
        }
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error inesperado"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUserId) return;
    setIsActionLoading(true);
    try {
      const res = await deleteUser(deletingUserId);
      if (res.success) {
        toast.success(
          t("users.deleteSuccess", "Usuario eliminado correctamente")
        );
        setDeletingUserId(null);
        setSelectedUserIds((prev) =>
          prev.filter((id) => id !== deletingUserId)
        );
        fetchServerUsers();
      } else {
        toast.error(
          res.error ?? t("common.errorGeneric", "Error al eliminar usuario")
        );
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error al eliminar usuario"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: UserWithRoles) => {
    setIsActionLoading(true);
    try {
      const res = await toggleUserStatus(user.id, !user.isActive);
      if (res.success) {
        toast.success(t("users.updateSuccess", "Estado de usuario actualizado"));
        fetchServerUsers();
      } else {
        toast.error(res.error ?? t("common.errorGeneric", "Error al cambiar estado"));
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error al cambiar estado"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkToggle = async (active: boolean) => {
    if (selectedUserIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await bulkToggleUsersStatus(selectedUserIds, active);
      if (res.success) {
        toast.success(
          t(
            "users.bulkStatusSuccess",
            "Estado de usuarios actualizado correctamente"
          )
        );
        setSelectedUserIds([]);
        fetchServerUsers();
      } else {
        toast.error(res.error ?? t("common.errorGeneric", "Error en lote"));
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error en lote"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;
    setIsActionLoading(true);
    try {
      const res = await bulkDeleteUsers(selectedUserIds);
      if (res.success) {
        toast.success(
          t(
            "users.bulkDeleteSuccess",
            "Usuarios seleccionados eliminados correctamente"
          )
        );
        setSelectedUserIds([]);
        fetchServerUsers();
      } else {
        toast.error(res.error ?? t("common.errorGeneric", "Error en lote"));
      }
    } catch (_err) {
      toast.error(t("common.errorGeneric", "Error en lote"));
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className={
              "text-2xl sm:text-3xl font-black text-zinc-900 " +
              "dark:text-white tracking-tight flex items-center gap-2"
            }
          >
            <Users className="h-7 w-7 text-emerald-500" />
            <span>{t("users.title", "Gestión de Usuarios")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {t(
              "users.subtitle",
              "Gestiona el equipo de trabajo, operadores NOC y técnicos de campo."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => setIsRolesModalOpen(true)}
            className={
              "gap-2 font-bold rounded-xl h-11 border-zinc-200 " +
              "dark:border-zinc-800 text-xs shadow-xs cursor-pointer"
            }
          >
            <Shield className="h-4 w-4 text-emerald-500" />
            <span>{t("users.rolesMatrixBtn", "Matriz de Roles")}</span>
          </Button>

          <Button
            onClick={() => {
              createForm.reset({
                name: "",
                email: "",
                password: "",
                roleName: "TECHNICIAN",
                brandId: activeBrandId !== "ALL" ? activeBrandId : null,
              });
              setIsCreateOpen(true);
            }}
            className={
              "gap-2 font-bold rounded-xl h-11 shadow-sm " +
              "bg-gradient-to-r from-emerald-500 to-teal-600 text-white cursor-pointer"
            }
          >
            <Plus className="h-4 w-4" />
            <span>{t("users.btnCreate", "Nuevo Usuario")}</span>
          </Button>
        </div>
      </div>

      {/* Metrics Cards Grid acting as Filter Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
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
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-3.5">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t("users.statTotal", "Total")}
            </CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div className="text-xl font-black font-mono text-zinc-900 dark:text-white">
              {total}
            </div>
            <p className="text-[9px] text-zinc-400 mt-0.5 truncate">
              {isTotalActive ? "Filtro activo" : "Ver todos"}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterCardClick("active")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isActiveStatusActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
              "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
              "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-3.5">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t("users.statActive", "Activas")}
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div
              className={
                "text-xl font-black font-mono text-emerald-600 " +
                "dark:text-emerald-400"
              }
            >
              {activeCount}
            </div>
            <p className="text-[9px] text-zinc-400 mt-0.5 truncate">
              {isActiveStatusActive ? "Filtro activo" : "Filtrar activas"}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterCardClick("admin")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isAdminsActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
              "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
              "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-3.5">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t("users.statAdmins", "Admins")}
            </CardTitle>
            <Shield className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div className="text-xl font-black font-mono text-zinc-900 dark:text-white">
              {adminsCount}
            </div>
            <p className="text-[9px] text-zinc-400 mt-0.5 truncate">
              {isAdminsActive ? "Filtro activo" : "Filtrar admins"}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterCardClick("technician")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isTechniciansActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
              "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
              "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-3.5">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t("users.statTechnicians", "Técnicos")}
            </CardTitle>
            <Wrench className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div className="text-xl font-black font-mono text-zinc-900 dark:text-white">
              {techniciansCount}
            </div>
            <p className="text-[9px] text-zinc-400 mt-0.5 truncate">
              {isTechniciansActive ? "Filtro activo" : "Filtrar técnicos"}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterCardClick("billing")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isBillingActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
              "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
              "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-3.5">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t("users.statBilling", "Facturación")}
            </CardTitle>
            <Receipt className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div className="text-xl font-black font-mono text-zinc-900 dark:text-white">
              {billingCount}
            </div>
            <p className="text-[9px] text-zinc-400 mt-0.5 truncate">
              {isBillingActive ? "Filtro activo" : "Filtrar finanzas"}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleFilterCardClick("support")}
          className={cn(
            "cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur",
            isSupportActive
              ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 " +
              "border-emerald-500 shadow-md"
              : "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
              "dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-3.5">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t("users.statSupport", "Soporte")}
            </CardTitle>
            <Headphones className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div className="text-xl font-black font-mono text-zinc-900 dark:text-white">
              {supportCount}
            </div>
            <p className="text-[9px] text-zinc-400 mt-0.5 truncate">
              {isSupportActive ? "Filtro activo" : "Filtrar soporte"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card
        className={
          "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
          "dark:bg-zinc-900/60 backdrop-blur rounded-2xl shadow-sm"
        }
      >
        <CardContent className="p-4">
          <div
            className={
              "flex flex-col sm:flex-row items-stretch " +
              "sm:items-center gap-3 justify-between"
            }
          >
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <button
                type="submit"
                aria-label={t("common.search", "Buscar")}
                className={
                  "absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md " +
                  "text-zinc-400 hover:text-emerald-600 " +
                  "dark:hover:text-emerald-400 transition-colors cursor-pointer"
                }
              >
                <Search className="h-4 w-4" />
              </button>
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t(
                  "users.searchPlaceholder",
                  "Buscar por nombre o correo..."
                )}
                className={
                  "pl-9 pr-9 rounded-xl h-10 border-zinc-200 " +
                  "dark:border-zinc-800 text-xs"
                }
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className={
                    "absolute right-3 top-1/2 -translate-y-1/2 " +
                    "text-zinc-400 hover:text-zinc-600 " +
                    "dark:hover:text-zinc-200"
                  }
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-zinc-400 shrink-0" />
              <Select value={currentRole} onValueChange={handleRoleFilterChange}>
                <SelectTrigger
                  className={
                    "w-44 rounded-xl h-10 border-zinc-200 " +
                    "dark:border-zinc-800 text-xs font-semibold"
                  }
                >
                  <SelectValue
                    placeholder={t("users.filterRole", "Todos los roles")}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">
                    {t("users.roleAll", "Todos los roles")}
                  </SelectItem>
                  {isSuperAdmin && (
                    <SelectItem value="SUPER_ADMIN">
                      {t("users.roleSuperAdmin", "Super Admin")}
                    </SelectItem>
                  )}
                  <SelectItem value="ADMIN">
                    {t("users.roleAdmin", "Admin de Marca")}
                  </SelectItem>
                  <SelectItem value="TECHNICIAN">
                    {t("users.roleTechnician", "Técnico / Red NOC")}
                  </SelectItem>
                  <SelectItem value="BILLING">
                    {t("users.roleBilling", "Contabilidad / Facturación")}
                  </SelectItem>
                  <SelectItem value="SUPPORT">
                    {t("users.roleSupport", "Mesa de Ayuda / Soporte")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card
        className={
          "border-zinc-200 bg-white/90 dark:border-zinc-800 " +
          "dark:bg-zinc-900/60 backdrop-blur rounded-2xl overflow-hidden shadow-sm"
        }
      >
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader
                className={
                  "bg-zinc-50/80 dark:bg-zinc-950/80 border-b " +
                  "border-zinc-200 dark:border-zinc-800"
                }
              >
                <TableRow>
                  <TableHead className="w-10 p-2 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={isAllSelectableChecked}
                      onChange={toggleSelectAll}
                      disabled={selectableUsers.length === 0}
                      className={
                        "h-4 w-4 rounded accent-emerald-500 " +
                        "cursor-pointer disabled:opacity-40"
                      }
                      title="Seleccionar todos los usuarios de la página"
                    />
                  </TableHead>
                  <TableHead className="w-10 p-2 text-center"></TableHead>
                  <TableHead className="font-bold text-xs">
                    {t("users.colUser", "Usuario")}
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    {t("users.colRole", "Rol")}
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    {t("users.colStatus", "Estado")}
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    {t("users.colCreatedAt", "Fecha de Registro")}
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="p-2 text-center">
                        <Skeleton className="h-4 w-4 mx-auto rounded" />
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <Skeleton className="h-8 w-8 mx-auto rounded-lg" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-48 text-center text-zinc-500 text-xs"
                    >
                      {t("users.emptyState", "No se encontraron usuarios.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const roleName =
                      u.roles?.[0] === "USER"
                        ? "TECHNICIAN"
                        : (u.roles?.[0] ?? "TECHNICIAN");
                    const isTargetSuperAdmin =
                      roleName === "SUPER_ADMIN" ||
                      u.email === "admin@remotemonkeys.ai";
                    const isSelf = u.id === session?.user?.id;
                    const isSelected = selectedUserIds.includes(u.id);

                    const userActions: ActionDropdownItem[] = [
                      {
                        label: t("common.edit", "Editar Usuario"),
                        icon: Edit2,
                        onClick: () => setEditingUser(u),
                      },
                    ];

                    if (!isTargetSuperAdmin && !isSelf) {
                      userActions.push({
                        label: u.isActive
                          ? t("common.deactivate", "Desactivar")
                          : t("common.activate", "Activar"),
                        icon: u.isActive ? XCircle : CheckCircle,
                        onClick: () => handleToggleStatus(u),
                      });
                      userActions.push({
                        label: t("common.delete", "Eliminar Usuario"),
                        icon: Trash2,
                        variant: "rose",
                        onClick: () => setDeletingUserId(u.id),
                      });
                    }

                    return (
                      <TableRow
                        key={u.id}
                        className={cn(
                          "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors",
                          isSelected &&
                          "bg-emerald-500/5 dark:bg-emerald-500/10"
                        )}
                      >
                        <TableCell className="p-2 text-center align-middle w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isTargetSuperAdmin || isSelf}
                            onChange={() => toggleSelectUser(u.id)}
                            className={cn(
                              "h-4 w-4 rounded",
                              isTargetSuperAdmin || isSelf
                                ? "opacity-30 cursor-not-allowed border-zinc-300"
                                : "accent-emerald-500 cursor-pointer"
                            )}
                            title={
                              isTargetSuperAdmin
                                ? "SuperAdmin no puede ser seleccionado"
                                : isSelf
                                  ? "Tu propia cuenta no puede ser seleccionada"
                                  : ""
                            }
                          />
                        </TableCell>

                        <TableCell className="p-2 text-center align-middle w-10">
                          <ActionsDropdown align="left" items={userActions} />
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className={
                                "h-9 w-9 rounded-xl bg-emerald-500/10 border " +
                                "border-emerald-500/20 text-emerald-600 " +
                                "dark:text-emerald-400 font-bold flex items-center " +
                                "justify-center text-xs shrink-0"
                              }
                            >
                              {u.name?.[0]?.toUpperCase() ??
                                u.email[0].toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span
                                className={
                                  "font-bold text-xs text-zinc-900 " +
                                  "dark:text-white truncate"
                                }
                              >
                                {u.name ?? "Sin Nombre"}
                              </span>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] text-zinc-500 truncate font-mono">
                                  {u.email}
                                </span>
                                {isSuperAdmin && (
                                  <span
                                    className={
                                      "text-[10px] px-1.5 py-0.5 rounded " +
                                      "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 " +
                                      "dark:text-zinc-400 font-medium shrink-0 " +
                                      "flex items-center gap-1"
                                    }
                                  >
                                    <Building2 className="h-2.5 w-2.5 text-emerald-500" />
                                    {u.brand?.name ?? "Global / Sin Marca"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {(() => {
                            if (isTargetSuperAdmin || roleName === "SUPER_ADMIN") {
                              return (
                                <Badge variant="default" className="font-bold text-[10px]">
                                  {t("users.roleSuperAdmin", "Super Admin")}
                                </Badge>
                              );
                            }
                            if (roleName === "ADMIN") {
                              return (
                                <Badge
                                  variant="outline"
                                  className={
                                    "font-bold text-[10px] bg-emerald-500/10 " +
                                    "border-emerald-500/30 text-emerald-700 " +
                                    "dark:text-emerald-400"
                                  }
                                >
                                  {t("users.roleAdmin", "Admin de Marca")}
                                </Badge>
                              );
                            }
                            if (roleName === "TECHNICIAN" || roleName === "USER") {
                              return (
                                <Badge
                                  variant="outline"
                                  className={
                                    "font-bold text-[10px] bg-blue-500/10 " +
                                    "border-blue-500/30 text-blue-700 " +
                                    "dark:text-blue-400"
                                  }
                                >
                                  {t("users.roleTechnician", "Técnico / NOC")}
                                </Badge>
                              );
                            }
                            if (roleName === "BILLING") {
                              return (
                                <Badge
                                  variant="outline"
                                  className={
                                    "font-bold text-[10px] bg-amber-500/10 " +
                                    "border-amber-500/30 text-amber-700 " +
                                    "dark:text-amber-400"
                                  }
                                >
                                  {t("users.roleBilling", "Contabilidad")}
                                </Badge>
                              );
                            }
                            if (roleName === "SUPPORT") {
                              return (
                                <Badge
                                  variant="outline"
                                  className={
                                    "font-bold text-[10px] bg-purple-500/10 " +
                                    "border-purple-500/30 text-purple-700 " +
                                    "dark:text-purple-400"
                                  }
                                >
                                  {t("users.roleSupport", "Soporte")}
                                </Badge>
                              );
                            }
                            return (
                              <Badge variant="outline" className="font-bold text-[10px]">
                                {roleName}
                              </Badge>
                            );
                          })()}
                        </TableCell>

                        <TableCell>
                          {u.isActive ? (
                            <Badge
                              variant="outline"
                              className={
                                "border-emerald-500/30 bg-emerald-500/10 " +
                                "text-emerald-600 dark:text-emerald-400 text-[10px] gap-1"
                              }
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span>{t("common.active", "Activo")}</span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={
                                "border-zinc-300 dark:border-zinc-700 " +
                                "text-zinc-500 text-[10px] gap-1"
                              }
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                              <span>{t("common.inactive", "Inactivo")}</span>
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-zinc-500 text-xs font-mono">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              onPageChange={(page) => updateUrlParams({ page })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedUserIds.length}
        onClearSelection={() => setSelectedUserIds([])}
        onActivate={() => handleBulkToggle(true)}
        onDeactivate={() => handleBulkToggle(false)}
        onDelete={handleBulkDelete}
        resourceName={t("users.title", "usuarios")}
        isLoading={isActionLoading}
      />

      {/* ROLES MATRIX MODAL (Dialog) */}
      <Dialog open={isRolesModalOpen} onOpenChange={setIsRolesModalOpen}>
        <DialogContent
          className={
            "sm:max-w-2xl rounded-3xl p-6 shadow-2xl border-zinc-200/80 " +
            "dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl"
          }
        >
          <DialogHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div
                className={
                  "h-10 w-10 rounded-2xl bg-emerald-500/10 border " +
                  "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 " +
                  "flex items-center justify-center shrink-0"
                }
              >
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-white">
                  {t(
                    "users.rolesMatrixTitle",
                    "Matriz de Roles y Alcance de Permisos"
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  {t(
                    "users.rolesMatrixSub",
                    "Estructura de aislamiento y capacidades según " +
                    "el nivel de acceso en la plataforma."
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 pt-2">
            {/* SUPER_ADMIN Card */}
            <div
              className={
                "p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 " +
                "bg-zinc-50/50 dark:bg-zinc-900/40 space-y-2"
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
                    {t("users.roleSuperAdmin", "Super Admin")}
                  </span>
                  <Badge variant="default" className="text-[10px]">
                    {t("users.superAdminScope", "Acceso Global (Todas las Marcas)")}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t(
                  "users.superAdminDesc",
                  "Control absoluto sobre la infraestructura, creación de " +
                  "marcas, nodos MikroTik globales y cuentas administrativas."
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Supervisión Global",
                  "Gestión de Marcas",
                  "Nodos MikroTik",
                  "Auditoría y Logs",
                  "Asignación de Marcas",
                ].map((cap) => (
                  <span
                    key={cap}
                    className={
                      "text-[10px] px-2 py-0.5 rounded-lg bg-zinc-200/70 " +
                      "dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
                    }
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* ADMIN Card */}
            <div
              className={
                "p-4 rounded-2xl border border-emerald-500/20 " +
                "bg-emerald-500/5 space-y-2"
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
                    {t("users.roleAdmin", "Admin de Marca")}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      "text-[10px] border-emerald-500/40 text-emerald-600 " +
                      "dark:text-emerald-400 font-bold"
                    }
                  >
                    {t("users.adminScope", "Aislamiento por Marca")}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t(
                  "users.adminDesc",
                  "Administración total de su propia marca: altas de clientes, " +
                  "planes, cortes, reactivaciones, cobros y operadores."
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Clientes & Contratos",
                  "Planes y Tarifas",
                  "Cortes & Facturación",
                  "Operadores Locales",
                  "Enrutadores de Marca",
                ].map((cap) => (
                  <span
                    key={cap}
                    className={
                      "text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/10 " +
                      "border border-emerald-500/20 text-emerald-700 " +
                      "dark:text-emerald-300 font-medium"
                    }
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* TECHNICIAN Card */}
            <div
              className={
                "p-4 rounded-2xl border border-blue-500/20 " +
                "bg-blue-500/5 space-y-2"
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
                    {t("users.roleTechnician", "Técnico / Red NOC")}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      "text-[10px] border-blue-500/40 text-blue-600 " +
                      "dark:text-blue-400 font-bold"
                    }
                  >
                    {t("users.technicianScope", "Operaciones Técnicas (Tenant)")}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t(
                  "users.technicianDesc",
                  "Instalaciones, diagnóstico en MikroTik, mapa de red " +
                  "y resolución de tickets."
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Nodos MikroTik (Lectura)",
                  "Mapa de Red NOC",
                  "Tickets y Visitas",
                  "Contratos y Enlaces",
                ].map((cap) => (
                  <span
                    key={cap}
                    className={
                      "text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/10 " +
                      "border border-blue-500/20 text-blue-700 " +
                      "dark:text-blue-300 font-medium"
                    }
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* BILLING Card */}
            <div
              className={
                "p-4 rounded-2xl border border-amber-500/20 " +
                "bg-amber-500/5 space-y-2"
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
                    {t("users.roleBilling", "Contabilidad / Facturación")}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      "text-[10px] border-amber-500/40 text-amber-600 " +
                      "dark:text-amber-400 font-bold"
                    }
                  >
                    {t("users.billingScope", "Gestión Financiera (Tenant)")}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t(
                  "users.billingDesc",
                  "Facturación, cobros, recibos y conciliación bancaria " +
                  "de Efecty y DaviPay."
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Facturación & Recibos",
                  "Conciliación Bancaria",
                  "Cuentas de Clientes",
                  "Avisos de Cobro",
                ].map((cap) => (
                  <span
                    key={cap}
                    className={
                      "text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/10 " +
                      "border border-amber-500/20 text-amber-700 " +
                      "dark:text-amber-300 font-medium"
                    }
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* SUPPORT Card */}
            <div
              className={
                "p-4 rounded-2xl border border-purple-500/20 " +
                "bg-purple-500/5 space-y-2"
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
                    {t("users.roleSupport", "Mesa de Ayuda / Soporte")}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      "text-[10px] border-purple-500/40 text-purple-600 " +
                      "dark:text-purple-400 font-bold"
                    }
                  >
                    {t("users.supportScope", "Atención al Cliente (Tenant)")}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t(
                  "users.supportDesc",
                  "Mesa de ayuda, atención por WhatsApp, creación de tickets " +
                  "y consultas."
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Chats de WhatsApp",
                  "Mesa de Ayuda con IA",
                  "Consulta de Clientes",
                  "Planes y Tarifas",
                ].map((cap) => (
                  <span
                    key={cap}
                    className={
                      "text-[10px] px-2 py-0.5 rounded-lg bg-purple-500/10 " +
                      "border border-purple-500/20 text-purple-700 " +
                      "dark:text-purple-300 font-medium"
                    }
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Security Callout Box */}
            <div
              className={
                "flex items-start gap-3 p-3.5 rounded-2xl border " +
                "border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 " +
                "dark:bg-zinc-900/60 text-xs"
              }
            >
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-zinc-900 dark:text-white">
                  {t(
                    "users.securityProtocolTitle",
                    "Protocolo de Seguridad Multi-Tenant"
                  )}
                </span>
                <p className="text-zinc-500 text-[11px] leading-relaxed">
                  {t(
                    "users.securityProtocolDesc",
                    "Los administradores y operadores quedan estrictamente " +
                    "restringidos a los datos de su propia marca."
                  )}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CREATE USER DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          className={
            "sm:max-w-md rounded-3xl p-6 shadow-2xl border-zinc-200/80 " +
            "dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl"
          }
        >
          <DialogHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div
                className={
                  "h-10 w-10 rounded-2xl bg-emerald-500/10 border " +
                  "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 " +
                  "flex items-center justify-center shrink-0"
                }
              >
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-white">
                  {t("users.modalCreateTitle", "Crear Nuevo Usuario")}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  {t(
                    "users.modalCreateSub",
                    "Ingresa los datos para registrar un usuario en el sistema."
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={createForm.handleSubmit(handleCreateSubmit)}
            className="space-y-4 pt-2"
          >
            {/* Brand Assignment Section */}
            {isSuperAdmin ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("users.labelBrand", "Marca Asignada (Brand)")}
                </Label>
                <Select
                  value={createForm.watch("brandId") ?? "NONE"}
                  onValueChange={(val) =>
                    createForm.setValue(
                      "brandId",
                      val === "NONE" ? null : val
                    )
                  }
                >
                  <SelectTrigger className="rounded-xl h-10 text-xs">
                    <SelectValue
                      placeholder={t(
                        "users.brandSelectPlaceholder",
                        "Selecciona una marca..."
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="NONE">
                      {t(
                        "users.brandGlobal",
                        "Global / Sin Marca (SuperAdmin)"
                      )}
                    </SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("users.labelBrand", "Marca Asignada")}
                </Label>
                <div
                  className={
                    "flex items-center gap-2 p-2.5 rounded-xl border " +
                    "border-zinc-200 dark:border-zinc-800 bg-zinc-50 " +
                    "dark:bg-zinc-900/60 text-xs text-zinc-700 dark:text-zinc-300"
                  }
                >
                  <Building2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-bold">
                    {activeBrand?.name ?? "Mi Marca"}
                  </span>
                  <span className="text-[10px] text-zinc-500 ml-auto">
                    {t(
                      "users.brandLockedNotice",
                      "Asignado automáticamente a tu marca actual."
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("users.labelName", "Nombre Completo")}
              </Label>
              <Input
                {...createForm.register("name")}
                placeholder="Ej. Juan Pérez"
                className="rounded-xl h-10 text-xs"
              />
              {createForm.formState.errors.name && (
                <p className="text-[11px] text-rose-500">
                  {createForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("users.labelEmail", "Correo Electrónico")}
              </Label>
              <Input
                type="email"
                {...createForm.register("email")}
                placeholder="juan@empresa.com"
                className="rounded-xl h-10 text-xs"
              />
              {createForm.formState.errors.email && (
                <p className="text-[11px] text-rose-500">
                  {createForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("users.labelPassword", "Contraseña")}
              </Label>
              <Input
                type="password"
                {...createForm.register("password")}
                placeholder="••••••••"
                className="rounded-xl h-10 text-xs font-mono"
              />
              {createForm.formState.errors.password && (
                <p className="text-[11px] text-rose-500">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("users.labelRole", "Rol de Usuario")}
              </Label>
              <Select
                value={createForm.watch("roleName")}
                onValueChange={(val: RoleName) =>
                  createForm.setValue("roleName", val)
                }
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ADMIN">
                    {t("users.roleAdmin", "Admin de Marca")}
                  </SelectItem>
                  <SelectItem value="TECHNICIAN">
                    {t("users.roleTechnician", "Técnico / Red NOC")}
                  </SelectItem>
                  <SelectItem value="BILLING">
                    {t("users.roleBilling", "Contabilidad / Facturación")}
                  </SelectItem>
                  <SelectItem value="SUPPORT">
                    {t("users.roleSupport", "Mesa de Ayuda / Soporte")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              className={
                "flex items-center justify-end gap-2 pt-3 border-t " +
                "border-zinc-100 dark:border-zinc-800"
              }
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl text-xs cursor-pointer"
              >
                {t("common.cancel", "Cancelar")}
              </Button>
              <Button
                type="submit"
                disabled={isActionLoading}
                className={
                  "rounded-xl text-xs font-bold gap-2 bg-gradient-to-r " +
                  "from-emerald-500 to-teal-600 text-white cursor-pointer"
                }
              >
                {isActionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{t("common.save", "Guardar Usuario")}</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT USER DIALOG */}
      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent
          className={
            "sm:max-w-md rounded-3xl p-6 shadow-2xl border-zinc-200/80 " +
            "dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl"
          }
        >
          <DialogHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div
                className={
                  "h-10 w-10 rounded-2xl bg-emerald-500/10 border " +
                  "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 " +
                  "flex items-center justify-center shrink-0"
                }
              >
                <Edit2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-white">
                  {t("users.modalEditTitle", "Editar Usuario")}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  {t("users.modalEditSub", "Modifica los datos del usuario.")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={updateForm.handleSubmit(handleUpdateSubmit)}
            className="space-y-4 pt-2"
          >
            {/* Brand in Edit dialog */}
            {isSuperAdmin ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("users.labelBrand", "Marca Asignada (Brand)")}
                </Label>
                <Select
                  value={updateForm.watch("brandId") ?? "NONE"}
                  onValueChange={(val) =>
                    updateForm.setValue(
                      "brandId",
                      val === "NONE" ? null : val
                    )
                  }
                >
                  <SelectTrigger className="rounded-xl h-10 text-xs">
                    <SelectValue
                      placeholder={t(
                        "users.brandSelectPlaceholder",
                        "Selecciona una marca..."
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="NONE">
                      {t(
                        "users.brandGlobal",
                        "Global / Sin Marca (SuperAdmin)"
                      )}
                    </SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("users.labelBrand", "Marca Asignada")}
                </Label>
                <div
                  className={
                    "flex items-center gap-2 p-2.5 rounded-xl border " +
                    "border-zinc-200 dark:border-zinc-800 bg-zinc-50 " +
                    "dark:bg-zinc-900/60 text-xs text-zinc-700 dark:text-zinc-300"
                  }
                >
                  <Building2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-bold">
                    {editingUser?.brand?.name ??
                      activeBrand?.name ??
                      "Mi Marca"}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("users.labelName", "Nombre Completo")}
              </Label>
              <Input
                {...updateForm.register("name")}
                className="rounded-xl h-10 text-xs"
              />
              {updateForm.formState.errors.name && (
                <p className="text-[11px] text-rose-500">
                  {updateForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("users.labelEmail", "Correo Electrónico")}
              </Label>
              <Input
                type="email"
                {...updateForm.register("email")}
                className="rounded-xl h-10 text-xs"
              />
              {updateForm.formState.errors.email && (
                <p className="text-[11px] text-rose-500">
                  {updateForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t(
                  "users.labelNewPassword",
                  "Nueva Contraseña (Opcional)"
                )}
              </Label>
              <Input
                type="password"
                {...updateForm.register("password")}
                placeholder="••••••••"
                className="rounded-xl h-10 text-xs font-mono"
              />
              {updateForm.formState.errors.password && (
                <p className="text-[11px] text-rose-500">
                  {updateForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("users.labelRole", "Rol de Usuario")}
              </Label>
              <Select
                value={updateForm.watch("roleName")}
                disabled={editingUser?.roles?.includes("SUPER_ADMIN")}
                onValueChange={(val: RoleName) =>
                  updateForm.setValue("roleName", val)
                }
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {isSuperAdmin &&
                    editingUser?.roles?.includes("SUPER_ADMIN") && (
                      <SelectItem value="SUPER_ADMIN">
                        {t("users.roleSuperAdmin", "Super Admin")}
                      </SelectItem>
                    )}
                  <SelectItem value="ADMIN">
                    {t("users.roleAdmin", "Admin de Marca")}
                  </SelectItem>
                  <SelectItem value="TECHNICIAN">
                    {t("users.roleTechnician", "Técnico / Red NOC")}
                  </SelectItem>
                  <SelectItem value="BILLING">
                    {t("users.roleBilling", "Contabilidad / Facturación")}
                  </SelectItem>
                  <SelectItem value="SUPPORT">
                    {t("users.roleSupport", "Mesa de Ayuda / Soporte")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              className={
                "flex items-center justify-end gap-2 pt-3 border-t " +
                "border-zinc-100 dark:border-zinc-800"
              }
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingUser(null)}
                className="rounded-xl text-xs cursor-pointer"
              >
                {t("common.cancel", "Cancelar")}
              </Button>
              <Button
                type="submit"
                disabled={isActionLoading}
                className={
                  "rounded-xl text-xs font-bold gap-2 bg-gradient-to-r " +
                  "from-emerald-500 to-teal-600 text-white cursor-pointer"
                }
              >
                {isActionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{t("common.save", "Guardar Cambios")}</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SINGLE DELETE CONFIRMATION ALERT DIALOG */}
      <AlertDialog
        open={Boolean(deletingUserId)}
        onOpenChange={(open) => !open && setDeletingUserId(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-600 dark:text-rose-400">
              {t("users.confirmDeleteTitle", "¿Eliminar usuario?")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-500">
              {t(
                "users.confirmDeleteSub",
                "Esta acción no se puede deshacer. El usuario perderá acceso al sistema."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="rounded-xl text-xs">
              {t("common.cancel", "Cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className={
                "bg-rose-600 hover:bg-rose-700 text-white font-bold " +
                "rounded-xl text-xs cursor-pointer"
              }
            >
              {t("common.delete", "Eliminar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-500 mb-2" />
          <span>Cargando directorio de usuarios...</span>
        </div>
      }
    >
      <UsersTableContent />
    </Suspense>
  );
}
