"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchIdsWithUnaccent } from "@/lib/search";
import { hasPermission } from "@/lib/permissions";
import { contractSchema } from "@/lib/validations/isp";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { grantPaymentPromise } from "@/lib/payments/billing-cycle";
import {
  getClientPppSession,
  setClientSuspensionOnRouter,
  kickClientSession,
  getNodeAllSecrets,
  createPppSecretOnRouter,
} from "@/lib/mikrotik/node-manager";
import type {
  ApiResponse,
  Contract,
  ContractsPaginatedResponse,
  MikrotikLiveDiagnostic,
  TrafficLightColor,
  ContractAuditResult,
  ContractAuditOrphanInCrm,
  ContractAuditOrphanInRouter,
  ContractAuditSynced,
} from "@/types";

export interface GetContractsPaginatedParams {
  brandId?: string;
  page?: number;
  limit?: number;
  search?: string;
  nodeId?: string;
  billingStatus?: string;
  technology?: string;
}

function decryptContractPassword<T extends { pppoePassword?: string | null }>(
  contract: T
): T {
  if (!contract.pppoePassword) return contract;
  return {
    ...contract,
    pppoePassword: decryptSecret(contract.pppoePassword),
  };
}

export async function getContractsPaginated(
  params: GetContractsPaginatedParams = {}
): Promise<ApiResponse<ContractsPaginatedResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:read")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:read'.",
      };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    const targetBrandId =
      isSuperAdmin && params.brandId && params.brandId !== "ALL"
        ? params.brandId
        : session.user.brandId;

    const brandFilter =
      isSuperAdmin && (!params.brandId || params.brandId === "ALL")
        ? {}
        : { brandId: targetBrandId ?? "none" };

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 10));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { ...brandFilter };

    if (
      params.nodeId &&
      params.nodeId !== "all" &&
      params.nodeId !== "ALL"
    ) {
      where.nodeId = params.nodeId;
    }

    if (
      params.billingStatus &&
      params.billingStatus !== "all" &&
      params.billingStatus !== "ALL"
    ) {
      where.billingStatus = params.billingStatus;
    }

    if (
      params.technology &&
      params.technology !== "all" &&
      ["FIBRA_OPTICA", "MICROONDAS"].includes(params.technology)
    ) {
      where.technology = params.technology;
    }

    if (params.search?.trim()) {
      const matchedIds = await searchIdsWithUnaccent(
        "contracts",
        params.search,
        targetBrandId
      );
      where.id = { in: matchedIds };
    }

    const [
      contracts,
      total,
      activeCount,
      warningCount,
      suspendedCount,
    ] = await prisma.$transaction([
      prisma.contract.findMany({
        where,
        include: {
          client: true,
          node: true,
          plan: true,
          equipment: true,
          _count: {
            select: {
              payments: true,
              tickets: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contract.count({ where }),
      prisma.contract.count({
        where: { ...brandFilter, billingStatus: "ACTIVO" },
      }),
      prisma.contract.count({
        where: { ...brandFilter, billingStatus: "AVISO_VENCIMIENTO" },
      }),
      prisma.contract.count({
        where: { ...brandFilter, billingStatus: "SUSPENDIDO_MORA" },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const decryptedContracts = contracts.map(decryptContractPassword);

    return {
      success: true,
      data: {
        contracts: decryptedContracts as unknown as Contract[],
        total,
        totalPages,
        activeCount,
        warningCount,
        suspendedCount,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener contratos.";
    return { success: false, error: message };
  }
}

interface GetContractsParams {
  brandId?: string;
  nodeId?: string;
  billingStatus?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getContracts(
  params: GetContractsParams = {}
): Promise<
  ApiResponse<{
    items: Contract[];
    total: number;
    totalPages: number;
    page: number;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:read")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:read'.",
      };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const targetBrandId =
      isSuperAdmin && params.brandId && params.brandId !== "ALL"
        ? params.brandId
        : session.user.brandId;

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = {};
    if (!isSuperAdmin || (params.brandId && params.brandId !== "ALL")) {
      whereClause.brandId = targetBrandId ?? "none";
    }

    if (params.nodeId && params.nodeId !== "ALL") {
      whereClause.nodeId = params.nodeId;
    }

    if (params.billingStatus && params.billingStatus !== "ALL") {
      whereClause.billingStatus = params.billingStatus;
    }

    if (params.search && params.search.trim() !== "") {
      const term = params.search.trim().replace(/^#/, "");
      if (/^\d{1,5}$/.test(term)) {
        whereClause.OR = [
          { client: { clientCode: term } },
          { client: { id: `serkoi-client-${term}` } },
          { client: { id: term } },
          { contractNumber: term },
          { id: `serkoi-contract-${term}` },
          { id: term },
          { client: { documentNumber: term } },
        ];
      } else if (/^\d{6,12}$/.test(term)) {
        whereClause.OR = [
          { client: { documentNumber: term } },
          { contractNumber: term },
          { client: { phonePrimary: { contains: term } } },
          { client: { phoneSecondary: { contains: term } } },
        ];
      } else {
        whereClause.OR = [
          { client: { fullName: { contains: term, mode: "insensitive" } } },
          { pppoeUser: { contains: term, mode: "insensitive" } },
          { client: { email: { contains: term, mode: "insensitive" } } },
          { address: { contains: term, mode: "insensitive" } },
        ];
      }
    }

    const [total, contracts] = await Promise.all([
      prisma.contract.count({ where: whereClause }),
      prisma.contract.findMany({
        where: whereClause,
        include: {
          client: true,
          node: true,
          plan: true,
          equipment: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    const decryptedContracts = contracts.map(decryptContractPassword);

    return {
      success: true,
      data: {
        items: decryptedContracts as unknown as Contract[],
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
        page,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener contratos.";
    return { success: false, error: message };
  }
}

export async function getContractById(
  id: string
): Promise<ApiResponse<Contract>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:read")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:read'.",
      };
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: true,
        node: true,
        plan: true,
        equipment: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin && session.user.brandId !== contract.brandId) {
      return { success: false, error: "Acceso denegado a este contrato." };
    }

    return {
      success: true,
      data: decryptContractPassword(contract) as unknown as Contract,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener contrato.";
    return { success: false, error: message };
  }
}

export async function saveContract(
  rawInput: unknown
): Promise<ApiResponse<Contract>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const canManageContract =
      hasPermission(session.user, "contracts:manage") ||
      hasPermission(session.user, "billing:manage");
    if (!canManageContract) {
      return {
        success: false,
        error:
          "Permiso denegado: Se requiere permiso 'contracts:manage' o " +
          "'billing:manage'.",
      };
    }

    const parsed = contractSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const fieldName = firstIssue?.path?.[0]
        ? String(firstIssue.path[0])
        : "campo";
      const message =
        firstIssue?.message || "Datos del contrato no válidos.";
      const errorText = message.includes(":")
        ? message
        : `${fieldName}: ${message}`;
      return {
        success: false,
        error: errorText,
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

    // Check unique contract number
    const existingNum = await prisma.contract.findFirst({
      where: {
        brandId: data.brandId,
        contractNumber: data.contractNumber,
        ...(data.id ? { NOT: { id: data.id } } : {}),
      },
    });

    if (existingNum) {
      return {
        success: false,
        error: `El contrato #${data.contractNumber} ya existe en esta marca.`,
      };
    }

    // Check unique PPPoE user
    const existingPpp = await prisma.contract.findFirst({
      where: {
        brandId: data.brandId,
        pppoeUser: data.pppoeUser,
        ...(data.id ? { NOT: { id: data.id } } : {}),
      },
    });

    if (existingPpp) {
      return {
        success: false,
        error:
          `El usuario PPPoE '${data.pppoeUser}' ya está en uso en ` +
          `esta marca.`,
      };
    }

    const actor = session.user.email ?? null;
    const equipPayload = {
      routerBrand: data.routerBrand || null,
      routerModel: data.routerModel || null,
      routerMac: data.routerMac || null,
      antennaType: data.antennaType || null,
      antennaMac: data.antennaMac || null,
      antennaIp: data.antennaIp || null,
      cableMeters: data.cableMeters ?? 0,
      opticalPowerRx: data.opticalPowerRx ?? null,
      notes: data.equipmentNotes || null,
    };

    const securePppoePassword = data.pppoePassword
      ? encryptSecret(data.pppoePassword.trim())
      : null;

    let savedContract;
    if (data.id) {
      savedContract = await prisma.contract.update({
        where: { id: data.id },
        data: {
          contractNumber: data.contractNumber,
          address: data.address,
          neighborhood: data.neighborhood ?? null,
          city: data.city,
          department: data.department,
          nodeId: data.nodeId,
          planId: data.planId,
          technology: data.technology,
          pppoeUser: data.pppoeUser,
          pppoePassword: securePppoePassword,
          ipAddress: data.ipAddress ?? null,
          macAddress: data.macAddress ?? null,
          billingStatus: data.billingStatus,
          updatedBy: actor,
        },
      });

      await prisma.contractEquipment.upsert({
        where: { contractId: savedContract.id },
        update: equipPayload,
        create: {
          contractId: savedContract.id,
          ...equipPayload,
        },
      });
    } else {
      savedContract = await prisma.contract.create({
        data: {
          brandId: data.brandId,
          clientId: data.clientId,
          contractNumber: data.contractNumber,
          address: data.address,
          neighborhood: data.neighborhood ?? null,
          city: data.city,
          department: data.department,
          nodeId: data.nodeId,
          planId: data.planId,
          technology: data.technology,
          pppoeUser: data.pppoeUser,
          pppoePassword: securePppoePassword,
          ipAddress: data.ipAddress ?? null,
          macAddress: data.macAddress ?? null,
          billingStatus: data.billingStatus,
          createdBy: actor,
          updatedBy: actor,
          equipment: {
            create: equipPayload,
          },
        },
      });
    }

    return {
      success: true,
      data: decryptContractPassword(savedContract) as unknown as Contract,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al guardar contrato.";
    return { success: false, error: message };
  }
}

export async function runLiveContractDiagnostic(
  contractId: string
): Promise<ApiResponse<MikrotikLiveDiagnostic>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:read")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:read'.",
      };
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { node: true },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    if (!contract.node) {
      return {
        success: false,
        error: "El contrato no tiene un nodo MikroTik asignado.",
      };
    }

    const diag = await getClientPppSession(
      contract.node,
      contract.pppoeUser,
      contract.ipAddress
    );

    let trafficLight: TrafficLightColor = "GREEN";
    let trafficSummary = "Enlace activo y navegando con normalidad.";
    let trafficRecommendation =
      "El equipo del abonado responde correctamente a la red.";

    if (!diag.connected) {
      trafficLight = "RED";
      trafficSummary = "Router MikroTik inaccesible o fuera de línea.";
      trafficRecommendation =
        `Verificar conectividad IP y credenciales con el nodo ` +
        `${contract.node.name || "MikroTik"}.`;
    } else if (diag.secretDisabled) {
      trafficLight = "RED";
      trafficSummary =
        "Servicio suspendido en MikroTik (Secret deshabilitado).";
      trafficRecommendation =
        "Corte administrativo por mora o retiro. Habilitar tras conciliar pago.";
    } else if (!diag.sessionFound) {
      trafficLight = "RED";
      if (!diag.secretFound) {
        trafficSummary = "Usuario PPPoE no registrado en el router.";
        trafficRecommendation =
          "El secret no existe en RouterOS. Requiere sincronización desde Kontrol ISP.";
      } else {
        const disconnect = diag.lastDisconnectReason
          ? ` (${diag.lastDisconnectReason})`
          : "";
        trafficSummary =
          `Router apagado o fibra óptica desconectada${disconnect}.`;
        trafficRecommendation =
          "Verificar energía eléctrica en domicilio o niveles ópticos.";
      }
    } else if (diag.latencyMs !== undefined && diag.latencyMs >= 80) {
      trafficLight = "YELLOW";
      trafficSummary = `Latencia elevada detectada (${diag.latencyMs} ms).`;
      trafficRecommendation =
        "Posible saturación en cola de tráfico o interferencia en la red.";
    } else {
      trafficLight = "GREEN";
      trafficSummary =
        "Enlace óptimo: Sesión PPPoE levantada y transmitiendo.";
      trafficRecommendation =
        "El servicio opera al 100% en RouterOS sin degradación.";
    }

    diag.trafficLight = trafficLight;
    diag.trafficSummary = trafficSummary;
    diag.trafficRecommendation = trafficRecommendation;

    const actor = session.user.email ?? null;
    const updateData: Record<string, unknown> = {
      serviceStatus: diag.sessionFound ? "ONLINE" : "OFFLINE",
      updatedBy: actor,
    };
    if (diag.sessionFound && diag.session?.address) {
      updateData.ipAddress = diag.session.address;
    }
    if (diag.sessionFound && diag.session?.callerId) {
      updateData.macAddress = diag.session.callerId;
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: updateData,
    });

    return {
      success: true,
      data: diag,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error en diagnóstico en vivo.";
    return { success: false, error: message };
  }
}

export interface SyncContractTelemetryParams {
  ipAddress?: string | null;
  macAddress?: string | null;
  serviceStatus?: "ONLINE" | "OFFLINE";
  setBillingActive?: boolean;
}

export async function syncContractTelemetry(
  contractId: string,
  params: SyncContractTelemetryParams = {}
): Promise<ApiResponse<{ message: string; contract: Contract }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:read")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:read'.",
      };
    }

    const actor = session.user.email ?? null;
    const updateData: Record<string, unknown> = {
      updatedBy: actor,
    };

    if (params.ipAddress) {
      updateData.ipAddress = params.ipAddress;
    }
    if (params.macAddress) {
      updateData.macAddress = params.macAddress;
    }
    if (params.serviceStatus) {
      updateData.serviceStatus = params.serviceStatus;
    }
    if (params.setBillingActive) {
      updateData.billingStatus = "ACTIVO";
    }

    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: updateData,
      include: {
        client: true,
        node: true,
        plan: true,
        equipment: true,
      },
    });

    if (params.macAddress) {
      await prisma.contractEquipment.upsert({
        where: { contractId },
        update: {
          routerMac: params.macAddress,
        },
        create: {
          contractId,
          routerMac: params.macAddress,
        },
      });
    }

    return {
      success: true,
      data: {
        message: "Contrato sincronizado exitosamente con IP, MAC y estado.",
        contract: updatedContract as unknown as Contract,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al sincronizar telemetría.";
    return { success: false, error: message };
  }
}

export async function toggleContractSuspension(
  contractId: string,
  suspend: boolean
): Promise<ApiResponse<{ message: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const canManageSuspension =
      hasPermission(session.user, "contracts:manage") ||
      hasPermission(session.user, "billing:manage");
    if (!canManageSuspension) {
      return {
        success: false,
        error:
          "Permiso denegado: Se requiere permiso 'contracts:manage' o " +
          "'billing:manage'.",
      };
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { node: true },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    // Apply change to router
    const routerRes = await setClientSuspensionOnRouter(
      contract.node,
      contract.pppoeUser,
      suspend
    );

    if (!routerRes.success) {
      return {
        success: false,
        error: routerRes.message,
      };
    }

    const actor = session.user.email ?? null;
    // Update billing status
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        billingStatus: suspend ? "SUSPENDIDO_MORA" : "ACTIVO",
        serviceStatus: suspend ? "OFFLINE" : contract.serviceStatus,
        updatedBy: actor,
      },
    });

    revalidatePath("/dashboard/contracts");
    return {
      success: true,
      data: { message: routerRes.message },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al cambiar estado de corte.";
    return { success: false, error: message };
  }
}

export async function kickContractSessionAction(
  contractId: string
): Promise<ApiResponse<{ message: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:read")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:read'.",
      };
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { node: true },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    const res = await kickClientSession(contract.node, contract.pppoeUser);

    if (!res.success) {
      return {
        success: false,
        error: res.message,
      };
    }

    revalidatePath("/dashboard/contracts");
    return {
      success: true,
      data: { message: res.message },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al reiniciar sesión PPPoE.";
    return { success: false, error: message };
  }
}

export async function grantPromiseOfPaymentAction(
  contractId: string,
  hours = 24
): Promise<ApiResponse<{ message: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "billing:manage")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'billing:manage'.",
      };
    }

    const actor = session.user.email ?? session.user.name ?? "Operador Web";
    const result = await grantPaymentPromise({
      contractId,
      hours,
      actor,
    });

    revalidatePath("/dashboard/contracts");
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard/tickets");

    const formattedLimit = result.limitDate.toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    return {
      success: true,
      data: {
        message:
          `Prórroga de ${result.hours}h concedida exitosamente ` +
          `hasta ${formattedLimit} (Ticket #${result.ticketNumber}).`,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al otorgar promesa de pago.";
    return { success: false, error: message };
  }
}

export async function deleteContract(
  id: string
): Promise<ApiResponse<{ deletedId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:delete")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:delete'.",
      };
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      select: {
        id: true,
        brandId: true,
        _count: {
          select: {
            payments: true,
            tickets: true,
          },
        },
      },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin && session.user.brandId !== contract.brandId) {
      return {
        success: false,
        error: "No tienes permiso para eliminar este contrato.",
      };
    }

    if (contract._count.payments > 0 || contract._count.tickets > 0) {
      return {
        success: false,
        error:
          "No se puede eliminar el contrato porque posee pagos o " +
          "tickets de soporte registrados.",
      };
    }

    await prisma.contract.delete({
      where: { id },
    });

    return {
      success: true,
      data: { deletedId: id },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar contrato.";
    return { success: false, error: message };
  }
}

