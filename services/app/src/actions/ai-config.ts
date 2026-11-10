"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { brandAiConfigSchema } from "@/lib/validations/ai";
import { AI_AGENT_TEMPLATES, DEFAULT_CHATBOT_FLOW } from "@/lib/ai/templates";
import type { ApiResponse, BrandAiConfig } from "@/types";

export async function getBrandAiConfigAction(
  brandId: string
): Promise<ApiResponse<BrandAiConfig>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const config = await prisma.brandAiConfig.findUnique({
      where: { brandId },
    });

    if (config) {
      const typedConfig = config as unknown as BrandAiConfig;
      if (!typedConfig.flowConfig) {
        typedConfig.flowConfig = DEFAULT_CHATBOT_FLOW;
      }
      return {
        success: true,
        data: typedConfig,
      };
    }

    // Default template fallback if not yet created in DB
    const defaultTemplate = AI_AGENT_TEMPLATES.BAILEYS_AI;
    const fallback: BrandAiConfig = {
      id: "pending-save",
      brandId,
      templateType: defaultTemplate.type,
      botName: defaultTemplate.defaultBotName,
      tone: defaultTemplate.recommendedTone,
      systemPrompt: defaultTemplate.defaultSystemPrompt,
      flowConfig: DEFAULT_CHATBOT_FLOW,
      allowDiagnosticMikrotik: defaultTemplate.allowDiagnosticMikrotik,
      allowKickSession: defaultTemplate.allowKickSession,
      allowGracePromise: defaultTemplate.allowGracePromise,
      graceHours: 24,
      allowScheduleVisits: defaultTemplate.allowScheduleVisits,
      morningVisitSlots: 4,
      afternoonVisitSlots: 4,
      allowBillingBalance: defaultTemplate.allowBillingBalance,
      allowTransferHuman: defaultTemplate.allowTransferHuman,
      allowCheckVisits: defaultTemplate.allowCheckVisits,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return {
      success: true,
      data: fallback,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al consultar configuración de IA.";
    return { success: false, error: message };
  }
}

export async function saveBrandAiConfigAction(
  rawInput: unknown
): Promise<ApiResponse<BrandAiConfig>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    const parsed = brandAiConfigSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Datos de configuración no válidos.",
      };
    }

    const data = parsed.data;
    const isSuperAdmin = Boolean(
      session.user.roles?.includes("SUPER_ADMIN")
    );

    if (!isSuperAdmin && session.user.brandId !== data.brandId) {
      return {
        success: false,
        error:
          "Solo el configurador global o el administrador de marca " +
          "puede editar esta configuración.",
      };
    }

    const actor = session.user.email ?? null;

    const flowConfigJson = data.flowConfig
      ? (data.flowConfig as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    const saved = await prisma.brandAiConfig.upsert({
      where: { brandId: data.brandId },
      create: {
        brandId: data.brandId,
        templateType: data.templateType,
        botName: data.botName,
        tone: data.tone,
        systemPrompt: data.systemPrompt || null,
        flowConfig: flowConfigJson,
        allowDiagnosticMikrotik: data.allowDiagnosticMikrotik,
        allowKickSession: data.allowKickSession,
        allowGracePromise: data.allowGracePromise,
        graceHours: data.graceHours,
        allowScheduleVisits: data.allowScheduleVisits,
        morningVisitSlots: data.morningVisitSlots,
        afternoonVisitSlots: data.afternoonVisitSlots,
        allowBillingBalance: data.allowBillingBalance,
        allowTransferHuman: data.allowTransferHuman,
        allowCheckVisits: data.allowCheckVisits,
        createdBy: actor,
        updatedBy: actor,
      },
      update: {
        templateType: data.templateType,
        botName: data.botName,
        tone: data.tone,
        systemPrompt: data.systemPrompt || null,
        flowConfig: flowConfigJson,
        allowDiagnosticMikrotik: data.allowDiagnosticMikrotik,
        allowKickSession: data.allowKickSession,
        allowGracePromise: data.allowGracePromise,
        graceHours: data.graceHours,
        allowScheduleVisits: data.allowScheduleVisits,
        morningVisitSlots: data.morningVisitSlots,
        afternoonVisitSlots: data.afternoonVisitSlots,
        allowBillingBalance: data.allowBillingBalance,
        allowTransferHuman: data.allowTransferHuman,
        allowCheckVisits: data.allowCheckVisits,
        updatedBy: actor,
      },
    });

    return {
      success: true,
      data: saved as unknown as BrandAiConfig,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al guardar configuración de IA.";
    return { success: false, error: message };
  }
}

export async function checkIspAiEnvironmentAction(): Promise<
  ApiResponse<{
    hasIspAiApiKey: boolean;
    provider: string;
    model: string;
    missingVariables: string[];
  }>
> {
  try {
    const apiKey =
      process.env.ISP_AI_API_KEY || process.env.OPENAI_API_KEY || "";
    const provider = process.env.ISP_AI_PROVIDER || "openai";
    const model = process.env.ISP_AI_MODEL || "gpt-4o-mini";
    const missingVariables: string[] = [];

    if (!apiKey) {
      missingVariables.push("ISP_AI_API_KEY");
    }

    return {
      success: true,
      data: {
        hasIspAiApiKey: Boolean(apiKey),
        provider,
        model,
        missingVariables,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al verificar credenciales de IA.";
    return { success: false, error: message };
  }
}


