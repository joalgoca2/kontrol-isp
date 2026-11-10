"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  getEvolutionConfig,
  fetchEvolutionStatus,
  fetchEvolutionQrCode,
  logoutEvolutionInstance,
  sendTestWhatsappMessage,
  configureEvolutionWebsocket,
} from "@/lib/evolution-api";
import type { ApiResponse, WhatsappStatusData, WhatsappConfig } from "@/types";
import {
  saveWhatsappConfigSchema,
  type SaveWhatsappConfigInput,
} from "@/lib/validations/whatsapp";

async function resolveTargetBrand(
  userRoles: string[] | undefined,
  userBrandId: string | null | undefined,
  brandId?: string
) {
  const isSuperAdmin = Boolean(userRoles?.includes("SUPER_ADMIN"));
  let targetId = brandId?.trim();

  if (!isSuperAdmin) {
    if (!userBrandId) {
      return null;
    }
    targetId = userBrandId;
  }

  if (!targetId || targetId === "ALL") {
    if (userBrandId) {
      targetId = userBrandId;
    } else {
      const firstBrand = await prisma.brand.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
      targetId = firstBrand?.id;
    }
  }

  if (!targetId) return null;

  return prisma.brand.findUnique({
    where: { id: targetId },
  });
}

export async function getEvolutionStatusAction(
  brandId?: string
): Promise<ApiResponse<WhatsappStatusData>> {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return { success: false, error: "No autorizado." };
    }

    const brand = await resolveTargetBrand(
      session.user.roles,
      session.user.brandId,
      brandId
    );

    if (!brand) {
      return { success: false, error: "Marca no encontrada." };
    }

    const savedConfig = await prisma.whatsappConfig.findFirst({
      where: { brandId: brand.id },
    });

    const instanceName =
      savedConfig?.instanceName ||
      `isp_${brand.slug.toLowerCase().trim()}`;
    const { baseUrl, apiKey } = getEvolutionConfig(instanceName);
    const apiUrlConfigured = Boolean(baseUrl && baseUrl.length > 0);
    const apiKeyConfigured = Boolean(apiKey && apiKey.length > 0);

    const liveStatus = await fetchEvolutionStatus(instanceName);

    let connectionStatus = "close";
    if (liveStatus.state === "open" || liveStatus.state === "connected") {
      connectionStatus = "open";
    } else if (liveStatus.state === "connecting") {
      connectionStatus = "connecting";
    }

    const phoneNumber =
      connectionStatus === "open"
        ? liveStatus.phoneNumber || savedConfig?.phoneNumber || null
        : null;
    const qrCode =
      connectionStatus === "open" ? null : savedConfig?.qrCode || null;

    if (savedConfig) {
      await prisma.whatsappConfig.update({
        where: { id: savedConfig.id },
        data: {
          instanceName,
          connectionStatus,
          phoneNumber,
          qrCode,
        },
      });
    } else {
      await prisma.whatsappConfig.create({
        data: {
          brandId: brand.id,
          instanceName,
          connectionStatus,
          phoneNumber,
          qrCode,
        },
      });
    }

    return {
      success: true,
      data: {
        instanceName,
        evolutionToken: savedConfig?.evolutionToken || null,
        connectionStatus,
        phoneNumber,
        qrCode,
        apiUrlConfigured,
        apiKeyConfigured,
        brandId: brand.id,
        brandName: brand.name,
      },
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Error al obtener estado";
    return { success: false, error: msg };
  }
}

