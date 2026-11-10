export interface UserContextForAi {
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string;
  brandName?: string | null;
  brandCurrency?: string;
  planName?: string | null;
  subscriptionEndDate?: string | null;
  hasAiAgentAccess?: boolean;
  locale?: string;
}

export const APP_BUSINESS_KNOWLEDGE = {
  appName: "Kontrol ISP",
  targetAudience: "Administradores, Técnicos de Red NOC, Operadores y Facturación de ISPs",
  modules: [
    {
      name: "Dashboard Principal",
      description:
        "Métricas globales en tiempo real: abonados activos, cortes por mora, ingresos y estado.",
      link: "/dashboard",
    },
    {
      name: "Nodos MikroTik RouterOS",
      description:
        "Monitoreo de routers, consumo CPU/memoria, sesiones PPPoE activas y reconexión remota.",
      link: "/dashboard/nodes",
    },
    {
      name: "Planes de Internet",
      description:
        "Configuración de perfiles de velocidad (Down/Up), ráfagas (burst), pool IP y tarifas.",
      link: "/dashboard/plans",
    },
    {
      name: "Mapa de Red NOC",
      description:
        "Topología cartográfica de nodos, torres de transmisión, OLTs y cobertura geográfica.",
      link: "/dashboard/network-map",
    },
    {
      name: "Abonados / Clientes",
      description:
        "Registro de abonados, cédula/NIT, teléfonos WhatsApp, dirección y georreferenciación.",
      link: "/dashboard/clients",
    },
    {
      name: "Contratos & Enlaces",
      description:
        "Asociación de cliente a plan, nodo MikroTik, credenciales PPPoE y estado de servicio.",
      link: "/dashboard/contracts",
    },
    {
      name: "Facturación & Recaudos",
      description:
        "Emisión de facturas periódicas, recibos digitales en PDF, pasarela Wompi/PSE y cortes.",
      link: "/dashboard/billing",
    },
    {
      name: "Mesa de Ayuda & Tickets",
      description:
        "Gestión de incidencias técnicas, cuadrillas de campo y visitas en jornadas AM/PM.",
      link: "/dashboard/tickets",
    },
    {
      name: "Bandeja de WhatsApp",
      description:
        "Supervisión y chat en vivo con clientes, intervención humana y auditoría de mensajes.",
      link: "/dashboard/whatsapp-chat",
    },
    {
      name: "Marcas & Filiales ISP",
      description:
        "Administración multi-marca, logos, moneda local, zona horaria y webhooks a n8n.",
      link: "/dashboard/brands",
    },
    {
      name: "Usuarios & Permisos (RBAC)",
      description:
        "Control de accesos y roles jerárquicos (SUPER_ADMIN, ADMIN, USER) por marca.",
      link: "/dashboard/users",
    },
    {
      name: "Configuración de Agente IA & Bot",
      description:
        "Motor de WhatsApp (Baileys vs Meta Cloud API vs Reglas 1-2-3), prompt y herramientas.",
      link: "/dashboard/settings/ai",
    },
    {
      name: "Configuración General",
      description:
        "Línea de WhatsApp oficial, tokens de webhook, seguridad PIN y biometría WebAuthn.",
      link: "/dashboard/settings",
    },
  ],
  adminGuide: [
    "Gestionar routers y sesiones activas en [Nodos MikroTik](/dashboard/nodes).",
    "Definir perfiles de velocidad y precios en [Planes de Internet](/dashboard/plans).",
    "Dar de alta abonados residenciales o corporativos en [Clientes](/dashboard/clients).",
    "Vincular contratos y credenciales PPPoE/estáticas en [Contratos](/dashboard/contracts).",
    "Generar facturación periódica y registrar abonos en [Facturación](/dashboard/billing).",
    "Atender averías y agendar cuadrillas técnicas en [Tickets](/dashboard/tickets).",
    "Supervisar conversaciones en vivo en [Chats de WhatsApp](/dashboard/whatsapp-chat).",
    "Configurar el motor de atención automática en [Configuración de IA](/dashboard/settings/ai).",
    "Conectar Meta Cloud API o Evolution en [Configuración WhatsApp](/dashboard/settings).",
    "Administrar cuentas de operadores y técnicos en [Usuarios & Roles](/dashboard/users).",
  ],
  userGuide: [
    "Consultar estado de contratos y clientes en [Abonados](/dashboard/clients).",
    "Registrar pagos de mensualidades y expedir recibos en [Facturación](/dashboard/billing).",
    "Crear y consultar tickets de soporte técnico en [Tickets](/dashboard/tickets).",
    "Interactuar con clientes en la bandeja de [WhatsApp](/dashboard/whatsapp-chat).",
    "Proteger la sesión activando el PIN de bloqueo en [Seguridad](/dashboard/settings).",
  ],
};

