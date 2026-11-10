export type DocumentType = "CC" | "NIT" | "CE" | "PASAPORTE";

export interface Client {
  id: string;
  brandId: string;
  clientCode?: string | null;
  documentType: DocumentType;
  documentNumber: string;
  fullName: string;
  email?: string | null;
  phonePrimary: string;
  phoneSecondary?: string | null;
  address?: string | null;
  city: string;
  department: string;
  notes?: string | null;
  isActive: boolean;
  contractsCount?: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ClientsPaginatedResponse {
  clients: Client[];
  total: number;
  totalPages: number;
  activeCount: number;
  inactiveCount: number;
  withoutContractsCount: number;
}
