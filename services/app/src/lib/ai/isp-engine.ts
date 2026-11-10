import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  AiEngineResponse,
  AiChatMessage,
  ChatbotFlowConfig,
  FlowMenuOption,
} from "@/types";
import { DEFAULT_CHATBOT_FLOW, AI_AGENT_TEMPLATES } from "./templates";
import { buildIspSystemPrompt } from "./isp-prompt";
import {
  consultarClienteTool,
  diagnosticarServicioTool,
  consultarSaldoTool,
  promesaPagoTool,
  agendarVisitaTool,
  transferirHumanoTool,
  reiniciarPppoeTool,
  consultarVisitaTool,
  consultarDisponibilidadTool,
} from "./isp-tools";

export interface ProcessIspMessageParams {
  userMessage: string;
  brandId: string;
  senderIdentifier?: string;
  history?: AiChatMessage[];
}

interface ConversationSessionState {
  [key: string]: unknown;
  currentPath: string[];
  contractNumber?: string;
  clientDocument?: string;
  titular?: string;
  isMora?: boolean;
}

export async function processIspMessage(
  params: ProcessIspMessageParams
): Promise<AiEngineResponse> {
  const {
    userMessage,
    brandId,
    senderIdentifier = "anonymous",
    history = [],
  } = params;

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  const brandName = brand?.name || "Serkoi Telecom";
  const brandCurrency = brand?.currency || "COP";
  const systemPrompt = buildIspSystemPrompt({ brandName, brandCurrency });

  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();
  const apiKey = process.env.AI_API_KEY;

  // 1. Optional LLM Execution (OpenAI)
  if (provider === "openai" && apiKey) {
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: userMessage },
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "gpt-4o-mini",
          messages,
          temperature: 0.3,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { total_tokens?: number };
        };
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          await logAiConversation(
            brandId,
            senderIdentifier,
            userMessage,
            content,
            data.usage?.total_tokens,
            { currentPath: [] }
          );
          return { message: content, provider: "openai" };
        }
      }
    } catch (_err) {
      // Fallback to deterministic decision tree
    }
  }

  // 2. Fetch Brand AI Configuration or default flow
  const brandAiConfig = await prisma.brandAiConfig.findUnique({
    where: { brandId },
  });

  const flowConfig: ChatbotFlowConfig =
    (brandAiConfig?.flowConfig as unknown as ChatbotFlowConfig) ||
    DEFAULT_CHATBOT_FLOW;

  const historyLimit =
    (flowConfig as { historyLimit?: number })?.historyLimit ||
    Number(process.env.ISP_AI_HISTORY_LIMIT || 10);

  // 3. Retrieve prior conversation state & conversation memory
  let conversationHistory: AiChatMessage[] = [];
  let lastLog: {
    toolsInvoked: unknown;
    createdAt: Date;
    userMessage: string;
    aiResponse: string;
  } | null = null;

  if (history && history.length > 0) {
    conversationHistory = history.slice(-historyLimit);
    lastLog = await prisma.aiConversationLog.findFirst({
      where: { brandId, senderIdentifier },
      orderBy: { createdAt: "desc" },
    });
  } else {
    const logsToFetch = Math.max(1, Math.ceil(historyLimit / 2));
    const recentLogs = await prisma.aiConversationLog.findMany({
      where: { brandId, senderIdentifier },
      orderBy: { createdAt: "desc" },
      take: logsToFetch,
    });

    lastLog = recentLogs[0] || null;

    const chronoLogs = [...recentLogs].reverse();
    for (const log of chronoLogs) {
      if (log.userMessage) {
        conversationHistory.push({
          id: `${log.id}-user`,
          role: "user",
          content: log.userMessage,
          createdAt: new Date(log.createdAt).toISOString(),
        });
      }
      if (log.aiResponse) {
        conversationHistory.push({
          id: `${log.id}-bot`,
          role: "assistant",
          content: log.aiResponse,
          createdAt: new Date(log.createdAt).toISOString(),
        });
      }
    }

    if (conversationHistory.length > historyLimit) {
      conversationHistory = conversationHistory.slice(-historyLimit);
    }
  }

  const rawTools = lastLog?.toolsInvoked as Record<string, unknown> | null;
  const rawSession = rawTools?._session as ConversationSessionState | undefined;
  const sessionState: ConversationSessionState = {
    currentPath: Array.isArray(rawSession?.currentPath)
      ? [...rawSession.currentPath]
      : [],
    contractNumber: rawSession?.contractNumber,
    clientDocument: rawSession?.clientDocument,
    titular: rawSession?.titular,
    isMora: rawSession?.isMora,
  };

  const cleanMsg = userMessage.toLowerCase().trim();

  // Pattern detection for identification
  const docMatch = userMessage.match(/\b(\d{7,10})\b/);
  const contractMatch =
    userMessage.match(/test-?(\d+)/i) ||
    userMessage.match(/ser-?(\d+)/i) ||
    userMessage.match(/contrato\s*#?\s*([a-z0-9_-]+)/i);

  const activeIdentifier =
    sessionState.contractNumber ||
    docMatch?.[1] ||
    contractMatch?.[0] ||
    sessionState.clientDocument ||
    senderIdentifier.replace(/^\+?57/, "");

  // 4. Branch for Conversational Agents (Baileys or Meta Cloud API)
  const isAiAgent =
    (brandAiConfig?.templateType || "BAILEYS_AI") === "BAILEYS_AI" ||
    brandAiConfig?.templateType === "META_CLOUD_API";

  if (isAiAgent) {
    return await processBaileysAgentMessage({
      userMessage,
      brandId,
      brandName,
      brandAiConfig,
      senderIdentifier,
      sessionState,
      activeIdentifier,
      history: conversationHistory,
    });
  }

  let responseText = "";
  let executedTool = "DECISION_TREE_NAVIGATION";

  // Helper: Find option in tree by ID
  const findOptionInTree = (
    options: FlowMenuOption[],
    id: string
  ): FlowMenuOption | null => {
    for (const opt of options) {
      if (opt.id === id) return opt;
      if (opt.subOptions && opt.subOptions.length > 0) {
        const found = findOptionInTree(opt.subOptions, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper: Get active options based on current path and status
  const getActiveOptions = (): {
    options: FlowMenuOption[];
    headerText: string;
    parentTitle?: string;
  } => {
    if (sessionState.currentPath.length === 0) {
      const visible = flowConfig.menuStep.options.filter((opt) => {
        if (!opt.enabled) return false;
        if (sessionState.isMora) {
          return (
            opt.condition === "IS_MORA" ||
            opt.condition === "ALL" ||
            !opt.condition
          );
        }
        return (
          opt.condition === "IS_ACTIVE" ||
          opt.condition === "ALL" ||
          !opt.condition
        );
      });
      return {
        options: visible,
        headerText: flowConfig.menuStep.menuHeader.replace(
          "{{clientName}}",
          sessionState.titular || "Estimado(a) abonado(a)"
        ),
      };
    }

    // Traverse down the path
    let currentLevel = flowConfig.menuStep.options;
    let parentOpt: FlowMenuOption | null = null;
    for (const id of sessionState.currentPath) {
      const match = findOptionInTree(currentLevel, id);
      if (match && match.subOptions) {
        parentOpt = match;
        currentLevel = match.subOptions;
      }
    }

    return {
      options: currentLevel.filter((o) => o.enabled),
      headerText: parentOpt?.responseText || `📂 *${parentOpt?.title || "Opciones"}*`,
      parentTitle: parentOpt?.title,
    };
  };

  // Helper: Render menu options formatted for WhatsApp
  const renderFormattedMenu = (
    title: string,
    opts: FlowMenuOption[],
    isSubmenu = false
  ): string => {
    const lines = opts.map((o) => `*${o.digit}.* ${o.title}`);
    if (isSubmenu) {
      lines.push("*0.* ⬅️ Volver al menú anterior");
    }
    return `${title}\n\n${lines.join("\n")}`;
  };

  // Priority 1: User enters new document or contract number
  if (docMatch || contractMatch) {
    const lookupId = docMatch ? docMatch[1] : contractMatch![0];
    const clientRes = await consultarClienteTool(lookupId, brandId);

    if (clientRes.ok && clientRes.data) {
      const data = clientRes.data as Record<string, unknown>;
      sessionState.currentPath = [];
      sessionState.clientDocument = docMatch?.[1];
      sessionState.titular = String(data.titular || "");

      if (data.multiples_contratos) {
        const servicios = (data.servicios as Array<{
          numero_contrato: string;
          direccion: string;
          plan: string;
        }>) || [];
        const lista = servicios
          .map(
            (s, i) =>
              `*${i + 1}.* Contrato #${s.numero_contrato}: ${s.direccion} (${s.plan})`
          )
          .join("\n");
        responseText =
          `¡Hola ${data.titular}! Encontré ${servicios.length} contratos a tu nombre:\n\n` +
          `${lista}\n\n` +
          `¿Sobre cuál de ellos deseas consultar? Por favor escribe el número de contrato.`;
      } else {
        sessionState.contractNumber = String(data.numero_contrato);
        sessionState.isMora = data.estado_cuenta === "SUSPENDIDO_MORA";

        const { options } = getActiveOptions();

        if (sessionState.isMora) {
          const saldoRes = await consultarSaldoTool(
            sessionState.contractNumber,
            brandId
          );
          const totalPendiente =
            saldoRes.ok && saldoRes.data ? saldoRes.data.totalPendiente : 65000;
          const totalCOP = new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0,
          }).format(totalPendiente);

          const header =
            `Estimado(a) ${data.titular}, su servicio (Contrato #${data.numero_contrato}) ` +
            `se encuentra SUSPENDIDO por facturación pendiente.\n\n` +
            `• Saldo total adeudado: ${totalCOP}\n` +
            `• Pago en línea PSE: https://pagos.serkoi.com/p/${data.numero_contrato}\n\n` +
            `¿Qué deseas hacer?`;
          responseText = renderFormattedMenu(header, options, false);
        } else {
          const header =
            `¡Hola ${data.titular}! Tu servicio en ${data.direccion} ` +
            `(Contrato #${data.numero_contrato}, Plan ${data.plan}) está ACTIVO.\n\n` +
            `¿En qué podemos ayudarte hoy?`;
          responseText = renderFormattedMenu(header, options, false);
        }
      }

      await logAiConversation(
        brandId,
        senderIdentifier,
        userMessage,
        responseText,
        35,
        sessionState
      );
      return { message: responseText, provider: "guided" };
    }
  }

  // Priority 2: Navigation "0" or "volver" / "atras"
  if (
    cleanMsg === "0" ||
    cleanMsg === "volver" ||
    cleanMsg === "atras" ||
    cleanMsg === "atrás" ||
    cleanMsg === "regresar" ||
    cleanMsg === "menu" ||
    cleanMsg === "menú"
  ) {
    if (sessionState.currentPath.length > 0) {
      sessionState.currentPath.pop();
    }
    const { options, headerText } = getActiveOptions();
    responseText = renderFormattedMenu(
      headerText,
      options,
      sessionState.currentPath.length > 0
    );

    await logAiConversation(
      brandId,
      senderIdentifier,
      userMessage,
      responseText,
      25,
      sessionState
    );
    return { message: responseText, provider: "guided" };
  }

  // Priority 3: Match against active options at current tree node
  const { options: activeOpts } = getActiveOptions();
  let matchedOption: FlowMenuOption | null = null;

  // 3a. Exact digit match in current menu
  const digitMatch = activeOpts.find((o) => o.digit === cleanMsg);
  if (digitMatch) {
    matchedOption = digitMatch;
  }

  // 3b. Keyword match in current menu if no digit
  if (!matchedOption) {
    const kwMatch = activeOpts.find((o) =>
      o.keywords.some((k) => cleanMsg.includes(k.toLowerCase()))
    );
    if (kwMatch) {
      matchedOption = kwMatch;
    }
  }

  // 3c. Global keyword fallback across entire tree if not matched locally
  if (!matchedOption) {
    const allOptions = [
      ...flowConfig.menuStep.options,
      ...(flowConfig.menuStep.options.flatMap((o) => o.subOptions || [])),
    ];
    const globalKw = allOptions.find(
      (o) =>
        o.enabled &&
        o.keywords.some((k) => cleanMsg.includes(k.toLowerCase()))
    );
    if (globalKw) {
      matchedOption = globalKw;
    }
  }

  // 4. Execute matched option (Branch vs Leaf Tool)
  if (matchedOption) {
    executedTool = matchedOption.actionType;

    // Branch navigation
    if (
      matchedOption.actionType === "BRANCH_MENU" ||
      (matchedOption.subOptions && matchedOption.subOptions.length > 0)
    ) {
      sessionState.currentPath.push(matchedOption.id);
      const subLevel = matchedOption.subOptions || [];
      const title =
        matchedOption.responseText ||
        `🛠️ *${matchedOption.title}*\nSelecciona una opción:`;
      responseText = renderFormattedMenu(title, subLevel, true);
    } else if (matchedOption.actionType === "GO_BACK") {
      if (sessionState.currentPath.length > 0) {
        sessionState.currentPath.pop();
      }
      const { options, headerText } = getActiveOptions();
      responseText = renderFormattedMenu(
        headerText,
        options,
        sessionState.currentPath.length > 0
      );
    } else if (matchedOption.actionType === "PROMISE_PAYMENT") {
      const targetContract = sessionState.contractNumber || activeIdentifier;
      const promiseRes = await promesaPagoTool(targetContract, brandId);
      responseText = promiseRes.message;
    } else if (matchedOption.actionType === "KICK_PPPOE_SESSION") {
      const targetContract = sessionState.contractNumber || activeIdentifier;
      const kickRes = await reiniciarPppoeTool(targetContract, brandId);
      responseText = kickRes.message;
    } else if (matchedOption.actionType === "DIAGNOSTIC_MIKROTIK") {
      const targetContract = sessionState.contractNumber || activeIdentifier;
      const diagRes = await diagnosticarServicioTool(targetContract, brandId);

      if (diagRes.ok && diagRes.data) {
        const diag = diagRes.data as Record<string, unknown>;
        if (diag.estado_enlace === "ONLINE") {
          responseText =
            `✅ Diagnóstico en tiempo real para Contrato #${diag.contrato} ` +
            `(${diag.titular}):\n\n` +
            `• Sesión MikroTik: ONLINE (PPPoE activo)\n` +
            `• Tiempo de conexión: ${diag.uptime || "Activo"}\n` +
            `• Tecnología: ${diag.tecnologia}\n` +
            (diag.potencia_optica_rx
              ? `• Potencia Óptica Rx: ${diag.potencia_optica_rx} dBm (Rango óptimo)\n`
              : "") +
            `\nEl enlace responde adecuadamente. Si sientes lentitud, reinicia tu router ` +
            `desconectándolo de la toma de corriente durante 2 minutos.`;
        } else if (diag.estado_enlace === "SUSPENDIDO_MORA") {
          responseText =
            `El servicio reporta corte por cartera pendiente. Escribe "promesa" ` +
            `para reactivar 24 horas de gracia o "saldo" para ver el link de pago.`;
        } else {
          responseText =
            `⚠️ Diagnóstico: El enlace hacia tu router reporta estado OFFLINE.\n\n` +
            `Revisa si el router está energizado. Si la luz LOS parpadea en rojo, ` +
            `escribe "visita" para agendar un técnico a domicilio.`;
        }
      } else {
        responseText =
          diagRes.error ||
          "No fue posible completar el diagnóstico de servicio en este momento.";
      }
    } else if (matchedOption.actionType === "BILLING_BALANCE") {
      const target = sessionState.contractNumber || activeIdentifier;
      const saldoRes = await consultarSaldoTool(target, brandId);
      if (saldoRes.ok && saldoRes.data) {
        const d = saldoRes.data;
        if (d.totalPendiente > 0) {
          const totalCOP = new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0,
          }).format(d.totalPendiente);

          responseText =
            `💰 Estado de Cartera para ${d.titular} (Contrato #${d.contrato}):\n\n` +
            `• Total en mora: ${totalCOP}\n` +
            `• Facturas pendientes: ${d.facturasPendientes} ` +
            `(${d.facturaDetalle || "Mensualidad"})\n` +
            `• Pagar en línea vía PSE: ${d.linkPagoPse}\n\n` +
            `💡 Si no puedes pagar hoy, escribe "promesa" para activar 24 horas de gracia ` +
            `y reactivar tu navegación de inmediato.`;
        } else {
          responseText =
            `✅ ¡Buenas noticias! Tu servicio (Contrato #${d.contrato}) se encuentra al día. ` +
            `No registras facturas pendientes de pago.`;
        }
      } else {
        responseText =
          `No se encontró información de cartera. Por favor escribe tu número de cédula o ` +
          `contrato para consultar tu saldo.`;
      }
    } else if (matchedOption.actionType === "SCHEDULE_VISIT") {
      const target = sessionState.contractNumber || activeIdentifier;
      const jornada = cleanMsg.includes("tarde") ? "TARDE" : "MAÑANA";
      const visitRes = await agendarVisitaTool(target, jornada, brandId);
      responseText = visitRes.message;
    } else if (matchedOption.actionType === "TRANSFER_HUMAN") {
      const target = sessionState.contractNumber || activeIdentifier;
      const res = await transferirHumanoTool(
        target,
        "Solicitud explícita de cliente vía WhatsApp",
        brandId
      );
      responseText =
        `Entiendo perfectamente. He transferido tu solicitud a nuestro equipo de ` +
        `atención humana (${res.message}). Un asesor se comunicará contigo por este canal ` +
        `a la brevedad. ¡Gracias!`;
    } else if (matchedOption.actionType === "CUSTOM_TEXT") {
      responseText =
        matchedOption.responseText ||
        "Tu solicitud ha sido procesada con éxito por nuestro sistema.";
    }
  }

  // 5. Fallback or initial greeting
  if (!responseText) {
    if (sessionState.contractNumber || sessionState.clientDocument) {
      const { options, headerText } = getActiveOptions();
      responseText =
        `No logré comprender esa opción. Por favor escribe el número deseado ` +
        `o 'asesor' para soporte humano.\n\n` +
        renderFormattedMenu(
          headerText,
          options,
          sessionState.currentPath.length > 0
        );
    } else {
      responseText =
        flowConfig.welcomeStep.greeting.replace("{{brandName}}", brandName) +
        "\n\n" +
        flowConfig.welcomeStep.askIdentifierPrompt;
    }
  }

  const isTransferred =
    executedTool === "TRANSFER_HUMAN" ||
    cleanMsg === "asesor" ||
    cleanMsg.includes("hablar con un asesor");

  await logAiConversation(
    brandId,
    senderIdentifier,
    userMessage,
    responseText,
    50,
    sessionState,
    executedTool,
    isTransferred
  );

  return {
    message: responseText,
    provider: "guided",
  };
}

