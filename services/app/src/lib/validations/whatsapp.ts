import { z } from "zod";

export const saveWhatsappConfigSchema = z.object({
  brandId: z.string().min(1, "Marca requerida"),
  provider: z.enum(["EVOLUTION", "META_CLOUD"]).default("EVOLUTION"),
  instanceName: z.string().trim().max(100).optional().nullable(),
  evolutionToken: z.string().trim().max(255).optional().nullable(),
  metaPhoneNumberId: z.string().trim().max(100).optional().nullable(),
  metaWabaId: z.string().trim().max(100).optional().nullable(),
  metaAccessToken: z.string().trim().max(2000).optional().nullable(),
  metaWebhookVerifyToken: z.string().trim().max(255).optional().nullable(),
  metaAppSecret: z.string().trim().max(255).optional().nullable(),
});

export type SaveWhatsappConfigInput = z.infer<
  typeof saveWhatsappConfigSchema
>;

