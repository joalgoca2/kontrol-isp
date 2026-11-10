export type PaymentMethod =
  | "EFECTIVO"
  | "EFECTY"
  | "NEQUI"
  | "DAVIPLATA"
  | "BANCOLOMBIA"
  | "PAYU"
  | "DAVIPAY"
  | "OTRO";

export type PaymentStatus = "APROBADO" | "PENDIENTE" | "RECHAZADO" | "ANULADO";

export interface Payment {
  id: string;
  brandId: string;
  contractId: string;
  receiptNumber: number;
  invoiceNumber?: string | null;
  periodBilled: string;
  amount: number;
  paymentMethod: PaymentMethod;
  externalReference?: string | null;
  recordedByUserId: string;
  status: PaymentStatus;
  notes?: string | null;
  contract?: {
    id: string;
    contractNumber: string;
    address: string;
    pppoeUser?: string;
    client?: {
      id: string;
      fullName: string;
      documentNumber: string;
      phonePrimary: string;
    };
    plan?: {
      id: string;
      name: string;
      priceCop: number;
    };
  };
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface PaymentsPaginatedResponse {
  payments: Payment[];
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  voidedCount: number;
  totalApprovedAmount: number;
  totalPages: number;
  currentPage: number;
}
