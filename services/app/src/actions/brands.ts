"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchIdsWithUnaccent } from "@/lib/search";
import { brandSchema } from "@/lib/validations/brand";
import type {
  ApiResponse,
  Brand,
  BrandWithCounts,
  BrandsPaginatedResponse,
} from "@/types";

export interface GetBrandsPaginatedParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  hasNodes?: string;
}

export async function getBrandsPaginated(
  params: GetBrandsPaginatedParams = {}
): Promise<ApiResponse<BrandsPaginatedResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin) {
      return {
        success: false,
        error: "Acceso denegado: solo SUPER_ADMIN puede gestionar marcas.",
      };
    }

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 10));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params.status === "active") {
      where.isActive = true;
    } else if (params.status === "inactive") {
      where.isActive = false;
    }

    if (params.hasNodes === "true") {
      where.mikrotikNodes = { some: {} };
    }

    if (params.search?.trim()) {
      const matchedIds = await searchIdsWithUnaccent("brands", params.search);
      where.id = { in: matchedIds };
    }

    const [brands, total, activeCount, inactiveCount, withNodesCount] =
      await prisma.$transaction([
        prisma.brand.findMany({
          where,
          include: {
            _count: {
              select: {
                users: true,
                mikrotikNodes: true,
                clients: true,
                contracts: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.brand.count({ where }),
        prisma.brand.count({ where: { isActive: true } }),
        prisma.brand.count({ where: { isActive: false } }),
        prisma.brand.count({ where: { mikrotikNodes: { some: {} } } }),
      ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      success: true,
      data: {
        brands: brands as unknown as BrandWithCounts[],
        total,
        totalPages,
        activeCount,
        inactiveCount,
        withNodesCount,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener marcas.";
    return { success: false, error: message };
  }
}

export async function getBrands(): Promise<ApiResponse<Brand[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    const userBrandId = session.user.brandId;

    const whereClause = isSuperAdmin
      ? {}
      : userBrandId
      ? { id: userBrandId }
      : { id: "none" };

    const brands = await prisma.brand.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: brands as unknown as Brand[],
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener marcas.";
    return { success: false, error: message };
  }
}

export async function getBrandById(
  id: string
): Promise<ApiResponse<Brand>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin && session.user.brandId !== id) {
      return { success: false, error: "Acceso denegado a esta marca." };
    }

    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      return { success: false, error: "Marca no encontrada." };
    }

    return {
      success: true,
      data: brand as unknown as Brand,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener marca.";
    return { success: false, error: message };
  }
}

export async function saveBrand(
  data: Partial<Brand> & { name: string; slug: string }
): Promise<ApiResponse<Brand>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin) {
      return {
        success: false,
        error: "Solo SUPER_ADMIN puede gestionar marcas.",
      };
    }

    const validation = brandSchema.safeParse(data);
    if (!validation.success) {
      const firstError =
        validation.error.issues[0]?.message || "Datos de marca inválidos.";
      return { success: false, error: firstError };
    }

    const cleanSlug = data.slug.toLowerCase().trim();

    const existingSlug = await prisma.brand.findFirst({
      where: {
        slug: cleanSlug,
        ...(data.id ? { NOT: { id: data.id } } : {}),
      },
    });

    if (existingSlug) {
      return {
        success: false,
        error: `El slug "${cleanSlug}" ya está registrado por otra marca.`,
      };
    }

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const fallbackApiKey =
      `isp_live_${cleanSlug}_${Date.now().toString(36)}_${randomSuffix}`;
    const apiKey = data.apiKey?.trim() || fallbackApiKey;
    const actor = session.user.email ?? null;

    let savedBrand;
    if (data.id) {
      savedBrand = await prisma.brand.update({
        where: { id: data.id },
        data: {
          name: data.name.trim(),
          slug: cleanSlug,
          legalName: data.legalName?.trim() || null,
          taxId: data.taxId?.trim() || null,
          logo: data.logo?.trim() || null,
          ...(data.apiKey?.trim() ? { apiKey: data.apiKey.trim() } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          currency: data.currency?.trim() || "COP",
          timezone: data.timezone?.trim() || "America/Bogota",
          locale: data.locale?.trim() || "es",
          billingWebhookUrl: data.billingWebhookUrl?.trim() || null,
          generalWebhookUrl: data.generalWebhookUrl?.trim() || null,
          updatedBy: actor,
        },
      });
    } else {
      savedBrand = await prisma.brand.create({
        data: {
          name: data.name.trim(),
          slug: cleanSlug,
          legalName: data.legalName?.trim() || null,
          taxId: data.taxId?.trim() || null,
          logo: data.logo?.trim() || null,
          apiKey,
          isActive: data.isActive ?? true,
          currency: data.currency?.trim() || "COP",
          timezone: data.timezone?.trim() || "America/Bogota",
          locale: data.locale?.trim() || "es",
          billingWebhookUrl: data.billingWebhookUrl?.trim() || null,
          generalWebhookUrl: data.generalWebhookUrl?.trim() || null,
          createdBy: actor,
          updatedBy: actor,
        },
      });
    }

    return {
      success: true,
      data: savedBrand as unknown as Brand,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al guardar marca.";
    return { success: false, error: message };
  }
}

export async function toggleBrandStatus(
  id: string
): Promise<ApiResponse<Brand>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin) {
      return {
        success: false,
        error: "Solo SUPER_ADMIN puede modificar el estado de marcas.",
      };
    }

    const currentBrand = await prisma.brand.findUnique({
      where: { id },
    });
    if (!currentBrand) {
      return { success: false, error: "Marca no encontrada." };
    }

    const actor = session.user.email ?? null;
    const updated = await prisma.brand.update({
      where: { id },
      data: {
        isActive: !currentBrand.isActive,
        updatedBy: actor,
      },
    });

    return {
      success: true,
      data: updated as unknown as Brand,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al alternar estado.";
    return { success: false, error: message };
  }
}