export async function connectEvolutionAction(
  brandId?: string
): Promise<ApiResponse<WhatsappStatusData>> {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return { success: false, error: "No autorizado." };
    }

    const brand = await resolveTargetBrand(
      session.user.roles,
      session.user.brandId,
      brandId
    );

    if (!brand) {
      return { success: false, error: "Marca no encontrada." };
    }

    const savedConfig = await prisma.whatsappConfig.findFirst({
      where: { brandId: brand.id },
    });

    const instanceName =
      savedConfig?.instanceName ||
      `isp_${brand.slug.toLowerCase().trim()}`;
    const { baseUrl, apiKey } = getEvolutionConfig(instanceName);
    if (!baseUrl || !apiKey) {
      return {
        success: false,
        error: "Faltan variables EVOLUTION_API_URL o EVOLUTION_API_KEY",
      };
    }

    const qrRes = await fetchEvolutionQrCode(instanceName);

    // Ensure WebSocket is configured for real-time upsert events
    await configureEvolutionWebsocket(instanceName);

    if (!qrRes.success) {
      return {
        success: false,
        error: qrRes.error || "No se pudo generar el código QR",
      };
    }

    const connectionStatus = qrRes.status || "connecting";
    const qrCode = qrRes.qrCode || null;

    if (savedConfig) {
      await prisma.whatsappConfig.update({
        where: { id: savedConfig.id },
        data: {
          instanceName,
          connectionStatus,
          qrCode,
        },
      });
    } else {
      await prisma.whatsappConfig.create({
        data: {
          brandId: brand.id,
          instanceName,
          connectionStatus,
          qrCode,
        },
      });
    }

    return {
      success: true,
      data: {
        instanceName,
        evolutionToken: savedConfig?.evolutionToken || null,
        connectionStatus,
        qrCode,
        apiUrlConfigured: true,
        apiKeyConfigured: true,
        brandId: brand.id,
        brandName: brand.name,
      },
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Error al conectar WhatsApp";
    return { success: false, error: msg };
  }
}

export async function disconnectEvolutionAction(
  brandId?: string
): Promise<ApiResponse<boolean>> {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return { success: false, error: "No autorizado." };
    }

    const brand = await resolveTargetBrand(
      session.user.roles,
      session.user.brandId,
      brandId
    );

    if (!brand) {
      return { success: false, error: "Marca no encontrada." };
    }

    const savedConfig = await prisma.whatsappConfig.findFirst({
      where: { brandId: brand.id },
    });

    const instanceName =
      savedConfig?.instanceName ||
      `isp_${brand.slug.toLowerCase().trim()}`;
    await logoutEvolutionInstance(instanceName);

    if (savedConfig) {
      await prisma.whatsappConfig.update({
        where: { id: savedConfig.id },
        data: {
          instanceName,
          connectionStatus: "close",
          phoneNumber: null,
          qrCode: null,
        },
      });
    } else {
      await prisma.whatsappConfig.create({
        data: {
          brandId: brand.id,
          instanceName,
          connectionStatus: "close",
          phoneNumber: null,
          qrCode: null,
        },
      });
    }

    return { success: true, data: true };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Error al desconectar";
    return { success: false, error: msg };
  }
}

export async function sendTestMessageAction(
  recipientPhone: string,
  brandId?: string
): Promise<ApiResponse<{ messageId?: string }>> {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return { success: false, error: "No autorizado." };
    }

    if (!recipientPhone || recipientPhone.trim().length < 7) {
      return {
        success: false,
        error: "Ingresa un número de celular válido",
      };
    }

    const brand = await resolveTargetBrand(
      session.user.roles,
      session.user.brandId,
      brandId
    );

    if (!brand) {
      return { success: false, error: "Marca no encontrada." };
    }

    const savedConfig = await prisma.whatsappConfig.findFirst({
      where: { brandId: brand.id },
    });

    const instanceName =
      savedConfig?.instanceName ||
      `isp_${brand.slug.toLowerCase().trim()}`;
    const brandLabel = brand.name || "Kontrol ISP";

    const testText =
      `🌐 *${brandLabel}*\n` +
      `✅ *Mensaje de Prueba de Notificaciones WhatsApp*\n\n` +
      `¡La conexión con la instancia (${instanceName}) funciona correctamente!`;

    const res = await sendTestWhatsappMessage(
      recipientPhone,
      testText,
      instanceName
    );

    if (!res.success) {
      return {
        success: false,
        error: res.error || "Falló el envío del mensaje",
      };
    }

    return {
      success: true,
      data: { messageId: res.messageId },
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Error enviando prueba";
    return { success: false, error: msg };
  }
}

