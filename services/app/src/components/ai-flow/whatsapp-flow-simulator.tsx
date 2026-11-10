"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  RotateCcw,
  Sparkles,
  Phone,
  Video,
  CheckCheck,
  Bot,
  ShieldAlert,
} from "lucide-react";
import type { ChatbotFlowConfig, FlowMenuOption, AiTemplateType } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendSimulatorMessageAction } from "@/actions/ai";

interface WhatsAppFlowSimulatorProps {
  botName: string;
  brandName: string;
  flow: ChatbotFlowConfig;
  templateType?: AiTemplateType;
  brandId?: string;
  hasIspAiApiKey?: boolean;
  onActionExecuted?: () => void;
}

interface SimMessage {
  id: string;
  sender: "bot" | "user" | "system";
  text: string;
  time: string;
}

export function WhatsAppFlowSimulator({
  botName,
  brandName,
  flow,
  templateType = "RULES_BOT",
  brandId,
  hasIspAiApiKey = true,
  onActionExecuted,
}: WhatsAppFlowSimulatorProps) {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isBotTyping, setIsBotTyping] = useState<boolean>(false);
  const [step, setStep] = useState<"AWAITING_ID" | "MENU" | "TRANSFERRED">("AWAITING_ID");
  const [identifiedClient, setIdentifiedClient] = useState<string | null>(null);
  const [simulatorSenderId, setSimulatorSenderId] = useState<string>(
    () => `sim-${Date.now()}`
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef(flow);

  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const buildMenuText = useCallback(
    (client: string) => {
      const currentFlow = flowRef.current;
      const header = currentFlow.menuStep.menuHeader
        .replace(/{{brandName}}/g, brandName)
        .replace(/{{clientName}}/g, client);

      const activeOpts = currentFlow.menuStep.options
        .filter((o) => o.enabled)
        .map((o) => `*${o.digit}.* ${o.title}`)
        .join("\n");

      return `${header}\n\n${activeOpts}`;
    },
    [brandName]
  );

  const resetChat = useCallback(() => {
    setSimulatorSenderId(`sim-${Date.now()}`);
    const currentFlow = flowRef.current;
    const time = formatTime();
    const initialMsgs: SimMessage[] = [];

    if (templateType === "BAILEYS_AI") {
      if (!hasIspAiApiKey) {
        initialMsgs.push({
          id: "msg-warn-key",
          sender: "system",
          text:
            "⚠️ Atención: No se ha detectado la variable ISP_AI_API_KEY en .env. " +
            "Para interactuar con el Agente guiado por tu Prompt Maestro, define tu " +
            "clave de OpenAI.",
          time,
        });
      }
      initialMsgs.push({
        id: "msg-greet-ai",
        sender: "bot",
        text:
          `¡Hola! 👋 Soy ${botName || "tu Asistente Virtual"}, asistente oficial ` +
          `de ${brandName}. ¿En qué te puedo colaborar hoy?`,
        time,
      });
      setStep("MENU");
      setIdentifiedClient(null);
    } else if (templateType === "META_CLOUD_API") {
      initialMsgs.push({
        id: "msg-greet-meta",
        sender: "bot",
        text:
          `📌 [Plantilla Oficial Meta HSM]\n` +
          `Estimado(a) abonado(a) de ${brandName}, tu canal oficial está activo. ` +
          `¿En qué podemos servirte hoy?`,
        time,
      });
      setStep("MENU");
      setIdentifiedClient("Rosaura Meza");
    } else {
      // RULES_BOT
      const greeting = currentFlow.welcomeStep.greeting
        .replace(/{{brandName}}/g, brandName)
        .replace(/{{clientName}}/g, "Abonado");

      initialMsgs.push({
        id: "msg-greet",
        sender: "bot",
        text: greeting,
        time,
      });

      if (currentFlow.welcomeStep.requireIdentification) {
        initialMsgs.push({
          id: "msg-ask-id",
          sender: "bot",
          text: currentFlow.welcomeStep.askIdentifierPrompt,
          time,
        });
        setStep("AWAITING_ID");
        setIdentifiedClient(null);
      } else {
        const client = "Cliente Serkoi";
        setIdentifiedClient(client);
        initialMsgs.push({
          id: "msg-menu",
          sender: "bot",
          text: buildMenuText(client),
          time,
        });
        setStep("MENU");
      }
    }

    setMessages(initialMsgs);
    setInputText("");
  }, [brandName, buildMenuText, templateType, botName]);

  useEffect(() => {
    resetChat();
  }, [templateType, brandId, resetChat]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const replaceTemplateVars = (rawText: string, option?: FlowMenuOption) => {
    const client = identifiedClient || "Carlos Prueba NOC";
    return rawText
      .replace(/{{brandName}}/g, brandName)
      .replace(/{{clientName}}/g, client)
      .replace(/{{cliente}}/g, client)
      .replace(/{{ip}}/g, "192.168.196.250")
      .replace(/{{estado}}/g, "🔴 SUSPENDIDO_MORA / OFFLINE")
      .replace(/{{uptime}}/g, "0m (Suspendido por mora)")
      .replace(/{{saldo}}/g, "$65.000 COP")
      .replace(/{{fecha_corte}}/g, "Factura FAC-TEST-001")
      .replace(/{{link_pago}}/g, "https://pagos.serkoi.com/p/TEST-001")
      .replace(/{{horas_gracia}}/g, "24")
      .replace(/{{cupos_manana}}/g, "4")
      .replace(/{{cupos_tarde}}/g, "4")
      .replace(/{{opcion}}/g, option?.title || "");
  };

  const handleSendMessage = async (e?: React.FormEvent, directInput?: string) => {
    if (e) e.preventDefault();
    const raw = directInput || inputText;
    const trimmed = raw.trim();
    if (!trimmed || isBotTyping) return;

    const time = formatTime();
    const userMsg: SimMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: trimmed,
      time,
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInputText("");
    setIsBotTyping(true);

    const historyLimit = flow.historyLimit || 10;
    const historyPayload = messages
      .filter((m) => m.sender === "user" || m.sender === "bot")
      .slice(-historyLimit)
      .map((m) => ({
        role: (m.sender === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.text,
      }));

    try {
      const res = await sendSimulatorMessageAction({
        message: trimmed,
        brandId,
        senderIdentifier: simulatorSenderId,
        history: historyPayload,
      });

      if (res.success && res.data?.message) {
        setMessages([
          ...newMsgs,
          {
            id: `bot-${Date.now()}`,
            sender: "bot",
            text: res.data.message,
            time: formatTime(),
          },
        ]);
        onActionExecuted?.();
      } else {
        processBotResponse(trimmed, newMsgs);
      }
    } catch (_err) {
      processBotResponse(trimmed, newMsgs);
    } finally {
      setIsBotTyping(false);
    }
  };

  const processBotResponse = (userInput: string, currentMsgs: SimMessage[]) => {
    const lower = userInput.toLowerCase();
    const time = formatTime();

    // Check human escape keywords first
    const isEscape = flow.fallbackStep.triggerKeywords.some((kw) =>
      lower.includes(kw.toLowerCase())
    );

    if (isEscape) {
      setStep("TRANSFERRED");
      setMessages([
        ...currentMsgs,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: flow.fallbackStep.transferMessage,
          time,
        },
        {
          id: `sys-${Date.now()}`,
          sender: "system",
          text: "Conversación transferida a la bandeja de operadores humanos en tiempo real.",
          time,
        },
      ]);
      return;
    }

    if (templateType !== "RULES_BOT") {
      if (!hasIspAiApiKey) {
        setMessages([
          ...currentMsgs,
          {
            id: `bot-warn-${Date.now()}`,
            sender: "system",
            text:
              "⚠️ No se ha detectado la variable ISP_AI_API_KEY en el servidor. " +
              "Por favor agrégala en tu archivo .env para interactuar con tu Prompt Maestro.",
            time,
          },
        ]);
        return;
      }

      // If already identified
      if (
        lower.includes("lento") ||
        lower.includes("lentitud") ||
        lower.includes("falla") ||
        lower.includes("sin internet") ||
        lower.includes("caido") ||
        lower.includes("caído")
      ) {
        setMessages([
          ...currentMsgs,
          {
            id: `bot-ai-${Date.now()}`,
            sender: "bot",
            text:
              "Revisando tu conexión en el router central...\n" +
              "• Contrato: #759 (Rosaura Meza)\n" +
              "• Estado MikroTik: 🟢 ONLINE (PPPoE activo)\n" +
              "• Uptime: 3d 14h 22m | Potencia Óptica: -21.4 dBm\n" +
              "• IP: 192.168.196.214\n\n" +
              "Hemos enviado un reinicio a tu sesión PPPoE para optimizar la señal. " +
              "Por favor espera 60 segundos y comprueba la navegación.",
            time,
          },
        ]);
        return;
      }

      if (
        lower.includes("saldo") ||
        lower.includes("pagar") ||
        lower.includes("factura") ||
        lower.includes("pse")
      ) {
        setMessages([
          ...currentMsgs,
          {
            id: `bot-ai-${Date.now()}`,
            sender: "bot",
            text:
              "Tu estado de cuenta actual:\n" +
              "• Saldo pendiente: $65.000 COP\n" +
              "• Fecha de corte: 15 de cada mes\n" +
              "• Enlace de pago PSE seguro: https://pagos.serkoi.com/p/759",
            time,
          },
        ]);
        return;
      }

      if (
        lower.includes("visita") ||
        lower.includes("tecnico") ||
        lower.includes("técnico") ||
        lower.includes("agendar")
      ) {
        setMessages([
          ...currentMsgs,
          {
            id: `bot-ai-${Date.now()}`,
            sender: "bot",
            text:
              "Disponibilidad de visitas técnicas en tu sector:\n" +
              "• Mañana (8:00 AM - 1:00 PM): 3 cupos disponibles\n" +
              "• Tarde (1:00 PM - 6:00 PM): 4 cupos disponibles\n\n" +
              "¿Para qué día y en cuál jornada prefieres agendar a nuestra cuadrilla?",
            time,
          },
        ]);
        return;
      }

      setMessages([
        ...currentMsgs,
        {
          id: `bot-ai-${Date.now()}`,
          sender: "bot",
          text:
            `Comprendo tu consulta sobre "${userInput}". ` +
            `Puedo verificar tu servicio, consultar pagos o comunicarte ` +
            `con un asesor humano. ¿Cómo prefieres continuar?`,
          time,
        },
      ]);
      return;
    }

    if (step === "AWAITING_ID") {
      const clientName = "Carlos Prueba NOC";
      setIdentifiedClient(clientName);
      setStep("MENU");

      const confirmMsg: SimMessage = {
        id: `bot-id-${Date.now()}`,
        sender: "bot",
        text: `¡Hola ${clientName}! Hemos verificado tu Contrato #TEST-001 en el sistema.`,
        time,
      };

      const menuMsg: SimMessage = {
        id: `bot-menu-${Date.now()}`,
        sender: "bot",
        text: buildMenuText(clientName),
        time,
      };

      setMessages([...currentMsgs, confirmMsg, menuMsg]);
      return;
    }

    // Step is MENU
    const matchedOption = flow.menuStep.options.find(
      (opt) =>
        opt.enabled &&
        (opt.digit.toLowerCase() === lower ||
          opt.keywords.some((kw) => lower.includes(kw.toLowerCase())))
    );

    if (matchedOption) {
      const replyText = replaceTemplateVars(matchedOption.responseText, matchedOption);
      const botReply: SimMessage = {
        id: `bot-opt-${Date.now()}`,
        sender: "bot",
        text: replyText,
        time,
      };

      if (matchedOption.actionType === "TRANSFER_HUMAN") {
        setStep("TRANSFERRED");
        setMessages([
          ...currentMsgs,
          botReply,
          {
            id: `sys-${Date.now()}`,
            sender: "system",
            text: "Ticket escalado a Soporte Técnico Nivel 1.",
            time,
          },
        ]);
      } else {
        setMessages([...currentMsgs, botReply]);
      }
      return;
    }

    // Unmatched fallback
    setMessages([
      ...currentMsgs,
      {
        id: `bot-fallback-${Date.now()}`,
        sender: "bot",
        text: flow.fallbackStep.fallbackMessage,
        time,
      },
    ]);
  };

  const handleSimulateChoice = (digitOrWord: string) => {
    handleSendMessage(undefined, digitOrWord);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Phone Mockup Frame */}
      <div
        className={cn(
          "w-full max-w-[340px] sm:max-w-[370px] rounded-[36px] overflow-hidden",
          "border-4 border-zinc-700/80 shadow-2xl bg-zinc-900 flex flex-col",
          "h-[620px] transition-all duration-200"
        )}
      >
        {/* Phone Top Notch / Speaker */}
        <div className="bg-zinc-900 px-6 pt-3 pb-1 flex items-center justify-between">
          <div className="text-[10px] font-semibold text-zinc-300">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="h-4 w-24 bg-zinc-800 rounded-full mx-auto" />
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-zinc-400">4G</span>
          </div>
        </div>

        {/* WhatsApp App Header */}
        <div className="bg-emerald-700 text-white px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "h-8 w-8 rounded-full bg-emerald-800 border border-emerald-500/30",
                "flex items-center justify-center font-bold text-xs"
              )}
            >
              <Bot className="h-4 w-4 text-emerald-200" />
            </div>
            <div>
              <div className="text-xs font-bold leading-tight flex items-center gap-1">
                <span>{botName || "Bot WhatsApp"}</span>
                <span className="text-[9px] bg-emerald-600/70 px-1 py-0.2 rounded text-emerald-100">
                  ISP
                </span>
              </div>
              <div className="text-[10px] text-emerald-100/90 leading-none">
                en línea
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-emerald-100">
            <Video className="h-4 w-4 opacity-70" />
            <Phone className="h-3.5 w-3.5 opacity-70" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={resetChat}
              title="Reiniciar Simulación"
              className="h-7 w-7 text-emerald-100 hover:bg-emerald-600/50 rounded-full"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* WhatsApp Chat Canvas */}
        <div
          ref={chatContainerRef}
          className={cn(
            "flex-1 p-3 overflow-y-auto space-y-2.5 text-xs font-sans",
            "bg-[#efeae2] dark:bg-[#0b141a] transition-colors"
          )}
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.03) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          {/* Encryption Pill */}
          <div className="text-center my-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px]",
                "bg-amber-50 dark:bg-zinc-800 text-amber-800 dark:text-amber-300",
                "shadow-2xs border border-amber-200 dark:border-amber-800/40"
              )}
            >
              🔒 Mensajes cifrados de extremo a extremo con el ISP
            </span>
          </div>

          {/* Date pill */}
          <div className="text-center">
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-md text-[9px] font-semibold",
                "bg-white/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 shadow-2xs"
              )}
            >
              HOY
            </span>
          </div>

          {/* Messages Thread */}
          {messages.map((m) => {
            if (m.sender === "system") {
              return (
                <div key={m.id} className="text-center my-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[10px]",
                      "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300",
                      "border border-emerald-300 dark:border-emerald-800/50"
                    )}
                  >
                    <ShieldAlert className="h-3 w-3 shrink-0" />
                    {m.text}
                  </span>
                </div>
              );
            }

            const isBot = m.sender === "bot";
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-end gap-1 max-w-[85%]",
                  isBot ? "mr-auto" : "ml-auto flex-row-reverse"
                )}
              >
                <div
                  className={cn(
                    "p-2.5 rounded-2xl shadow-2xs break-words leading-relaxed whitespace-pre-wrap",
                    isBot
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-xs"
                      : "bg-[#d9fdd3] dark:bg-emerald-900/80 text-zinc-900 dark:text-zinc-50 rounded-br-xs"
                  )}
                >
                  <p className="text-[11.5px] leading-snug">{m.text}</p>
                  <div
                    className={cn(
                      "text-[9px] text-zinc-400 mt-1 flex items-center justify-end gap-1 leading-none"
                    )}
                  >
                    <span>{m.time}</span>
                    {!isBot && (
                      <CheckCheck className="h-3 w-3 text-sky-500 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {isBotTyping && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-zinc-800 rounded-2xl rounded-tl-xs px-3 py-1.5 shadow-2xs border border-zinc-200/50 dark:border-zinc-700/50 flex items-center gap-1 text-zinc-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" />
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                <span className="text-[10px] ml-1 font-medium">Escribiendo...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Simulation Pills */}
        <div className="bg-zinc-100 dark:bg-zinc-800/90 p-1.5 border-t border-zinc-200 dark:border-zinc-700/60 overflow-x-auto flex items-center gap-1">
          <span className="text-[9px] font-bold text-zinc-400 px-1 shrink-0">
            Probar:
          </span>
          {templateType !== "RULES_BOT" ? (
            step === "AWAITING_ID" ? (
              <>
                <button
                  type="button"
                  onClick={() => setInputText("1234567890")}
                  className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-zinc-700 border text-zinc-700 dark:text-zinc-200 shadow-2xs shrink-0 hover:border-emerald-500 font-semibold"
                >
                  🧪 CC 1234567890 (Identificarme)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setInputText("Tengo problemas de lentitud con mi internet")
                  }
                  className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-zinc-700 border text-zinc-700 dark:text-zinc-200 shadow-2xs shrink-0 hover:border-emerald-500"
                >
                  ⚡ Lentitud (Sin ID)
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setInputText("Tengo problemas de lentitud con mi internet")
                  }
                  className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-zinc-700 border text-zinc-700 dark:text-zinc-200 shadow-2xs shrink-0 hover:border-emerald-500"
                >
                  ⚡ Lentitud
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setInputText("¿Cuál es mi saldo actual para pagar?")
                  }
                  className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-zinc-700 border text-zinc-700 dark:text-zinc-200 shadow-2xs shrink-0 hover:border-emerald-500"
                >
                  💳 Consultar Saldo
                </button>
                <button
                  type="button"
                  onClick={() => setInputText("Quiero hablar con un asesor")}
                  className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-zinc-700 border text-zinc-700 dark:text-zinc-200 shadow-2xs shrink-0 hover:border-emerald-500"
                >
                  👤 Asesor
                </button>
              </>
            )
          ) : step === "AWAITING_ID" ? (
            <button
              type="button"
              onClick={() => {
                setInputText("1234567890");
              }}
              className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-zinc-700 border text-zinc-700 dark:text-zinc-200 shadow-2xs shrink-0 hover:border-emerald-500 font-semibold"
            >
              🧪 CC 1234567890 (Carlos Testing)
            </button>
          ) : (
            <>
              {flow.menuStep.options
                .filter((o) => o.enabled)
                .slice(0, 3)
                .map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => handleSimulateChoice(o.digit)}
                    className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-zinc-700 border text-zinc-700 dark:text-zinc-200 shadow-2xs shrink-0 hover:border-emerald-500"
                  >
                    Opción {o.digit}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => handleSimulateChoice("asesor")}
                className="px-2 py-0.5 rounded-full text-[10px] bg-white dark:bg-zinc-700 border text-zinc-700 dark:text-zinc-200 shadow-2xs shrink-0 hover:border-emerald-500"
              >
                👤 Asesor
              </button>
            </>
          )}
        </div>

        {/* WhatsApp Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="bg-zinc-100 dark:bg-zinc-900 px-2 py-2 flex items-center gap-1.5"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              step === "AWAITING_ID"
                ? "Escribe tu cédula o contrato..."
                : templateType === "BAILEYS_AI"
                ? "Escribe tu consulta aquí..."
                : "Escribe 1, 2, 3 o 'asesor'..."
            }
            className={cn(
              "flex-1 h-9 rounded-full px-3 text-xs",
              "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700",
              "text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            )}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputText.trim()}
            className="h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Helper label below simulator */}
      <p className="text-[11px] text-zinc-400 mt-2.5 text-center flex items-center gap-1">
        <Sparkles className="h-3 w-3 text-emerald-500 shrink-0" />
        Simulador interactivo en tiempo real: prueba tu flujo antes de guardar.
      </p>
    </div>
  );
}
