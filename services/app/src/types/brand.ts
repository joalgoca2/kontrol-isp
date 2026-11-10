import type { PaymentGatewayConfig } from "./payment-gateway";

export interface Brand {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  taxId?: string | null;
  logo?: string | null;
  apiKey?: string | null;
  isActive: boolean;
  locale: string;
  timezone: string;
  currency: string;
  billingWebhookUrl?: string | null;
  generalWebhookUrl?: string | null;
  paymentGateways?: PaymentGatewayConfig[];
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface BrandWithCounts extends Brand {
  _count?: {
    users: number;
    mikrotikNodes: number;
    clients: number;
    contracts: number;
  };
}

export interface BrandsPaginatedResponse {
  brands: BrandWithCounts[];
  total: number;
  totalPages: number;
  activeCount: number;
  inactiveCount: number;
  withNodesCount: number;
}
