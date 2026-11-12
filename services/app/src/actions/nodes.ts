"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchIdsWithUnaccent } from "@/lib/search";
import { mikrotikNodeSchema } from "@/lib/validations/isp";
import { testNodeHealth } from "@/lib/mikrotik/node-manager";
import { encryptSecret } from "@/lib/crypto";
import {
  sendWhatsappTextMessage,
  validateAndFormatPhone,
} from "@/lib/evolution-api";
import type {
  ApiResponse,
  MikrotikNode,
  MikrotikNodeWithCounts,
  MikrotikNodesPaginatedResponse,
} from "@/types";

export interface GetMikrotikNodesPaginatedParams {
  brandId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  health?: string;
  hasContracts?: string;
}

export async function getMikrotikNodesPaginated(
  params: GetMikrotikNodesPaginatedParams = {}
): Promise<ApiResponse<MikrotikNodesPaginatedResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const userRoles = session.user.roles ?? [];
    const canViewNodes = userRoles.some((r) =>
      ["SUPER_ADMIN", "ADMIN", "TECHNICIAN"].includes(r)
    );
    if (!canViewNodes) {
      return {
        success: false,
        error: "Acceso denegado: se requiere rol de Red, Técnico o Administrador.",
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

    if (params.status === "active") {
      where.isActive = true;
    } else if (params.status === "inactive") {
      where.isActive = false;
    }

    if (params.health === "ONLINE") {
      where.status = "ONLINE";
    } else if (params.health === "OFFLINE") {
      where.status = "OFFLINE";
    }

    if (params.hasContracts === "false") {
      where.contracts = { none: {} };
    } else if (params.hasContracts === "true") {
      where.contracts = { some: {} };
    }

    if (params.search?.trim()) {
      const matchedIds = await searchIdsWithUnaccent("nodes", params.search);
      where.id = { in: matchedIds };
    }

    const [
      nodes,
      total,
      onlineCount,
      offlineCount,
      withoutContractsCount,
    ] = await prisma.$transaction([
      prisma.mikrotikNode.findMany({
        where,
        include: {
          _count: {
            select: { contracts: true },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.mikrotikNode.count({ where }),
      prisma.mikrotikNode.count({
        where: { ...brandFilter, status: "ONLINE" },
      }),
      prisma.mikrotikNode.count({
        where: { ...brandFilter, status: "OFFLINE" },
      }),
      prisma.mikrotikNode.count({
        where: { ...brandFilter, contracts: { none: {} } },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const sanitizedNodes = nodes.map((node) => ({
      ...node,
      passwordEncrypted: "",
    }));

    return {
      success: true,
      data: {
        nodes: sanitizedNodes as unknown as MikrotikNodeWithCounts[],
        total,
        totalPages,
        onlineCount,
        offlineCount,
        withoutContractsCount,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener nodos.";
    return { success: false, error: message };
  }
}

export async function getMikrotikNodes(
  brandId?: string
): Promise<ApiResponse<MikrotikNode[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const targetBrandId = isSuperAdmin && brandId && brandId !== "ALL"
      ? brandId
      : session.user.brandId;

    const whereClause = isSuperAdmin && (!brandId || brandId === "ALL")
      ? {}
      : { brandId: targetBrandId ?? "none" };

    const nodes = await prisma.mikrotikNode.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { contracts: true },
        },
      },
    });

    const sanitizedNodes = nodes.map((n) => ({
      ...n,
      passwordEncrypted: "",
    }));

    return {
      success: true,
      data: sanitizedNodes as unknown as MikrotikNode[],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al obtener nodos.";
    return { success: false, error: message };
  }
}

export async function getMikrotikNodeById(
  id: string
): Promise<ApiResponse<MikrotikNode>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const node = await prisma.mikrotikNode.findUnique({
      where: { id },
    });

    if (!node) {
      return { success: false, error: "Nodo no encontrado." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin && session.user.brandId !== node.brandId) {
      return { success: false, error: "Acceso denegado a este nodo." };
    }

    const sanitizedNode = {
      ...node,
      passwordEncrypted: "",
    };

    return {
      success: true,
      data: sanitizedNode as unknown as MikrotikNode,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al obtener nodo.";
    return { success: false, error: message };
  }
}

export async function saveMikrotikNode(
  rawInput: unknown
): Promise<ApiResponse<MikrotikNode>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const parsed = mikrotikNodeSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del nodo no válidos.",
      };
    }

    const data = parsed.data;
    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const isAdmin = isSuperAdmin || session.user.roles?.includes("ADMIN");
    if (!isAdmin) {
      return {
        success: false,
        error: "Acceso denegado: solo administradores pueden registrar nodos.",
      };
    }
    if (!isSuperAdmin && session.user.brandId !== data.brandId) {
      return { success: false, error: "No tienes permiso para gestionar esta marca." };
    }

    // Check unique code per brand
    const existing = await prisma.mikrotikNode.findFirst({
      where: {
        brandId: data.brandId,
        code: data.code,
        ...(data.id ? { NOT: { id: data.id } } : {}),
      },
    });

    if (existing) {
      return {
        success: false,
        error: `El código de nodo '${data.code}' ya existe en esta marca.`,
      };
    }

    const actor = session.user.email ?? null;
    let savedNode;
    if (data.id) {
      const updateData: Record<string, unknown> = {
        name: data.name,
        code: data.code,
        location: data.location,
        host: data.host,
        port: data.port,
        username: data.username,
        fallbackHost: data.fallbackHost ?? null,
        useTls: data.useTls,
        isActive: data.isActive,
        updatedBy: actor,
      };

      if (data.password && data.password.trim() !== "") {
        updateData.passwordEncrypted = encryptSecret(data.password.trim());
      }

      savedNode = await prisma.mikrotikNode.update({
        where: { id: data.id },
        data: updateData,
      });
    } else {
      savedNode = await prisma.mikrotikNode.create({
        data: {
          brandId: data.brandId,
          name: data.name,
          code: data.code,
          location: data.location,
          host: data.host,
          port: data.port,
          username: data.username,
          passwordEncrypted: data.password ? encryptSecret(data.password.trim()) : "",
          fallbackHost: data.fallbackHost ?? null,
          useTls: data.useTls,
          isActive: data.isActive,
          createdBy: actor,
          updatedBy: actor,
        },
      });
    }

    const sanitizedSaved = {
      ...savedNode,
      passwordEncrypted: "",
    };

    return {
      success: true,
      data: sanitizedSaved as unknown as MikrotikNode,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al guardar nodo.";
    return { success: false, error: message };
  }
}

export async function testNodeHealthAction(
  nodeId: string
): Promise<ApiResponse<{ latencyMs: number; activeSessions: number; version?: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const node = await prisma.mikrotikNode.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      return { success: false, error: "Nodo no encontrado." };
    }

    const health = await testNodeHealth(node as unknown as MikrotikNode);

    const actor = session.user.email ?? null;
    // Update node health in DB
    await prisma.mikrotikNode.update({
      where: { id: nodeId },
      data: {
        status: health.connected ? "ONLINE" : "OFFLINE",
        latencyMs: health.latencyMs,
        activeSessions: health.activeSessions,
        cpuUsage: health.cpuUsage ?? null,
        routerOsVersion: health.version ?? null,
        lastCheckAt: new Date(),
        updatedBy: actor,
      },
    });

    if (!health.connected) {
      return {
        success: false,
        error:
          health.error || "No se pudo establecer conexión con el nodo MikroTik.",
      };
    }

    return {
      success: true,
      data: {
        latencyMs: health.latencyMs,
        activeSessions: health.activeSessions,
        version: health.version,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al probar nodo.";
    return { success: false, error: message };
  }
}

export async function toggleMikrotikNodeStatus(
  id: string
): Promise<ApiResponse<MikrotikNode>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const node = await prisma.mikrotikNode.findUnique({
      where: { id },
    });

    if (!node) {
      return { success: false, error: "Nodo no encontrado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    const isAdmin = isSuperAdmin || Boolean(session.user.roles?.includes("ADMIN"));
    if (!isAdmin) {
      return {
        success: false,
        error: "Acceso denegado: solo administradores pueden modificar nodos.",
      };
    }
    if (!isSuperAdmin && session.user.brandId !== node.brandId) {
      return {
        success: false,
        error: "No tienes permiso para modificar este nodo.",
      };
    }

    const actor = session.user.email ?? null;
    const updated = await prisma.mikrotikNode.update({
      where: { id },
      data: {
        isActive: !node.isActive,
        updatedBy: actor,
      },
    });

    return {
      success: true,
      data: updated as unknown as MikrotikNode,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al alternar estado del nodo.";
    return { success: false, error: message };
  }
}

export async function deleteMikrotikNode(
  id: string
): Promise<ApiResponse<{ deletedId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const node = await prisma.mikrotikNode.findUnique({
      where: { id },
      select: {
        id: true,
        brandId: true,
        _count: {
          select: { contracts: true },
        },
      },
    });

    if (!node) {
      return { success: false, error: "Nodo no encontrado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    const isAdmin = isSuperAdmin || Boolean(session.user.roles?.includes("ADMIN"));
    if (!isAdmin) {
      return {
        success: false,
        error: "Acceso denegado: solo administradores pueden eliminar nodos.",
      };
    }
    if (!isSuperAdmin && session.user.brandId !== node.brandId) {
      return {
        success: false,
        error: "No tienes permiso para eliminar este nodo.",
      };
    }

    if (node._count.contracts > 0) {
      return {
        success: false,
        error:
          "No se puede eliminar el nodo porque tiene contratos de abonados " +
          "vinculados. Desactívalo o migra los contratos primero.",
      };
    }

    await prisma.mikrotikNode.delete({
      where: { id },
    });

    return {
      success: true,
      data: { deletedId: id },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar nodo.";
    return { success: false, error: message };
  }
}

export async function bulkToggleMikrotikNodesStatus(
  ids: string[],
  isActive: boolean
): Promise<ApiResponse<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se seleccionaron nodos." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    const isAdmin = isSuperAdmin || Boolean(session.user.roles?.includes("ADMIN"));
    if (!isAdmin) {
      return {
        success: false,
        error: "Acceso denegado: solo administradores pueden modificar nodos.",
      };
    }

    const whereClause: Record<string, unknown> = {
      id: { in: ids },
    };

    if (!isSuperAdmin) {
      whereClause.brandId = session.user.brandId ?? "none";
    }

    const actor = session.user.email ?? null;
    const result = await prisma.mikrotikNode.updateMany({
      where: whereClause,
      data: {
        isActive,
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

export async function bulkDeleteMikrotikNodes(
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number; skippedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se seleccionaron nodos." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    const isAdmin = isSuperAdmin || Boolean(session.user.roles?.includes("ADMIN"));
    if (!isAdmin) {
      return {
        success: false,
        error: "Acceso denegado: solo administradores pueden eliminar nodos.",
      };
    }

    const whereClause: Record<string, unknown> = {
      id: { in: ids },
    };

    if (!isSuperAdmin) {
      whereClause.brandId = session.user.brandId ?? "none";
    }

    const candidateNodes = await prisma.mikrotikNode.findMany({
      where: whereClause,
      select: {
        id: true,
        _count: {
          select: { contracts: true },
        },
      },
    });

    const deletableIds: string[] = [];
    let skippedCount = 0;

    for (const n of candidateNodes) {
      if (n._count.contracts === 0) {
        deletableIds.push(n.id);
      } else {
        skippedCount++;
      }
    }

    let deletedCount = 0;
    if (deletableIds.length > 0) {
      const deleteResult = await prisma.mikrotikNode.deleteMany({
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
      err instanceof Error ? err.message : "Error al eliminar nodos en lote.";
    return { success: false, error: message };
  }
}

export type BroadcastAudience = "ALL" | "ACTIVE" | "OFFLINE";

export interface NodeBroadcastRecipient {
  contractId: string;
  contractNumber: string;
  clientName: string;
  phone: string;
  pppoeUser: string;
  serviceStatus: string;
  billingStatus: string;
}

export interface NodeBroadcastData {
  nodeId: string;
  nodeName: string;
  nodeCode: string;
  brandName: string;
  totalContractsOnNode: number;
  validRecipients: NodeBroadcastRecipient[];
  skippedNoPppoeCount: number;
  skippedInvalidPhoneCount: number;
  skippedDuplicatePhoneCount: number;
}

export async function getNodeBroadcastRecipientsAction(
  nodeId: string,
  audience: BroadcastAudience = "ALL"
): Promise<ApiResponse<NodeBroadcastData>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const userRoles = session.user.roles ?? [];
    const canBroadcast = userRoles.some((r) =>
      ["SUPER_ADMIN", "ADMIN", "TECHNICIAN"].includes(r)
    );
    if (!canBroadcast) {
      return {
        success: false,
        error: "Acceso denegado: rol insuficiente para emitir avisos.",
      };
    }

    const node = await prisma.mikrotikNode.findUnique({
      where: { id: nodeId },
      include: { brand: true },
    });

    if (!node) {
      return { success: false, error: "Nodo no encontrado." };
    }

    const totalContractsOnNode = await prisma.contract.count({
      where: { nodeId },
    });

    const whereClause: Record<string, unknown> = { nodeId };
    if (audience === "ACTIVE") {
      whereClause.billingStatus = "ACTIVO";
    } else if (audience === "OFFLINE") {
      whereClause.serviceStatus = "OFFLINE";
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      include: {
        client: true,
      },
      orderBy: { contractNumber: "asc" },
    });

    const validRecipients: NodeBroadcastRecipient[] = [];
    const seenPhones = new Set<string>();
    let skippedNoPppoeCount = 0;
    let skippedInvalidPhoneCount = 0;
    let skippedDuplicatePhoneCount = 0;

    for (const c of contracts) {
      // Security Filter 1: Must have a registered PPPoE user
      if (!c.pppoeUser || !c.pppoeUser.trim()) {
        skippedNoPppoeCount++;
        continue;
      }

      // Security Filter 2: Must have client and valid primary phone
      const rawPhone = c.client?.phonePrimary;
      if (!rawPhone || !rawPhone.trim()) {
        skippedInvalidPhoneCount++;
        continue;
      }

      const phoneVal = validateAndFormatPhone(rawPhone);
      if (!phoneVal.isValid) {
        skippedInvalidPhoneCount++;
        continue;
      }

      // Security Filter 3: Deduplicate by phone
      if (seenPhones.has(phoneVal.phone)) {
        skippedDuplicatePhoneCount++;
        continue;
      }

      seenPhones.add(phoneVal.phone);
      validRecipients.push({
        contractId: c.id,
        contractNumber: c.contractNumber,
        clientName: c.client?.fullName || "Abonado",
        phone: phoneVal.phone,
        pppoeUser: c.pppoeUser,
        serviceStatus: c.serviceStatus,
        billingStatus: c.billingStatus,
      });
    }

    return {
      success: true,
      data: {
        nodeId: node.id,
        nodeName: node.name,
        nodeCode: node.code,
        brandName: node.brand?.name || "Serkoi",
        totalContractsOnNode,
        validRecipients,
        skippedNoPppoeCount,
        skippedInvalidPhoneCount,
        skippedDuplicatePhoneCount,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al consultar destinatarios.";
    return { success: false, error: message };
  }
}

export interface SendSingleBroadcastParams {
  recipientPhone: string;
  message: string;
  instanceName?: string;
}

export async function sendSingleBroadcastMessageAction(
  params: SendSingleBroadcastParams
): Promise<ApiResponse<{ messageId?: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const res = await sendWhatsappTextMessage(
      params.recipientPhone,
      params.message,
      params.instanceName
    );

    if (!res.success) {
      return {
        success: false,
        error: res.error || "No se pudo entregar el mensaje por WhatsApp.",
      };
    }

    return {
      success: true,
      data: { messageId: res.messageId },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al despachar mensaje.";
    return { success: false, error: message };
  }
}

