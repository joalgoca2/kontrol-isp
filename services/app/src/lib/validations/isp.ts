import { z } from "zod";

export const mikrotikNodeSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1, "La marca es requerida."),
  name: z
    .string()
    .trim()
    .min(2, "Nombre del nodo: Mínimo 2 caracteres.")
    .max(100, "Nombre del nodo: Máximo 100 caracteres."),
  code: z
    .string()
    .trim()
    .min(2, "Código del nodo: Mínimo 2 caracteres.")
    .max(30, "Código del nodo: Máximo 30 caracteres."),
  location: z
    .string()
    .trim()
    .min(2, "Ubicación del nodo: Mínimo 2 caracteres.")
    .max(150, "Ubicación del nodo: Máximo 150 caracteres."),
  host: z
    .string()
    .trim()
    .min(3, "Host / IP del nodo: Mínimo 3 caracteres.")
    .max(100, "Host / IP del nodo: Máximo 100 caracteres."),
  port: z.coerce.number().int().min(1).max(65535).default(8728),
  username: z
    .string()
    .trim()
    .min(1, "Usuario del nodo es requerido.")
    .max(60, "Usuario del nodo: Máximo 60 caracteres."),
  password: z
    .string()
    .max(100, "Contraseña del nodo: Máximo 100 caracteres.")
    .optional(),
  fallbackHost: z
    .string()
    .trim()
    .max(100, "Host de respaldo: Máximo 100 caracteres.")
    .optional()
    .nullable(),
  useTls: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const clientSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1, "La marca es requerida."),
  documentType: z.enum(["CC", "NIT", "CE", "PASAPORTE"]).default("CC"),
  documentNumber: z
    .string()
    .trim()
    .min(5, "Número de documento: Mínimo 5 dígitos.")
    .max(25, "Número de documento: Máximo 25 caracteres."),
  fullName: z
    .string()
    .trim()
    .min(3, "Nombre completo: Mínimo 3 caracteres.")
    .max(120, "Nombre completo: Máximo 120 caracteres."),
  email: z
    .union([
      z
        .string()
        .trim()
        .email("Correo electrónico no válido.")
        .max(100, "Correo electrónico: Máximo 100 caracteres."),
      z.literal(""),
    ])
    .optional()
    .nullable(),
  phonePrimary: z
    .string()
    .trim()
    .min(7, "Teléfono principal: Mínimo 7 dígitos.")
    .max(20, "Teléfono principal: Máximo 20 caracteres."),
  phoneSecondary: z
    .string()
    .trim()
    .max(20, "Teléfono secundario: Máximo 20 caracteres.")
    .optional()
    .nullable(),
  address: z
    .string()
    .trim()
    .max(150, "Dirección fiscal: Máximo 150 caracteres.")
    .optional()
    .nullable(),
  city: z
    .string()
    .trim()
    .min(2, "Ciudad: Mínimo 2 caracteres.")
    .max(60, "Ciudad: Máximo 60 caracteres.")
    .default("Soacha"),
  department: z
    .string()
    .trim()
    .min(2, "Departamento: Mínimo 2 caracteres.")
    .max(60, "Departamento: Máximo 60 caracteres.")
    .default("Cundinamarca"),
  notes: z
    .string()
    .max(500, "Observaciones del cliente: Máximo 500 caracteres.")
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
});

export const contractSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1, "La marca es requerida."),
  clientId: z.string().min(1, "El cliente es requerido."),
  contractNumber: z
    .string()
    .trim()
    .min(1, "El número de contrato es requerido.")
    .max(50, "Número de contrato: Máximo 50 caracteres."),
  address: z
    .string()
    .trim()
    .min(1, "La dirección de instalación es requerida.")
    .max(150, "Dirección de instalación: Máximo 150 caracteres."),
  neighborhood: z
    .string()
    .trim()
    .max(80, "Barrio: Máximo 80 caracteres.")
    .optional()
    .nullable(),
  city: z
    .string()
    .trim()
    .min(2, "Ciudad: Mínimo 2 caracteres.")
    .max(60, "Ciudad: Máximo 60 caracteres.")
    .default("Soacha"),
  department: z
    .string()
    .trim()
    .min(2, "Departamento: Mínimo 2 caracteres.")
    .max(60, "Departamento: Máximo 60 caracteres.")
    .default("Cundinamarca"),
  nodeId: z.string().min(1, "El nodo MikroTik es requerido."),
  planId: z.string().min(1, "El plan es requerido."),
  technology: z.enum(["FIBRA_OPTICA", "MICROONDAS"]).default("FIBRA_OPTICA"),
  pppoeUser: z
    .string()
    .trim()
    .min(2, "Usuario PPPoE: Mínimo 2 caracteres.")
    .max(60, "Usuario PPPoE: Máximo 60 caracteres."),
  pppoePassword: z
    .string()
    .trim()
    .max(60, "Contraseña PPPoE: Máximo 60 caracteres.")
    .optional()
    .nullable(),
  ipAddress: z
    .string()
    .trim()
    .max(45, "Dirección IP: Máximo 45 caracteres.")
    .optional()
    .nullable(),
  macAddress: z
    .string()
    .trim()
    .max(25, "Dirección MAC: Máximo 25 caracteres.")
    .optional()
    .nullable(),
  billingStatus: z
    .enum([
      "ACTIVO",
      "AVISO_VENCIMIENTO",
      "SUSPENDIDO_MORA",
      "RETIRADO",
      "CORTESIA",
    ])
    .default("ACTIVO"),
  // Equipos en comodato / CPE opcionales
  routerBrand: z
    .string()
    .trim()
    .max(60, "Marca de router: Máximo 60 caracteres.")
    .optional()
    .nullable(),
  routerModel: z
    .string()
    .trim()
    .max(60, "Modelo de router: Máximo 60 caracteres.")
    .optional()
    .nullable(),
  routerMac: z
    .string()
    .trim()
    .max(30, "MAC de router: Máximo 30 caracteres.")
    .optional()
    .nullable(),
  antennaType: z
    .string()
    .trim()
    .max(60, "Tipo de antena: Máximo 60 caracteres.")
    .optional()
    .nullable(),
  antennaMac: z
    .string()
    .trim()
    .max(30, "MAC de antena: Máximo 30 caracteres.")
    .optional()
    .nullable(),
  antennaIp: z
    .string()
    .trim()
    .max(45, "IP de antena: Máximo 45 caracteres.")
    .optional()
    .nullable(),
  cableMeters: z.coerce.number().int().min(0).optional().nullable(),
  opticalPowerRx: z.coerce.number().optional().nullable(),
  equipmentNotes: z
    .string()
    .trim()
    .max(500, "Notas de equipos: Máximo 500 caracteres.")
    .optional()
    .nullable(),
});

