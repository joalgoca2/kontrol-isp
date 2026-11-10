"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchIdsWithUnaccent } from "@/lib/search";
import { planSchema } from "@/lib/validations/isp";
import type { ApiResponse, Plan, PlansPaginatedResponse } from "@/types";

export interface GetPlansPaginatedParams {
  brandId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  technology?: string;
  hasContracts?: string;
}

export async function getPlansPaginated(
  params: GetPlansPaginatedParams = {}
): Promise<ApiResponse<PlansPaginatedResponse>> {
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

    if (params.status === "active") {
      where.isActive = true;
    } else if (params.status === "inactive") {
      where.isActive = false;
    }

    if (params.technology === "FIBRA_OPTICA") {
      where.technology = "FIBRA_OPTICA";
    } else if (params.technology === "MICROONDAS") {
      where.technology = "MICROONDAS";
    }

    if (params.hasContracts === "false") {
      where.contracts = { none: {} };
    } else if (params.hasContracts === "true") {
      where.contracts = { some: {} };
    }

    if (params.search?.trim()) {
      const matchedIds = await searchIdsWithUnaccent("plans", params.search);
      where.id = { in: matchedIds };
    }

    const [
      plans,
      total,
      activeCount,
      inactiveCount,
      fiberCount,
      withoutContractsCount,
    ] = await prisma.$transaction([
      prisma.plan.findMany({
        where,
        include: {
          _count: {
            select: { contracts: true },
          },
        },
        orderBy: { priceCop: "asc" },
        skip,
        take: limit,
      }),
      prisma.plan.count({ where }),
      prisma.plan.count({ where: { ...brandFilter, isActive: true } }),
      prisma.plan.count({ where: { ...brandFilter, isActive: false } }),
      prisma.plan.count({
        where: { ...brandFilter, technology: "FIBRA_OPTICA" },
      }),
      prisma.plan.count({
        where: { ...brandFilter, contracts: { none: {} } },
      }),
    ]);

    const formatted: Plan[] = plans.map((p) => ({
      id: p.id,
      brandId: p.brandId,
      name: p.name,
      downloadSpeedMbps: p.downloadSpeedMbps,
      uploadSpeedMbps: p.uploadSpeedMbps,
      rateLimit: p.rateLimit,
      priceCop: p.priceCop,
      billingDay: p.billingDay,
      mikrotikProfile: p.mikrotikProfile,
      technology: p.technology,
      isActive: p.isActive,
      contractsCount: p._count.contracts,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      success: true,
      data: {
        plans: formatted,
        total,
        totalPages,
        activeCount,
        inactiveCount,
        fiberCount,
        withoutContractsCount,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener planes.";
    return { success: false, error: message };
  }
}

export async function getPlans(
  brandId?: string
): Promise<ApiResponse<Plan[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const targetBrandId =
      isSuperAdmin && brandId && brandId !== "ALL"
        ? brandId
        : session.user.brandId;

    const whereClause =
      isSuperAdmin && (!brandId || brandId === "ALL")
        ? {}
        : { brandId: targetBrandId ?? "none" };

    const plans = await prisma.plan.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { contracts: true },
        },
      },
      orderBy: { priceCop: "asc" },
    });

    const formatted: Plan[] = plans.map((p) => ({
      id: p.id,
      brandId: p.brandId,
      name: p.name,
      downloadSpeedMbps: p.downloadSpeedMbps,
      uploadSpeedMbps: p.uploadSpeedMbps,
      rateLimit: p.rateLimit,
      priceCop: p.priceCop,
      billingDay: p.billingDay,
      mikrotikProfile: p.mikrotikProfile,
      technology: p.technology,
      isActive: p.isActive,
      contractsCount: p._count.contracts,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return {
      success: true,
      data: formatted,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener planes.";
    return { success: false, error: message };
  }
}

export async function savePlan(
  rawInput: unknown
): Promise<ApiResponse<Plan>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const parsed = planSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del plan no válidos.",
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

    const existing = await prisma.plan.findFirst({
      where: {
        brandId: data.brandId,
        name: data.name,
        ...(data.id ? { NOT: { id: data.id } } : {}),
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Ya existe un plan con el nombre '${data.name}' en esta marca.`,
      };
    }

    const actor = session.user.email ?? null;
    let saved;
    if (data.id) {
      saved = await prisma.plan.update({
        where: { id: data.id },
        data: {
          name: data.name,
          downloadSpeedMbps: data.downloadSpeedMbps,
          uploadSpeedMbps: data.uploadSpeedMbps,
          rateLimit: data.rateLimit,
          priceCop: data.priceCop,
          billingDay: data.billingDay,
          mikrotikProfile: data.mikrotikProfile ?? null,
          technology: data.technology,
          isActive: data.isActive,
          updatedBy: actor,
        },
      });
    } else {
      saved = await prisma.plan.create({
        data: {
          brandId: data.brandId,
          name: data.name,
          downloadSpeedMbps: data.downloadSpeedMbps,
          uploadSpeedMbps: data.uploadSpeedMbps,
          rateLimit: data.rateLimit,
          priceCop: data.priceCop,
          billingDay: data.billingDay,
          mikrotikProfile: data.mikrotikProfile ?? null,
          technology: data.technology,
          isActive: data.isActive,
          createdBy: actor,
          updatedBy: actor,
        },
      });
    }

    return {
      success: true,
      data: saved as unknown as Plan,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al guardar plan.";
    return { success: false, error: message };
  }
}

export async function togglePlanStatus(
  id: string
): Promise<ApiResponse<Plan>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const plan = await prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      return { success: false, error: "Plan no encontrado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin && session.user.brandId !== plan.brandId) {
      return {
        success: false,
        error: "No tienes permiso para modificar este plan.",
      };
    }

    const actor = session.user.email ?? null;
    const updated = await prisma.plan.update({
      where: { id },
      data: {
        isActive: !plan.isActive,
        updatedBy: actor,
      },
    });

    return {
      success: true,
      data: updated as unknown as Plan,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al cambiar estado del plan.";
    return { success: false, error: message };
  }
}

export async function deletePlan(
  id: string
): Promise<ApiResponse<{ deletedId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const plan = await prisma.plan.findUnique({
      where: { id },
      select: {
        id: true,
        brandId: true,
        _count: {
          select: { contracts: true },
        },
      },
    });

    if (!plan) {
      return { success: false, error: "Plan no encontrado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin && session.user.brandId !== plan.brandId) {
      return {
        success: false,
        error: "No tienes permiso para eliminar este plan.",
      };
    }

    if (plan._count.contracts > 0) {
      return {
        success: false,
        error:
          "No se puede eliminar el plan porque tiene contratos de abonados " +
          "vinculados. Desactívalo en su lugar.",
      };
    }

    await prisma.plan.delete({
      where: { id },
    });

    return {
      success: true,
      data: { deletedId: id },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar plan.";
    return { success: false, error: message };
  }
}

export async function bulkTogglePlansStatus(
  ids: string[],
  isActive: boolean
): Promise<ApiResponse<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se seleccionaron planes." };
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
    const result = await prisma.plan.updateMany({
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

export async function bulkDeletePlans(
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number; skippedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se seleccionaron planes." };
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

    const candidatePlans = await prisma.plan.findMany({
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

    for (const plan of candidatePlans) {
      if (plan._count.contracts === 0) {
        deletableIds.push(plan.id);
      } else {
        skippedCount++;
      }
    }

    let deletedCount = 0;
    if (deletableIds.length > 0) {
      const deleteResult = await prisma.plan.deleteMany({
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
      err instanceof Error ? err.message : "Error al eliminar planes en lote.";
    return { success: false, error: message };
  }
}

