import { z } from "zod";

export const paymentGatewayConfigSchema = z.object({
  id: z.string().optional(),
  brandId: z
    .string()
    .trim()
    .min(1, "El identificador de marca es requerido."),
  provider: z.enum(["DAVIPAY", "EFECTY"], {
    errorMap: () => ({ message: "Proveedor de pasarela inválido." }),
  }),
  isEnabled: z.boolean().default(false),
  isTestMode: z.boolean().default(true),

  // DaviPay / ePayco
  customerId: z
    .string()
    .trim()
    .max(100, "El ID de cliente no puede exceder 100 caracteres.")
    .nullable()
    .optional(),
  publicKey: z
    .string()
    .trim()
    .max(150, "La llave pública no puede exceder 150 caracteres.")
    .nullable()
    .optional(),
  privateKey: z
    .string()
    .trim()
    .max(255, "La llave privada no puede exceder 255 caracteres.")
    .nullable()
    .optional(),
  pKey: z
    .string()
    .trim()
    .max(255, "La clave P_KEY no puede exceder 255 caracteres.")
    .nullable()
    .optional(),

  // Efecty
  agreementCode: z
    .string()
    .trim()
    .max(50, "El código de convenio no puede exceder 50 caracteres.")
    .nullable()
    .optional(),
  secretKey: z
    .string()
    .trim()
    .max(255, "La clave secreta de API no puede exceder 255 caracteres.")
    .nullable()
    .optional(),
  validationMode: z
    .enum(["DOCUMENT", "CONTRACT_NUMBER"])
    .default("DOCUMENT"),
});

export type PaymentGatewayConfigInput = z.infer<typeof paymentGatewayConfigSchema>;