export function buildSystemPrompt(context: UserContextForAi): string {
  const roleName = context.userRole || "USER";
  const isAdmin =
    roleName.includes("ADMIN") || roleName.includes("SUPER_ADMIN");

  const brandName = context.brandName || "Kontrol ISP";
  const brandCurrency = context.brandCurrency || "COP";

  const roleInstructions = isAdmin
    ? "El usuario es ADMINISTRADOR/NOC. Asístelo en configuración de MikroTik, planes, " +
      "facturación, corte por mora, contratos, gestión de bots de WhatsApp y roles."
    : "El usuario es OPERADOR/TÉCNICO. Asístelo en atención a clientes, consulta de " +
      "contratos, expedición de recibos de pago y seguimiento de tickets de campo.";

  const guideList = isAdmin
    ? APP_BUSINESS_KNOWLEDGE.adminGuide
    : APP_BUSINESS_KNOWLEDGE.userGuide;

  return [
    `Eres el Asistente IA interno y Copiloto de Operaciones de ${APP_BUSINESS_KNOWLEDGE.appName}.`,
    `Empresa / Marca activa: ${brandName} (Moneda: ${brandCurrency}).`,
    roleInstructions,
    "",
    "SISTEMA KONTROL ISP:",
    "- Plataforma integral de gestión técnica y comercial para Proveedores de Internet (WISP/ISP).",
    "- Incluye SIEMPRE enlaces Markdown interactivos exactos (ej. [Clientes](/dashboard/clients), " +
      "[Nodos MikroTik](/dashboard/nodes), [Facturación](/dashboard/billing), " +
      "[Configuración IA](/dashboard/settings/ai)) cuando expliques cómo realizar una acción.",
    "",
    "DATOS EN TIEMPO REAL DEL USUARIO:",
    `- Nombre: ${context.userName || "Operador"}`,
    `- Email: ${context.userEmail || "N/A"}`,
    `- Rol: ${roleName}`,
    `- Idioma: ${context.locale || "es"}`,
    "",
    "MÓDULOS DEL SISTEMA DISPONIBLES:",
    ...guideList.map((g) => `- ${g}`),
    "",
    "INSTRUCCIONES Y LÍMITES DE DOMINIO (GUARDRAILS):",
    "1. Responde de forma cordial, ejecutiva, profesional y directa en el idioma del usuario.",
    "2. Proporciona pasos guiados claros y estructurados usando listas y negritas.",
    "3. Siempre que menciones una vista o proceso, incluye el enlace Markdown correspondiente.",
    "4. Si te consultan por configuración de WhatsApp, explica que en " +
      "[Configuración](/dashboard/settings) se parametrizan los tokens de Meta Cloud API o " +
      "Evolution API, y en [Configuración IA](/dashboard/settings/ai) el comportamiento del bot.",
    "5. LÍMITE DE DOMINIO: Eres EXCLUSIVAMENTE el asistente operativo interno de Kontrol ISP. " +
      "Si el usuario pregunta sobre temas externos (entretenimiento, deportes, tareas no " +
      "relacionadas con telecomunicaciones o el sistema), rechaza cordialmente la consulta " +
      "y reoriéntalo a las operaciones de la plataforma ISP.",
  ].join("\n");
}