async function logAiConversation(
  brandId: string,
  senderIdentifier: string,
  userMessage: string,
  aiResponse: string,
  tokensUsed = 0,
  sessionState?: ConversationSessionState,
  toolName = "Triaje",
  transferredToHuman = false
): Promise<void> {
  try {
    let contractId: string | null = null;
    if (sessionState?.contractNumber) {
      const contract = await prisma.contract.findFirst({
        where: { brandId, contractNumber: sessionState.contractNumber },
        select: { id: true },
      });
      contractId = contract?.id ?? null;
    } else if (sessionState?.clientDocument) {
      const contract = await prisma.contract.findFirst({
        where: {
          brandId,
          client: { documentNumber: sessionState.clientDocument },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      contractId = contract?.id ?? null;
    }

    await prisma.aiConversationLog.create({
      data: {
        brandId,
        contractId,
        channel: "WHATSAPP",
        senderIdentifier,
        userMessage,
        aiResponse,
        tokensUsed,
        transferredToHuman,
        toolsInvoked: {
          toolName,
          _session: sessionState
            ? (sessionState as unknown as Prisma.InputJsonValue)
            : null,
        },
      },
    });
  } catch (_err) {
    // Non-blocking log persistence
  }
}

async function processBaileysAgentMessage(params: {
  userMessage: string;
  brandId: string;
  brandName: string;
  brandAiConfig: {
    botName?: string | null;
    systemPrompt?: string | null;
  } | null;
  senderIdentifier: string;
  sessionState: ConversationSessionState;
  activeIdentifier: string;
  history?: AiChatMessage[];
}): Promise<AiEngineResponse> {
  const apiKey =
    process.env.ISP_AI_API_KEY || process.env.OPENAI_API_KEY || "";

  // 1. If ISP AI API Key is not set, notify clearly
  if (!apiKey) {
    const errorReply =
      `⚠️ *Configuración de IA Requerida*\n\n` +
      `El Agente IA de WhatsApp no puede responder porque no se ha configurado ` +
      `la variable ISP_AI_API_KEY en el servidor.\n\n` +
      `Por favor define tu clave de OpenAI en el archivo .env para habilitar ` +
      `el procesamiento autónomo gobernado por tu Prompt Maestro.`;
    await logAiConversation(
      params.brandId,
      params.senderIdentifier,
      params.userMessage,
      errorReply,
      0,
      params.sessionState,
      "ENV_VAR_MISSING"
    );
    return { message: errorReply, provider: "guided" };
  }

  // 2. Hydrate System Prompt from Brand Configuration
  const botName = params.brandAiConfig?.botName || "Lumi";
  const rawPrompt =
    params.brandAiConfig?.systemPrompt ||
    AI_AGENT_TEMPLATES.BAILEYS_AI.defaultSystemPrompt;

  const now = new Date();
  const dateFormatted = now.toISOString().split("T")[0];
  const dayName = now.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeFormatted = now.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hydratedPrompt = rawPrompt
    .replace(/{{brandName}}/g, params.brandName)
    .replace(/{{botName}}/g, botName)
    .replace(
      /{{clientName}}/g,
      params.sessionState.titular || "Estimado(a) abonado(a)"
    )
    .replace(/{{currentDate}}/g, dateFormatted)
    .replace(/{{currentDay}}/g, dayName)
    .replace(/{{currentTime}}/g, timeFormatted);

  // 3. Define ISP Tools for OpenAI Function Calling
  const tools = [
    {
      type: "function",
      function: {
        name: "consultar_cliente",
        description:
          "Busca datos del abonado por Cédula, NIT o número de contrato.",
        parameters: {
          type: "object",
          properties: {
            identificador: {
              type: "string",
              description: "Cédula o número de contrato del abonado.",
            },
          },
          required: ["identificador"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "diagnosticar_servicio",
        description:
          "Diagnostica en vivo la conexión MikroTik (PPPoE, uptime, Rx).",
        parameters: {
          type: "object",
          properties: {
            contrato: {
              type: "string",
              description: "Número de contrato del abonado.",
            },
          },
          required: ["contrato"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "reiniciar_pppoe",
        description:
          "Reinicia la sesión PPPoE en MikroTik para refrescar navegación.",
        parameters: {
          type: "object",
          properties: {
            contrato: {
              type: "string",
              description: "Número de contrato del abonado.",
            },
          },
          required: ["contrato"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "consultar_saldo",
        description:
          "Consulta saldo en mora, facturas pendientes y link de pago PSE.",
        parameters: {
          type: "object",
          properties: {
            contrato: {
              type: "string",
              description: "Número de contrato o cédula del abonado.",
            },
          },
          required: ["contrato"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "promesa_pago",
        description:
          "Otorga prórroga de 24 horas y reactiva el servicio suspendido en MikroTik.",
        parameters: {
          type: "object",
          properties: {
            contrato: {
              type: "string",
              description:
                "Número de contrato del abonado (obtenido al consultar " +
                "cliente, ej: TEST-001) o documento.",
            },
          },
          required: ["contrato"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "consultar_disponibilidad",
        description:
          "Verifica cupos de visitas técnicas para una fecha específica.",
        parameters: {
          type: "object",
          properties: {
            fecha_cita: {
              type: "string",
              description: "Fecha en formato YYYY-MM-DD.",
            },
          },
          required: ["fecha_cita"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "agendar_visita",
        description:
          "Agenda una visita técnica presencial en jornada Mañana o Tarde.",
        parameters: {
          type: "object",
          properties: {
            contrato: {
              type: "string",
              description: "Número de contrato del cliente.",
            },
            jornada: {
              type: "string",
              enum: ["MANANA", "TARDE"],
              description: "Jornada: MANANA (8am-1pm) o TARDE (1pm-6pm).",
            },
            fecha_cita: {
              type: "string",
              description: "Fecha deseada en formato YYYY-MM-DD.",
            },
          },
          required: ["contrato", "jornada"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "consultar_visita",
        description:
          "Verifica si el abonado ya tiene visitas técnicas programadas.",
        parameters: {
          type: "object",
          properties: {
            contrato: {
              type: "string",
              description: "Número de contrato o cédula del cliente.",
            },
          },
          required: ["contrato"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "transferir_humano",
        description:
          "Transfiere la atención a la bandeja de operadores humanos.",
        parameters: {
          type: "object",
          properties: {
            motivo: {
              type: "string",
              description: "Motivo por el cual se escala a un asesor.",
            },
          },
          required: ["motivo"],
        },
      },
    },
  ];

  try {
    const model = process.env.ISP_AI_MODEL || "gpt-4o-mini";
    const messages: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content?: string | null;
      tool_calls?: unknown[];
      tool_call_id?: string;
    }> = [
      { role: "system", content: hydratedPrompt },
      ...(params.history || []).map((h) => ({
        role: h.role,
        content: h.content,
      })),
      { role: "user", content: params.userMessage },
    ];

    const firstRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          temperature: 0.3,
        }),
      }
    );

    if (!firstRes.ok) {
      throw new Error(`OpenAI HTTP Error: ${firstRes.statusText}`);
    }

    const firstData = (await firstRes.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage?: { total_tokens?: number };
    };

    const choice = firstData.choices?.[0]?.message;
    if (!choice) {
      throw new Error("Respuesta vacía de OpenAI.");
    }

    // 4. Handle Tool Invocations if the LLM called any
    if (choice.tool_calls && choice.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: choice.content || null,
        tool_calls: choice.tool_calls,
      });

      let executedToolName = "TOOL_CALL";
      let isTransferred = false;

      for (const call of choice.tool_calls) {
        executedToolName = call.function.name;
        let args: Record<string, string> = {};
        try {
          args = JSON.parse(call.function.arguments);
        } catch (_jsonErr) {
          args = {};
        }

        let result: unknown = null;
        if (call.function.name === "consultar_cliente") {
          const res = await consultarClienteTool(
            args.identificador || params.activeIdentifier,
            params.brandId
          );
          if (res.ok && res.data) {
            const d = res.data as Record<string, unknown>;
            params.sessionState.contractNumber = String(d.numero_contrato || "");
            params.sessionState.titular = String(d.titular || "");
            params.sessionState.clientDocument = args.identificador;
            params.sessionState.isMora = d.estado_cuenta === "SUSPENDIDO_MORA";
          }
          result = res;
        } else if (call.function.name === "diagnosticar_servicio") {
          const target =
            params.sessionState.contractNumber ||
            args.contrato ||
            params.activeIdentifier;
          result = await diagnosticarServicioTool(target, params.brandId);
        } else if (call.function.name === "reiniciar_pppoe") {
          const target =
            params.sessionState.contractNumber ||
            args.contrato ||
            params.activeIdentifier;
          result = await reiniciarPppoeTool(target, params.brandId);
        } else if (call.function.name === "consultar_saldo") {
          const target =
            params.sessionState.contractNumber ||
            args.contrato ||
            params.activeIdentifier;
          result = await consultarSaldoTool(target, params.brandId);
        } else if (call.function.name === "promesa_pago") {
          const target =
            params.sessionState.contractNumber ||
            args.contrato ||
            params.activeIdentifier;
          result = await promesaPagoTool(target, params.brandId);
        } else if (call.function.name === "consultar_disponibilidad") {
          result = await consultarDisponibilidadTool(
            args.fecha_cita,
            params.brandId
          );
        } else if (call.function.name === "agendar_visita") {
          const target = args.contrato || params.activeIdentifier;
          const jornada = args.jornada === "TARDE" ? "TARDE" : "MAÑANA";
          result = await agendarVisitaTool(target, jornada, params.brandId, {
            fechaCita: args.fecha_cita,
          });
        } else if (call.function.name === "consultar_visita") {
          const target = args.contrato || params.activeIdentifier;
          result = await consultarVisitaTool(target, params.brandId);
        } else if (call.function.name === "transferir_humano") {
          isTransferred = true;
          result = await transferirHumanoTool(
            params.activeIdentifier,
            args.motivo || "Derivación por IA",
            params.brandId
          );
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      // Second call to OpenAI with tool outputs for final natural answer
      const secondRes = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.3,
          }),
        }
      );

      if (secondRes.ok) {
        const secondData = (await secondRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { total_tokens?: number };
        };
        const finalContent = secondData.choices?.[0]?.message?.content;
        if (finalContent) {
          await logAiConversation(
            params.brandId,
            params.senderIdentifier,
            params.userMessage,
            finalContent,
            secondData.usage?.total_tokens || firstData.usage?.total_tokens,
            params.sessionState,
            executedToolName,
            isTransferred
          );
          return { message: finalContent, provider: "openai" };
        }
      }
    }

    // 5. Direct LLM Response (no tool called)
    const directContent =
      choice.content ||
      "No logré generar una respuesta. ¿Cómo puedo ayudarte con tu servicio?";
    await logAiConversation(
      params.brandId,
      params.senderIdentifier,
      params.userMessage,
      directContent,
      firstData.usage?.total_tokens,
      params.sessionState,
      "LLM_DIRECT_COMPLETION"
    );
    return { message: directContent, provider: "openai" };
  } catch (_err) {
    const fallbackMsg =
      `Disculpa, en este momento estoy presentando una intermitencia de ` +
      `procesamiento. Por favor escribe "asesor" si deseas que un operador ` +
      `humano te atienda de inmediato.`;
    return { message: fallbackMsg, provider: "guided" };
  }
}
