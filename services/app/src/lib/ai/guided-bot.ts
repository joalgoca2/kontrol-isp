import type { UserContextForAi } from "./knowledge";

interface GuidedTranslations {
  mainMenu: string;
  route1: string;
  route2: string;
  route3: string;
  route4: string;
  route5: string;
  route6: string;
  route7: string;
  unrecognized: string;
}

function getGuidedTranslations(
  userContext: UserContextForAi
): GuidedTranslations {
  const lang = (userContext.locale || "es").toLowerCase();
  const name = userContext.userName || "Operador";
  const role = userContext.userRole || "USER";
  const brandName = userContext.brandName || "Kontrol ISP";

  if (lang.startsWith("en")) {
    return {
      mainMenu:
        `🤖 **Kontrol ISP Operations Copilot**\n\n` +
        `Hello, **${name}**! Select a topic or tap a direct link:\n\n` +
        `**[1]** 📊 [Dashboard & NOC Live Metrics](/dashboard)\n` +
        `**[2]** 🌐 [MikroTik Nodes & Bandwidth Plans](/dashboard/nodes)\n` +
        `**[3]** 👥 [Subscribers / Clients & Contracts](/dashboard/clients)\n` +
        `**[4]** 🧾 [Billing, Invoices & Digital Receipts](/dashboard/billing)\n` +
        `**[5]** 🛠️ [Help Desk, Technical Tickets & Field Visits](/dashboard/tickets)\n` +
        `**[6]** 📱 [WhatsApp Lines & AI Customer Bot](/dashboard/settings/ai)\n` +
        `**[7]** 🔒 [Security, Screen PIN & RBAC Users](/dashboard/users)\n\n` +
        `*Reply with a number (1-7) or type your operational question.*`,

      route1:
        `📊 **[Dashboard & NOC Live Metrics]**\n\n` +
        `• **Server & Database:** Real-time health, latency, and uptime.\n` +
        `• **Operational KPIs:** Active subscribers, overdue debts, and revenue.\n\n` +
        `👉 Open [Dashboard](/dashboard) to inspect network performance.\n\n` +
        `Type **0** to return to the main menu.`,

      route2:
        `🌐 **[MikroTik Nodes & Bandwidth Plans]**\n\n` +
        `• **MikroTik Routers:** Connect via RouterOS API to monitor CPU, RAM and PPPoE.\n` +
        `• **Internet Plans:** Configure upload/download speeds, burst limits and rates.\n\n` +
        `👉 Manage nodes: [MikroTik Nodes](/dashboard/nodes)\n` +
        `👉 Manage plans: [Internet Plans](/dashboard/plans)\n\n` +
        `Type **0** to return to the main menu.`,

      route3:
        `👥 **[Subscribers / Clients & Contracts]**\n\n` +
        `• **Subscribers:** Register legal name, ID/tax number, WhatsApp and address.\n` +
        `• **Contracts:** Link subscriber to node, plan, PPPoE credentials and tech.\n\n` +
        `👉 View subscribers: [Go to Clients](/dashboard/clients)\n` +
        `👉 View contracts: [Go to Contracts](/dashboard/contracts)\n\n` +
        `Type **0** to return to the main menu.`,

      route4:
        `🧾 **[Billing, Invoices & Digital Receipts]**\n\n` +
        `• Generate cyclical invoices and register partial/full payments.\n` +
        `• Automatic suspension for overdue accounts and immediate reconnection.\n` +
        `• Instant PDF receipts and auto-dispatch via WhatsApp.\n\n` +
        `👉 Open billing: [Go to Billing](/dashboard/billing)\n\n` +
        `Type **0** to return to the main menu.`,

      route5:
        `🛠️ **[Help Desk, Technical Tickets & Field Visits]**\n\n` +
        `• Log service failures (cut line, optical attenuation, router damage).\n` +
        `• Assign field technicians and schedule visits (Morning / Afternoon).\n\n` +
        `👉 Manage tickets: [Go to Tickets](/dashboard/tickets)\n\n` +
        `Type **0** to return to the main menu.`,

      route6:
        `📱 **[WhatsApp Lines & AI Customer Bot]**\n\n` +
        `• **Official Line:** Meta Cloud API or Evolution API in ` +
        `[WhatsApp Settings](/dashboard/settings).\n` +
        `• **AI Customer Bot:** Configure System Prompt, 1-2-3 Rules, or RAG in ` +
        `[AI Settings](/dashboard/settings/ai).\n` +
        `• **Live Inbox:** Intervene conversations in ` +
        `[WhatsApp Chat](/dashboard/whatsapp-chat).\n\n` +
        `Type **0** to return to the main menu.`,

      route7:
        `🔒 **[Security, Screen PIN & RBAC Users]**\n\n` +
        `• **Active Role:** ${role} in ${brandName}.\n` +
        `• Manage staff accounts in [Users & Roles](/dashboard/users).\n` +
        `• Protect workstation with 4-digit PIN or WebAuthn in ` +
        `[Settings](/dashboard/settings).\n\n` +
        `Type **0** to return to the main menu.`,

      unrecognized: `⚠️ Option not recognized.`,
    };
  }

  if (lang.startsWith("pt")) {
    return {
      mainMenu:
        `🤖 **Copiloto de Operações Kontrol ISP**\n\n` +
        `Olá, **${name}**! Selecione um tópico ou clique em um link:\n\n` +
        `**[1]** 📊 [Painel e Métricas NOC](/dashboard)\n` +
        `**[2]** 🌐 [Nós MikroTik e Planos de Internet](/dashboard/nodes)\n` +
        `**[3]** 👥 [Assinantes / Clientes e Contratos](/dashboard/clients)\n` +
        `**[4]** 🧾 [Faturamento, Cobranças e Recibos](/dashboard/billing)\n` +
        `**[5]** 🛠️ [Suporte Técnico e Ordens de Serviço](/dashboard/tickets)\n` +
        `**[6]** 📱 [Linhas WhatsApp e Bot de IA](/dashboard/settings/ai)\n` +
        `**[7]** 🔒 [Segurança, PIN de Tela e Usuários](/dashboard/users)\n\n` +
        `*Responda com um número (1-7) ou faça sua pergunta.*`,

      route1:
        `📊 **[Painel e Métricas NOC]**\n\n` +
        `• Saúde dos servidores, banco de dados e clientes ativos.\n` +
        `👉 Abrir [Painel](/dashboard).\n\n` +
        `Digite **0** para voltar ao menu.`,

      route2:
        `🌐 **[Nós MikroTik e Planos de Internet]**\n\n` +
        `• Gerencie roteadores RouterOS e planos de banda larga.\n` +
        `👉 Ver nós: [Nós MikroTik](/dashboard/nodes)\n` +
        `👉 Ver planos: [Planos de Internet](/dashboard/plans)\n\n` +
        `Digite **0** para voltar ao menu.`,

      route3:
        `👥 **[Assinantes / Clientes e Contratos]**\n\n` +
        `• Cadastro de clientes, endereços e credenciais PPPoE.\n` +
        `👉 Clientes: [Ir para Clientes](/dashboard/clients)\n` +
        `👉 Contratos: [Ir para Contratos](/dashboard/contracts)\n\n` +
        `Digite **0** para voltar ao menu.`,

      route4:
        `🧾 **[Faturamento, Cobranças e Recibos]**\n\n` +
        `• Faturas, suspensão automática por débito e recibos em PDF.\n` +
        `👉 Faturamento: [Ir para Faturamento](/dashboard/billing)\n\n` +
        `Digite **0** para voltar ao menu.`,

      route5:
        `🛠️ **[Suporte Técnico e Ordens de Serviço]**\n\n` +
        `• Registro de incidentes e agendamento de visitas técnicas.\n` +
        `👉 Suporte: [Ir para Tickets](/dashboard/tickets)\n\n` +
        `Digite **0** para voltar ao menu.`,

      route6:
        `📱 **[Linhas WhatsApp e Bot de IA]**\n\n` +
        `• Configurar WhatsApp em [Configurações](/dashboard/settings).\n` +
        `• Configurar Bot em [Configuração de IA](/dashboard/settings/ai).\n\n` +
        `Digite **0** para voltar ao menu.`,

      route7:
        `🔒 **[Segurança, PIN de Tela e Usuários]**\n\n` +
        `• Usuários e permissões em [Usuários](/dashboard/users).\n` +
        `• Bloqueio por PIN em [Configurações](/dashboard/settings).\n\n` +
        `Digite **0** para voltar ao menu.`,

      unrecognized: `⚠️ Opção não reconhecida.`,
    };
  }

  // Spanish (default fallback)
  return {
    mainMenu:
      `🤖 **Copiloto de Operaciones Kontrol ISP**\n\n` +
      `¡Hola, **${name}**! Selecciona un número o haz clic en un enlace directo:\n\n` +
      `**[1]** 📊 [Dashboard & Métricas NOC en Vivo](/dashboard)\n` +
      `**[2]** 🌐 [Nodos MikroTik & Planes de Internet](/dashboard/nodes)\n` +
      `**[3]** 👥 [Abonados / Clientes & Contratos](/dashboard/clients)\n` +
      `**[4]** 🧾 [Facturación, Cobros & Recaudos](/dashboard/billing)\n` +
      `**[5]** 🛠️ [Mesa de Ayuda, Tickets & Cuadrillas](/dashboard/tickets)\n` +
      `**[6]** 📱 [WhatsApp Oficial & Bot de Clientes](/dashboard/settings/ai)\n` +
      `**[7]** 🔒 [Seguridad, Bloqueo por PIN & Usuarios RBAC](/dashboard/users)\n\n` +
      `*Responde con el número de la opción (1-7) o escribe tu duda operativa.*`,

    route1:
      `📊 **[Dashboard & Métricas NOC en Vivo]**\n\n` +
      `• **Salud Operativa:** Estado del servidor PostgreSQL y uptime.\n` +
      `• **KPIs de Cartera:** Abonados activos, suspendidos por mora e ingresos.\n\n` +
      `👉 Abre el [Dashboard Principal](/dashboard) para ver el estado general.\n\n` +
      `Escribe **0** para regresar al menú principal.`,

    route2:
      `🌐 **[Nodos MikroTik & Planes de Internet]**\n\n` +
      `• **Nodos RouterOS:** Conexión vía API para monitorear CPU, memoria y sesiones PPPoE.\n` +
      `• **Planes de Internet:** Configura velocidades de bajada/subida, ráfagas y tarifas.\n\n` +
      `👉 Administrar routers: [Nodos MikroTik](/dashboard/nodes)\n` +
      `👉 Configurar anchos de banda: [Planes de Internet](/dashboard/plans)\n\n` +
      `Escribe **0** para regresar al menú principal.`,

    route3:
      `👥 **[Abonados / Clientes & Contratos]**\n\n` +
      `• **Abonados:** Registro de titulares con cédula/NIT, WhatsApp y dirección.\n` +
      `• **Contratos:** Asociación de cliente a plan, nodo MikroTik y credenciales.\n\n` +
      `👉 Ver abonados: [Gestión de Clientes](/dashboard/clients)\n` +
      `👉 Ver contratos activos: [Contratos & Enlaces](/dashboard/contracts)\n\n` +
      `Escribe **0** para regresar al menú principal.`,

    route4:
      `🧾 **[Facturación, Cobros & Recaudos]**\n\n` +
      `• Emisión de facturas periódicas y conciliación multicanal (Efectivo/PSE).\n` +
      `• Corte automático por mora y reactivación inmediata tras el pago.\n` +
      `• Expedición de recibos digitales en PDF con envío a WhatsApp.\n\n` +
      `👉 Gestionar cartera: [Facturación & Recaudos](/dashboard/billing)\n\n` +
      `Escribe **0** para regresar al menú principal.`,

    route5:
      `🛠️ **[Mesa de Ayuda, Tickets & Cuadrillas]**\n\n` +
      `• Registro de fallas técnicas (corte de fibra, atenuación, router apagado).\n` +
      `• Asignación a técnicos de campo y agendamiento de visitas (Mañana / Tarde).\n\n` +
      `👉 Atender casos: [Mesa de Ayuda & Tickets](/dashboard/tickets)\n\n` +
      `Escribe **0** para regresar al menú principal.`,

    route6:
      `📱 **[WhatsApp Oficial & Bot de Clientes]**\n\n` +
      `• **Conexión de Línea:** Vincula Meta Cloud API o Evolution API en ` +
      `[Configuración](/dashboard/settings).\n` +
      `• **Parametrización del Bot:** Configura el Prompt Maestro o menú 1-2-3 en ` +
      `[Configuración de IA](/dashboard/settings/ai).\n` +
      `• **Supervisión en Vivo:** Intervén conversaciones de clientes en ` +
      `[Chats de WhatsApp](/dashboard/whatsapp-chat).\n\n` +
      `Escribe **0** para regresar al menú principal.`,

    route7:
      `🔒 **[Seguridad, Bloqueo por PIN & Usuarios RBAC]**\n\n` +
      `• **Rol Activo:** ${role} en ${brandName}.\n` +
      `• Administra cuentas de operadores y roles en ` +
      `[Usuarios & Roles](/dashboard/users).\n` +
      `• Protege tu pantalla configurando PIN de 4 dígitos o Huella en ` +
      `[Configuración General](/dashboard/settings).\n\n` +
      `Escribe **0** para regresar al menú principal.`,

    unrecognized: `⚠️ Opción no reconocida.`,
  };
}

