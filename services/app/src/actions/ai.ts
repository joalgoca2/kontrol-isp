"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendAiMessageSchema } from "@/lib/validations/ai";
import { processAiMessage } from "@/lib/ai/engine";
import type { UserContextForAi } from "@/lib/ai/knowledge";
import { processIspMessage } from "@/lib/ai/isp-engine";
import type { ApiResponse, AiChatMessage } from "@/types";

export async function sendAiChatMessageAction(
  data: unknown
): Promise<ApiResponse<AiChatMessage>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autorizado. Inicia sesión." };
    }

    const validation = sendAiMessageSchema.safeParse(data);
    if (!validation.success) {
      const issue = validation.error.issues[0]?.message || "Datos no válidos.";
      return { success: false, error: issue };
    }

    const { message, history = [] } = validation.data;

    // Resolve brand ID
    let brandId = session.user.brandId;
    if (!brandId) {
      const firstBrand = await prisma.brand.findFirst({ select: { id: true } });
      brandId = firstBrand?.id || "default";
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { name: true, currency: true },
    });

    const userContext: UserContextForAi = {
      userName: session.user.name,
      userEmail: session.user.email,
      userRole: session.user.roles?.[0] || "ADMIN",
      brandName: brand?.name || "Kontrol ISP",
      brandCurrency: brand?.currency || "COP",
      hasAiAgentAccess: true,
      locale: session.user.locale || "es",
    };

    const formattedHistory: AiChatMessage[] = history.map((h, i) => ({
      id: `hist-${i}`,
      role: h.role,
      content: h.content,
      createdAt: new Date().toISOString(),
    }));

    const response = await processAiMessage(
      message,
      userContext,
      formattedHistory
    );

    const assistantMessage: AiChatMessage = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: response.message,
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: assistantMessage,
    };
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Error al procesar el mensaje.";
    return { success: false, error: errorMsg };
  }
}

export async function sendSimulatorMessageAction(params: {
  message: string;
  brandId?: string;
  senderIdentifier?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<ApiResponse<{ message: string }>> {
  try {
    let session = null;
    try {
      session = await auth();
    } catch (_authErr) {
      // CLI / background invocation
    }

    let brandId = params.brandId || session?.user?.brandId;
    if (!brandId || brandId === "ALL") {
      const firstBrand = await prisma.brand.findFirst({ select: { id: true } });
      brandId = firstBrand?.id || "default";
    }

    const senderIdentifier =
      params.senderIdentifier?.trim() || "573001234567";

    const formattedHistory: AiChatMessage[] | undefined = params.history?.map(
      (h, idx) => ({
        id: `sim-hist-${idx}`,
        role: h.role,
        content: h.content,
        createdAt: new Date().toISOString(),
      })
    );

    const response = await processIspMessage({
      userMessage: params.message.trim(),
      brandId,
      senderIdentifier,
      history: formattedHistory,
    });

    return {
      success: true,
      data: { message: response.message },
    };
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Error en simulador de bot.";
    return { success: false, error: errorMsg };
  }
}
