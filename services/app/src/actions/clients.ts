"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchIdsWithUnaccent } from "@/lib/search";
import { hasPermission } from "@/lib/permissions";
import { clientSchema } from "@/lib/validations/isp";
import type {
  ApiResponse,
  Client,
  ClientsPaginatedResponse,
} from "@/types";

export interface GetClientsPaginatedParams {
  brandId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  documentType?: string;
  hasContracts?: string;
}

export async function getClientsPaginated(
  params: GetClientsPaginatedParams = {}
): Promise<ApiResponse<ClientsPaginatedResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "clients:read")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'clients:read'.",
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

    if (
      params.documentType &&
      params.documentType !== "all" &&
      ["CC", "NIT", "CE", "PASAPORTE"].includes(params.documentType)
    ) {
      where.documentType = params.documentType;
    }

    if (params.hasContracts === "false") {
      where.contracts = { none: {} };
    } else if (params.hasContracts === "true") {
      where.contracts = { some: {} };
    }

    if (params.search?.trim()) {
      const matchedIds = await searchIdsWithUnaccent(
        "clients",
        params.search,
        targetBrandId
      );
      where.id = { in: matchedIds };
    }

    const [
      clients,
      total,
      activeCount,
      inactiveCount,
      withoutContractsCount,
    ] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        include: {
          _count: {
            select: { contracts: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
      prisma.client.count({
        where: { ...brandFilter, isActive: true },
      }),
      prisma.client.count({
        where: { ...brandFilter, isActive: false },
      }),
      prisma.client.count({
        where: { ...brandFilter, contracts: { none: {} } },
      }),
    ]);

    const formattedClients: Client[] = clients.map((c) => ({
      id: c.id,
      brandId: c.brandId,
      documentType: c.documentType,
      documentNumber: c.documentNumber,
      fullName: c.fullName,
      email: c.email,
      phonePrimary: c.phonePrimary,
      phoneSecondary: c.phoneSecondary,
      address: c.address,
      city: c.city,
      department: c.department,
      notes: c.notes,
      isActive: c.isActive,
      contractsCount: c._count.contracts,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      success: true,
      data: {
        clients: formattedClients,
        total,
        totalPages,
        activeCount,
        inactiveCount,
        withoutContractsCount,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener clientes.";
    return { success: false, error: message };
  }
}

interface GetClientsParams {
  brandId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getClients(
  params: GetClientsParams = {}
): Promise<
  ApiResponse<{
    items: Client[];
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

    if (!hasPermission(session.user, "clients:read")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'clients:read'.",
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

    if (params.search && params.search.trim() !== "") {
      const term = params.search.trim().replace(/^#/, "");
      whereClause.OR = [
        { fullName: { contains: term, mode: "insensitive" } },
        { documentNumber: { contains: term } },
        { clientCode: { contains: term } },
        { id: { contains: term, mode: "insensitive" } },
        { phonePrimary: { contains: term } },
        { email: { contains: term, mode: "insensitive" } },
        { contracts: { some: { contractNumber: { contains: term } } } },
      ];
    }

    const [total, clients] = await Promise.all([
      prisma.client.count({ where: whereClause }),
      prisma.client.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { contracts: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    const formattedItems: Client[] = clients.map((c) => ({
      id: c.id,
      brandId: c.brandId,
      documentType: c.documentType,
      documentNumber: c.documentNumber,
      fullName: c.fullName,
      email: c.email,
      phonePrimary: c.phonePrimary,
      phoneSecondary: c.phoneSecondary,
      address: c.address,
      city: c.city,
      department: c.department,
      notes: c.notes,
      isActive: c.isActive,
      contractsCount: c._count.contracts,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return {
      success: true,
      data: {
        items: formattedItems,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
        page,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener clientes.";
    return { success: false, error: message };
  }
}

export async function getClientById(
  id: string
): Promise<ApiResponse<Client & { contracts: unknown[] }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "clients:read")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'clients:read'.",
      };
    }

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        contracts: {
          include: {
            node: true,
            plan: true,
            equipment: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client) {
      return { success: false, error: "Cliente no encontrado." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin && session.user.brandId !== client.brandId) {
      return { success: false, error: "Acceso denegado a este cliente." };
    }

    return {
      success: true,
      data: client as unknown as Client & { contracts: unknown[] },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener cliente.";
    return { success: false, error: message };
  }
}

export async function saveClient(
  rawInput: unknown
): Promise<ApiResponse<Client>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "clients:manage")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'clients:manage'.",
      };
    }

    const parsed = clientSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Datos del cliente no válidos.",
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

    // Check unique document number in brand
    const existing = await prisma.client.findFirst({
      where: {
        brandId: data.brandId,
        documentNumber: data.documentNumber,
        ...(data.id ? { NOT: { id: data.id } } : {}),
      },
    });

    if (existing) {
      return {
        success: false,
        error:
          `El documento '${data.documentNumber}' ya está registrado ` +
          `en esta marca.`,
      };
    }

    const normalizedEmail =
      data.email && data.email.trim() !== "" ? data.email.trim() : null;
    const actor = session.user.email ?? null;

    let savedClient;
    if (data.id) {
      savedClient = await prisma.client.update({
        where: { id: data.id },
        data: {
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          fullName: data.fullName,
          email: normalizedEmail,
          phonePrimary: data.phonePrimary,
          phoneSecondary: data.phoneSecondary ?? null,
          address: data.address ?? null,
          city: data.city,
          department: data.department,
          notes: data.notes ?? null,
          isActive: data.isActive,
          updatedBy: actor,
        },
      });
    } else {
      savedClient = await prisma.client.create({
        data: {
          brandId: data.brandId,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          fullName: data.fullName,
          email: normalizedEmail,
          phonePrimary: data.phonePrimary,
          phoneSecondary: data.phoneSecondary ?? null,
          address: data.address ?? null,
          city: data.city,
          department: data.department,
          notes: data.notes ?? null,
          isActive: data.isActive,
          createdBy: actor,
          updatedBy: actor,
        },
      });
    }

    return {
      success: true,
      data: savedClient as unknown as Client,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al guardar cliente.";
    return { success: false, error: message };
  }
}

export async function toggleClientStatus(
  id: string
): Promise<ApiResponse<Client>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "clients:manage")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'clients:manage'.",
      };
    }

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return { success: false, error: "Cliente no encontrado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin && session.user.brandId !== client.brandId) {
      return {
        success: false,
        error: "No tienes permiso para modificar este titular.",
      };
    }

    const actor = session.user.email ?? null;
    const updated = await prisma.client.update({
      where: { id },
      data: {
        isActive: !client.isActive,
        updatedBy: actor,
      },
    });

    return {
      success: true,
      data: updated as unknown as Client,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al alternar estado del cliente.";
    return { success: false, error: message };
  }
}

export async function deleteClient(
  id: string
): Promise<ApiResponse<{ deletedId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "clients:delete")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'clients:delete'.",
      };
    }

    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        brandId: true,
        _count: {
          select: { contracts: true },
        },
      },
    });

    if (!client) {
      return { success: false, error: "Cliente no encontrado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin && session.user.brandId !== client.brandId) {
      return {
        success: false,
        error: "No tienes permiso para eliminar este titular.",
      };
    }

    if (client._count.contracts > 0) {
      return {
        success: false,
        error:
          "No se puede eliminar el titular porque tiene contratos de " +
          "servicio vinculados. Desactívalo o elimina sus contratos primero.",
      };
    }

    await prisma.client.delete({
      where: { id },
    });

    return {
      success: true,
      data: { deletedId: id },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar cliente.";
    return { success: false, error: message };
  }
}

export async function bulkToggleClientsStatus(
  ids: string[],
  isActive: boolean
): Promise<ApiResponse<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "clients:manage")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'clients:manage'.",
      };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se seleccionaron clientes." };
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

    const actor = session.user.email ?? null;
    const result = await prisma.client.updateMany({
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

export async function bulkDeleteClients(
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number; skippedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "clients:delete")) {
      return {
        success: false,
        error: "Permiso denegado: Se requiere permiso 'clients:delete'.",
      };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se seleccionaron clientes." };
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

    const candidateClients = await prisma.client.findMany({
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

    for (const c of candidateClients) {
      if (c._count.contracts === 0) {
        deletableIds.push(c.id);
      } else {
        skippedCount++;
      }
    }

    let deletedCount = 0;
    if (deletableIds.length > 0) {
      const deleteResult = await prisma.client.deleteMany({
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
        : "Error al eliminar clientes en lote.";
    return { success: false, error: message };
  }
}
