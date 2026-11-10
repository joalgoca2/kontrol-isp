"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchIdsWithUnaccent } from "@/lib/search";
import { paymentRecordSchema } from "@/lib/validations/isp";
import { setClientSuspensionOnRouter } from "@/lib/mikrotik/node-manager";
import { triggerOutboundWebhook } from "@/lib/webhook";
import {
  analyzeReconciliationBatch,
  applyReconciliationBatch,
  type ReconciliationPreviewResult,
  type ReconciliationPreviewItem,
} from "@/lib/payments/reconciliation";
import {
  buildDaviPayCheckoutData,
  type DaviPayCheckoutData,
} from "@/lib/payments/davipay";
import type {
  ApiResponse,
  Payment,
  PaymentStatus,
  PaymentsPaginatedResponse,
} from "@/types";

interface GetPaymentsParams {
  brandId?: string;
  contractId?: string;
  page?: number;
  pageSize?: number;
}

function hasBillingAccess(userRoles?: string[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some((r) =>
    ["SUPER_ADMIN", "ADMIN", "BILLING"].includes(r)
  );
}

export async function getPayments(
  params: GetPaymentsParams = {}
): Promise<
  ApiResponse<{ items: Payment[]; total: number; totalPages: number; page: number }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasBillingAccess(session.user.roles)) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Facturación o Administrador.",
      };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const targetBrandId =
      isSuperAdmin && params.brandId && params.brandId !== "ALL"
        ? params.brandId
        : session.user.brandId;

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(50, Math.max(5, params.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = {};
    if (!isSuperAdmin || (params.brandId && params.brandId !== "ALL")) {
      whereClause.brandId = targetBrandId ?? "none";
    }

    if (params.contractId && params.contractId !== "ALL") {
      whereClause.contractId = params.contractId;
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where: whereClause }),
      prisma.payment.findMany({
        where: whereClause,
        include: {
          contract: {
            include: {
              client: true,
              plan: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      success: true,
      data: {
        items: payments as unknown as Payment[],
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
        page,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener pagos.";
    return { success: false, error: message };
  }
}

export async function getPaymentsPaginated(
  page: number = 1,
  limit: number = 10,
  search?: string,
  statusFilter?: string,
  methodFilter?: string,
  brandId?: string
): Promise<ApiResponse<PaymentsPaginatedResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasBillingAccess(session.user.roles)) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Facturación o Administrador.",
      };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const targetBrandId =
      isSuperAdmin && brandId && brandId !== "ALL"
        ? brandId
        : session.user.brandId;

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const baseWhere: Record<string, unknown> = {};
    if (!isSuperAdmin || (brandId && brandId !== "ALL")) {
      baseWhere.brandId = targetBrandId ?? "none";
    }

    const whereClause: Record<string, unknown> = { ...baseWhere };

    if (search && search.trim().length > 0) {
      const matchedIds = await searchIdsWithUnaccent(
        "payments",
        search,
        targetBrandId
      );
      whereClause.id = { in: matchedIds };
    }

    if (statusFilter && statusFilter !== "all" && statusFilter !== "ALL") {
      if (statusFilter === "VOIDED") {
        whereClause.status = { in: ["ANULADO", "RECHAZADO"] };
      } else {
        whereClause.status = statusFilter;
      }
    }

    if (methodFilter && methodFilter !== "all" && methodFilter !== "ALL") {
      whereClause.paymentMethod = methodFilter;
    }

    const [
      filteredCount,
      totalCount,
      approvedCount,
      pendingCount,
      voidedCount,
      approvedSum,
      payments,
    ] = await Promise.all([
      prisma.payment.count({ where: whereClause }),
      prisma.payment.count({ where: baseWhere }),
      prisma.payment.count({
        where: { ...baseWhere, status: "APROBADO" },
      }),
      prisma.payment.count({
        where: { ...baseWhere, status: "PENDIENTE" },
      }),
      prisma.payment.count({
        where: {
          ...baseWhere,
          status: { in: ["ANULADO", "RECHAZADO"] },
        },
      }),
      prisma.payment.aggregate({
        where: { ...baseWhere, status: "APROBADO" },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: whereClause,
        include: {
          contract: {
            include: {
              client: true,
              plan: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
    ]);

    return {
      success: true,
      data: {
        payments: payments as unknown as Payment[],
        totalCount,
        approvedCount,
        pendingCount,
        voidedCount,
        totalApprovedAmount: approvedSum._sum.amount || 0,
        totalPages: Math.max(1, Math.ceil(filteredCount / safeLimit)),
        currentPage: safePage,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener recaudos.";
    return { success: false, error: message };
  }
}

export async function savePayment(
  rawInput: unknown
): Promise<ApiResponse<Payment>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasBillingAccess(session.user.roles)) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Facturación o Administrador.",
      };
    }

    const parsed = paymentRecordSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del pago no válidos.",
      };
    }

    const data = parsed.data;
    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin && session.user.brandId !== data.brandId) {
      return {
        success: false,
        error: "No tienes permiso para gestionar esta marca.",
      };
    }

    const contract = await prisma.contract.findUnique({
      where: { id: data.contractId },
      include: { node: true, client: true, plan: true },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    const actor = session.user.email ?? null;
    let savedPayment;

    if (data.id) {
      savedPayment = await prisma.payment.update({
        where: { id: data.id },
        data: {
          contractId: data.contractId,
          periodBilled: data.periodBilled,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          status: data.status,
          externalReference: data.externalReference ?? null,
          notes: data.notes ?? null,
          updatedBy: actor,
        },
        include: {
          contract: {
            include: { client: true, plan: true },
          },
        },
      });
    } else {
      const receiptNumber = Date.now() % 1000000;
      const invoiceNumber = `REC-${new Date().getFullYear()}-${receiptNumber}`;

      savedPayment = await prisma.payment.create({
        data: {
          brandId: data.brandId,
          contractId: data.contractId,
          receiptNumber,
          invoiceNumber,
          periodBilled: data.periodBilled,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          externalReference: data.externalReference ?? null,
          recordedByUserId: session.user.id,
          status: data.status,
          notes: data.notes ?? null,
          createdBy: actor,
          updatedBy: actor,
        },
        include: {
          contract: {
            include: { client: true, plan: true },
          },
        },
      });
    }

    // Auto-reactivate contract if payment is approved and contract was suspended
    if (
      data.status === "APROBADO" &&
      (contract.billingStatus === "SUSPENDIDO_MORA" ||
        contract.billingStatus === "AVISO_VENCIMIENTO")
    ) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          billingStatus: "ACTIVO",
          serviceStatus: "ONLINE",
          updatedBy: actor,
        },
      });

      await setClientSuspensionOnRouter(contract.node, contract.pppoeUser, false);
    }

    if (!data.id) {
      triggerOutboundWebhook("billing", {
        event: "payment.recorded",
        brandId: data.brandId,
        data: {
          paymentId: savedPayment.id,
          contractNumber: contract.contractNumber,
          clientName: contract.client.fullName,
          amount: data.amount,
          period: data.periodBilled,
          method: data.paymentMethod,
        },
      });
    }

    revalidatePath("/dashboard/billing");
    return {
      success: true,
      data: savedPayment as unknown as Payment,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al registrar pago.";
    return { success: false, error: message };
  }
}

