import { z } from "zod";
import { validateAndFormatPhone } from "@/lib/evolution-api";

export const paymentSchema = z
  .object({
    isExternal: z.boolean().default(false),
    studentId: z.string().trim().optional(),
    externalPayerName: z.string().trim().optional(),
    whatsappRecipient: z.string().trim().optional(),
    conceptType: z.enum(
      ["MENSUALIDAD", "UNIFORME", "CURSO", "EXAMEN_DE_GRADO", "OTRO"],
      { required_error: "Selecciona el concepto del cobro" }
    ),
    conceptDescription: z
      .string()
      .trim()
      .min(3, "La descripción debe tener al menos 3 caracteres")
      .max(150, "La descripción no puede exceder 150 caracteres"),
    currency: z.enum(["COP", "USD"]).default("COP"),
    amount: z
      .number({ invalid_type_error: "Ingresa un monto numérico válido" }),
    amountCop: z.number().optional(),
    exchangeRate: z.number().optional(),
    paymentMethod: z.enum(
      ["EFECTIVO", "NEQUI", "DAVIPLATA", "TRANSFERENCIA_BANCARIA"],
      { required_error: "Selecciona el método de pago" }
    ),
    sendWhatsapp: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.currency === "COP") {
      if (data.amount < 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El monto mínimo es $1.000 COP",
          path: ["amount"],
        });
      }
      if (data.amount > 50000000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Monto máximo superado ($50.000.000 COP)",
          path: ["amount"],
        });
      }
    } else if (data.currency === "USD") {
      if (data.amount < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El monto mínimo es $1 USD",
          path: ["amount"],
        });
      }
      if (data.amount > 10000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Monto máximo superado ($10.000 USD)",
          path: ["amount"],
        });
      }
      if (!data.exchangeRate || data.exchangeRate < 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresa una tasa de cambio válida (ej. 4.100)",
          path: ["exchangeRate"],
        });
      }
    }

    if (data.isExternal) {
      if (!data.externalPayerName || data.externalPayerName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresa el nombre completo del pagador externo",
          path: ["externalPayerName"],
        });
      }
      if (
        !data.whatsappRecipient ||
        !validateAndFormatPhone(data.whatsappRecipient).isValid
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "El número debe incluir código de país (ej. 573XXXXXXXXX para Colombia)",
          path: ["whatsappRecipient"],
        });
      }
    } else {
      if (!data.studentId || data.studentId.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debes seleccionar un alumno",
          path: ["studentId"],
        });
      }
    }
  });

export type PaymentSchemaType = z.infer<typeof paymentSchema>;

