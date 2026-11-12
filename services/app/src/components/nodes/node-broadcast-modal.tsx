"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  MessageSquare,
  Zap,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Send,
  PauseCircle,
  Clock,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getNodeBroadcastRecipientsAction,
  sendSingleBroadcastMessageAction,
  type BroadcastAudience,
  type NodeBroadcastData,
  type NodeBroadcastRecipient,
} from "@/actions/nodes";
import type { MikrotikNode } from "@/types";

type TemplateKey =
  | "POWER_OUTAGE"
  | "FIBER_CUT"
  | "MAINTENANCE"
  | "RESTORED"
  | "CUSTOM";

interface IncidentTemplate {
  key: TemplateKey;
  label: string;
  icon: typeof Zap;
  defaultTime: string;
  template: string;
}

const TEMPLATES: IncidentTemplate[] = [
  {
    key: "POWER_OUTAGE",
    label: "Corte de Energía",
    icon: Zap,
    defaultTime: "2 horas",
    template:
      "Hola {nombre}, te informamos que en este momento se presenta una " +
      "interrupción en el suministro de energía eléctrica que afecta a los " +
      "equipos que alimentan tu sector ({nodo}). Nuestro equipo técnico ya se " +
      "encuentra al tanto. Tiempo estimado de restablecimiento: {tiempo_estimado}. " +
      "Agradecemos tu paciencia. - {empresa}",
  },
  {
    key: "FIBER_CUT",
    label: "Corte de Fibra",
    icon: AlertTriangle,
    defaultTime: "3 horas",
    template:
      "Hola {nombre}, detectamos una afectación en la troncal principal de " +
      "fibra óptica que abastece a {nodo}. Nuestras cuadrillas de campo ya están " +
      "en sitio realizando los empalmes necesarios. Tiempo estimado de solución: " +
      "{tiempo_estimado}. Lamentamos los inconvenientes. - {empresa}",
  },
  {
    key: "MAINTENANCE",
    label: "Mantenimiento",
    icon: Wrench,
    defaultTime: "1 hora",
    template:
      "Hola {nombre}, para garantizar la máxima velocidad y estabilidad en " +
      "tu conexión, realizaremos labores de mantenimiento preventivo y " +
      "optimización en {nodo}. Horario estimado de la labor: {tiempo_estimado}. " +
      "Gracias por tu comprensión. - {empresa}",
  },
  {
    key: "RESTORED",
    label: "Servicio Restablecido",
    icon: CheckCircle2,
    defaultTime: "Normalizado",
    template:
      "Hola {nombre}, te confirmamos que la incidencia en el sector de {nodo} " +
      "ha sido superada y tu servicio de internet se encuentra normalizado. " +
      "Si tu router aún no conecta, desconéctalo de la energía por 1 minuto y " +
      "vuelve a encenderlo. - {empresa}",
  },
  {
    key: "CUSTOM",
    label: "Personalizado",
    icon: MessageSquare,
    defaultTime: "Por definir",
    template:
      "Hola {nombre}, te contactamos de {empresa} para informarte sobre tu " +
      "servicio en {nodo}. Tiempo estimado: {tiempo_estimado}.",
  },
];

interface NodeBroadcastModalProps {
  node: MikrotikNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NodeBroadcastModal({
  node,
  open,
  onOpenChange,
}: NodeBroadcastModalProps) {
  const [audience, setAudience] = useState<BroadcastAudience>("ALL");
  const [data, setData] = useState<NodeBroadcastData | null>(null);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);

  // Template State
  const [selectedTemplateKey, setSelectedTemplateKey] =
    useState<TemplateKey>("POWER_OUTAGE");
  const [estimatedTime, setEstimatedTime] = useState("2 horas");
  const [messageTemplate, setMessageTemplate] = useState(
    TEMPLATES[0].template
  );

  // Anti-Ban Dispatch State
  const [isSending, setIsSending] = useState(false);
  const [isCooling, setIsCooling] = useState(false);
  const [coolingCountdown, setCoolingCountdown] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [currentRecipient, setCurrentRecipient] =
    useState<NodeBroadcastRecipient | null>(null);

  const abortRef = useRef(false);

