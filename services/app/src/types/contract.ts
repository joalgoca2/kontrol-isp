import type { DocumentType } from "./client";

export type TechnologyType = "FIBRA_OPTICA" | "MICROONDAS";

export type BillingStatus =
  | "ACTIVO"
  | "AVISO_VENCIMIENTO"
  | "SUSPENDIDO_MORA"
  | "RETIRADO"
  | "CORTESIA";

export type ServiceStatus = "ONLINE" | "OFFLINE" | "DESCONOCIDO";

export interface ContractEquipment {
  id: string;
  contractId: string;
  routerBrand?: string | null;
  routerModel?: string | null;
  routerMac?: string | null;
  routerSerial?: string | null;
  antennaType?: string | null;
  antennaMac?: string | null;
  antennaIp?: string | null;
  cableMeters: number;
  opticalPowerRx?: number | null;
  onuTemperature?: number | null;
  fiberPort?: string | null;
  notes?: string | null;
  installationDate: string | Date;
}

export interface Contract {
  id: string;
  brandId: string;
  clientId: string;
  contractNumber: string;
  contractDate: string | Date;
  address: string;
  neighborhood?: string | null;
  city: string;
  department: string;
  latitude?: number | null;
  longitude?: number | null;
  nodeId: string;
  planId: string;
  technology: TechnologyType;
  pppoeUser: string;
  pppoePassword?: string | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  billingStatus: BillingStatus;
  serviceStatus: ServiceStatus;
  equipment?: ContractEquipment | null;
  client?: {
    id: string;
    clientCode?: string | null;
    fullName: string;
    documentType: DocumentType;
    documentNumber: string;
    phonePrimary: string;
  };
  node?: {
    id: string;
    name: string;
    code: string;
    location: string;
  };
  plan?: {
    id: string;
    name: string;
    rateLimit: string;
    priceCop: number;
  };
  _count?: {
    payments: number;
    tickets: number;
  };
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ContractsPaginatedResponse {
  contracts: Contract[];
  total: number;
  totalPages: number;
  activeCount: number;
  warningCount: number;
  suspendedCount: number;
}
