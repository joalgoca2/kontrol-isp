"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchIdsWithUnaccent } from "@/lib/search";
import { contractSchema } from "@/lib/validations/isp";
import { encryptSecret } from "@/lib/crypto";
import {
  getClientPppSession,
  setClientSuspensionOnRouter,
  kickClientSession,
} from "@/lib/mikrotik/node-manager";
import type {
  ApiResponse,
  Contract,
  ContractsPaginatedResponse,
  MikrotikLiveDiagnostic,
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

export async function getContractsPaginated(
  params: GetContractsPaginatedParams = {}
): Promise<ApiResponse<ContractsPaginatedResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
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

    return {
      success: true,
      data: {
        contracts: contracts as unknown as Contract[],
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

    return {
      success: true,
      data: {
        items: contracts as unknown as Contract[],
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
      data: contract as unknown as Contract,
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

    const parsed = contractSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Datos del contrato no válidos.",
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
      data: savedContract as unknown as Contract,
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

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { node: true },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    const diag = await getClientPppSession(
      contract.node,
      contract.pppoeUser,
      contract.ipAddress
    );

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

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { node: true },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    const res = await kickClientSession(contract.node, contract.pppoeUser);

    return {
      success: res.success,
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

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { node: true, client: true },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    // 1. Enable client in MikroTik router (/ppp/secret)
    const routerRes = await setClientSuspensionOnRouter(
      contract.node,
      contract.pppoeUser,
      false
    );

    // 2. Kick session to force CPE immediate connection
    await kickClientSession(contract.node, contract.pppoeUser);

    const actor = session.user.email ?? null;

    // 3. Update contract in database to CORTESIA
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        billingStatus: "CORTESIA",
        serviceStatus: "ONLINE",
        updatedBy: actor,
      },
    });

    return {
      success: true,
      data: {
        message:
          `Promesa de pago concedida por ${hours}h exitosamente en ` +
          `el router: ${routerRes.message}`,
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

    for (const c of targetContracts) {
      try {
        await setClientSuspensionOnRouter(c.node, c.pppoeUser, suspend);
      } catch (_err) {
        // Ignore individual router network timeouts in batch
      }
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
