import type { TechnologyType } from "./contract";

export interface Plan {
  id: string;
  brandId: string;
  name: string;
  downloadSpeedMbps: number;
  uploadSpeedMbps: number;
  rateLimit: string;
  priceCop: number;
  billingDay: number;
  mikrotikProfile?: string | null;
  technology: TechnologyType;
  isActive: boolean;
  contractsCount?: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PlansPaginatedResponse {
  plans: Plan[];
  total: number;
  totalPages: number;
  activeCount: number;
  inactiveCount: number;
  fiberCount: number;
  withoutContractsCount: number;
}
