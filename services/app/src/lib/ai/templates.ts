import type { AiTemplateType, ChatbotFlowConfig } from "@/types";

export interface TemplateDefinition {
  type: AiTemplateType;
  title: string;
  description: string;
  defaultBotName: string;
  defaultSystemPrompt: string;
  recommendedTone: "AMABLE" | "FORMAL" | "TECNICO";
  allowDiagnosticMikrotik: boolean;
  allowKickSession: boolean;
  allowGracePromise: boolean;
  allowScheduleVisits: boolean;
  allowBillingBalance: boolean;
  allowTransferHuman: boolean;
  allowCheckVisits: boolean;
}

export const DEFAULT_CHATBOT_FLOW: ChatbotFlowConfig = {
  version: "2.0",
  welcomeStep: {
    greeting: "¡Hola! Bienvenido al canal de atención de {{brandName}} 🌐",
    requireIdentification: true,
    askIdentifierPrompt:
      "Para ayudarte mejor, por favor indícame tu número de Cédula/NIT o Contrato:",
    notFoundMessage:
      "No encontramos un contrato con ese dato. Escribe 'asesor' para atención personalizada.",
  },
  menuStep: {
    menuHeader:
      "Hola {{clientName}}, selecciona una opción digitando el número:",
    options: [
      {
        id: "opt-billing",
        digit: "1",
        title: "Consultar saldo y pagar por PSE / Wompi",
        keywords: [
          "saldo",
          "pagar",
          "factura",
          "pse",
          "cuenta",
          "recibo",
          "cuanto debo",
        ],
        actionType: "BILLING_BALANCE",
        condition: "ALL",
        responseText:
          "Tu estado de cuenta actual:\n" +
          "• Saldo pendiente: {{saldo}}\n" +
          "• Fecha de corte: {{fecha_corte}}\n" +
          "Enlace seguro de pago: {{link_pago}}",
        enabled: true,
      },
      {
        id: "opt-support-branch",
        digit: "2",
        title: "Soporte Técnico de Conexión",
        keywords: [
          "soporte",
          "tecnico",
          "internet",
          "falla",
          "lento",
          "caido",
          "diagnostico",
        ],
        actionType: "BRANCH_MENU",
        condition: "IS_ACTIVE",
        responseText: "🛠️ *Menú de Soporte Técnico*\nSelecciona una opción:",
        enabled: true,
        subOptions: [
          {
            id: "opt-sub-diag",
            digit: "1",
            title: "Diagnóstico de conexión en tiempo real (MikroTik)",
            keywords: [
              "diagnostico",
              "lento",
              "ping",
              "estado",
              "revisar",
              "conexion",
            ],
            actionType: "DIAGNOSTIC_MIKROTIK",
            condition: "ALL",
            responseText: "Revisando sesión PPPoE y potencia óptica...",
            enabled: true,
          },
          {
            id: "opt-sub-visit",
            digit: "2",
            title: "Agendar visita técnica a domicilio",
            keywords: ["visita", "tecnico", "domicilio", "casa", "cuadrilla"],
            actionType: "SCHEDULE_VISIT",
            condition: "ALL",
            responseText: "Agendando visita técnica...",
            enabled: true,
          },
          {
            id: "sub-slow-kick",
            digit: "3",
            title: "Velocidad Lenta",
            keywords: ["servicio"],
            actionType: "KICK_PPPOE_SESSION",
            condition: "ALL",
            responseText: "",
            enabled: true,
          },
        ],
      },
      {
        id: "opt-promise",
        digit: "3",
        title: "Solicitar prórroga de pago (24h de gracia)",
        keywords: [
          "promesa",
          "prorroga",
          "gracia",
          "reconnect",
          "reconexion",
          "plazo",
        ],
        actionType: "PROMISE_PAYMENT",
        condition: "IS_MORA",
        responseText:
          "Hemos activado una promesa de pago por {{horas_gracia}} horas. " +
          "Tu servicio ha sido reactivado para que puedas ponerte al día.",
        enabled: true,
      },
      {
        id: "opt-human",
        digit: "4",
        title: "Hablar con un asesor humano",
        keywords: [
          "asesor",
          "humano",
          "persona",
          "agente",
          "operador",
          "ayuda",
        ],
        actionType: "TRANSFER_HUMAN",
        condition: "ALL",
        responseText:
          "He transferido tu conversación a un asesor en línea. " +
          "En breves momentos serás atendido por este mismo chat.",
        enabled: true,
      },
    ],
  },
  fallbackStep: {
    triggerKeywords: [
      "asesor",
      "humano",
      "operador",
      "persona",
      "ayuda",
      "soporte",
    ],
    maxUnknownAttempts: 2,
    fallbackMessage:
      "No logré comprender tu mensaje. Por favor elige una opción del menú " +
      "o escribe 'asesor' para hablar con un agente humano.",
    transferMessage:
      "Te estamos transfiriendo con un asesor humano. Un momento por favor...",
  },
};