export async function getWhatsappFullConfigAction(
  brandId?: string
): Promise<ApiResponse<WhatsappConfig>> {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return { success: false, error: "No autorizado." };
    }

    const brand = await resolveTargetBrand(
      session.user.roles,
      session.user.brandId,
      brandId
    );

    if (!brand) {
      return { success: false, error: "Marca no encontrada." };
    }

    const config = await prisma.whatsappConfig.findFirst({
      where: { brandId: brand.id },
    });

    if (!config) {
      const fallback: WhatsappConfig = {
        id: "",
        brandId: brand.id,
        provider: "EVOLUTION",
        instanceName: `isp_${brand.slug.toLowerCase().trim()}`,
        evolutionToken: null,
        metaPhoneNumberId: null,
        metaWabaId: null,
        metaAccessToken: null,
        metaWebhookVerifyToken: null,
        metaAppSecret: null,
        phoneNumber: null,
        connectionStatus: "close",
        qrCode: null,
        updatedAt: new Date(),
      };
      return { success: true, data: fallback };
    }

    return {
      success: true,
      data: {
        id: config.id,
        brandId: config.brandId,
        provider:
          (config.provider as "EVOLUTION" | "META_CLOUD") || "EVOLUTION",
        instanceName: config.instanceName,
        evolutionToken: config.evolutionToken,
        metaPhoneNumberId: config.metaPhoneNumberId,
        metaWabaId: config.metaWabaId,
        metaAccessToken: config.metaAccessToken,
        metaWebhookVerifyToken: config.metaWebhookVerifyToken,
        metaAppSecret: config.metaAppSecret,
        phoneNumber: config.phoneNumber,
        connectionStatus: config.connectionStatus,
        qrCode: config.qrCode,
        updatedAt: config.updatedAt,
      },
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Error al obtener configuración";
    return { success: false, error: msg };
  }
}

export async function saveWhatsappFullConfigAction(
  rawInput: SaveWhatsappConfigInput
): Promise<ApiResponse<WhatsappConfig>> {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return { success: false, error: "No autorizado." };
    }

    const parsed = saveWhatsappConfigSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || "Datos inválidos";
      return { success: false, error: firstErr };
    }

    const input = parsed.data;

    const brand = await resolveTargetBrand(
      session.user.roles,
      session.user.brandId,
      input.brandId
    );

    if (!brand) {
      return { success: false, error: "Marca no encontrada." };
    }

    const existing = await prisma.whatsappConfig.findFirst({
      where: { brandId: brand.id },
    });

    const instanceName =
      input.instanceName?.trim() ||
      existing?.instanceName ||
      `isp_${brand.slug.toLowerCase().trim()}`;

    const updateData = {
      provider: input.provider,
      instanceName,
      evolutionToken: input.evolutionToken?.trim() || null,
      metaPhoneNumberId: input.metaPhoneNumberId?.trim() || null,
      metaWabaId: input.metaWabaId?.trim() || null,
      metaAccessToken: input.metaAccessToken?.trim() || null,
      metaWebhookVerifyToken: input.metaWebhookVerifyToken?.trim() || null,
      metaAppSecret: input.metaAppSecret?.trim() || null,
    };

    let saved = null;
    if (existing) {
      saved = await prisma.whatsappConfig.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      saved = await prisma.whatsappConfig.create({
        data: {
          brandId: brand.id,
          ...updateData,
          connectionStatus: "close",
        },
      });
    }

    return {
      success: true,
      data: {
        id: saved.id,
        brandId: saved.brandId,
        provider:
          (saved.provider as "EVOLUTION" | "META_CLOUD") || "EVOLUTION",
        instanceName: saved.instanceName,
        evolutionToken: saved.evolutionToken,
        metaPhoneNumberId: saved.metaPhoneNumberId,
        metaWabaId: saved.metaWabaId,
        metaAccessToken: saved.metaAccessToken,
        metaWebhookVerifyToken: saved.metaWebhookVerifyToken,
        metaAppSecret: saved.metaAppSecret,
        phoneNumber: saved.phoneNumber,
        connectionStatus: saved.connectionStatus,
        qrCode: saved.qrCode,
        updatedAt: saved.updatedAt,
      },
    };
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Error al guardar configuración";
    return { success: false, error: msg };
  }
}
