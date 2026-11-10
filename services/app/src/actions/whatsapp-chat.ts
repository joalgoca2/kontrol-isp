"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveTenantBrand } from "@/lib/tenant";
import { sendTestWhatsappMessage } from "@/lib/evolution-api";
import type { ApiResponse } from "@/types";

export interface WhatsAppConversationSummary {
  senderIdentifier: string;
  clientName: string;
  phone: string;
  contractNumber: string | null;
  contractId: string | null;
  serviceStatus: string;
  billingStatus: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderRole: "client" | "bot" | "operator";
  transferredToHuman: boolean;
  messageCount: number;
}

export interface ChatThreadMessage {
  id: string;
  sender: "client" | "bot" | "operator";
  content: string;
  createdAt: string;
  toolsInvoked?: unknown;
  transferredToHuman?: boolean;
}

export interface ConversationThreadDetails {
  senderIdentifier: string;
  clientInfo?: {
    name: string;
    document: string;
    phone: string;
    address: string;
    city: string;
  } | null;
  contractInfo?: {
    id: string;
    contractNumber: string;
    pppoeUser: string;
    planName: string;
    planSpeed: string;
    serviceStatus: string;
    billingStatus: string;
    nodeName: string;
    ipAddress?: string | null;
    macAddress?: string | null;
  } | null;
  messages: ChatThreadMessage[];
  transferredToHuman: boolean;
}

/**
 * Retrieves the grouped list of WhatsApp conversations for the current tenant.
 */
export async function getWhatsAppConversations(
  brandId?: string,
  searchQuery?: string
): Promise<ApiResponse<WhatsAppConversationSummary[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const { brandFilter } = resolveTenantBrand(session, brandId);

    // Fetch logs ordered by creation descending
    const logs = await prisma.aiConversationLog.findMany({
      where: brandFilter,
      orderBy: { createdAt: "desc" },
      include: {
        contract: {
          include: {
            client: true,
          },
        },
      },
      take: 500,
    });

    const conversationMap = new Map<string, WhatsAppConversationSummary>();

    for (const log of logs) {
      const sender = log.senderIdentifier;
      if (!conversationMap.has(sender)) {
        const client = log.contract?.client;
        const lastIsOperator = log.channel === "OPERATOR";
        const lastMessage = lastIsOperator
          ? log.aiResponse
          : log.userMessage || log.aiResponse;

        const rawTools = log.toolsInvoked as Record<string, unknown> | null;
        const sess = rawTools?._session as
          | { titular?: string; contractNumber?: string }
          | undefined;

        const resolvedName =
          client?.fullName ||
          sess?.titular ||
          `Abonado (${sender})`;
        const resolvedContract =
          log.contract?.contractNumber || sess?.contractNumber || null;

        conversationMap.set(sender, {
          senderIdentifier: sender,
          clientName: resolvedName,
          phone: client?.phonePrimary || sender,
          contractNumber: resolvedContract,
          contractId: log.contract?.id ?? null,
          serviceStatus: log.contract?.serviceStatus || "DESCONOCIDO",
          billingStatus: log.contract?.billingStatus || "ACTIVO",
          lastMessage: lastMessage.substring(0, 120),
          lastMessageAt: log.createdAt.toISOString(),
          lastSenderRole: lastIsOperator
            ? "operator"
            : log.aiResponse
              ? "bot"
              : "client",
          transferredToHuman: log.transferredToHuman,
          messageCount: 1,
        });
      } else {
        const existing = conversationMap.get(sender)!;
        existing.messageCount += 1;
        if (log.transferredToHuman) {
          existing.transferredToHuman = true;
        }

        const rawTools = log.toolsInvoked as Record<string, unknown> | null;
        const sess = rawTools?._session as
          | { titular?: string; contractNumber?: string }
          | undefined;

        if (!existing.contractNumber && sess?.contractNumber) {
          existing.contractNumber = sess.contractNumber;
        }
        if (existing.clientName.startsWith("Abonado") && sess?.titular) {
          existing.clientName = sess.titular;
        }
      }
    }

    let summaries = Array.from(conversationMap.values());

    if (searchQuery && searchQuery.trim()) {
      const norm = searchQuery.toLowerCase().trim();
      summaries = summaries.filter(
        (c) =>
          c.senderIdentifier.toLowerCase().includes(norm) ||
          c.clientName.toLowerCase().includes(norm) ||
          (c.contractNumber && c.contractNumber.toLowerCase().includes(norm))
      );
    }

    return {
      success: true,
      data: summaries,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener conversaciones.";
    return { success: false, error: message };
  }
}