export const AI_AGENT_TEMPLATES: Record<AiTemplateType, TemplateDefinition> = {
  BAILEYS_AI: {
    type: "BAILEYS_AI",
    title: "WhatsApp Baileys (Agente IA Conversacional Libre)",
    description:
      "Modelo RAG 24/7 sin plantillas HSM de Meta. Respuestas abiertas y triaje completo.",
    defaultBotName: "Lumi",
    recommendedTone: "AMABLE",
    allowDiagnosticMikrotik: true,
    allowKickSession: true,
    allowGracePromise: true,
    allowScheduleVisits: true,
    allowBillingBalance: true,
    allowTransferHuman: true,
    allowCheckVisits: true,
    defaultSystemPrompt:
      "Eres {{botName}}, el asistente de soporte técnico oficial de {{brandName}}.\n" +
      "Tu misión es realizar el triaje guiado de fallas de internet " +
      "(Fibra Óptica y Microondas),\n" +
      "diagnosticar en tiempo real con MikroTik, validar pagos y comprobantes,\n" +
      "activar prórroga o promesa de pago de 24 horas si el cliente está en mora,\n" +
      "gestionar agendamiento de visitas técnicas en franja mañana/tarde y transferir\n" +
      "con amabilidad y precisión a los asesores humanos cuando proceda.",
  },
  META_CLOUD_API: {
    type: "META_CLOUD_API",
    title: "WhatsApp Meta Cloud API (Oficial con Templates HSM)",
    description:
      "Envío transaccional y cobranza oficial bajo plantillas aprobadas. Activa ventana de 24h.",
    defaultBotName: "Atención al Cliente",
    recommendedTone: "FORMAL",
    allowDiagnosticMikrotik: true,
    allowKickSession: true,
    allowGracePromise: false,
    allowScheduleVisits: true,
    allowBillingBalance: true,
    allowTransferHuman: true,
    allowCheckVisits: true,
    defaultSystemPrompt:
      "Eres el canal oficial de atención corporativa de {{brandName}} en Meta " +
      "WhatsApp Business. Gestionas confirmaciones de visita técnica, estado de " +
      "cuenta oficial y soporte estructurado dentro de la ventana de sesión.",
  },
  RULES_BOT: {
    type: "RULES_BOT",
    title: "ChatBot de Reglas & Menú Estructurado (1-2-3)",
    description:
      "Flujo guiado por opciones fijas sin margen de alucinación. Determinista y rápido.",
    defaultBotName: "Bot de Servicios",
    recommendedTone: "TECNICO",
    allowDiagnosticMikrotik: true,
    allowKickSession: false,
    allowGracePromise: true,
    allowScheduleVisits: true,
    allowBillingBalance: true,
    allowTransferHuman: true,
    allowCheckVisits: true,
    defaultSystemPrompt:
      "Menú principal estructurado: 1. Consultar saldo y pago PSE | 2. Test técnico de " +
      "conexión MikroTik | 3. Solicitar visita técnica por jornada | 4. Transferir a un asesor.",
  },
};