export async function recordPayment(
  rawInput: unknown
): Promise<ApiResponse<Payment>> {
  return savePayment(rawInput);
}

export async function togglePaymentStatus(
  id: string,
  status: PaymentStatus
): Promise<ApiResponse<Payment>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasBillingAccess(session.user.roles)) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Facturación o Administrador.",
      };
    }

    const existing = await prisma.payment.findUnique({
      where: { id },
      include: {
        contract: {
          include: { node: true, client: true, plan: true },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Pago no encontrado." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin && session.user.brandId !== existing.brandId) {
      return { success: false, error: "No autorizado." };
    }

    const actor = session.user.email ?? null;
    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status,
        updatedBy: actor,
      },
      include: {
        contract: {
          include: { client: true, plan: true },
        },
      },
    });

    if (
      status === "APROBADO" &&
      existing.contract &&
      (existing.contract.billingStatus === "SUSPENDIDO_MORA" ||
        existing.contract.billingStatus === "AVISO_VENCIMIENTO")
    ) {
      await prisma.contract.update({
        where: { id: existing.contract.id },
        data: {
          billingStatus: "ACTIVO",
          serviceStatus: "ONLINE",
          updatedBy: actor,
        },
      });

      await setClientSuspensionOnRouter(
        existing.contract.node,
        existing.contract.pppoeUser,
        false
      );
    }

    revalidatePath("/dashboard/billing");
    return {
      success: true,
      data: updated as unknown as Payment,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al actualizar estado del pago.";
    return { success: false, error: message };
  }
}