/**
 * Retrieves the message thread and NOC telemetry for a specific conversation.
 */
export async function getConversationThread(
  senderIdentifier: string,
  brandId?: string
): Promise<ApiResponse<ConversationThreadDetails>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const { brandFilter, targetBrandId } = resolveTenantBrand(session, brandId);

    const logs = await prisma.aiConversationLog.findMany({
      where: {
        ...brandFilter,
        senderIdentifier,
      },
      orderBy: { createdAt: "asc" },
      include: {
        contract: {
          include: {
            client: true,
            plan: true,
            node: true,
          },
        },
      },
    });

    if (logs.length === 0) {
      return {
        success: false,
        error: "Conversación no encontrada.",
      };
    }

    // Attempt to locate associated contract
    let matchedContract = logs.find((l) => l.contract)?.contract || null;

    // Fallback A: Inspect session in conversation logs (contractNumber or clientDocument)
    if (!matchedContract) {
      for (const log of logs) {
        const rawTools = log.toolsInvoked as Record<string, unknown> | null;
        const sess = rawTools?._session as
          | { contractNumber?: string; clientDocument?: string }
          | undefined;

        if (sess?.contractNumber) {
          matchedContract = await prisma.contract.findFirst({
            where: {
              ...(targetBrandId ? { brandId: targetBrandId } : {}),
              contractNumber: sess.contractNumber,
            },
            include: {
              plan: true,
              node: true,
              client: true,
            },
          });
          if (matchedContract) break;
        }

        if (sess?.clientDocument) {
          matchedContract = await prisma.contract.findFirst({
            where: {
              ...(targetBrandId ? { brandId: targetBrandId } : {}),
              client: { documentNumber: sess.clientDocument },
            },
            include: {
              plan: true,
              node: true,
              client: true,
            },
            orderBy: { createdAt: "desc" },
          });
          if (matchedContract) break;
        }
      }
    }

    // Fallback B: look up by phone in clients
    if (!matchedContract && targetBrandId) {
      const cleanDigits = senderIdentifier.replace(/\D/g, "");
      const clientWithContract = await prisma.client.findFirst({
        where: {
          brandId: targetBrandId,
          OR: [
            { phonePrimary: { contains: cleanDigits.slice(-7) } },
            { phoneSecondary: { contains: cleanDigits.slice(-7) } },
          ],
        },
      });

      if (clientWithContract) {
        matchedContract = await prisma.contract.findFirst({
          where: { clientId: clientWithContract.id },
          include: {
            plan: true,
            node: true,
            client: true,
          },
        });
      }
    }

    const messages: ChatThreadMessage[] = [];

    for (const log of logs) {
      if (log.channel === "OPERATOR") {
        messages.push({
          id: `${log.id}-op`,
          sender: "operator",
          content: log.aiResponse,
          createdAt: log.createdAt.toISOString(),
          transferredToHuman: log.transferredToHuman,
        });
      } else {
        if (log.userMessage && log.userMessage.trim()) {
          messages.push({
            id: `${log.id}-user`,
            sender: "client",
            content: log.userMessage,
            createdAt: log.createdAt.toISOString(),
          });
        }
        if (log.aiResponse && log.aiResponse.trim()) {
          messages.push({
            id: `${log.id}-bot`,
            sender: "bot",
            content: log.aiResponse,
            createdAt: log.createdAt.toISOString(),
            toolsInvoked: log.toolsInvoked,
            transferredToHuman: log.transferredToHuman,
          });
        }
      }
    }

    const isTransferred = logs.some((l) => l.transferredToHuman);

    return {
      success: true,
      data: {
        senderIdentifier,
        clientInfo: matchedContract?.client
          ? {
              name: matchedContract.client.fullName,
              document:
                `${matchedContract.client.documentType || "CC"} ` +
                `${matchedContract.client.documentNumber}`,
              phone: matchedContract.client.phonePrimary,
              address:
                matchedContract.client.address || matchedContract.address,
              city: matchedContract.client.city || matchedContract.city,
            }
          : null,
        contractInfo: matchedContract
          ? {
              id: matchedContract.id,
              contractNumber: matchedContract.contractNumber,
              pppoeUser: matchedContract.pppoeUser,
              planName: matchedContract.plan?.name || "Sin plan",
              planSpeed: matchedContract.plan?.rateLimit || "N/D",
              serviceStatus: matchedContract.serviceStatus,
              billingStatus: matchedContract.billingStatus,
              nodeName: matchedContract.node?.name || "Sin nodo",
              ipAddress: matchedContract.ipAddress,
              macAddress: matchedContract.macAddress,
            }
          : null,
        messages,
        transferredToHuman: isTransferred,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al obtener hilo de chat.";
    return { success: false, error: message };
  }
}