export async function bulkToggleContractsSuspension(
  ids: string[],
  suspend: boolean
): Promise<ApiResponse<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const canManageSuspension =
      hasPermission(session.user, "contracts:manage") ||
      hasPermission(session.user, "billing:manage");
    if (!canManageSuspension) {
      return {
        success: false,
        error:
          "Permiso denegado: Se requiere permiso 'contracts:manage' o " +
          "'billing:manage'.",
      };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se seleccionaron contratos." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );

    const whereClause: Record<string, unknown> = {
      id: { in: ids },
    };

    if (!isSuperAdmin) {
      whereClause.brandId = session.user.brandId ?? "none";
    }

    const targetContracts = await prisma.contract.findMany({
      where: whereClause,
      include: { node: true },
    });

    let permissionErrorDetected = false;
    for (const c of targetContracts) {
      try {
        const rRes = await setClientSuspensionOnRouter(
          c.node,
          c.pppoeUser,
          suspend
        );
        if (
          !rRes.success &&
          rRes.message.includes("Permiso denegado en MikroTik")
        ) {
          permissionErrorDetected = true;
        }
      } catch (_err) {
        // Ignore individual router network timeouts in batch
      }
    }

    if (permissionErrorDetected) {
      return {
        success: false,
        error:
          "Permiso denegado en MikroTik: El nodo tiene configurado un " +
          "usuario de solo lectura ('read'). Se requieren permisos de " +
          "escritura ('write') en RouterOS para suspender o reactivar enlaces.",
      };
    }

    const actor = session.user.email ?? null;
    const result = await prisma.contract.updateMany({
      where: whereClause,
      data: {
        billingStatus: suspend ? "SUSPENDIDO_MORA" : "ACTIVO",
        ...(suspend ? { serviceStatus: "OFFLINE" } : {}),
        updatedBy: actor,
      },
    });

    return {
      success: true,
      data: { count: result.count },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al actualizar lote.";
    return { success: false, error: message };
  }
}