export async function deletePayment(id: string): Promise<ApiResponse<null>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasBillingAccess(session.user.roles)) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Facturación o Administrador.",
      };
    }

    const existing = await prisma.payment.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false, error: "Registro de pago no encontrado." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin && session.user.brandId !== existing.brandId) {
      return { success: false, error: "No autorizado." };
    }

    await prisma.payment.delete({
      where: { id },
    });

    revalidatePath("/dashboard/billing");
    return { success: true, data: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar el pago.";
    return { success: false, error: message };
  }
}

export async function bulkTogglePaymentsStatus(
  ids: string[],
  status: PaymentStatus
): Promise<ApiResponse<null>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasBillingAccess(session.user.roles)) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Facturación o Administrador.",
      };
    }

    if (!ids.length) {
      return { success: false, error: "No se seleccionaron pagos." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const whereClause: Record<string, unknown> = {
      id: { in: ids },
    };

    if (!isSuperAdmin) {
      whereClause.brandId = session.user.brandId ?? "none";
    }

    const actor = session.user.email ?? null;
    await prisma.payment.updateMany({
      where: whereClause,
      data: {
        status,
        updatedBy: actor,
      },
    });

    revalidatePath("/dashboard/billing");
    return { success: true, data: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al actualizar pagos en lote.";
    return { success: false, error: message };
  }
}

export async function bulkDeletePayments(
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasBillingAccess(session.user.roles)) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Facturación o Administrador.",
      };
    }

    if (!ids.length) {
      return { success: false, error: "No se seleccionaron pagos." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const whereClause: Record<string, unknown> = {
      id: { in: ids },
    };

    if (!isSuperAdmin) {
      whereClause.brandId = session.user.brandId ?? "none";
    }

    const result = await prisma.payment.deleteMany({
      where: whereClause,
    });

    revalidatePath("/dashboard/billing");
    return {
      success: true,
      data: {
        deletedCount: result.count,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar pagos en lote.";
    return { success: false, error: message };
  }
}

/**
 * Previews and validates a batch payment file (CSV/TXT) without modifying database records.
 */
export async function previewReconciliationFileAction(
  formData: FormData
): Promise<ApiResponse<ReconciliationPreviewResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasBillingAccess(session.user.roles)) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Facturación o Administrador.",
      };
    }

    const file = formData.get("file") as File | null;
    const brandId = String(formData.get("brandId") || "").trim();

    if (!file) {
      return { success: false, error: "Archivo de recaudo no proporcionado." };
    }

    const targetBrandId = brandId || session.user.brandId;
    if (!targetBrandId) {
      return { success: false, error: "Marca requerida para la conciliación." };
    }

    const text = await file.text();
    if (!text || text.trim().length === 0) {
      return { success: false, error: "El archivo está vacío." };
    }

    const result = await analyzeReconciliationBatch(targetBrandId, text);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al previsualizar archivo de conciliación.";
    return { success: false, error: message };
  }
}

/**
 * Applies valid batch payments to the payments table and unblocks MikroTik contracts.
 */
export async function applyReconciliationBatchAction(
  brandId: string,
  items: ReconciliationPreviewItem[],
  provider: "EFECTY" | "DAVIPAY"
): Promise<ApiResponse<{ appliedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasBillingAccess(session.user.roles)) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Facturación o Administrador.",
      };
    }

    const targetBrandId = brandId || session.user.brandId;
    if (!targetBrandId) {
      return { success: false, error: "Identificador de marca requerido." };
    }

    const actor = session.user.email ?? "system";
    const res = await applyReconciliationBatch(
      targetBrandId,
      items,
      provider,
      actor
    );

    if (!res.success) {
      return { success: false, error: res.message };
    }

    revalidatePath("/dashboard/billing");
    return {
      success: true,
      data: { appliedCount: res.appliedCount },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al aplicar lote de conciliación.";
    return { success: false, error: message };
  }
}

/**
 * Generates DaviPay / ePayco online payment checkout parameters for a contract.
 */
export async function generateOnlinePaymentCheckoutAction(
  contractId: string,
  originUrl?: string
): Promise<ApiResponse<DaviPayCheckoutData>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const res = await buildDaviPayCheckoutData(contractId, originUrl);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || "Error al generar checkout." };
    }

    return { success: true, data: res.data };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al generar enlace de pago en línea.";
    return { success: false, error: message };
  }
}
