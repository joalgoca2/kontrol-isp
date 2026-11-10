import { z } from "zod";

export const sendAiMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "El mensaje no puede estar vacío.")
    .max(2000, "El mensaje excede el límite de 2000 caracteres."),
  contextPath: z.string().trim().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().trim().min(1).max(2000),
      })
    )
    .optional(),
});

export type SendAiMessageFormValues = z.infer<typeof sendAiMessageSchema>;

export const flowMenuOptionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1, "El ID de la opción es requerido."),
    digit: z
      .string()
      .trim()
      .min(1, "El dígito es requerido.")
      .max(5, "El dígito no puede exceder 5 caracteres."),
    title: z
      .string()
      .trim()
      .min(1, "El título de la opción no puede estar vacío.")
      .max(100, "El título no puede exceder 100 caracteres."),
    keywords: z.array(
      z
        .string()
        .trim()
        .min(1, "Palabra clave no válida.")
        .max(50, "Palabra clave demasiado larga.")
    ),
    actionType: z.enum([
      "DIAGNOSTIC_MIKROTIK",
      "KICK_PPPOE_SESSION",
      "BILLING_BALANCE",
      "PROMISE_PAYMENT",
      "SCHEDULE_VISIT",
      "TRANSFER_HUMAN",
      "CUSTOM_TEXT",
      "BRANCH_MENU",
      "GO_BACK",
    ]),
    condition: z
      .enum(["IS_MORA", "IS_ACTIVE", "ALL"])
      .optional()
      .default("ALL"),
    responseText: z
      .string()
      .trim()
      .max(1000, "La plantilla de respuesta no puede exceder 1000 caracteres.")
      .optional()
      .default(""),
    enabled: z.boolean(),
    subOptions: z.array(flowMenuOptionSchema).optional(),
  })
);

export const chatbotFlowConfigSchema = z.object({
  version: z.enum(["1.0", "2.0"]),
  historyLimit: z.number().int().min(2).max(50).optional(),
  welcomeStep: z.object({
    greeting: z
      .string()
      .trim()
      .min(1, "El saludo de bienvenida es obligatorio.")
      .max(500, "El saludo no puede exceder 500 caracteres."),
    requireIdentification: z.boolean(),
    askIdentifierPrompt: z
      .string()
      .trim()
      .min(1, "El mensaje para solicitar cédula/contrato es obligatorio.")
      .max(500, "El mensaje no puede exceder 500 caracteres."),
    notFoundMessage: z
      .string()
      .trim()
      .min(1, "El mensaje de contrato no encontrado es obligatorio.")
      .max(500, "El mensaje no puede exceder 500 caracteres."),
  }),
  menuStep: z.object({
    menuHeader: z
      .string()
      .trim()
      .min(1, "El encabezado del menú no puede estar vacío.")
      .max(500, "El encabezado no puede exceder 500 caracteres."),
    options: z
      .array(flowMenuOptionSchema)
      .min(1, "El menú debe tener al menos una opción configurada.")
      .max(25, "El menú no puede exceder 25 opciones."),
  }),
  rootNode: z.record(z.string(), z.unknown()).optional(),
  fallbackStep: z.object({
    triggerKeywords: z.array(
      z
        .string()
        .trim()
        .min(1, "Palabra clave no válida.")
        .max(50, "Palabra clave demasiado larga.")
    ),
    maxUnknownAttempts: z.number().int().min(1).max(5),
    fallbackMessage: z
      .string()
      .trim()
      .min(1, "El mensaje de fallback es obligatorio.")
      .max(500, "El mensaje no puede exceder 500 caracteres."),
    transferMessage: z
      .string()
      .trim()
      .min(1, "El mensaje de transferencia es obligatorio.")
      .max(500, "El mensaje no puede exceder 500 caracteres."),
  }),
});

export type ChatbotFlowConfigFormValues = z.infer<
  typeof chatbotFlowConfigSchema
>;

export const brandAiConfigSchema = z.object({
  brandId: z.string().min(1, "ID de marca requerido."),
  templateType: z.enum(["BAILEYS_AI", "META_CLOUD_API", "RULES_BOT"]),
  botName: z.string().trim().min(2, "Nombre de bot requerido.").max(50),
  tone: z.enum(["AMABLE", "FORMAL", "TECNICO"]),
  systemPrompt: z.string().trim().max(50000).optional().nullable(),
  flowConfig: chatbotFlowConfigSchema.optional().nullable(),
  allowDiagnosticMikrotik: z.boolean().default(true),
  allowKickSession: z.boolean().default(true),
  allowGracePromise: z.boolean().default(true),
  graceHours: z.number().int().min(1).max(72),
  allowScheduleVisits: z.boolean().default(true),
  morningVisitSlots: z.number().int().min(0).max(20),
  afternoonVisitSlots: z.number().int().min(0).max(20),
  allowBillingBalance: z.boolean().default(true),
  allowTransferHuman: z.boolean().default(true),
  allowCheckVisits: z.boolean().default(true),
});

export type BrandAiConfigFormValues = z.infer<typeof brandAiConfigSchema>;