export async function bulkDeleteContracts(
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number; skippedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:delete")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:delete'.",
      };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se seleccionaron contratos." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );

    const whereClause: Record<string, unknown> = {
      id: { in: ids },
    };

    if (!isSuperAdmin) {
      whereClause.brandId = session.user.brandId ?? "none";
    }

    const candidateContracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        _count: {
          select: {
            payments: true,
            tickets: true,
          },
        },
      },
    });

    const deletableIds: string[] = [];
    let skippedCount = 0;

    for (const c of candidateContracts) {
      if (c._count.payments === 0 && c._count.tickets === 0) {
        deletableIds.push(c.id);
      } else {
        skippedCount++;
      }
    }

    let deletedCount = 0;
    if (deletableIds.length > 0) {
      const deleteResult = await prisma.contract.deleteMany({
        where: { id: { in: deletableIds } },
      });
      deletedCount = deleteResult.count;
    }

    return {
      success: true,
      data: {
        deletedCount,
        skippedCount,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al eliminar contratos en lote.";
    return { success: false, error: message };
  }
}

function extractSecretBaseName(name: string): {
  baseName: string;
  isRetiredInRouter: boolean;
} {
  const upper = name.toUpperCase().trim();
  const retirementPatterns = [
    /[-_]EQUIPOS?[-_]RETIRADOS?$/i,
    /[-_]RETIRADOS?$/i,
    /[-_]CANCELADOS?$/i,
    /[-_]EQUIPOS?[-_]DEVUELTOS?$/i,
    /[-_]BAJA$/i,
  ];

  for (const pattern of retirementPatterns) {
    if (pattern.test(upper)) {
      return {
        baseName: upper.replace(pattern, "").trim(),
        isRetiredInRouter: true,
      };
    }
  }

  return { baseName: upper, isRetiredInRouter: false };
}