export async function deleteBrand(
  id: string
): Promise<ApiResponse<{ deletedId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin) {
      return {
        success: false,
        error: "Solo SUPER_ADMIN puede eliminar marcas.",
      };
    }

    const counts = await prisma.brand.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            clients: true,
            contracts: true,
            mikrotikNodes: true,
            users: true,
          },
        },
      },
    });

    if (!counts) {
      return { success: false, error: "Marca no encontrada." };
    }

    const totalRelations =
      counts._count.clients +
      counts._count.contracts +
      counts._count.mikrotikNodes +
      counts._count.users;

    if (totalRelations > 0) {
      return {
        success: false,
        error:
          "No se puede eliminar la marca porque tiene clientes, contratos, " +
          "nodos o usuarios vinculados. Desactívala en su lugar.",
      };
    }

    await prisma.brand.delete({
      where: { id },
    });

    return {
      success: true,
      data: { deletedId: id },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar marca.";
    return { success: false, error: message };
  }
}

export async function bulkToggleBrandsStatus(
  ids: string[],
  isActive: boolean
): Promise<ApiResponse<{ count: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin) {
      return {
        success: false,
        error: "Solo SUPER_ADMIN puede modificar marcas en lote.",
      };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se proporcionaron marcas." };
    }

    const actor = session.user.email ?? null;
    const result = await prisma.brand.updateMany({
      where: { id: { in: ids } },
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

export async function bulkDeleteBrands(
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number; skippedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin) {
      return {
        success: false,
        error: "Solo SUPER_ADMIN puede eliminar marcas en lote.",
      };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No se proporcionaron marcas." };
    }

    const candidateBrands = await prisma.brand.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        _count: {
          select: {
            clients: true,
            contracts: true,
            mikrotikNodes: true,
            users: true,
          },
        },
      },
    });

    const safeToDeleteIds = candidateBrands
      .filter((b) => {
        const total =
          b._count.clients +
          b._count.contracts +
          b._count.mikrotikNodes +
          b._count.users;
        return total === 0;
      })
      .map((b) => b.id);

    if (safeToDeleteIds.length === 0) {
      return {
        success: false,
        error:
          "Ninguna marca seleccionada pudo ser eliminada porque todas " +
          "tienen recursos asociados (nodos, clientes o contratos).",
      };
    }

    const deleted = await prisma.brand.deleteMany({
      where: { id: { in: safeToDeleteIds } },
    });

    const skippedCount = ids.length - deleted.count;

    return {
      success: true,
      data: {
        deletedCount: deleted.count,
        skippedCount,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar marcas en lote.";
    return { success: false, error: message };
  }
}

export async function regenerateBrandApiKey(
  id: string
): Promise<ApiResponse<{ apiKey: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );
    if (!isSuperAdmin) {
      return {
        success: false,
        error: "Solo SUPER_ADMIN puede regenerar claves de marcas.",
      };
    }

    const brand = await prisma.brand.findUnique({
      where: { id },
    });
    if (!brand) {
      return { success: false, error: "Marca no encontrada." };
    }

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const newApiKey =
      `isp_live_${brand.slug}_${Date.now().toString(36)}_${randomSuffix}`;

    const actor = session.user.email ?? null;
    await prisma.brand.update({
      where: { id },
      data: {
        apiKey: newApiKey,
        updatedBy: actor,
      },
    });

    return {
      success: true,
      data: { apiKey: newApiKey },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al regenerar clave API.";
    return { success: false, error: message };
  }
}
