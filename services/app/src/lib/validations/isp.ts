import { z } from "zod";

export const mikrotikNodeSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1, "La marca es requerida."),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(100),
  code: z.string().trim().min(2, "El código debe tener al menos 2 caracteres.").max(30),
  location: z.string().trim().min(2, "La ubicación es requerida.").max(150),
  host: z.string().trim().min(3, "La IP o host es requerida.").max(100),
  port: z.coerce.number().int().min(1).max(65535).default(8728),
  username: z.string().trim().min(1, "El usuario es requerido.").max(60),
  password: z.string().max(100).optional(),
  fallbackHost: z.string().trim().max(100).optional().nullable(),
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
    .min(5, "El documento debe tener al menos 5 dígitos.")
    .max(25),
  fullName: z
    .string()
    .trim()
    .min(3, "El nombre completo debe tener al menos 3 caracteres.")
    .max(120),
  email: z
    .union([
      z.string().trim().email("Correo electrónico no válido.").max(100),
      z.literal(""),
    ])
    .optional()
    .nullable(),
  phonePrimary: z
    .string()
    .trim()
    .min(7, "El teléfono debe tener al menos 7 dígitos.")
    .max(20),
  phoneSecondary: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(150).optional().nullable(),
  city: z.string().trim().min(2).max(60).default("Soacha"),
  department: z.string().trim().min(2).max(60).default("Cundinamarca"),
  notes: z.string().max(500).optional().nullable(),
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
    .max(50),
  address: z
    .string()
    .trim()
    .min(1, "La dirección de instalación es requerida.")
    .max(150),
  neighborhood: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().min(2).max(60).default("Soacha"),
  department: z.string().trim().min(2).max(60).default("Cundinamarca"),
  nodeId: z.string().min(1, "El nodo MikroTik es requerido."),
  planId: z.string().min(1, "El plan es requerido."),
  technology: z.enum(["FIBRA_OPTICA", "MICROONDAS"]).default("FIBRA_OPTICA"),
  pppoeUser: z
    .string()
    .trim()
    .min(2, "El usuario PPPoE es requerido.")
    .max(60),
  pppoePassword: z.string().trim().max(60).optional().nullable(),
  ipAddress: z.string().trim().max(45).optional().nullable(),
  macAddress: z.string().trim().max(25).optional().nullable(),
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
  routerBrand: z.string().trim().max(60).optional().nullable(),
  routerModel: z.string().trim().max(60).optional().nullable(),
  routerMac: z.string().trim().max(30).optional().nullable(),
  antennaType: z.string().trim().max(60).optional().nullable(),
  antennaMac: z.string().trim().max(30).optional().nullable(),
  antennaIp: z.string().trim().max(45).optional().nullable(),
  cableMeters: z.coerce.number().int().min(0).optional().nullable(),
  opticalPowerRx: z.coerce.number().optional().nullable(),
  equipmentNotes: z.string().trim().max(500).optional().nullable(),
});

export const planSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1, "La marca es requerida."),
  name: z.string().trim().min(2, "El nombre del plan es requerido.").max(80),
  downloadSpeedMbps: z.coerce.number().int().min(1, "Mínimo 1 Mbps."),
  uploadSpeedMbps: z.coerce.number().int().min(1, "Mínimo 1 Mbps."),
  rateLimit: z.string().trim().min(3).max(30),
  priceCop: z.coerce.number().min(0, "El precio no puede ser negativo."),
  billingDay: z.coerce.number().int().min(1).max(31).default(10),
  mikrotikProfile: z.string().trim().max(50).optional().nullable(),
  technology: z.enum(["FIBRA_OPTICA", "MICROONDAS"]).default("FIBRA_OPTICA"),
  isActive: z.boolean().default(true),
});

export const paymentRecordSchema = z.object({
  id: z.string().optional(),
  brandId: z.string().min(1, "La marca es requerida."),
  contractId: z.string().min(1, "El contrato es requerido."),
  periodBilled: z.string().trim().min(4).max(20),
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
  externalReference: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
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
    .min(5, "La descripción debe tener al menos 5 caracteres.")
    .max(2000),
});

export const billingCycleSchema = z.object({
  brandId: z.string().min(1, "La marca es requerida."),
  year: z.coerce.number().int().min(2020).max(2050),
  month: z.coerce.number().int().min(1).max(12),
});

export const paymentPromiseSchema = z.object({
  contractId: z.string().min(1, "El contrato es requerido."),
  hours: z.coerce.number().int().min(1).max(168).default(24),
  notes: z.string().trim().max(300).optional().nullable(),
});