export async function auditContractsWithRouterAction(
  nodeId: string
): Promise<ApiResponse<ContractAuditResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:manage")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:manage'.",
      };
    }

    if (!nodeId) {
      return { success: false, error: "Nodo no especificado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );

    const node = await prisma.mikrotikNode.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      return { success: false, error: "Nodo MikroTik no encontrado." };
    }

    if (!isSuperAdmin && node.brandId !== session.user.brandId) {
      return { success: false, error: "Acceso denegado a este nodo." };
    }

    const secretsRes = await getNodeAllSecrets(node);
    if (!secretsRes.success || !secretsRes.secrets) {
      return {
        success: false,
        error:
          secretsRes.error ||
          "No se pudieron obtener las cuentas de MikroTik.",
      };
    }

    const routerSecrets = secretsRes.secrets;
    const secretMap = new Map<string, (typeof routerSecrets)[0]>();
    const cleanSecretMap = new Map<
      string,
      { secret: (typeof routerSecrets)[0]; isRetired: boolean }
    >();
    const matchedSecretNames = new Set<string>();

    for (const secret of routerSecrets) {
      if (secret.name) {
        const rawKey = secret.name.toLowerCase().trim();
        secretMap.set(rawKey, secret);

        const clean = extractSecretBaseName(secret.name);
        cleanSecretMap.set(clean.baseName.toLowerCase().trim(), {
          secret,
          isRetired: clean.isRetiredInRouter,
        });
      }
    }

    const contracts = await prisma.contract.findMany({
      where: {
        nodeId: node.id,
        ...(isSuperAdmin
          ? {}
          : { brandId: session.user.brandId ?? "none" }),
      },
      include: {
        client: {
          select: {
            fullName: true,
            phonePrimary: true,
          },
        },
        plan: {
          select: {
            name: true,
            mikrotikProfile: true,
          },
        },
      },
      orderBy: { contractNumber: "asc" },
    });

    const orphansInCrm: ContractAuditOrphanInCrm[] = [];
    const synced: ContractAuditSynced[] = [];
    let totalCrmActive = 0;
    let detectedRetiredCount = 0;

    for (const contract of contracts) {
      const isCrmActive = contract.billingStatus !== "RETIRADO";
      if (isCrmActive) {
        totalCrmActive++;
      }

      const clientName = contract.client.fullName;
      const userKey = contract.pppoeUser?.toLowerCase().trim();
      const secret = userKey ? secretMap.get(userKey) : undefined;
      const cleanMatch =
        !secret && userKey ? cleanSecretMap.get(userKey) : undefined;

      if (secret) {
        matchedSecretNames.add(userKey);
        if (isCrmActive) {
          synced.push({
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            clientName,
            pppoeUser: contract.pppoeUser,
            serviceStatus: contract.serviceStatus,
            disabledInRouter: secret.disabled,
            profileInRouter: secret.profile,
          });
        }
      } else if (cleanMatch && cleanMatch.isRetired) {
        matchedSecretNames.add(
          cleanMatch.secret.name.toLowerCase().trim()
        );
        if (isCrmActive) {
          detectedRetiredCount++;
          orphansInCrm.push({
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            clientName,
            clientPhone: contract.client.phonePrimary,
            pppoeUser: contract.pppoeUser,
            pppoePassword: contract.pppoePassword,
            planName: contract.plan?.name ?? null,
            planProfile: contract.plan?.mikrotikProfile ?? null,
            serviceStatus: contract.serviceStatus,
            billingStatus: contract.billingStatus,
            detectedRetiredInRouter: true,
            routerSecretName: cleanMatch.secret.name,
          });
        }
      } else if (isCrmActive) {
        orphansInCrm.push({
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          clientName,
          clientPhone: contract.client.phonePrimary,
          pppoeUser: contract.pppoeUser,
          pppoePassword: contract.pppoePassword,
          planName: contract.plan?.name ?? null,
          planProfile: contract.plan?.mikrotikProfile ?? null,
          serviceStatus: contract.serviceStatus,
          billingStatus: contract.billingStatus,
        });
      }
    }

    const orphansInRouter: ContractAuditOrphanInRouter[] = [];
    for (const secret of routerSecrets) {
      const secretKey = secret.name.toLowerCase().trim();
      if (!matchedSecretNames.has(secretKey)) {
        orphansInRouter.push({
          name: secret.name,
          profile: secret.profile,
          disabled: secret.disabled,
          comment: secret.comment,
          remoteAddress: secret.remoteAddress,
          lastLoggedOut: secret.lastLoggedOut,
        });
      }
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        nodeName: node.name,
        totalCrmActive,
        totalRouterSecrets: routerSecrets.length,
        syncedCount: synced.length,
        detectedRetiredCount,
        orphansInCrm,
        orphansInRouter,
        synced,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al auditar contratos contra MikroTik.";
    return { success: false, error: message };
  }
}

