export type TicketChannel =
  | "WHATSAPP_AI"
  | "TELEFONO"
  | "PORTAL"
  | "PRESENCIAL";

export type IssueType =
  | "CORTE_TOTAL"
  | "LENTITUD"
  | "CAMBIO_WIFI"
  | "FALLA_FISICA_LOS"
  | "CARTERA"
  | "OTRO";

export type TicketPriority = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

export type TicketStatus =
  | "ABIERTO"
  | "EN_DIAGNOSTICO_IA"
  | "TRANSFERIDO_HUMANO"
  | "VISITA_AGENDADA"
  | "RESUELTO"
  | "CERRADO";

export type VisitStatus = "AGENDADA" | "EN_RUTA" | "COMPLETADA" | "CANCELADA";

export interface SupportTicket {
  id: string;
  brandId: string;
  contractId: string;
  ticketNumber: string;
  channel: TicketChannel;
  issueType: IssueType;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  diagnosticSnapshot?: unknown;
  assignedUserId?: string | null;
  assignedUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  contract?: {
    id: string;
    contractNumber: string;
    address: string;
    pppoeUser?: string;
    client?: {
      id: string;
      clientCode?: string | null;
      fullName: string;
      documentNumber?: string;
      phonePrimary: string;
    };
    node?: {
      id: string;
      name: string;
      code: string;
    };
    plan?: {
      id: string;
      name: string;
      rateLimit: string;
    };
  };
  technicianVisits?: TechnicianVisit[];
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface TechnicianVisit {
  id: string;
  ticketId: string;
  scheduledDate: string | Date;
  technicianName: string;
  status: VisitStatus;
  notes?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface TicketsPaginatedResponse {
  tickets: SupportTicket[];
  totalCount: number;
  openCount: number;
  escalatedCount: number;
  resolvedCount: number;
  totalPages: number;
  currentPage: number;
}