  const loadRecipients = useCallback(async () => {
    if (!node?.id) return;
    setIsLoadingRecipients(true);
    try {
      const res = await getNodeBroadcastRecipientsAction(node.id, audience);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Error al consultar abonados del nodo.");
      }
    } catch (_err) {
      toast.error("Error al cargar destinatarios.");
    } finally {
      setIsLoadingRecipients(false);
    }
  }, [node?.id, audience]);

  useEffect(() => {
    if (open && node?.id) {
      setSentCount(0);
      setFailedCount(0);
      setIsSending(false);
      setIsCooling(false);
      abortRef.current = false;
      loadRecipients();
    }
  }, [open, node?.id, audience, loadRecipients]);

  const handleSelectTemplate = (tpl: IncidentTemplate) => {
    setSelectedTemplateKey(tpl.key);
    setEstimatedTime(tpl.defaultTime);
    setMessageTemplate(tpl.template);
  };

  const sampleRecipient = useMemo(() => {
    return (
      data?.validRecipients[0] || {
        clientName: "Juan Carlos Pérez",
        phone: "573101234567",
      }
    );
  }, [data]);

  const renderedPreview = useMemo(() => {
    const brandName = data?.brandName || "Serkoi Telecom";
    const nodeName = data?.nodeName || node?.name || "Nodo Principal";
    return messageTemplate
      .replace(/\{nombre\}/g, sampleRecipient.clientName)
      .replace(/\{nodo\}/g, nodeName)
      .replace(/\{tiempo_estimado\}/g, estimatedTime)
      .replace(/\{empresa\}/g, brandName);
  }, [messageTemplate, sampleRecipient, data, node, estimatedTime]);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const handleStartBroadcast = async () => {
    if (!data || data.validRecipients.length === 0) {
      toast.warning("No hay destinatarios válidos para notificar.");
      return;
    }

    setIsSending(true);
    abortRef.current = false;
    setSentCount(0);
    setFailedCount(0);

    const brandName = data.brandName;
    const nodeName = data.nodeName;
    const recipients = data.validRecipients;

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
      if (abortRef.current) {
        toast.info("Despacho detenido por el operador.");
        break;
      }

      const r = recipients[i];
      setCurrentRecipient(r);

      const personalizedMessage = messageTemplate
        .replace(/\{nombre\}/g, r.clientName)
        .replace(/\{nodo\}/g, nodeName)
        .replace(/\{tiempo_estimado\}/g, estimatedTime)
        .replace(/\{empresa\}/g, brandName);

      try {
        const res = await sendSingleBroadcastMessageAction({
          recipientPhone: r.phone,
          message: personalizedMessage,
        });

        if (res.success) {
          successful++;
          setSentCount(successful);
        } else {
          failed++;
          setFailedCount(failed);
        }
      } catch (_err) {
        failed++;
        setFailedCount(failed);
      }

      // Check if another message is pending
      if (i < recipients.length - 1 && !abortRef.current) {
        // Anti-Ban Rule 2: Batch cooling every 20 messages
        if ((i + 1) % 20 === 0) {
          setIsCooling(true);
          for (let c = 10; c > 0; c--) {
            if (abortRef.current) break;
            setCoolingCountdown(c);
            await sleep(1000);
          }
          setIsCooling(false);
        } else {
          // Anti-Ban Rule 1: Jitter between 1.5s and 3.5s
          const randomJitter = 1500 + Math.floor(Math.random() * 2000);
          await sleep(randomJitter);
        }
      }
    }

    setIsSending(false);
    setCurrentRecipient(null);

    if (!abortRef.current) {
      toast.success(
        `Despacho completado: ${successful} enviados, ${failed} fallidos.`
      );
    }
  };

  const handleStopBroadcast = () => {
    abortRef.current = true;
    setIsSending(false);
    setIsCooling(false);
  };

  if (!node) return null;

  const validCount = data?.validRecipients.length || 0;
  const skippedTotal =
    (data?.skippedNoPppoeCount || 0) +
    (data?.skippedInvalidPhoneCount || 0) +
    (data?.skippedDuplicatePhoneCount || 0);

  const progressPercent =
    validCount > 0 ? Math.round((sentCount / validCount) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-500" />
              <span>Notificar Incidencia por WhatsApp</span>
            </div>
            <Badge
              variant="outline"
              className="text-[11px] font-mono mr-6"
            >
              {node.name} ({node.code})
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Audience Filter & Recipient Summary */}
          <div
            className={cn(
              "p-3 rounded-2xl border space-y-2.5",
              "bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between gap-3",
                "flex-wrap text-xs"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 font-bold",
                  "text-zinc-700 dark:text-zinc-300"
                )}
              >
                <Users className="h-4 w-4 text-emerald-600" />
                <span>Audiencia Destino:</span>
              </div>

              <div className="flex items-center gap-1.5">
                {(["ALL", "ACTIVE", "OFFLINE"] as const).map((aud) => (
                  <Button
                    key={aud}
                    type="button"
                    size="sm"
                    variant={audience === aud ? "default" : "outline"}
                    disabled={isSending || isLoadingRecipients}
                    onClick={() => setAudience(aud)}
                    className="h-7 text-[11px] rounded-lg px-2.5"
                  >
                    {aud === "ALL" && "Todos los Contratos"}
                    {aud === "ACTIVE" && "Solo Activos"}
                    {aud === "OFFLINE" && "Solo Fuera de Línea"}
                  </Button>
                ))}
              </div>
            </div>

            {/* Recipient Stats Bar */}
            <div
              className={cn(
                "flex items-center gap-2 flex-wrap text-[11px] pt-1",
                "border-t border-zinc-200 dark:border-zinc-800"
              )}
            >
              {isLoadingRecipients ? (
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Consultando contratos y teléfonos válidos...</span>
                </div>
              ) : (
                <>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "bg-emerald-500/15 text-emerald-700",
                      "dark:text-emerald-300 border border-emerald-500/30"
                    )}
                  >
                    {validCount} destinatarios válidos listos
                  </Badge>

                  {skippedTotal > 0 && (
                    <span className="text-zinc-500 flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      <span>
                        {skippedTotal} omitidos ({data?.skippedNoPppoeCount}{" "}
                        sin PPPoE, {data?.skippedInvalidPhoneCount} sin tel)
                      </span>
                    </span>
                  )}

                  <span className="text-[10px] text-zinc-400 font-mono ml-auto">
                    Anti-Baneo Jitter: 1.5s - 3.5s
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Template Selection Chips */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Tipo de Incidencia / Plantilla
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {TEMPLATES.map((tpl) => {
                const IconComponent = tpl.icon;
                const isSelected = selectedTemplateKey === tpl.key;
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    disabled={isSending}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={cn(
                      "p-2 rounded-xl border text-left transition-all",
                      "text-xs flex flex-col gap-1 cursor-pointer",
                      isSelected
                        ? "bg-emerald-500/15 border-emerald-500 " +
                          "text-emerald-700 dark:text-emerald-300 " +
                          "font-bold shadow-xs"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 " +
                          "dark:border-zinc-800 text-zinc-600 " +
                          "dark:text-zinc-400 hover:border-zinc-300"
                    )}
                  >
                    <IconComponent className="h-4 w-4" />
                    <span className="truncate">{tpl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estimated Time Input */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1 space-y-1">
              <Label className="text-xs font-bold flex items-center gap-1">
                <Clock className="h-3 w-3 text-emerald-600" />
                <span>Tiempo Estimado</span>
              </Label>
              <Input
                value={estimatedTime}
                disabled={isSending}
                onChange={(e) => setEstimatedTime(e.target.value)}
                placeholder="ej. 2 horas o 45 min"
                className="h-8.5 rounded-xl text-xs"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-bold">
                Variables dinámicas disponibles:
              </Label>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1">
                {["{nombre}", "{nodo}", "{tiempo_estimado}", "{empresa}"].map(
                  (v) => (
                    <span
                      key={v}
                      className={cn(
                        "px-1.5 py-0.5 rounded-md font-mono text-[10px]",
                        "bg-zinc-100 dark:bg-zinc-800 text-zinc-700",
                        "dark:text-zinc-300 border border-zinc-200",
                        "dark:border-zinc-700"
                      )}
                    >
                      {v}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Message Template Editor */}
          <div className="space-y-1">
            <Label className="text-xs font-bold">Mensaje a Despachar</Label>
            <Textarea
              rows={3}
              value={messageTemplate}
              disabled={isSending}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="text-xs rounded-xl font-sans"
            />
          </div>

          {/* WhatsApp Live Chat Simulator Preview */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Vista Previa en Tiempo Real (WhatsApp)
            </span>
            <div
              className={cn(
                "p-3.5 rounded-2xl border",
                "bg-[#EFEAE2] dark:bg-zinc-950/80 border-zinc-300 dark:border-zinc-800"
              )}
            >
              <div
                className={cn(
                  "max-w-md bg-white dark:bg-zinc-900 rounded-xl",
                  "rounded-tl-none p-3 shadow-xs border",
                  "border-zinc-200/80 dark:border-zinc-800 space-y-1.5 text-xs"
                )}
              >
                <p
                  className={cn(
                    "text-zinc-800 dark:text-zinc-200",
                    "whitespace-pre-wrap leading-relaxed"
                  )}
                >
                  {renderedPreview}
                </p>
                <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-400">
                  <span>Ahora</span>
                  <span className="text-blue-500 font-bold">&check;&check;</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sending Progress Bar / Anti-Ban Cooling */}
          {isSending && (
            <div
              className={cn(
                "p-3 rounded-2xl border space-y-2",
                "bg-emerald-500/10 border-emerald-500/25"
              )}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {isCooling
                    ? `Pausa anti-baneo (${coolingCountdown}s)...`
                    : `Despachando ${sentCount + failedCount} de ${validCount}...`}
                </span>
                <span className="font-mono text-[11px] text-emerald-600">
                  {progressPercent}%
                </span>
              </div>

              <Progress value={progressPercent} className="h-2" />

              {currentRecipient && !isCooling && (
                <div className="text-[11px] text-zinc-500 truncate">
                  Enviando a:{" "}
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    {currentRecipient.clientName}
                  </span>{" "}
                  ({currentRecipient.phone})
                </div>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div
            className={cn(
              "flex items-center justify-between pt-2 border-t",
              "border-zinc-200 dark:border-zinc-800"
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSending}
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl"
            >
              Cerrar
            </Button>

            <div className="flex items-center gap-2">
              {isSending ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleStopBroadcast}
                  className="rounded-xl text-xs gap-1.5"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  Detener Envío
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={validCount === 0 || isLoadingRecipients}
                  onClick={handleStartBroadcast}
                  className={cn(
                    "rounded-xl text-xs font-semibold gap-1.5",
                    "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar a {validCount} Abonados
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