export async function bulkProvisionSecretsAction(
  contractIds: string[]
): Promise<
  ApiResponse<{
    provisionedCount: number;
    failedCount: number;
    errors: string[];
  }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "contracts:manage")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'contracts:manage'.",
      };
    }

    if (!contractIds || contractIds.length === 0) {
      return {
        success: false,
        error: "No se seleccionaron contratos para provisionar.",
      };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );

    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        ...(isSuperAdmin
          ? {}
          : { brandId: session.user.brandId ?? "none" }),
      },
      include: {
        node: true,
        plan: true,
      },
    });

    let provisionedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const contract of contracts) {
      if (!contract.node) {
        failedCount++;
        errors.push(
          `Contrato ${contract.contractNumber}: Nodo no asignado.`
        );
        continue;
      }

      if (!contract.pppoeUser || !contract.pppoeUser.trim()) {
        failedCount++;
        errors.push(
          `Contrato ${contract.contractNumber}: Sin usuario PPPoE.`
        );
        continue;
      }

      const profile =
        contract.plan?.mikrotikProfile ||
        contract.plan?.name ||
        "default";
      const rawPass = contract.pppoePassword || "123456";
      const password = decryptSecret(rawPass);

      const res = await createPppSecretOnRouter(contract.node, {
        name: contract.pppoeUser.trim(),
        password,
        profile,
        comment: `Contrato ${contract.contractNumber}`,
        remoteAddress: contract.ipAddress ?? undefined,
      });

      if (res.success) {
        provisionedCount++;
        if (contract.serviceStatus === "DESCONOCIDO") {
          await prisma.contract.update({
            where: { id: contract.id },
            data: {
              serviceStatus: "OFFLINE",
              updatedBy: session.user.email ?? null,
            },
          });
        }
      } else {
        failedCount++;
        errors.push(
          `Contrato ${contract.contractNumber} (${contract.pppoeUser}): ${res.message}`
        );
      }
    }

    revalidatePath("/dashboard/contracts");

    return {
      success: true,
      data: {
        provisionedCount,
        failedCount,
        errors,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al provisionar cuentas en lote.";
    return { success: false, error: message };
  }
}

export async function bulkMarkContractsRetiredAction(
  contractIds: string[]
): Promise<ApiResponse<{ updatedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const canRetireContracts =
      hasPermission(session.user, "contracts:manage") ||
      hasPermission(session.user, "billing:manage");
    if (!canRetireContracts) {
      return {
        success: false,
        error:
          "Permiso denegado: Se requiere permiso 'contracts:manage' o " +
          "'billing:manage'.",
      };
    }

    if (!contractIds || contractIds.length === 0) {
      return {
        success: false,
        error: "No se seleccionaron contratos para retirar.",
      };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    const actor = session.user.email ?? null;

    const whereClause: Record<string, unknown> = {
      id: { in: contractIds },
    };
    if (!isSuperAdmin) {
      whereClause.brandId = session.user.brandId ?? "none";
    }

    const updateResult = await prisma.contract.updateMany({
      where: whereClause,
      data: {
        billingStatus: "RETIRADO",
        serviceStatus: "OFFLINE",
        updatedBy: actor,
      },
    });

    revalidatePath("/dashboard/contracts");

    return {
      success: true,
      data: {
        updatedCount: updateResult.count,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al marcar contratos como retirados.";
    return { success: false, error: message };
  }
}