/**
 * Sends a human operator message to the customer via WhatsApp and logs it.
 */
export async function sendOperatorMessageAction(data: {
  senderIdentifier: string;
  message: string;
  contractId?: string | null;
  brandId?: string;
}): Promise<ApiResponse<ChatThreadMessage>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const text = data.message.trim();
    if (!text) {
      return { success: false, error: "El mensaje no puede estar vacío." };
    }

    const { targetBrandId } = resolveTenantBrand(session, data.brandId);
    if (!targetBrandId) {
      return { success: false, error: "No se identificó la marca asociada." };
    }

    const brand = await prisma.brand.findUnique({
      where: { id: targetBrandId },
      select: {
        slug: true,
        whatsappConfigs: {
          select: { instanceName: true },
          take: 1,
        },
      },
    });
    const instanceName =
      brand?.whatsappConfigs?.[0]?.instanceName ||
      (brand?.slug ? `isp_${brand.slug.toLowerCase().trim()}` : undefined);

    // 1. Log to database as OPERATOR reply
    const newLog = await prisma.aiConversationLog.create({
      data: {
        brandId: targetBrandId,
        contractId: data.contractId ?? null,
        channel: "OPERATOR",
        senderIdentifier: data.senderIdentifier,
        userMessage: "",
        aiResponse: text,
        transferredToHuman: true,
      },
    });

    // 2. Outbound WhatsApp delivery via Evolution API if phone formatted
    const cleanDigits = data.senderIdentifier.replace(/\D/g, "");
    if (cleanDigits.length >= 10) {
      await sendTestWhatsappMessage(
        cleanDigits,
        text,
        instanceName
      ).catch(() => null);
    }

    return {
      success: true,
      data: {
        id: `${newLog.id}-op`,
        sender: "operator",
        content: text,
        createdAt: newLog.createdAt.toISOString(),
        transferredToHuman: true,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al enviar mensaje.";
    return { success: false, error: message };
  }
}

/**
 * Toggles human transfer status for an entire conversation.
 */
export async function toggleHumanTransferAction(
  senderIdentifier: string,
  transferredToHuman: boolean,
  brandId?: string
): Promise<ApiResponse<boolean>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const { brandFilter } = resolveTenantBrand(session, brandId);

    await prisma.aiConversationLog.updateMany({
      where: {
        ...brandFilter,
        senderIdentifier,
      },
      data: {
        transferredToHuman,
      },
    });

    return {
      success: true,
      data: transferredToHuman,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error al actualizar estado.";
    return { success: false, error: message };
  }
}
