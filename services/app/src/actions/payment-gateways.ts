"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { encryptSecret } from "@/lib/crypto";
import { paymentGatewayConfigSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";
import type {
  PaymentGatewayConfig,
  GatewayProvider,
} from "@/types";

/**
 * Retrieves payment gateway configurations for a given brand or active session brand.
 */
export async function getPaymentGatewayConfigs(
  brandId?: string
): Promise<ApiResponse<PaymentGatewayConfig[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const targetBrandId = brandId || session.user.brandId;
    if (!targetBrandId) {
      return { success: false, error: "Identificador de marca requerido." };
    }

    const configs = await prisma.paymentGatewayConfig.findMany({
      where: { brandId: targetBrandId },
      orderBy: { provider: "asc" },
    });

    const sanitizedConfigs = configs.map((c) => ({
      ...c,
      privateKey: c.privateKey ? "••••••••••••" : null,
      pKey: c.pKey ? "••••••••••••" : null,
      secretKey: c.secretKey ? "••••••••••••" : null,
    }));

    return {
      success: true,
      data: sanitizedConfigs as unknown as PaymentGatewayConfig[],
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al obtener configuraciones de pasarelas.";
    return { success: false, error: message };
  }
}

/**
 * Creates or updates a payment gateway configuration for a brand.
 */
export async function savePaymentGatewayConfig(
  rawInput: unknown
): Promise<ApiResponse<PaymentGatewayConfig>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const validation = paymentGatewayConfigSchema.safeParse(rawInput);
    if (!validation.success) {
      const firstError =
        validation.error.issues[0]?.message || "Datos de pasarela inválidos.";
      return { success: false, error: firstError };
    }

    const data = validation.data;
    const actor = session.user.email ?? "system";

    const isPlaceholderPrivate =
      !data.privateKey || data.privateKey.includes("•••");
    const isPlaceholderPKey = !data.pKey || data.pKey.includes("•••");
    const isPlaceholderSecret =
      !data.secretKey || data.secretKey.includes("•••");

    // Encrypt sensitive secrets if new values provided
    const privateKeyEnc =
      !isPlaceholderPrivate && data.privateKey?.trim()
        ? encryptSecret(data.privateKey.trim())
        : null;
    const pKeyEnc =
      !isPlaceholderPKey && data.pKey?.trim()
        ? encryptSecret(data.pKey.trim())
        : null;
    const secretKeyEnc =
      !isPlaceholderSecret && data.secretKey?.trim()
        ? encryptSecret(data.secretKey.trim())
        : null;

    const savedConfig = await prisma.paymentGatewayConfig.upsert({
      where: {
        brandId_provider: {
          brandId: data.brandId,
          provider: data.provider,
        },
      },
      create: {
        brandId: data.brandId,
        provider: data.provider,
        isEnabled: data.isEnabled,
        isTestMode: data.isTestMode,
        customerId: data.customerId?.trim() || null,
        publicKey: data.publicKey?.trim() || null,
        privateKey: privateKeyEnc,
        pKey: pKeyEnc,
        agreementCode: data.agreementCode?.trim() || null,
        secretKey: secretKeyEnc,
        validationMode: data.validationMode,
        createdBy: actor,
        updatedBy: actor,
      },
      update: {
        isEnabled: data.isEnabled,
        isTestMode: data.isTestMode,
        customerId: data.customerId?.trim() || null,
        publicKey: data.publicKey?.trim() || null,
        ...(privateKeyEnc ? { privateKey: privateKeyEnc } : {}),
        ...(pKeyEnc ? { pKey: pKeyEnc } : {}),
        agreementCode: data.agreementCode?.trim() || null,
        ...(secretKeyEnc ? { secretKey: secretKeyEnc } : {}),
        validationMode: data.validationMode,
        updatedBy: actor,
      },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/brands");

    const sanitizedSaved = {
      ...savedConfig,
      privateKey: savedConfig.privateKey ? "••••••••••••" : null,
      pKey: savedConfig.pKey ? "••••••••••••" : null,
      secretKey: savedConfig.secretKey ? "••••••••••••" : null,
    };

    return {
      success: true,
      data: sanitizedSaved as unknown as PaymentGatewayConfig,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al guardar configuración de pasarela.";
    return { success: false, error: message };
  }
}

/**
 * Toggles a payment gateway status (enabled/disabled) on or off.
 */
export async function togglePaymentGateway(
  brandId: string,
  provider: GatewayProvider,
  isEnabled: boolean
): Promise<ApiResponse<PaymentGatewayConfig>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const actor = session.user.email ?? "system";

    const updated = await prisma.paymentGatewayConfig.upsert({
      where: {
        brandId_provider: {
          brandId,
          provider,
        },
      },
      create: {
        brandId,
        provider,
        isEnabled,
        isTestMode: true,
        createdBy: actor,
        updatedBy: actor,
      },
      update: {
        isEnabled,
        updatedBy: actor,
      },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/brands");

    return {
      success: true,
      data: updated as unknown as PaymentGatewayConfig,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al cambiar estado de pasarela.";
    return { success: false, error: message };
  }
}

