"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { searchIdsWithUnaccent } from "@/lib/search";
import { supportTicketSchema } from "@/lib/validations/isp";
import type {
  ApiResponse,
  SupportTicket,
  TicketStatus,
  TicketsPaginatedResponse,
} from "@/types";

interface GetTicketsParams {
  brandId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function getSupportTickets(
  params: GetTicketsParams = {}
): Promise<
  ApiResponse<{
    items: SupportTicket[];
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
    const pageSize = Math.min(50, Math.max(5, params.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = {};
    if (!isSuperAdmin || (params.brandId && params.brandId !== "ALL")) {
      whereClause.brandId = targetBrandId ?? "none";
    }

    if (params.status && params.status !== "ALL") {
      whereClause.status = params.status;
    }

    const [total, tickets] = await Promise.all([
      prisma.supportTicket.count({ where: whereClause }),
      prisma.supportTicket.findMany({
        where: whereClause,
        include: {
          contract: {
            include: {
              client: true,
              node: true,
              plan: true,
            },
          },
          assignedUser: true,
          technicianVisits: {
            orderBy: { scheduledDate: "asc" },
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
        items: tickets as unknown as SupportTicket[],
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
        page,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener tickets.";
    return { success: false, error: message };
  }
}

export async function getTicketsPaginated(
  page: number = 1,
  limit: number = 10,
  search?: string,
  statusFilter?: string,
  priorityFilter?: string,
  channelFilter?: string,
  brandId?: string
): Promise<ApiResponse<TicketsPaginatedResponse>> {
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
        "tickets",
        search,
        targetBrandId
      );
      whereClause.id = { in: matchedIds };
    }

    if (statusFilter && statusFilter !== "all" && statusFilter !== "ALL") {
      if (statusFilter === "OPEN_GROUP") {
        whereClause.status = {
          in: ["ABIERTO", "EN_DIAGNOSTICO_IA", "VISITA_AGENDADA"],
        };
      } else if (statusFilter === "RESOLVED_GROUP") {
        whereClause.status = { in: ["RESUELTO", "CERRADO"] };
      } else {
        whereClause.status = statusFilter;
      }
    }

    if (
      priorityFilter &&
      priorityFilter !== "all" &&
      priorityFilter !== "ALL"
    ) {
      whereClause.priority = priorityFilter;
    }

    if (channelFilter && channelFilter !== "all" && channelFilter !== "ALL") {
      whereClause.channel = channelFilter;
    }

    const [
      filteredCount,
      totalCount,
      openCount,
      escalatedCount,
      resolvedCount,
      tickets,
    ] = await Promise.all([
      prisma.supportTicket.count({ where: whereClause }),
      prisma.supportTicket.count({ where: baseWhere }),
      prisma.supportTicket.count({
        where: {
          ...baseWhere,
          status: { in: ["ABIERTO", "EN_DIAGNOSTICO_IA", "VISITA_AGENDADA"] },
        },
      }),
      prisma.supportTicket.count({
        where: { ...baseWhere, status: "TRANSFERIDO_HUMANO" },
      }),
      prisma.supportTicket.count({
        where: { ...baseWhere, status: { in: ["RESUELTO", "CERRADO"] } },
      }),
      prisma.supportTicket.findMany({
        where: whereClause,
        include: {
          contract: {
            include: {
              client: true,
              node: true,
              plan: true,
            },
          },
          assignedUser: true,
          technicianVisits: {
            orderBy: { scheduledDate: "asc" },
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
        tickets: tickets as unknown as SupportTicket[],
        totalCount,
        openCount,
        escalatedCount,
        resolvedCount,
        totalPages: Math.max(1, Math.ceil(filteredCount / safeLimit)),
        currentPage: safePage,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener casos de soporte.";
    return { success: false, error: message };
  }
}

export async function saveSupportTicket(
  rawInput: unknown
): Promise<ApiResponse<SupportTicket>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const parsed = supportTicketSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del ticket no válidos.",
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

    const actor = session.user.email ?? null;
    let savedTicket;

    if (data.id) {
      savedTicket = await prisma.supportTicket.update({
        where: { id: data.id },
        data: {
          channel: data.channel,
          issueType: data.issueType,
          priority: data.priority,
          status: data.status,
          description: data.description,
          updatedBy: actor,
        },
        include: {
          contract: {
            include: { client: true, node: true, plan: true },
          },
        },
      });
    } else {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const ticketNumber = `TCK-${new Date().getFullYear()}-${randomNum}`;

      savedTicket = await prisma.supportTicket.create({
        data: {
          brandId: data.brandId,
          contractId: data.contractId,
          ticketNumber,
          channel: data.channel,
          issueType: data.issueType,
          priority: data.priority,
          status: data.status,
          description: data.description,
          createdBy: actor,
          updatedBy: actor,
        },
        include: {
          contract: {
            include: { client: true, node: true, plan: true },
          },
        },
      });
    }

    revalidatePath("/dashboard/tickets");
    return {
      success: true,
      data: savedTicket as unknown as SupportTicket,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al guardar el ticket.";
    return { success: false, error: message };
  }
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  notes?: string
): Promise<ApiResponse<SupportTicket>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return { success: false, error: "Ticket no encontrado." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin && session.user.brandId !== ticket.brandId) {
      return { success: false, error: "No autorizado." };
    }

    const actor = session.user.email ?? null;
    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        description: notes
          ? `${ticket.description}\n[${new Date().toISOString()}] ${notes}`
          : ticket.description,
        updatedBy: actor,
      },
      include: {
        contract: {
          include: { client: true, node: true, plan: true },
        },
      },
    });

    revalidatePath("/dashboard/tickets");
    return {
      success: true,
      data: updated as unknown as SupportTicket,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al actualizar ticket.";
    return { success: false, error: message };
  }
}

export async function deleteSupportTicket(
  id: string
): Promise<ApiResponse<null>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "tickets:delete")) {
      return {
        success: false,
        error:
          "Permiso denegado: Los roles operativos no tienen " +
          "autorización para eliminar tickets del historial.",
      };
    }

    const existing = await prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false, error: "Ticket no encontrado." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    if (!isSuperAdmin && session.user.brandId !== existing.brandId) {
      return { success: false, error: "No autorizado." };
    }

    await prisma.supportTicket.delete({
      where: { id },
    });

    revalidatePath("/dashboard/tickets");
    return { success: true, data: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al eliminar el ticket.";
    return { success: false, error: message };
  }
}

export async function bulkToggleTicketsStatus(
  ids: string[],
  status: TicketStatus
): Promise<ApiResponse<null>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!ids.length) {
      return { success: false, error: "No se seleccionaron tickets." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const whereClause: Record<string, unknown> = {
      id: { in: ids },
    };

    if (!isSuperAdmin) {
      whereClause.brandId = session.user.brandId ?? "none";
    }

    const actor = session.user.email ?? null;
    await prisma.supportTicket.updateMany({
      where: whereClause,
      data: {
        status,
        updatedBy: actor,
      },
    });

    revalidatePath("/dashboard/tickets");
    return { success: true, data: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al actualizar tickets en lote.";
    return { success: false, error: message };
  }
}

export async function bulkDeleteTickets(
  ids: string[]
): Promise<ApiResponse<{ deletedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!hasPermission(session.user, "tickets:delete")) {
      return {
        success: false,
        error:
          "Permiso denegado: Los roles operativos no tienen " +
          "autorización para eliminar tickets del historial.",
      };
    }

    if (!ids.length) {
      return { success: false, error: "No se seleccionaron tickets." };
    }

    const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
    const whereClause: Record<string, unknown> = {
      id: { in: ids },
    };

    if (!isSuperAdmin) {
      whereClause.brandId = session.user.brandId ?? "none";
    }

    const result = await prisma.supportTicket.deleteMany({
      where: whereClause,
    });

    revalidatePath("/dashboard/tickets");
    return {
      success: true,
      data: {
        deletedCount: result.count,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al eliminar tickets en lote.";
    return { success: false, error: message };
  }
}
