export type WhatsappProvider = "EVOLUTION" | "META_CLOUD";

export interface WhatsappConfig {
  id: string;
  brandId: string;
  provider: WhatsappProvider;
  instanceName: string;
  evolutionToken?: string | null;
  metaPhoneNumberId?: string | null;
  metaWabaId?: string | null;
  metaAccessToken?: string | null;
  metaWebhookVerifyToken?: string | null;
  metaAppSecret?: string | null;
  phoneNumber?: string | null;
  connectionStatus: string;
  qrCode?: string | null;
  updatedAt: string | Date;
}

export interface WhatsappStatusData {
  provider?: WhatsappProvider;
  instanceName: string;
  evolutionToken?: string | null;
  metaPhoneNumberId?: string | null;
  connectionStatus: string;
  phoneNumber?: string | null;
  qrCode?: string | null;
  apiUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  brandId?: string;
  brandName?: string;
}

