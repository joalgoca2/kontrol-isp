import { z } from "zod";

export const brandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre comercial debe tener al menos 2 caracteres.")
    .max(100, "El nombre comercial no puede exceder 100 caracteres."),
  slug: z
    .string()
    .trim()
    .min(2, "El slug debe tener al menos 2 caracteres.")
    .max(50, "El slug no puede exceder 50 caracteres.")
    .regex(/^[a-z0-9-]+$/, "El slug solo permite minúsculas, números y guiones."),
  legalName: z
    .string()
    .trim()
    .max(150, "La razón social no puede exceder 150 caracteres.")
    .nullable()
    .optional(),
  taxId: z
    .string()
    .trim()
    .max(50, "El NIT / Identificación fiscal no puede exceder 50 caracteres.")
    .nullable()
    .optional(),
  logo: z
    .string()
    .trim()
    .max(255, "La URL del logo no puede exceder 255 caracteres.")
    .nullable()
    .optional(),
  apiKey: z
    .string()
    .trim()
    .max(120, "La clave API no puede exceder 120 caracteres.")
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  currency: z
    .string()
    .trim()
    .min(2, "La moneda debe tener al menos 2 caracteres.")
    .max(10, "El código de moneda no puede exceder 10 caracteres."),
  timezone: z
    .string()
    .trim()
    .min(2, "La zona horaria debe tener al menos 2 caracteres.")
    .max(50, "La zona horaria no puede exceder 50 caracteres."),
  locale: z
    .string()
    .trim()
    .min(2, "El idioma debe tener al menos 2 caracteres.")
    .max(10, "El código de idioma no puede exceder 10 caracteres."),
  billingWebhookUrl: z
    .string()
    .trim()
    .max(255, "La URL del webhook no puede exceder 255 caracteres.")
    .nullable()
    .optional(),
  generalWebhookUrl: z
    .string()
    .trim()
    .max(255, "La URL del webhook no puede exceder 255 caracteres.")
    .nullable()
    .optional(),
});

export type BrandInput = z.infer<typeof brandSchema>;