export const planSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1, "La marca es requerida."),
  name: z
    .string()
    .trim()
    .min(2, "Nombre del plan: Mínimo 2 caracteres.")
    .max(80, "Nombre del plan: Máximo 80 caracteres."),
  downloadSpeedMbps: z.coerce.number().int().min(1, "Mínimo 1 Mbps."),
  uploadSpeedMbps: z.coerce.number().int().min(1, "Mínimo 1 Mbps."),
  rateLimit: z
    .string()
    .trim()
    .min(3, "Límite de velocidad: Mínimo 3 caracteres.")
    .max(30, "Límite de velocidad: Máximo 30 caracteres."),
  priceCop: z.coerce.number().min(0, "El precio no puede ser negativo."),
  billingDay: z.coerce.number().int().min(1).max(31).default(10),
  mikrotikProfile: z
    .string()
    .trim()
    .max(50, "Perfil MikroTik: Máximo 50 caracteres.")
    .optional()
    .nullable(),
  technology: z.enum(["FIBRA_OPTICA", "MICROONDAS"]).default("FIBRA_OPTICA"),
  isActive: z.boolean().default(true),
});

export const paymentRecordSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1, "La marca es requerida."),
  contractId: z.string().min(1, "El contrato es requerido."),
  periodBilled: z
    .string()
    .trim()
    .min(4, "Periodo facturado: Mínimo 4 caracteres.")
    .max(20, "Periodo facturado: Máximo 20 caracteres."),
  amount: z.coerce.number().min(1, "El monto debe ser mayor a 0."),
  paymentMethod: z
    .enum([
      "EFECTIVO",
      "EFECTY",
      "NEQUI",
      "DAVIPLATA",
      "BANCOLOMBIA",
      "PAYU",
      "OTRO",
    ])
    .default("EFECTIVO"),
  status: z
    .enum(["APROBADO", "PENDIENTE", "RECHAZADO", "ANULADO"])
    .default("APROBADO"),
  externalReference: z
    .string()
    .trim()
    .max(100, "Referencia externa: Máximo 100 caracteres.")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(300, "Observaciones de pago: Máximo 300 caracteres.")
    .optional()
    .nullable(),
});

export const supportTicketSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1, "La marca es requerida."),
  contractId: z.string().min(1, "El contrato es requerido."),
  channel: z
    .enum(["WHATSAPP_AI", "TELEFONO", "PORTAL", "PRESENCIAL"])
    .default("WHATSAPP_AI"),
  issueType: z
    .enum([
      "CORTE_TOTAL",
      "LENTITUD",
      "CAMBIO_WIFI",
      "FALLA_FISICA_LOS",
      "CARTERA",
      "OTRO",
    ])
    .default("CORTE_TOTAL"),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  status: z
    .enum([
      "ABIERTO",
      "EN_DIAGNOSTICO_IA",
      "TRANSFERIDO_HUMANO",
      "VISITA_AGENDADA",
      "RESUELTO",
      "CERRADO",
    ])
    .default("ABIERTO"),
  description: z
    .string()
    .trim()
    .min(5, "Descripción del caso: Mínimo 5 caracteres.")
    .max(2000, "Descripción del caso: Máximo 2000 caracteres."),
});

export const billingCycleSchema = z.object({
  brandId: z.string().min(1, "La marca es requerida."),
  year: z.coerce.number().int().min(2020).max(2050),
  month: z.coerce.number().int().min(1).max(12),
});

export const paymentPromiseSchema = z.object({
  contractId: z.string().min(1, "El contrato es requerido."),
  hours: z.coerce.number().int().min(1).max(168).default(24),
  notes: z
    .string()
    .trim()
    .max(300, "Notas de promesa: Máximo 300 caracteres.")
    .optional()
    .nullable(),
  overrideLimit: z.boolean().optional(),
});