export function processGuidedBotResponse(
  userMessage: string,
  userContext: UserContextForAi
): string {
  const msg = userMessage.trim().toLowerCase();
  const t = getGuidedTranslations(userContext);

  if (
    msg === "0" ||
    msg === "menu" ||
    msg === "menú" ||
    msg.includes("hola") ||
    msg.includes("hello") ||
    msg.includes("oi") ||
    msg.includes("inicio") ||
    msg.includes("ayuda") ||
    msg.includes("help")
  ) {
    return t.mainMenu;
  }

  if (
    msg === "1" ||
    msg.includes("dashboard") ||
    msg.includes("metrica") ||
    msg.includes("estado") ||
    msg.includes("servidor")
  ) {
    return t.route1;
  }

  if (
    msg === "2" ||
    msg.includes("mikrotik") ||
    msg.includes("nodo") ||
    msg.includes("router") ||
    msg.includes("plan") ||
    msg.includes("velocidad") ||
    msg.includes("ancho de banda") ||
    msg.includes("pppoe")
  ) {
    return t.route2;
  }

  if (
    msg === "3" ||
    msg.includes("cliente") ||
    msg.includes("abonado") ||
    msg.includes("contrato") ||
    msg.includes("enlace") ||
    msg.includes("cedula") ||
    msg.includes("subscriber")
  ) {
    return t.route3;
  }

  if (
    msg === "4" ||
    msg.includes("factura") ||
    msg.includes("pago") ||
    msg.includes("recibo") ||
    msg.includes("cobro") ||
    msg.includes("mora") ||
    msg.includes("corte") ||
    msg.includes("recaudo") ||
    msg.includes("wompi") ||
    msg.includes("pse") ||
    msg.includes("payment")
  ) {
    return t.route4;
  }

  if (
    msg === "5" ||
    msg.includes("ticket") ||
    msg.includes("falla") ||
    msg.includes("averia") ||
    msg.includes("visita") ||
    msg.includes("cuadrilla") ||
    msg.includes("soporte")
  ) {
    return t.route5;
  }

  if (
    msg === "6" ||
    msg.includes("whatsapp") ||
    msg.includes("meta") ||
    msg.includes("evolution") ||
    msg.includes("bot") ||
    msg.includes("ia") ||
    msg.includes("prompt") ||
    msg.includes("agente")
  ) {
    return t.route6;
  }

  if (
    msg === "7" ||
    msg.includes("seguridad") ||
    msg.includes("pin") ||
    msg.includes("huella") ||
    msg.includes("faceid") ||
    msg.includes("usuario") ||
    msg.includes("rol") ||
    msg.includes("rbac")
  ) {
    return t.route7;
  }

  return `${t.unrecognized} "*${userMessage}*"\n\n${t.mainMenu}`;
}
