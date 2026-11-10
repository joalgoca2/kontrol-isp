"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Send,
  Bot,
  User,
  ShieldCheck,
  Activity,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Phone,
  UserCheck,
  Calendar,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useBrand } from "@/context/brand-context";
import {
  getWhatsAppConversations,
  getConversationThread,
  sendOperatorMessageAction,
  toggleHumanTransferAction,
  type WhatsAppConversationSummary,
  type ConversationThreadDetails,
} from "@/actions/whatsapp-chat";
import {
  runLiveContractDiagnostic,
  kickContractSessionAction,
  grantPromiseOfPaymentAction,
} from "@/actions/contracts";
import type { MikrotikLiveDiagnostic } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function WhatsAppChatPage() {
  const { t } = useTranslation();
  const { activeBrandId } = useBrand();

  const [conversations, setConversations] = useState<
    WhatsAppConversationSummary[]
  >([]);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [thread, setThread] = useState<ConversationThreadDetails | null>(null);

  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingThread, setIsLoadingThread] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "human">("all");

  // NOC Quick Actions & Diag Modal
  const [diagModalOpen, setDiagModalOpen] = useState<boolean>(false);
  const [diagLoading, setDiagLoading] = useState<boolean>(false);
  const [diagResult, setDiagResult] = useState<MikrotikLiveDiagnostic | null>(
    null
  );
  const [isKicking, setIsKicking] = useState<boolean>(false);
  const [isGrantingPromise, setIsGrantingPromise] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Load Conversations List
  const loadConversations = useCallback(
    async (query?: string) => {
      try {
        const res = await getWhatsAppConversations(activeBrandId, query);
        if (res.success && res.data) {
          setConversations(res.data);
          // Auto-select first if none selected
          if (!selectedSender && res.data.length > 0) {
            setSelectedSender(res.data[0].senderIdentifier);
          }
        }
      } catch (_err) {
        toast.error("Error al cargar lista de conversaciones.");
      } finally {
        setIsLoadingList(false);
      }
    },
    [activeBrandId, selectedSender]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 2. Load Selected Thread
  const loadThread = useCallback(
    async (sender: string) => {
      setIsLoadingThread(true);
      try {
        const res = await getConversationThread(sender, activeBrandId);
        if (res.success && res.data) {
          setThread(res.data);
        } else {
          toast.error(res.error || "No se pudo cargar la conversación.");
        }
      } catch (_err) {
        toast.error("Error al cargar mensajes.");
      } finally {
        setIsLoadingThread(false);
      }
    },
    [activeBrandId]
  );

  useEffect(() => {
    if (selectedSender) {
      loadThread(selectedSender);
    }
  }, [selectedSender, loadThread]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages]);

  // 3. Send Operator Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedSender || isSending) return;

    const text = replyText.trim();
    setReplyText("");
    setIsSending(true);

    try {
      const res = await sendOperatorMessageAction({
        senderIdentifier: selectedSender,
        message: text,
        contractId: thread?.contractInfo?.id ?? null,
        brandId: activeBrandId,
      });

      if (res.success && res.data) {
        setThread((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, res.data!],
                transferredToHuman: true,
              }
            : null
        );
        // Update summary in left list
        setConversations((prev) =>
          prev.map((c) =>
            c.senderIdentifier === selectedSender
              ? {
                  ...c,
                  lastMessage: text,
                  lastMessageAt: new Date().toISOString(),
                  lastSenderRole: "operator",
                  transferredToHuman: true,
                }
              : c
          )
        );
      } else {
        toast.error(res.error || "Error al enviar mensaje.");
      }
    } catch (_err) {
      toast.error("Error al despachar mensaje.");
    } finally {
      setIsSending(false);
    }
  };

  // 4. Toggle Transfer to Human
  const handleToggleTransfer = async () => {
    if (!selectedSender || !thread) return;
    const nextVal = !thread.transferredToHuman;
    try {
      const res = await toggleHumanTransferAction(
        selectedSender,
        nextVal,
        activeBrandId
      );
      if (res.success) {
        setThread((prev) =>
          prev ? { ...prev, transferredToHuman: nextVal } : null
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.senderIdentifier === selectedSender
              ? { ...c, transferredToHuman: nextVal }
              : c
          )
        );
        toast.success(
          nextVal
            ? "Conversación asignada al Asesor Humano."
            : "Conversación devuelta al Bot de IA."
        );
      }
    } catch (_err) {
      toast.error("Error al cambiar estado de transferencia.");
    }
  };

  // 5. Run Live MikroTik Diagnostic for linked contract
  const handleRunDiag = async () => {
    if (!thread?.contractInfo?.id) return;
    setDiagModalOpen(true);
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const res = await runLiveContractDiagnostic(thread.contractInfo.id);
      if (res.success && res.data) {
        setDiagResult(res.data);
      } else {
        toast.error(res.error || "Error al ejecutar diagnóstico.");
      }
    } catch (_err) {
      toast.error("Error en diagnóstico de red.");
    } finally {
      setDiagLoading(false);
    }
  };

  // 6. Kick Session
  const handleKick = async () => {
    if (!thread?.contractInfo?.id) return;
    setIsKicking(true);
    try {
      const res = await kickContractSessionAction(thread.contractInfo.id);
      if (res.success) {
        toast.success(res.data?.message || "Sesión reiniciada con éxito.");
      } else {
        toast.error(res.error || "Error al reiniciar sesión.");
      }
    } catch (_err) {
      toast.error("Error al ejecutar kick en MikroTik.");
    } finally {
      setIsKicking(false);
    }
  };

  // 7. Promise of payment
  const handlePromise = async () => {
    if (!thread?.contractInfo?.id) return;
    setIsGrantingPromise(true);
    try {
      const res = await grantPromiseOfPaymentAction(thread.contractInfo.id);
      if (res.success) {
        toast.success(res.data?.message || "Promesa de pago concedida.");
        loadThread(selectedSender!);
      } else {
        toast.error(res.error || "Error al otorgar promesa.");
      }
    } catch (_err) {
      toast.error("Error en promesa de pago.");
    } finally {
      setIsGrantingPromise(false);
    }
  };

  // Filtered conversations list
  const filteredConversations = conversations.filter((c) => {
    if (filterMode === "human" && !c.transferredToHuman) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      c.senderIdentifier.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q) ||
      (c.contractNumber && c.contractNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className={cn(
              "text-xl font-black text-zinc-900 dark:text-zinc-50",
              "flex items-center gap-2"
            )}
          >
            <MessageSquare className="h-6 w-6 text-emerald-500" />
            {t("whatsappChat.title", "Bandeja de WhatsApp Web NOC")}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t(
              "whatsappChat.subtitle",
              "Atención multicanal en vivo con telemetría MikroTik y Bot de IA"
            )}
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => loadConversations(searchTerm)}
          disabled={isLoadingList}
          className="rounded-xl text-xs h-9 border-zinc-200 dark:border-zinc-800"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5 mr-1.5", isLoadingList && "animate-spin")}
          />
          {t("common.refresh", "Actualizar")}
        </Button>
      </div>

      {/* Main 3-Column WhatsApp Web Canvas */}
      <div
        className={cn(
          "w-full rounded-2xl border border-zinc-200 dark:border-zinc-800",
          "bg-white dark:bg-zinc-900/60 shadow-xs flex overflow-hidden",
          "h-[720px] md:h-[780px]"
        )}
      >
        {/* PANEL 1: Left Chat List */}
        <div
          className={cn(
            "w-80 md:w-88 flex-shrink-0 border-r border-zinc-200",
            "dark:border-zinc-800 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/30"
          )}
        >
          {/* Search & Filter pills */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="relative">
              <Search
                className={cn(
                  "h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2",
                  "text-zinc-400"
                )}
              />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  loadConversations(e.target.value);
                }}
                placeholder="Buscar por teléfono o cliente..."
                className={cn(
                  "pl-8 text-xs h-8 rounded-xl bg-white dark:bg-zinc-900",
                  "border-zinc-200 dark:border-zinc-800"
                )}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                  filterMode === "all"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                Todos ({conversations.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("human")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                  "flex items-center gap-1",
                  filterMode === "human"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                Requiere Asesor (
                {conversations.filter((c) => c.transferredToHuman).length})
              </button>
            </div>
          </div>

          {/* Chat items list */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                No se encontraron conversaciones.
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = selectedSender === c.senderIdentifier;
                const isOnline = c.serviceStatus === "ONLINE";

                return (
                  <button
                    key={c.senderIdentifier}
                    type="button"
                    onClick={() => setSelectedSender(c.senderIdentifier)}
                    className={cn(
                      "w-full text-left p-3 transition-colors flex items-start",
                      "gap-3 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40",
                      isSelected &&
                        "bg-emerald-500/10 dark:bg-emerald-500/15 border-l-4 border-emerald-500"
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center",
                          "font-bold text-xs bg-emerald-600 text-white shadow-xs"
                        )}
                      >
                        {c.clientName.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2",
                          "border-white dark:border-zinc-900 shadow-xs",
                          isOnline ? "bg-emerald-500" : "bg-rose-500"
                        )}
                        title={isOnline ? "MikroTik ONLINE" : "MikroTik OFFLINE"}
                      />
                    </div>

                    {/* Text preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {c.clientName}
                        </span>
                        <span className="text-[10px] text-zinc-400 flex-shrink-0">
                          {new Date(c.lastMessageAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {c.lastSenderRole === "bot" && (
                          <Bot className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                        )}
                        {c.lastSenderRole === "operator" && (
                          <User className="h-3 w-3 text-sky-500 flex-shrink-0" />
                        )}
                        <span className="truncate">{c.lastMessage}</span>
                      </div>

                      {/* Tags */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {c.contractNumber && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 font-mono"
                          >
                            #{c.contractNumber}
                          </Badge>
                        )}
                        {c.transferredToHuman && (
                          <Badge
                            className={cn(
                              "text-[9px] px-1.5 py-0 bg-amber-500/10",
                              "text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            )}
                          >
                            Asesor requerido
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* PANEL 2: Center Chat Thread Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-100/40 dark:bg-zinc-950/40">
          {!selectedSender ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-zinc-400">
              <div className="space-y-2">
                <MessageSquare className="h-10 w-10 mx-auto text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm font-semibold">
                  Selecciona una conversación para interactuar
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div
                className={cn(
                  "p-3 border-b border-zinc-200 dark:border-zinc-800",
                  "bg-white dark:bg-zinc-900 flex items-center justify-between"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-full bg-emerald-600 text-white shrink-0",
                      "flex items-center justify-center font-bold text-xs"
                    )}
                  >
                    {(thread?.clientInfo?.name || selectedSender)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {thread?.clientInfo?.name || `Abonado (${selectedSender})`}
                    </h3>
                    <p className="text-[10px] text-zinc-400 flex items-center gap-1.5 truncate">
                      <Phone className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{selectedSender}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleTransfer}
                    className={cn(
                      "h-8 w-8 p-0 rounded-xl shrink-0 relative transition-all",
                      thread?.transferredToHuman
                        ? "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 " +
                          "text-amber-600 dark:text-amber-400"
                        : "border-zinc-200 dark:border-zinc-800 " +
                          "hover:border-emerald-500/50 hover:bg-emerald-500/10 " +
                          "text-zinc-600 dark:text-zinc-400 hover:text-emerald-600"
                    )}
                    title={
                      thread?.transferredToHuman
                        ? "Atención humana activa. Clic para devolver al Bot de IA"
                        : "Bot de IA activo. Clic para tomar control como asesor humano"
                    }
                    aria-label={
                      thread?.transferredToHuman
                        ? "Devolver al Bot de IA"
                        : "Tomar control como asesor humano"
                    }
                  >
                    {thread?.transferredToHuman ? (
                      <>
                        <Bot className="h-4 w-4" />
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span
                            className={cn(
                              "animate-ping absolute inline-flex h-full w-full",
                              "rounded-full bg-amber-400 opacity-75"
                            )}
                          />
                          <span
                            className={cn(
                              "relative inline-flex rounded-full h-2.5 w-2.5",
                              "bg-amber-500"
                            )}
                          />
                        </span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span
                            className={cn(
                              "relative inline-flex rounded-full h-2 w-2",
                              "bg-emerald-500"
                            )}
                          />
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Messages Flow Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoadingThread ? (
                  <div className="p-8 text-center text-xs text-zinc-400">
                    Cargando historial de mensajes...
                  </div>
                ) : (thread?.messages || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400">
                    Sin mensajes registrados aún.
                  </div>
                ) : (
                  thread?.messages.map((m) => {
                    const isClient = m.sender === "client";
                    const isBot = m.sender === "bot";
                    const isOperator = m.sender === "operator";

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col max-w-[80%]",
                          isClient ? "mr-auto items-start" : "ml-auto items-end"
                        )}
                      >
                        {/* Bubble */}
                        <div
                          className={cn(
                            "p-3 rounded-2xl text-xs shadow-xs space-y-1 relative",
                            isClient &&
                              "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-xs border border-zinc-200 dark:border-zinc-700/60",
                            isBot &&
                              "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 border border-emerald-500/20 rounded-tr-xs",
                            isOperator &&
                              "bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100 border border-sky-500/20 rounded-tr-xs"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-75">
                            {isClient && <span>👤 Cliente</span>}
                            {isBot && (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Bot className="h-3 w-3" /> Bot de IA
                              </span>
                            )}
                            {isOperator && (
                              <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                <UserCheck className="h-3 w-3" /> Asesor Humano
                              </span>
                            )}
                          </div>

                          <p className="whitespace-pre-wrap leading-relaxed">
                            {m.content}
                          </p>

                          <span className="text-[9px] opacity-60 block text-right pt-0.5">
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Message Input */}
              <form
                onSubmit={handleSendReply}
                className={cn(
                  "p-3 border-t border-zinc-200 dark:border-zinc-800",
                  "bg-white dark:bg-zinc-900 flex items-center gap-2"
                )}
              >
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escribe una respuesta como asesor humano a WhatsApp..."
                  className={cn(
                    "flex-1 text-xs h-10 rounded-xl",
                    "border-zinc-200 dark:border-zinc-800"
                  )}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!replyText.trim() || isSending}
                  className={cn(
                    "rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white",
                    "h-10 px-4 text-xs font-bold"
                  )}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {isSending ? "Enviando..." : "Enviar"}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* PANEL 3: Right NOC Client & Live Telemetry Sidebar */}
        <div
          className={cn(
            "w-72 md:w-80 flex-shrink-0 border-l border-zinc-200",
            "dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30",
            "flex flex-col p-4 overflow-y-auto space-y-4"
          )}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Ficha NOC del Cliente
            </h4>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>

          {!thread?.contractInfo ? (
            <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400 space-y-2">
              <p>No se encontró un contrato asociado a este número.</p>
              <Link href="/dashboard/contracts">
                <Button size="sm" variant="outline" className="text-xs rounded-xl mt-1">
                  Buscar en Contratos
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Identity Card */}
              <Card className="rounded-xl border-zinc-200 dark:border-zinc-800 shadow-2xs">
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">
                      Titular
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      #{thread.contractInfo.contractNumber}
                    </Badge>
                  </div>
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {thread.clientInfo?.name}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {thread.clientInfo?.document}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {thread.clientInfo?.address}, {thread.clientInfo?.city}
                  </p>
                </CardContent>
              </Card>

              {/* Live MikroTik Telemetry Card */}
              <Card className="rounded-xl border-zinc-200 dark:border-zinc-800 shadow-2xs">
                <CardContent className="p-3.5 space-y-2.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">
                    Telemetría MikroTik
                  </span>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Estado Enlace:</span>
                    {thread.contractInfo.serviceStatus === "ONLINE" ? (
                      <Badge className="bg-emerald-500 text-white text-[10px] gap-1 font-bold">
                        <CheckCircle2 className="h-3 w-3" /> ONLINE
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500 text-white text-[10px] gap-1 font-bold">
                        <XCircle className="h-3 w-3" /> OFFLINE
                      </Badge>
                    )}
                  </div>

                  <div className="text-[11px] space-y-1 font-mono text-zinc-600 dark:text-zinc-400">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">PPPoE:</span>
                      <span className="font-bold truncate max-w-[130px]">
                        {thread.contractInfo.pppoeUser}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">IP:</span>
                      <span>{thread.contractInfo.ipAddress || "Dinámica"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Plan:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[130px]">
                        {thread.contractInfo.planName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Nodo:</span>
                      <span className="truncate max-w-[130px]">
                        {thread.contractInfo.nodeName}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Operator Quick Actions */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">
                  Acciones Rápidas
                </span>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRunDiag}
                  className="w-full text-xs h-8.5 rounded-xl justify-start"
                >
                  <Activity className="h-3.5 w-3.5 mr-2 text-emerald-500" />
                  Diagnosticar en MikroTik
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleKick}
                  disabled={isKicking}
                  className="w-full text-xs h-8.5 rounded-xl justify-start"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-2 text-amber-500" />
                  {isKicking ? "Reiniciando..." : "Reiniciar Enlace (Kick)"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePromise}
                  disabled={isGrantingPromise}
                  className="w-full text-xs h-8.5 rounded-xl justify-start"
                >
                  <Calendar className="h-3.5 w-3.5 mr-2 text-sky-500" />
                  {isGrantingPromise ? "Concediendo..." : "Promesa de Pago"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Live Diagnostic Modal */}
      {diagModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" />
                Diagnóstico en Vivo MikroTik
              </h3>
              <button
                type="button"
                onClick={() => setDiagModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {diagLoading ? (
              <div className="p-8 text-center text-xs text-zinc-400 space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-500" />
                <p>Consultando RouterOS vía API en tiempo real...</p>
              </div>
            ) : diagResult?.session ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Enlace Activo en MikroTik (ONLINE)
                  </div>
                  <p className="text-[11px]">
                    Uptime: {diagResult.session.uptime || "Activo"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60">
                    <span className="text-[10px] text-zinc-400 block font-sans">
                      IP Asignada:
                    </span>
                    <span className="font-bold">{diagResult.session.address}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60">
                    <span className="text-[10px] text-zinc-400 block font-sans">
                      MAC Router:
                    </span>
                    <span className="font-bold truncate block">
                      {diagResult.session.callerId || "N/D"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  Sin sesión activa en MikroTik (OFFLINE)
                </div>
                <p className="text-[11px]">
                  El router del cliente no tiene túnel PPPoE levantado.
                </p>
              </div>
            )}

            <Button
              className="w-full text-xs rounded-xl"
              onClick={() => setDiagModalOpen(false)}
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
