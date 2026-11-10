"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Save,
  Loader2,
  Calendar,
  CalendarCheck,
  FileCode,
  Plus,
  Trash2,
  Settings2,
  ChevronDown,
  ChevronUp,
  Zap,
  CreditCard,
  UserCheck,
  Headphones,
  RotateCcw,
  Copy,
  Layers,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  ListTree,
  FlaskConical,
  Power,
  Clock,
  GitBranch,
  CornerDownRight,
  CornerUpLeft,
  GripVertical,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  getBrandAiConfigAction,
  saveBrandAiConfigAction,
  checkIspAiEnvironmentAction,
} from "@/actions/ai-config";
import {
  getTestingSubscriberStatusAction,
  toggleTestSubscriberCutAction,
  grantTestSubscriberGraceAction,
  resetTestSubscriberAction,
  type TestingSubscriberSummary,
} from "@/actions/testing-subscriber";
import {
  AI_AGENT_TEMPLATES,
  DEFAULT_CHATBOT_FLOW,
  type TemplateDefinition,
} from "@/lib/ai/templates";
import type {
  BrandAiConfig,
  AiTone,
  ChatbotFlowConfig,
  FlowMenuOption,
  FlowActionType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsAppFlowSimulator } from "@/components/ai-flow/whatsapp-flow-simulator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AiSettingsPage() {
  const { t } = useTranslation();
  const { activeBrandId, activeBrand } = useBrand();

  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [aiConfig, setAiConfig] = useState<BrandAiConfig | null>(null);
  const [testingSub, setTestingSub] = useState<TestingSubscriberSummary | null>(null);
  const [isActionInProgress, setIsActionInProgress] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    "flow" | "prompt" | "params" | "json"
  >("flow");
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(
    "opt-diag"
  );
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    level: "ROOT" | "SUB";
    parentId?: string;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    id: string;
    level: "ROOT" | "SUB";
    parentId?: string;
    dropType: "before" | "after" | "inside";
  } | null>(null);
  const [validationErrorIds, setValidationErrorIds] = useState<string[]>([]);
  const [envStatus, setEnvStatus] = useState<{
    hasIspAiApiKey: boolean;
    missingVariables: string[];
  } | null>(null);

  const loadEnvStatus = useCallback(async () => {
    try {
      const res = await checkIspAiEnvironmentAction();
      if (res.success && res.data) {
        setEnvStatus(res.data);
      }
    } catch (_err) {
      // Quiet fail
    }
  }, []);

  const loadTestingSubscriber = useCallback(async () => {
    if (!activeBrandId || activeBrandId === "ALL") return;
    try {
      const res = await getTestingSubscriberStatusAction(activeBrandId);
      if (res.success && res.data) {
        setTestingSub(res.data);
      }
    } catch (_err) {
      // Quiet fail
    }
  }, [activeBrandId]);

  const loadConfig = useCallback(async () => {
    if (!activeBrandId || activeBrandId === "ALL") {
      setIsLoadingConfig(false);
      return;
    }
    setIsLoadingConfig(true);
    try {
      const res = await getBrandAiConfigAction(activeBrandId);
      if (res.success && res.data) {
        const data = res.data;
        if (!data.flowConfig) {
          data.flowConfig = DEFAULT_CHATBOT_FLOW;
        }
        setAiConfig(data);
        if (data.templateType === "RULES_BOT") {
          setActiveTab("flow");
        } else {
          setActiveTab("prompt");
        }
      }
    } catch (_err) {
      toast.error("Error al cargar configuración de IA.");
    } finally {
      setIsLoadingConfig(false);
    }
    await loadTestingSubscriber();
  }, [activeBrandId, loadTestingSubscriber]);

  const handleToggleCut = async (cut: boolean) => {
    if (!activeBrandId || isActionInProgress) return;
    setIsActionInProgress(true);
    try {
      const res = await toggleTestSubscriberCutAction(activeBrandId, cut);
      if (res.success) {
        toast.success(
          cut
            ? "Abonado de pruebas puesto en SUSPENDIDO_MORA (OFFLINE)."
            : "Abonado de pruebas reactivado a ACTIVO (ONLINE)."
        );
        await loadTestingSubscriber();
      } else {
        toast.error(res.error || "Error al alternar estado.");
      }
    } catch (_err) {
      toast.error("Error en servidor al alternar corte.");
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleGrantGrace = async () => {
    if (!activeBrandId || isActionInProgress) return;
    setIsActionInProgress(true);
    try {
      const res = await grantTestSubscriberGraceAction(activeBrandId);
      if (res.success && res.data) {
        toast.success(res.data.message);
        await loadTestingSubscriber();
      } else {
        toast.error(res.error || "Error al otorgar prórroga.");
      }
    } catch (_err) {
      toast.error("Error en servidor al otorgar prórroga.");
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleResetTestSub = async () => {
    if (!activeBrandId || isActionInProgress) return;
    setIsActionInProgress(true);
    try {
      const res = await resetTestSubscriberAction(activeBrandId);
      if (res.success) {
        toast.success("Escenario de pruebas reiniciado con éxito.");
        await loadTestingSubscriber();
      } else {
        toast.error(res.error || "Error al reiniciar escenario.");
      }
    } catch (_err) {
      toast.error("Error en servidor al reiniciar escenario.");
    } finally {
      setIsActionInProgress(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadEnvStatus();
  }, [loadConfig, loadEnvStatus]);

  const flow = aiConfig?.flowConfig || DEFAULT_CHATBOT_FLOW;
  const isRulesBot = aiConfig?.templateType === "RULES_BOT";

  const updateFlow = (newFlow: ChatbotFlowConfig) => {
    if (!aiConfig) return;
    setAiConfig({
      ...aiConfig,
      flowConfig: newFlow,
    });
  };

  const handleSelectEngine = (template: TemplateDefinition) => {
    if (!aiConfig) return;
    const newType = template.type;
    setAiConfig({
      ...aiConfig,
      templateType: newType,
      systemPrompt: template.defaultSystemPrompt,
      tone: template.recommendedTone,
      allowDiagnosticMikrotik: template.allowDiagnosticMikrotik,
      allowKickSession: template.allowKickSession,
      allowGracePromise: template.allowGracePromise,
      allowScheduleVisits: template.allowScheduleVisits,
      allowBillingBalance: template.allowBillingBalance,
      allowTransferHuman: template.allowTransferHuman,
      allowCheckVisits: template.allowCheckVisits,
    });

    if (newType === "RULES_BOT") {
      setActiveTab("flow");
    } else {
      setActiveTab("prompt");
    }
    toast.success(`Motor "${template.title}" seleccionado.`);
  };

  const recalculateDigits = (options: FlowMenuOption[]): FlowMenuOption[] => {
    return options.map((opt, idx) => {
      const updated: FlowMenuOption = {
        ...opt,
        digit: String(idx + 1),
      };
      if (updated.subOptions && updated.subOptions.length > 0) {
        updated.subOptions = updated.subOptions.map((sub, sIdx) => ({
          ...sub,
          digit: String(sIdx + 1),
        }));
      }
      return updated;
    });
  };

  const handleUpdateOption = (
    optId: string,
    field: keyof FlowMenuOption,
    value: unknown
  ) => {
    if (validationErrorIds.includes(optId)) {
      setValidationErrorIds((prev) => prev.filter((id) => id !== optId));
    }
    const updatedOptions = flow.menuStep.options.map((opt) => {
      if (opt.id === optId) {
        return { ...opt, [field]: value };
      }
      return opt;
    });

    updateFlow({
      ...flow,
      menuStep: {
        ...flow.menuStep,
        options: recalculateDigits(updatedOptions),
      },
    });
  };

  const handleAddOption = () => {
    const newId = `opt-${Date.now()}`;
    const newOption: FlowMenuOption = {
      id: newId,
      digit: "0",
      title: "Nueva Opción de Menú",
      keywords: ["opcion"],
      actionType: "CUSTOM_TEXT",
      responseText:
        "Hola {{clientName}}, has seleccionado esta opción personalizada.",
      enabled: true,
    };

    const newOptions = recalculateDigits([
      ...flow.menuStep.options,
      newOption,
    ]);

    updateFlow({
      ...flow,
      menuStep: {
        ...flow.menuStep,
        options: newOptions,
      },
    });
    setExpandedOptionId(newId);
    toast.success("Nueva opción añadida con numeración automática.");
  };

  const handleRemoveOption = (optId: string) => {
    if (flow.menuStep.options.length <= 1) {
      toast.error("El menú debe tener al menos una opción activa.");
      return;
    }

    const filtered = flow.menuStep.options.filter((opt) => opt.id !== optId);
    updateFlow({
      ...flow,
      menuStep: {
        ...flow.menuStep,
        options: recalculateDigits(filtered),
      },
    });
    toast.info("Opción eliminada y menú renumerado automáticamente.");
  };

  const handleAddSubOption = (parentId: string) => {
    const parent = flow.menuStep.options.find((o) => o.id === parentId);
    if (!parent) return;
    const currentSubs = parent.subOptions || [];
    const newSubId = `sub-${Date.now()}`;
    const newSub: FlowMenuOption = {
      id: newSubId,
      digit: "0",
      title: "Nueva Sub-opción Técnica",
      keywords: ["servicio"],
      actionType: "DIAGNOSTIC_MIKROTIK",
      responseText: "",
      enabled: true,
    };
    const updatedSubs = [...currentSubs, newSub].map((s, idx) => ({
      ...s,
      digit: String(idx + 1),
    }));
    handleUpdateOption(parentId, "subOptions", updatedSubs);
    toast.success("Sub-opción agregada con numeración automática.");
  };

  const handleUpdateSubOption = (
    parentId: string,
    subId: string,
    field: keyof FlowMenuOption,
    value: unknown
  ) => {
    if (validationErrorIds.includes(subId)) {
      setValidationErrorIds((prev) => prev.filter((id) => id !== subId));
    }
    const parent = flow.menuStep.options.find((o) => o.id === parentId);
    if (!parent || !parent.subOptions) return;
    const updatedSubs = parent.subOptions.map((s) =>
      s.id === subId ? { ...s, [field]: value } : s
    );
    handleUpdateOption(parentId, "subOptions", updatedSubs);
  };

  const handleRemoveSubOption = (parentId: string, subId: string) => {
    const parent = flow.menuStep.options.find((o) => o.id === parentId);
    if (!parent || !parent.subOptions) return;
    const filteredSubs = parent.subOptions
      .filter((s) => s.id !== subId)
      .map((s, idx) => ({
        ...s,
        digit: String(idx + 1),
      }));
    handleUpdateOption(parentId, "subOptions", filteredSubs);
    toast.info("Sub-opción eliminada y rama renumerada automáticamente.");
  };

  const handleMoveOptionUp = (optId: string) => {
    const idx = flow.menuStep.options.findIndex((o) => o.id === optId);
    if (idx <= 0) return;
    const newOptions = [...flow.menuStep.options];
    const temp = newOptions[idx];
    newOptions[idx] = newOptions[idx - 1];
    newOptions[idx - 1] = temp;
    updateFlow({
      ...flow,
      menuStep: {
        ...flow.menuStep,
        options: recalculateDigits(newOptions),
      },
    });
  };

  const handleMoveOptionDown = (optId: string) => {
    const idx = flow.menuStep.options.findIndex((o) => o.id === optId);
    if (idx === -1 || idx >= flow.menuStep.options.length - 1) return;
    const newOptions = [...flow.menuStep.options];
    const temp = newOptions[idx];
    newOptions[idx] = newOptions[idx + 1];
    newOptions[idx + 1] = temp;
    updateFlow({
      ...flow,
      menuStep: {
        ...flow.menuStep,
        options: recalculateDigits(newOptions),
      },
    });
  };

  const handleMoveSubOptionUp = (parentId: string, subId: string) => {
    const parent = flow.menuStep.options.find((o) => o.id === parentId);
    if (!parent || !parent.subOptions) return;
    const idx = parent.subOptions.findIndex((s) => s.id === subId);
    if (idx <= 0) return;
    const newSubs = [...parent.subOptions];
    const temp = newSubs[idx];
    newSubs[idx] = newSubs[idx - 1];
    newSubs[idx - 1] = temp;
    const renumbered = newSubs.map((s, i) => ({ ...s, digit: String(i + 1) }));
    handleUpdateOption(parentId, "subOptions", renumbered);
  };

  const handleMoveSubOptionDown = (parentId: string, subId: string) => {
    const parent = flow.menuStep.options.find((o) => o.id === parentId);
    if (!parent || !parent.subOptions) return;
    const idx = parent.subOptions.findIndex((s) => s.id === subId);
    if (idx === -1 || idx >= parent.subOptions.length - 1) return;
    const newSubs = [...parent.subOptions];
    const temp = newSubs[idx];
    newSubs[idx] = newSubs[idx + 1];
    newSubs[idx + 1] = temp;
    const renumbered = newSubs.map((s, i) => ({ ...s, digit: String(i + 1) }));
    handleUpdateOption(parentId, "subOptions", renumbered);
  };

  const handleNestOptionInside = (optId: string, targetParentId: string) => {
    if (optId === targetParentId) return;
    const optToNest = flow.menuStep.options.find((o) => o.id === optId);
    if (!optToNest) return;

    let newOptions = flow.menuStep.options.filter((o) => o.id !== optId);
    newOptions = newOptions.map((o) => {
      if (o.id === targetParentId) {
        const existingSubs = o.subOptions || [];
        return {
          ...o,
          actionType: "BRANCH_MENU" as FlowActionType,
          subOptions: [...existingSubs, { ...optToNest, subOptions: undefined }],
        };
      }
      return o;
    });

    updateFlow({
      ...flow,
      menuStep: {
        ...flow.menuStep,
        options: recalculateDigits(newOptions),
      },
    });
    toast.success("Opción anidada en la rama con renumeración automática.");
  };

  const handleExtractSubOptionToRoot = (parentId: string, subId: string) => {
    const parent = flow.menuStep.options.find((o) => o.id === parentId);
    if (!parent || !parent.subOptions) return;
    const subToExtract = parent.subOptions.find((s) => s.id === subId);
    if (!subToExtract) return;

    const remainingSubs = parent.subOptions.filter((s) => s.id !== subId);
    const newOptions = flow.menuStep.options.map((o) => {
      if (o.id === parentId) {
        return {
          ...o,
          subOptions: remainingSubs,
        };
      }
      return o;
    });

    newOptions.push({
      ...subToExtract,
      subOptions: undefined,
    });

    updateFlow({
      ...flow,
      menuStep: {
        ...flow.menuStep,
        options: recalculateDigits(newOptions),
      },
    });
    toast.success("Sub-opción extraída al menú principal con renumeración.");
  };

  const handleDropItem = (
    targetId: string,
    targetLevel: "ROOT" | "SUB",
    targetParentId?: string,
    dropType: "before" | "after" | "inside" = "after"
  ) => {
    if (!draggedItem) return;
    if (draggedItem.id === targetId && dropType !== "inside") {
      setDraggedItem(null);
      setDragOverTarget(null);
      return;
    }

    let newOptions = JSON.parse(
      JSON.stringify(flow.menuStep.options)
    ) as FlowMenuOption[];

    let movedOption: FlowMenuOption | null = null;
    if (draggedItem.level === "ROOT") {
      const idx = newOptions.findIndex((o) => o.id === draggedItem.id);
      if (idx !== -1) {
        movedOption = newOptions.splice(idx, 1)[0];
      }
    } else if (draggedItem.level === "SUB" && draggedItem.parentId) {
      const parent = newOptions.find((o) => o.id === draggedItem.parentId);
      if (parent && parent.subOptions) {
        const idx = parent.subOptions.findIndex(
          (s) => s.id === draggedItem.id
        );
        if (idx !== -1) {
          movedOption = parent.subOptions.splice(idx, 1)[0];
        }
      }
    }

    if (!movedOption) {
      setDraggedItem(null);
      setDragOverTarget(null);
      return;
    }

    if (dropType === "inside") {
      const targetBranch = newOptions.find((o) => o.id === targetId);
      if (targetBranch) {
        targetBranch.actionType = "BRANCH_MENU";
        if (!targetBranch.subOptions) targetBranch.subOptions = [];
        targetBranch.subOptions.push({
          ...movedOption,
          subOptions: undefined,
        });
      }
    } else if (targetLevel === "ROOT") {
      const targetIdx = newOptions.findIndex((o) => o.id === targetId);
      if (targetIdx !== -1) {
        const insertIdx = dropType === "before" ? targetIdx : targetIdx + 1;
        newOptions.splice(insertIdx, 0, movedOption);
      } else {
        newOptions.push(movedOption);
      }
    } else if (targetLevel === "SUB" && targetParentId) {
      const targetParent = newOptions.find((o) => o.id === targetParentId);
      if (targetParent) {
        if (!targetParent.subOptions) targetParent.subOptions = [];
        const targetIdx = targetParent.subOptions.findIndex(
          (s) => s.id === targetId
        );
        if (targetIdx !== -1) {
          const insertIdx = dropType === "before" ? targetIdx : targetIdx + 1;
          targetParent.subOptions.splice(insertIdx, 0, movedOption);
        } else {
          targetParent.subOptions.push(movedOption);
        }
      }
    }

    newOptions = recalculateDigits(newOptions);

    updateFlow({
      ...flow,
      menuStep: {
        ...flow.menuStep,
        options: newOptions,
      },
    });

    setDraggedItem(null);
    setDragOverTarget(null);
    toast.success("Opción reordenada con numeración automática.");
  };

  const handleInsertTag = (optId: string, tag: string) => {
    const opt = flow.menuStep.options.find((o) => o.id === optId);
    if (!opt) return;
    const newText = `${opt.responseText} ${tag}`;
    handleUpdateOption(optId, "responseText", newText);
  };

  const handleResetFlowToDefault = () => {
    updateFlow(DEFAULT_CHATBOT_FLOW);
    toast.success("Flujo restablecido a valores estándar de ISP.");
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiConfig || !activeBrandId) return;

    // Validate empty titles in options and subOptions
    const errorIds: string[] = [];
    for (const opt of flow.menuStep.options) {
      if (!opt.title.trim()) {
        errorIds.push(opt.id);
      }
      if (opt.subOptions) {
        for (const sub of opt.subOptions) {
          if (!sub.title.trim()) {
            errorIds.push(sub.id);
          }
        }
      }
    }

    if (errorIds.length > 0) {
      setValidationErrorIds(errorIds);
      toast.error(
        "Hay opciones o sub-opciones sin título. " +
        "Por favor complétalas antes de guardar."
      );
      return;
    }

    setIsSavingConfig(true);
    try {
      const res = await saveBrandAiConfigAction({
        brandId: activeBrandId,
        templateType: aiConfig.templateType,
        botName: aiConfig.botName,
        tone: aiConfig.tone,
        systemPrompt: aiConfig.systemPrompt || undefined,
        flowConfig: aiConfig.flowConfig || DEFAULT_CHATBOT_FLOW,
        allowDiagnosticMikrotik: aiConfig.allowDiagnosticMikrotik ?? true,
        allowKickSession: aiConfig.allowKickSession,
        allowGracePromise: aiConfig.allowGracePromise,
        graceHours: aiConfig.graceHours,
        allowScheduleVisits: aiConfig.allowScheduleVisits,
        morningVisitSlots: aiConfig.morningVisitSlots,
        afternoonVisitSlots: aiConfig.afternoonVisitSlots,
        allowBillingBalance: aiConfig.allowBillingBalance ?? true,
        allowTransferHuman: aiConfig.allowTransferHuman ?? true,
        allowCheckVisits: aiConfig.allowCheckVisits ?? true,
      });

      if (res.success && res.data) {
        setAiConfig(res.data);
        toast.success(
          t(
            "aiSettings.saveSuccess",
            "Configuración de IA y Flujo de Chatbot guardados exitosamente."
          )
        );
      } else {
        toast.error(
          res.error ||
          t("aiSettings.saveError", "Error al guardar configuración.")
        );
      }
    } catch (_err) {
      toast.error("Error al persistir configuración en la base de datos.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const getActionBadge = (actionType: FlowActionType) => {
    switch (actionType) {
      case "DIAGNOSTIC_MIKROTIK":
        return {
          label: "⚡ MikroTik Diagnostic",
          color:
            "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300" +
            " border-sky-200",
          icon: Zap,
        };
      case "KICK_PPPOE_SESSION":
        return {
          label: "🔄 Reinicio PPPoE",
          color:
            "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300" +
            " border-teal-200",
          icon: RotateCcw,
        };
      case "BILLING_BALANCE":
        return {
          label: "💳 Saldo & Link PSE",
          color:
            "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700" +
            " dark:text-emerald-300 border-emerald-200",
          icon: CreditCard,
        };
      case "PROMISE_PAYMENT":
        return {
          label: "🤝 Promesa 24h",
          color:
            "bg-amber-50 dark:bg-amber-950/60 text-amber-700" +
            " dark:text-amber-300 border-amber-200",
          icon: UserCheck,
        };
      case "SCHEDULE_VISIT":
        return {
          label: "📅 Visita Técnica",
          color:
            "bg-purple-50 dark:bg-purple-950/60 text-purple-700" +
            " dark:text-purple-300 border-purple-200",
          icon: Calendar,
        };
      case "TRANSFER_HUMAN":
        return {
          label: "👤 Asesor Humano",
          color:
            "bg-rose-50 dark:bg-rose-950/60 text-rose-700" +
            " dark:text-rose-300 border-rose-200",
          icon: Headphones,
        };
      case "BRANCH_MENU":
        return {
          label: "🌳 Ramificación / Submenú",
          color:
            "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700" +
            " dark:text-indigo-300 border-indigo-200",
          icon: ListTree,
        };
      case "GO_BACK":
        return {
          label: "⬅️ Volver Atrás",
          color:
            "bg-zinc-100 dark:bg-zinc-800 text-zinc-700" +
            " dark:text-zinc-300 border-zinc-200",
          icon: RotateCcw,
        };
      default:
        return {
          label: "💬 Texto Libre",
          color:
            "bg-zinc-100 dark:bg-zinc-800 text-zinc-700" +
            " dark:text-zinc-300 border-zinc-200",
          icon: MessageSquare,
        };
    }
  };

  const getConditionBadge = (condition?: "IS_MORA" | "IS_ACTIVE" | "ALL") => {
    switch (condition) {
      case "IS_MORA":
        return {
          label: "🔴 Solo Mora",
          color:
            "bg-rose-50 text-rose-700 dark:bg-rose-950/50" +
            " dark:text-rose-300 border-rose-200",
        };
      case "IS_ACTIVE":
        return {
          label: "🟢 Solo Activo",
          color:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50" +
            " dark:text-emerald-300 border-emerald-200",
        };
      default:
        return {
          label: "🌐 General (Todos)",
          color:
            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800" +
            " dark:text-zinc-400 border-zinc-200",
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className={cn(
              "text-xl font-black text-zinc-900 dark:text-zinc-50",
              "flex items-center gap-2"
            )}
          >
            <Bot className="h-6 w-6 text-emerald-500" />
            {t("aiSettings.title", "Configuración de Agente IA & Bot WhatsApp")}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t(
              "aiSettings.subtitle",
              "Parametrización del motor de WhatsApp, prompt maestro, flujo y telemetría para "
            )}
            <strong>{activeBrand?.name || "la Marca"}</strong>
          </p>
        </div>

        {aiConfig && (
          <Button
            type="button"
            disabled={isSavingConfig}
            onClick={handleSaveConfig}
            className={cn(
              "rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white",
              "text-xs font-bold h-9 px-4 shadow-xs self-start sm:self-auto"
            )}
          >
            {isSavingConfig ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            {isSavingConfig ? "Guardando..." : "Guardar Configuración"}
          </Button>
        )}
      </div>

      {isLoadingConfig ? (
        <div className="p-16 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
          Cargando configuración de IA...
        </div>
      ) : !aiConfig ? (
        <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-400">
          Selecciona una marca específica en el menú lateral para gestionar su bot de WhatsApp.
        </Card>
      ) : (
        <div className="space-y-6">
          {/* LEVEL 1: TOP-LEVEL BOT ENGINE CARDS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-emerald-500" />
                {t(
                  "aiSettings.engineSelectorTitle",
                  "Motor de Inteligencia & Arquitectura del Bot"
                )}
              </Label>
              <span className="text-[11px] text-zinc-400">
                Selecciona cómo interactúa tu línea de WhatsApp con los abonados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Baileys AI */}
              <div
                onClick={() =>
                  handleSelectEngine(AI_AGENT_TEMPLATES.BAILEYS_AI)
                }
                className={cn(
                  "p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between",
                  aiConfig.templateType === "BAILEYS_AI"
                    ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/60 hover:border-emerald-500/40"
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-500" />
                      WhatsApp Baileys
                    </span>
                    {aiConfig.templateType === "BAILEYS_AI" && (
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                    Agente IA Conversacional Libre (RAG). Respuestas abiertas 24/7 sin
                    plantillas HSM.
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 font-medium">
                  Ideal para atención consultiva y triaje dinámico
                </div>
              </div>

              {/* Card 2: Meta Cloud API */}
              <div
                onClick={() =>
                  handleSelectEngine(AI_AGENT_TEMPLATES.META_CLOUD_API)
                }
                className={cn(
                  "p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between",
                  aiConfig.templateType === "META_CLOUD_API"
                    ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/60 hover:border-emerald-500/40"
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-sky-500" />
                      Meta Cloud API
                    </span>
                    {aiConfig.templateType === "META_CLOUD_API" && (
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                    Línea oficial de WhatsApp Business bajo plantillas HSM y
                    ventana de 24h.
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 font-medium">
                  Ideal para recordatorios masivos y cobranza
                </div>
              </div>

              {/* Card 3: ChatBot de Reglas 1-2-3 */}
              <div
                onClick={() =>
                  handleSelectEngine(AI_AGENT_TEMPLATES.RULES_BOT)
                }
                className={cn(
                  "p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between",
                  aiConfig.templateType === "RULES_BOT"
                    ? "ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/60 hover:border-emerald-500/40"
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <ListTree className="h-4 w-4 text-emerald-500" />
                      ChatBot de Reglas (1-2-3)
                    </span>
                    {aiConfig.templateType === "RULES_BOT" && (
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                    Flujo por pasos fijos, menú numerado de autoservicio.
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Habilita el Constructor de Flujos & JSON
                </div>
              </div>
            </div>
          </div>

          {/* MISSING CREDENTIALS WARNING BANNER FOR BAILEYS & META */}
          {(aiConfig.templateType === "BAILEYS_AI" ||
            aiConfig.templateType === "META_CLOUD_API") &&
            envStatus &&
            !envStatus.hasIspAiApiKey && (
              <div
                className={cn(
                  "p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10",
                  "dark:bg-amber-500/15 flex items-start gap-3 shadow-xs"
                )}
              >
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                    Faltan credenciales de IA para el Agente de WhatsApp (ISP_AI_API_KEY)
                  </span>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Para que el Agente IA pueda responder guiado por tu Prompt Maestro,
                    debes definir la variable{" "}
                    <code
                      className={cn(
                        "font-mono bg-white/70 dark:bg-zinc-900/70",
                        "px-1 py-0.5 rounded text-[11px] font-bold"
                      )}
                    >
                      ISP_AI_API_KEY
                    </code>{" "}
                    en tu archivo <code className="font-mono">.env</code>. Mientras no esté
                    configurada, el agente no podrá generar respuestas de IA dinámicas.
                  </p>
                </div>
              </div>
            )}

          {/* TESTING SUBSCRIBER BANNER */}
          <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                      Abonado de Pruebas: Carlos Prueba NOC
                    </span>
                    <span className="text-[10px] font-mono bg-white/80 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                      CC 1234567890
                    </span>
                    <span className="text-[10px] font-mono bg-white/80 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                      Contrato TEST-001
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    {testingSub ? (
                      <>
                        Estado:{" "}
                        <span
                          className={cn(
                            "font-bold",
                            testingSub.contract.billingStatus === "SUSPENDIDO_MORA"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {testingSub.contract.billingStatus === "SUSPENDIDO_MORA"
                            ? "🔴 Cortado por Mora"
                            : "🟢 Activo"}
                        </span>
                        {" • "}Adeudo:{" "}
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          {new Intl.NumberFormat("es-CO", {
                            style: "currency",
                            currency: "COP",
                            maximumFractionDigits: 0,
                          }).format(testingSub.pendingDebt.total)}
                        </span>
                        {" • "}Tickets: {testingSub.openTicketsCount}
                        {" • "}Visitas: {testingSub.scheduledVisitsCount}
                      </>
                    ) : (
                      "Cargando estado del abonado..."
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {testingSub?.contract.billingStatus === "SUSPENDIDO_MORA" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleCut(false)}
                    disabled={isActionInProgress}
                    className="h-8 text-xs font-bold border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <Power className="h-3.5 w-3.5 mr-1" />
                    Reactivar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleCut(true)}
                    disabled={isActionInProgress}
                    className="h-8 text-xs font-bold border-rose-500 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  >
                    <Power className="h-3.5 w-3.5 mr-1" />
                    Cortar por Mora
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGrantGrace}
                  disabled={isActionInProgress}
                  className="h-8 text-xs font-bold border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  Prórroga 24h
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleResetTestSub}
                  disabled={isActionInProgress}
                  className="h-8 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  title="Reiniciar a Mora y limpiar tickets"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              </div>
            </div>
          </Card>

          {/* SPLIT VIEW: BUILDER ON LEFT, SIMULATOR ON RIGHT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT 7-8 COLS: CONTEXTUAL TABS */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-5">
              {/* Contextual Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                {isRulesBot ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveTab("flow")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                        activeTab === "flow"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      {t("aiSettings.tabFlow", "Constructor de Flujo")}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("params")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                        activeTab === "params"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {t("aiSettings.tabParams", "Ajustes")}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("json")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                        activeTab === "json"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      <FileCode className="h-3.5 w-3.5" />
                      {t("aiSettings.tabJson", "JSON del Flujo")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveTab("prompt")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                        activeTab === "prompt"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      <FileCode className="h-3.5 w-3.5" />
                      {t("aiSettings.tabPrompt", "Prompt Maestro & Directrices IA")}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("params")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                        activeTab === "params"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {t("aiSettings.tabParams", "Ajustes")}
                    </button>
                  </>
                )}
              </div>

              {/* VIEW A: STEP-FLOW BUILDER (ONLY WHEN RULES_BOT) */}
              {isRulesBot && activeTab === "flow" && (
                <div className="space-y-6">
                  {/* ETAPA 1: SALUDO & CAPTURA DE IDENTIDAD */}
                  <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Etapa 1
                        </span>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {t(
                            "aiSettings.step1Title",
                            "Etapa 1: Saludo & Captura de Identidad"
                          )}
                        </h3>
                      </div>
                      <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>

                    <CardContent className="p-5 space-y-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">
                          Mensaje de Bienvenida Inicial
                        </Label>
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={flow.welcomeStep.greeting}
                          onChange={(e) =>
                            updateFlow({
                              ...flow,
                              welcomeStep: {
                                ...flow.welcomeStep,
                                greeting: e.target.value,
                              },
                            })
                          }
                          className={cn(
                            "w-full rounded-xl border border-zinc-200 dark:border-zinc-800",
                            "bg-white dark:bg-zinc-900 p-2.5 text-xs focus:ring-1 focus:ring-emerald-500"
                          )}
                        />
                        <p className="text-[10px] text-zinc-400">
                          Usa <code>{"{{brandName}}"}</code> para insertar el nombre de la empresa.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={flow.welcomeStep.requireIdentification}
                            onChange={(e) =>
                              updateFlow({
                                ...flow,
                                welcomeStep: {
                                  ...flow.welcomeStep,
                                  requireIdentification: e.target.checked,
                                },
                              })
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            Exigir Cédula/NIT o Contrato antes de desplegar el menú de opciones
                          </span>
                        </label>

                        {flow.welcomeStep.requireIdentification && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                Mensaje para solicitar Cédula/Contrato
                              </Label>
                              <Input
                                maxLength={500}
                                value={flow.welcomeStep.askIdentifierPrompt}
                                onChange={(e) =>
                                  updateFlow({
                                    ...flow,
                                    welcomeStep: {
                                      ...flow.welcomeStep,
                                      askIdentifierPrompt: e.target.value,
                                    },
                                  })
                                }
                                className="h-8 rounded-xl text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                Mensaje de error si no se encuentra contrato
                              </Label>
                              <Input
                                maxLength={500}
                                value={flow.welcomeStep.notFoundMessage}
                                onChange={(e) =>
                                  updateFlow({
                                    ...flow,
                                    welcomeStep: {
                                      ...flow.welcomeStep,
                                      notFoundMessage: e.target.value,
                                    },
                                  })
                                }
                                className="h-8 rounded-xl text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* ETAPA 2: MENÚ PRINCIPAL DE AUTOSERVICIO */}
                  <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
                    <div className="bg-sky-50/50 dark:bg-sky-950/20 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          Etapa 2
                        </span>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {t(
                            "aiSettings.step2Title",
                            "Etapa 2: Menú Principal de Autoservicio"
                          )}
                        </h3>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddOption}
                        className="h-7 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Añadir Opción
                      </Button>
                    </div>

                    <CardContent className="p-5 space-y-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">
                          Encabezado del Menú en WhatsApp
                        </Label>
                        <Input
                          maxLength={500}
                          value={flow.menuStep.menuHeader}
                          onChange={(e) =>
                            updateFlow({
                              ...flow,
                              menuStep: {
                                ...flow.menuStep,
                                menuHeader: e.target.value,
                              },
                            })
                          }
                          className="h-9 rounded-xl text-xs"
                        />
                        <p className="text-[10px] text-zinc-400">
                          Variables: <code>{"{{clientName}}"}</code>, <code>{"{{brandName}}"}</code>
                        </p>
                      </div>

                      {/* Options list */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                            Opciones del Menú ({flow.menuStep.options.length})
                          </Label>
                          <span className="text-[10px] text-zinc-400">
                            Haz clic para desplegar los detalles de cada opción
                          </span>
                        </div>

                        <div className="space-y-3">
                          {flow.menuStep.options.map((opt, optIndex) => {
                            const isExpanded = expandedOptionId === opt.id;
                            const badge = getActionBadge(opt.actionType);
                            const BadgeIcon = badge.icon;
                            const isBeingDragged = draggedItem?.id === opt.id;
                            const isOverTarget =
                              dragOverTarget?.id === opt.id &&
                              dragOverTarget.dropType === "after";
                            const otherBranches = flow.menuStep.options.filter(
                              (o) =>
                                o.id !== opt.id &&
                                (o.actionType === "BRANCH_MENU" ||
                                  (o.subOptions && o.subOptions.length > 0))
                            );

                            return (
                              <div
                                key={opt.id}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("text/plain", opt.id);
                                  setDraggedItem({
                                    id: opt.id,
                                    level: "ROOT",
                                  });
                                }}
                                onDragEnd={() => {
                                  setDraggedItem(null);
                                  setDragOverTarget(null);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDragOverTarget({
                                    id: opt.id,
                                    level: "ROOT",
                                    dropType: "after",
                                  });
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDropItem(
                                    opt.id,
                                    "ROOT",
                                    undefined,
                                    "after"
                                  );
                                }}
                                className={cn(
                                  "rounded-2xl border transition-all duration-200",
                                  isBeingDragged &&
                                  "opacity-40 border-dashed border-emerald-500 scale-[0.99]",
                                  isOverTarget &&
                                  "ring-2 ring-emerald-500 border-emerald-500 shadow-md",
                                  !isBeingDragged &&
                                  !isOverTarget &&
                                  (isExpanded
                                    ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs"
                                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60")
                                )}
                              >
                                {/* Option header bar */}
                                <div className="p-3 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                    <div
                                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-grab active:cursor-grabbing p-1"
                                      title="Arrastra para reordenar o anidar adentro de una rama"
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </div>

                                    {/* Option position badge */}
                                    <span
                                      className={cn(
                                        "h-6 w-6 rounded-lg font-black text-xs flex items-center",
                                        "justify-center shrink-0 shadow-xs",
                                        opt.enabled
                                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                          : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800"
                                      )}
                                    >
                                      {opt.digit}
                                    </span>

                                    <div
                                      className="flex items-center gap-2 flex-wrap min-w-0 cursor-pointer"
                                      onClick={() =>
                                        setExpandedOptionId(
                                          isExpanded ? null : opt.id
                                        )
                                      }
                                    >
                                      <span
                                        className={cn(
                                          "text-xs font-bold",
                                          !opt.enabled &&
                                          "line-through text-zinc-400"
                                        )}
                                      >
                                        {opt.title}
                                      </span>

                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
                                          "text-[10px] font-semibold border shrink-0",
                                          badge.color
                                        )}
                                      >
                                        <BadgeIcon className="h-3 w-3" />
                                        {badge.label}
                                      </span>

                                      {(() => {
                                        const cBadge = getConditionBadge(
                                          opt.condition
                                        );
                                        return (
                                          <span
                                            className={cn(
                                              "inline-flex items-center px-2 py-0.5 rounded-full",
                                              "text-[10px] font-semibold border shrink-0",
                                              cBadge.color
                                            )}
                                          >
                                            {cBadge.label}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Quick move up/down buttons */}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled={optIndex === 0}
                                      onClick={() =>
                                        handleMoveOptionUp(opt.id)
                                      }
                                      className="h-7 w-7 text-zinc-400 hover:text-zinc-700 disabled:opacity-20"
                                      title="Subir opción"
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled={
                                        optIndex ===
                                        flow.menuStep.options.length - 1
                                      }
                                      onClick={() =>
                                        handleMoveOptionDown(opt.id)
                                      }
                                      className="h-7 w-7 text-zinc-400 hover:text-zinc-700 disabled:opacity-20"
                                      title="Bajar opción"
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </Button>

                                    <label
                                      className="flex items-center gap-1 cursor-pointer text-[11px] text-zinc-500 px-1"
                                      title="Activar o pausar esta opción"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={opt.enabled}
                                        onChange={(e) =>
                                          handleUpdateOption(
                                            opt.id,
                                            "enabled",
                                            e.target.checked
                                          )
                                        }
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span className="hidden sm:inline">
                                        {opt.enabled ? "Activa" : "Pausada"}
                                      </span>
                                    </label>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleRemoveOption(opt.id)
                                      }
                                      className="h-7 w-7 text-zinc-400 hover:text-rose-500"
                                      title="Eliminar opción"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setExpandedOptionId(
                                          isExpanded ? null : opt.id
                                        )
                                      }
                                      className="h-7 w-7 text-zinc-400"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>

                                {/* Option expanded body */}
                                {isExpanded && (
                                  <div className="px-4 pb-4 pt-1 space-y-3.5 border-t border-zinc-100 dark:border-zinc-800/80">
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                      <div className="sm:col-span-5 space-y-1">
                                        <Label className="text-[11px] font-bold">
                                          Título del Menú
                                        </Label>
                                        <Input
                                          value={opt.title}
                                          maxLength={100}
                                          draggable={false}
                                          onMouseDown={(e) =>
                                            e.stopPropagation()
                                          }
                                          onChange={(e) =>
                                            handleUpdateOption(
                                              opt.id,
                                              "title",
                                              e.target.value
                                            )
                                          }
                                          className={cn(
                                            "h-8 rounded-xl text-xs",
                                            validationErrorIds.includes(
                                              opt.id
                                            ) &&
                                              "border-rose-500 ring-2 ring-rose-500/20"
                                          )}
                                        />
                                      </div>

                                      <div className="sm:col-span-4 space-y-1">
                                        <Label className="text-[11px] font-bold">
                                          Acción Automatizada
                                        </Label>
                                        <select
                                          value={opt.actionType}
                                          onChange={(e) =>
                                            handleUpdateOption(
                                              opt.id,
                                              "actionType",
                                              e.target.value as FlowActionType
                                            )
                                          }
                                          className={cn(
                                            "w-full h-8 rounded-xl border border-zinc-200 dark:border-zinc-800",
                                            "bg-white dark:bg-zinc-900 px-2.5 text-xs"
                                          )}
                                        >
                                          <option value="DIAGNOSTIC_MIKROTIK">
                                            ⚡ Diagnóstico MikroTik (Sesión & Ping)
                                          </option>
                                          <option value="KICK_PPPOE_SESSION">
                                            🔄 Reiniciar Sesión PPPoE (MikroTik Kick)
                                          </option>
                                          <option value="BILLING_BALANCE">
                                            💳 Saldo & Link de Pago PSE / Wompi
                                          </option>
                                          <option value="PROMISE_PAYMENT">
                                            🤝 Promesa de Pago (24h de gracia)
                                          </option>
                                          <option value="SCHEDULE_VISIT">
                                            📅 Agendamiento de Visita Técnica
                                          </option>
                                          <option value="BRANCH_MENU">
                                            🌳 Ramificación (Submenú con sub-opciones)
                                          </option>
                                          <option value="TRANSFER_HUMAN">
                                            👤 Transferir a Asesor Humano
                                          </option>
                                          <option value="CUSTOM_TEXT">
                                            💬 Respuesta de Texto Personalizada
                                          </option>
                                        </select>
                                      </div>

                                      <div className="sm:col-span-3 space-y-1">
                                        <Label className="text-[11px] font-bold">
                                          Condición
                                        </Label>
                                        <select
                                          value={opt.condition || "ALL"}
                                          onChange={(e) =>
                                            handleUpdateOption(
                                              opt.id,
                                              "condition",
                                              e.target.value
                                            )
                                          }
                                          className={cn(
                                            "w-full h-8 rounded-xl border border-zinc-200 dark:border-zinc-800",
                                            "bg-white dark:bg-zinc-900 px-2.5 text-xs"
                                          )}
                                        >
                                          <option value="ALL">
                                            🌐 General (Siempre)
                                          </option>
                                          <option value="IS_ACTIVE">
                                            🟢 Solo ACTIVO
                                          </option>
                                          <option value="IS_MORA">
                                            🔴 Solo en MORA
                                          </option>
                                        </select>
                                      </div>
                                    </div>

                                    {/* Quick helper to nest into another branch */}
                                    {otherBranches.length > 0 &&
                                      opt.actionType !== "BRANCH_MENU" && (
                                        <div className="flex items-center gap-2 text-xs">
                                          <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
                                            <CornerDownRight className="h-3 w-3 text-indigo-500" />
                                            Anidar adentro de:
                                          </span>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {otherBranches.map((br) => (
                                              <Button
                                                key={br.id}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                  handleNestOptionInside(
                                                    opt.id,
                                                    br.id
                                                  )
                                                }
                                                className="h-6 text-[10px] rounded-lg border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50"
                                              >
                                                ↳ {br.title}
                                              </Button>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                    {/* Sub-options for BRANCH_MENU (Nivel 2) */}
                                    {opt.actionType === "BRANCH_MENU" && (
                                      <div
                                        className={cn(
                                          "rounded-2xl border border-indigo-200",
                                          "dark:border-indigo-800/80 bg-indigo-50/20",
                                          "dark:bg-indigo-950/20 p-4 space-y-3"
                                        )}
                                      >
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                          <div className="flex items-center gap-2">
                                            <GitBranch className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                              Sub-opciones: {opt.title} (
                                              {opt.subOptions?.length || 0})
                                            </h4>
                                            <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded-full border border-indigo-300 dark:border-indigo-800">
                                              Nivel 2
                                            </span>
                                          </div>

                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={() =>
                                              handleAddSubOption(opt.id)
                                            }
                                            className="h-7 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1 font-bold"
                                          >
                                            <Plus className="h-3 w-3" />
                                            Añadir Sub-opción
                                          </Button>
                                        </div>

                                        {/* Drop zone inside branch */}
                                        <div
                                          onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDragOverTarget({
                                              id: opt.id,
                                              level: "ROOT",
                                              dropType: "inside",
                                            });
                                          }}
                                          onDrop={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDropItem(
                                              opt.id,
                                              "ROOT",
                                              undefined,
                                              "inside"
                                            );
                                          }}
                                          className={cn(
                                            "p-3 rounded-xl border-2 border-dashed text-center text-xs transition-colors",
                                            dragOverTarget?.id === opt.id &&
                                              dragOverTarget.dropType ===
                                              "inside"
                                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 font-bold"
                                              : "border-indigo-200 dark:border-indigo-800/60 text-zinc-500 bg-white/60 dark:bg-zinc-900/60"
                                          )}
                                        >
                                          📥 Arrastra una opción aquí para anidarla en esta rama
                                        </div>

                                        <div className="space-y-2.5">
                                          {(opt.subOptions || []).map(
                                            (sub, subIndex) => {
                                              const subBadge =
                                                getActionBadge(
                                                  sub.actionType
                                                );
                                              const isSubBeingDragged =
                                                draggedItem?.id === sub.id;
                                              const isSubOver =
                                                dragOverTarget?.id ===
                                                sub.id &&
                                                dragOverTarget.dropType ===
                                                "after";

                                              return (
                                                <div
                                                  key={sub.id}
                                                  draggable={true}
                                                  onDragStart={(e) => {
                                                    e.dataTransfer.setData(
                                                      "text/plain",
                                                      sub.id
                                                    );
                                                    setDraggedItem({
                                                      id: sub.id,
                                                      level: "SUB",
                                                      parentId: opt.id,
                                                    });
                                                  }}
                                                  onDragEnd={() => {
                                                    setDraggedItem(null);
                                                    setDragOverTarget(null);
                                                  }}
                                                  onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setDragOverTarget({
                                                      id: sub.id,
                                                      level: "SUB",
                                                      parentId: opt.id,
                                                      dropType: "after",
                                                    });
                                                  }}
                                                  onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDropItem(
                                                      sub.id,
                                                      "SUB",
                                                      opt.id,
                                                      "after"
                                                    );
                                                  }}
                                                  className={cn(
                                                    "p-3 rounded-xl border bg-white dark:bg-zinc-900 space-y-2.5 transition-all",
                                                    isSubBeingDragged &&
                                                    "opacity-40 border-dashed border-indigo-500",
                                                    isSubOver &&
                                                    "ring-2 ring-indigo-500 border-indigo-500",
                                                    !isSubBeingDragged &&
                                                    !isSubOver &&
                                                    "border-indigo-100 dark:border-indigo-900/60"
                                                  )}
                                                >
                                                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                                    <div className="flex items-center gap-2">
                                                      <div
                                                        className="text-zinc-400 hover:text-zinc-700 cursor-grab active:cursor-grabbing"
                                                        title="Arrastra para reordenar esta sub-opción"
                                                      >
                                                        <GripVertical className="h-3.5 w-3.5" />
                                                      </div>
                                                      <span className="h-5 w-5 rounded-md bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-black text-[10px] flex items-center justify-center">
                                                        {sub.digit}
                                                      </span>
                                                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                                        {sub.title}
                                                      </span>
                                                      <span
                                                        className={cn(
                                                          "text-[9px] px-1.5 py-0.5 rounded-full border",
                                                          subBadge.color
                                                        )}
                                                      >
                                                        {subBadge.label}
                                                      </span>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                      {/* Sub move up/down */}
                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={
                                                          subIndex === 0
                                                        }
                                                        onClick={() =>
                                                          handleMoveSubOptionUp(
                                                            opt.id,
                                                            sub.id
                                                          )
                                                        }
                                                        className="h-6 w-6 text-zinc-400 hover:text-zinc-700 disabled:opacity-20"
                                                        title="Subir"
                                                      >
                                                        <ArrowUp className="h-3 w-3" />
                                                      </Button>

                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={
                                                          subIndex ===
                                                          (opt.subOptions
                                                            ?.length || 0) -
                                                          1
                                                        }
                                                        onClick={() =>
                                                          handleMoveSubOptionDown(
                                                            opt.id,
                                                            sub.id
                                                          )
                                                        }
                                                        className="h-6 w-6 text-zinc-400 hover:text-zinc-700 disabled:opacity-20"
                                                        title="Bajar"
                                                      >
                                                        <ArrowDown className="h-3 w-3" />
                                                      </Button>

                                                      {/* Extract to root level */}
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                          handleExtractSubOptionToRoot(
                                                            opt.id,
                                                            sub.id
                                                          )
                                                        }
                                                        className="h-6 text-[10px] rounded-lg gap-1 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50"
                                                        title="Extraer esta sub-opción y subirla al Menú Principal (Nivel 1)"
                                                      >
                                                        <CornerUpLeft className="h-3 w-3" />
                                                        Extraer a Nivel 1
                                                      </Button>

                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                          handleRemoveSubOption(
                                                            opt.id,
                                                            sub.id
                                                          )
                                                        }
                                                        className="h-6 w-6 text-zinc-400 hover:text-rose-500"
                                                      >
                                                        <Trash2 className="h-3 w-3" />
                                                      </Button>
                                                    </div>
                                                  </div>

                                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                                    <div className="sm:col-span-6">
                                                      <Input
                                                        value={sub.title}
                                                        maxLength={100}
                                                        draggable={false}
                                                        onMouseDown={(e) =>
                                                          e.stopPropagation()
                                                        }
                                                        onChange={(e) =>
                                                          handleUpdateSubOption(
                                                            opt.id,
                                                            sub.id,
                                                            "title",
                                                            e.target.value
                                                          )
                                                        }
                                                        placeholder="Título sub-opción"
                                                        className={cn(
                                                          "h-7 text-xs",
                                                          validationErrorIds.includes(
                                                            sub.id
                                                          ) &&
                                                            "border-rose-500 ring-2 ring-rose-500/20"
                                                        )}
                                                      />
                                                    </div>
                                                    <div className="sm:col-span-6">
                                                      <select
                                                        value={
                                                          sub.actionType
                                                        }
                                                        onChange={(e) =>
                                                          handleUpdateSubOption(
                                                            opt.id,
                                                            sub.id,
                                                            "actionType",
                                                            e.target
                                                              .value as FlowActionType
                                                          )
                                                        }
                                                        className="w-full h-7 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 text-xs"
                                                      >
                                                        <option value="DIAGNOSTIC_MIKROTIK">
                                                          ⚡ Diagnóstico MikroTik
                                                        </option>
                                                        <option value="KICK_PPPOE_SESSION">
                                                          🔄 Reiniciar Sesión PPPoE
                                                        </option>
                                                        <option value="SCHEDULE_VISIT">
                                                          📅 Agendar Visita Técnica
                                                        </option>
                                                        <option value="BILLING_BALANCE">
                                                          💳 Saldo & Link PSE
                                                        </option>
                                                        <option value="PROMISE_PAYMENT">
                                                          🤝 Promesa de Pago 24h
                                                        </option>
                                                        <option value="TRANSFER_HUMAN">
                                                          👤 Asesor Humano
                                                        </option>
                                                        <option value="CUSTOM_TEXT">
                                                          💬 Texto Libre
                                                        </option>
                                                      </select>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            }
                                          )}

                                          {/* Automatic return to parent banner */}
                                          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-[11px] text-zinc-500">
                                            <RotateCcw className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                            <span>
                                              <strong>0. ⬅️ Volver atrás</strong> se genera
                                              automáticamente para esta rama.
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Keywords trigger */}
                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">
                                        Palabras Clave (Disparadores)
                                      </Label>
                                      <Input
                                        value={opt.keywords.join(", ")}
                                        draggable={false}
                                        onMouseDown={(e) =>
                                          e.stopPropagation()
                                        }
                                        onChange={(e) => {
                                          const parsed = e.target.value
                                            .split(",")
                                            .map((k) => k.trim())
                                            .filter(Boolean);
                                          handleUpdateOption(
                                            opt.id,
                                            "keywords",
                                            parsed
                                          );
                                        }}
                                        placeholder="ej: lento, sin internet, problema, revisar"
                                        className="h-8 rounded-xl text-xs"
                                      />
                                    </div>

                                    {/* Response template */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-[11px] font-bold">
                                          Plantilla de Respuesta en WhatsApp
                                        </Label>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] text-zinc-400 mr-1">
                                            Insertar tag:
                                          </span>
                                          {[
                                            "{{clientName}}",
                                            "{{ip}}",
                                            "{{estado}}",
                                            "{{saldo}}",
                                            "{{link_pago}}",
                                          ].map((tTag) => (
                                            <button
                                              key={tTag}
                                              type="button"
                                              onClick={() =>
                                                handleInsertTag(opt.id, tTag)
                                              }
                                              className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-500/20"
                                            >
                                              {tTag}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <textarea
                                        rows={3}
                                        maxLength={1000}
                                        draggable={false}
                                        onMouseDown={(e) =>
                                          e.stopPropagation()
                                        }
                                        value={opt.responseText}
                                        onChange={(e) =>
                                          handleUpdateOption(
                                            opt.id,
                                            "responseText",
                                            e.target.value
                                          )
                                        }
                                        className={cn(
                                          "w-full rounded-xl border border-zinc-200 dark:border-zinc-800",
                                          "bg-white dark:bg-zinc-950 p-2.5 text-xs font-mono leading-relaxed"
                                        )}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ETAPA 3: FALLBACK & TRANSFERENCIA HUMANA */}
                  <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
                    <div className="bg-rose-50/50 dark:bg-rose-950/20 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          Etapa 3
                        </span>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {t(
                            "aiSettings.step3Title",
                            "Etapa 3: Fallback & Asignación a Asesores"
                          )}
                        </h3>
                      </div>
                      <Headphones className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    </div>

                    <CardContent className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                        <div className="sm:col-span-8 space-y-1">
                          <Label className="text-xs font-bold">
                            Palabras Clave de Escape a Asesor Humano
                          </Label>
                          <Input
                            value={flow.fallbackStep.triggerKeywords.join(", ")}
                            onChange={(e) => {
                              const parsed = e.target.value
                                .split(",")
                                .map((k) => k.trim())
                                .filter(Boolean);
                              updateFlow({
                                ...flow,
                                fallbackStep: {
                                  ...flow.fallbackStep,
                                  triggerKeywords: parsed,
                                },
                              });
                            }}
                            className="h-8 rounded-xl text-xs"
                          />
                          <p className="text-[10px] text-zinc-400">
                            Si el cliente escribe estas palabras, se transfiere inmediatamente
                            a la bandeja de asesores.
                          </p>
                        </div>

                        <div className="sm:col-span-4 space-y-1">
                          <Label className="text-xs font-bold">
                            Máx. Reintentos Desconocidos
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={flow.fallbackStep.maxUnknownAttempts}
                            onChange={(e) =>
                              updateFlow({
                                ...flow,
                                fallbackStep: {
                                  ...flow.fallbackStep,
                                  maxUnknownAttempts: Number(e.target.value),
                                },
                              })
                            }
                            className="h-8 rounded-xl text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold">
                            Mensaje cuando no entiende la opción digitada
                          </Label>
                          <textarea
                            rows={2}
                            maxLength={500}
                            value={flow.fallbackStep.fallbackMessage}
                            onChange={(e) =>
                              updateFlow({
                                ...flow,
                                fallbackStep: {
                                  ...flow.fallbackStep,
                                  fallbackMessage: e.target.value,
                                },
                              })
                            }
                            className={cn(
                              "w-full rounded-xl border border-zinc-200 dark:border-zinc-800",
                              "bg-white dark:bg-zinc-900 p-2 text-xs"
                            )}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold">
                            Mensaje de Confirmación de Transferencia
                          </Label>
                          <textarea
                            rows={2}
                            maxLength={500}
                            value={flow.fallbackStep.transferMessage}
                            onChange={(e) =>
                              updateFlow({
                                ...flow,
                                fallbackStep: {
                                  ...flow.fallbackStep,
                                  transferMessage: e.target.value,
                                },
                              })
                            }
                            className={cn(
                              "w-full rounded-xl border border-zinc-200 dark:border-zinc-800",
                              "bg-white dark:bg-zinc-900 p-2 text-xs"
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* VIEW B: SYSTEM PROMPT & IA DIRECTIVES (WHEN BAILEYS OR META) */}
              {!isRulesBot && activeTab === "prompt" && (
                <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <CardContent className="p-5 space-y-4">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {aiConfig.templateType === "BAILEYS_AI"
                          ? "Instrucciones del Agente IA Conversacional (RAG)"
                          : "Directrices para WhatsApp Meta Cloud API"}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Configura el prompt maestro de IA y la personalidad del asistente.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">
                          Nombre del Asistente Virtual
                        </Label>
                        <Input
                          value={aiConfig.botName}
                          onChange={(e) =>
                            setAiConfig({
                              ...aiConfig,
                              botName: e.target.value,
                            })
                          }
                          className="h-8 rounded-xl text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold">
                          Tono de Conversación
                        </Label>
                        <select
                          value={aiConfig.tone}
                          onChange={(e) =>
                            setAiConfig({
                              ...aiConfig,
                              tone: e.target.value as AiTone,
                            })
                          }
                          className={cn(
                            "w-full h-8 rounded-xl border border-zinc-200 dark:border-zinc-800",
                            "bg-white dark:bg-zinc-900 px-3 text-xs"
                          )}
                        >
                          <option value="AMABLE">Cercano & Amable</option>
                          <option value="FORMAL">Formal & Corporativo</option>
                          <option value="TECNICO">Técnico & Directo</option>
                        </select>
                      </div>
                    </div>

                    {/* Maestro System Prompt */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold flex items-center gap-1.5">
                          <FileCode className="h-3.5 w-3.5 text-emerald-500" />
                          System Prompt Maestro de IA
                        </Label>
                        <span className="text-[10px] text-zinc-400">
                          Variables: <code>{"{{brandName}}"}</code>, <code>{"{{clientName}}"}</code>
                        </span>
                      </div>
                      <textarea
                        rows={7}
                        value={aiConfig.systemPrompt || ""}
                        onChange={(e) =>
                          setAiConfig({
                            ...aiConfig,
                            systemPrompt: e.target.value,
                          })
                        }
                        className={cn(
                          "w-full rounded-xl border border-zinc-200 dark:border-zinc-800",
                          "bg-zinc-50 dark:bg-zinc-950/60 p-3 text-xs font-mono leading-relaxed"
                        )}
                        placeholder="Instrucciones maestras del agente..."
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* VIEW C: SETTINGS & MIKROTIK (SHARED) */}
              {activeTab === "params" && (
                <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <CardContent className="p-5 space-y-4">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        Ajustes Operativos & Permisos de Red MikroTik
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Reglas de ejecución técnica aplicadas independientemente del motor.
                      </p>
                    </div>

                    {isRulesBot && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">
                            Nombre del Bot en WhatsApp
                          </Label>
                          <Input
                            value={aiConfig.botName}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                botName: e.target.value,
                              })
                            }
                            className="h-8 rounded-xl text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-bold">
                            Tono de Conversación
                          </Label>
                          <select
                            value={aiConfig.tone}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                tone: e.target.value as AiTone,
                              })
                            }
                            className={cn(
                              "w-full h-8 rounded-xl border border-zinc-200 dark:border-zinc-800",
                              "bg-white dark:bg-zinc-900 px-3 text-xs"
                            )}
                          >
                            <option value="AMABLE">Cercano & Amable</option>
                            <option value="FORMAL">Formal & Corporativo</option>
                            <option value="TECNICO">Técnico & Directo</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {!isRulesBot && (
                      <div
                        className={cn(
                          "p-3.5 rounded-xl border border-emerald-500/30",
                          "bg-emerald-500/5 dark:bg-emerald-500/10 space-y-2"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <Label className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              {t(
                                "aiSettings.historyLimitTitle",
                                "Ventana de Memoria Conversacional (Historial)"
                              )}
                            </Label>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              {t(
                                "aiSettings.historyLimitDesc",
                                "Número de mensajes previos enviados al LLM " +
                                  "para mantener el contexto del hilo."
                              )}
                            </p>
                          </div>
                          <div className="w-20 shrink-0">
                            <Input
                              type="number"
                              min={2}
                              max={30}
                              step={1}
                              value={flow.historyLimit ?? 10}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                updateFlow({
                                  ...flow,
                                  historyLimit: isNaN(val)
                                    ? 10
                                    : Math.min(30, Math.max(2, val)),
                                });
                              }}
                              className="h-8 rounded-xl text-xs text-center font-bold"
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-400 block">
                          {t(
                            "aiSettings.historyLimitTip",
                            "Valor recomendado: 10 mensajes. " +
                              "Configuración base global: ISP_AI_HISTORY_LIMIT."
                          )}
                        </span>
                      </div>
                    )}

                    {/* Autonomous MikroTik Actions */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                        Permisos de Ejecución en MikroTik & CRM (Tools del Bot)
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* 1. Diagnóstico MikroTik */}
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer bg-white dark:bg-zinc-900/60 hover:border-emerald-500/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={aiConfig.allowDiagnosticMikrotik ?? true}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                allowDiagnosticMikrotik: e.target.checked,
                              })
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              Diagnóstico MikroTik en Vivo
                            </span>
                            <p className="text-[11px] text-zinc-500">
                              Consulta en tiempo real de sesión PPPoE, ping y potencia óptica Rx.
                            </p>
                          </div>
                        </label>

                        {/* 2. Kick PPPoE */}
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer bg-white dark:bg-zinc-900/60 hover:border-emerald-500/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={aiConfig.allowKickSession}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                allowKickSession: e.target.checked,
                              })
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                              <RotateCcw className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              Kick PPPoE (Reinicio Remoto)
                            </span>
                            <p className="text-[11px] text-zinc-500">
                              Reinicio autónomo de sesión en RouterOS ante reporte de lentitud.
                            </p>
                          </div>
                        </label>

                        {/* 3. Promesa de Pago */}
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer bg-white dark:bg-zinc-900/60 hover:border-emerald-500/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={aiConfig.allowGracePromise}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                allowGracePromise: e.target.checked,
                              })
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              Promesa de Pago (Reconexión)
                            </span>
                            <p className="text-[11px] text-zinc-500">
                              Reactivación temporal de servicio si el contrato
                              está suspendido por mora.
                            </p>
                          </div>
                        </label>

                        {/* 4. Agendamiento de Visitas */}
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer bg-white dark:bg-zinc-900/60 hover:border-emerald-500/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={aiConfig.allowScheduleVisits ?? true}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                allowScheduleVisits: e.target.checked,
                              })
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                              <Calendar className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                              Agendamiento de Visitas Técnicas
                            </span>
                            <p className="text-[11px] text-zinc-500">
                              Crear tickets y citas en jornada Mañana/Tarde
                              excluyendo fines de semana.
                            </p>
                          </div>
                        </label>

                        {/* 5. Consulta de Citas Programadas */}
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer bg-white dark:bg-zinc-900/60 hover:border-emerald-500/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={aiConfig.allowCheckVisits ?? true}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                allowCheckVisits: e.target.checked,
                              })
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                              <CalendarCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              Consulta de Visitas Programadas
                            </span>
                            <p className="text-[11px] text-zinc-500">
                              Permitir al abonado verificar el estado y fecha de sus citas activas.
                            </p>
                          </div>
                        </label>

                        {/* 6. Consulta de Saldo & PSE */}
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer bg-white dark:bg-zinc-900/60 hover:border-emerald-500/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={aiConfig.allowBillingBalance ?? true}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                allowBillingBalance: e.target.checked,
                              })
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                              <CreditCard className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              Consulta de Saldo & Enlace PSE
                            </span>
                            <p className="text-[11px] text-zinc-500">
                              Generar saldo y link de pasarela Wompi/PSE directamente en el chat.
                            </p>
                          </div>
                        </label>

                        {/* 7. Transferencia a Asesor Humano */}
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer bg-white dark:bg-zinc-900/60 hover:border-emerald-500/50 transition-colors sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={aiConfig.allowTransferHuman ?? true}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                allowTransferHuman: e.target.checked,
                              })
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                              <Headphones className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                              Transferencia a Asesor Humano
                            </span>
                            <p className="text-[11px] text-zinc-500">
                              Escalar la conversación a la bandeja de
                              operadores en vivo de la marca.
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Configuración de Horas de Gracia si está activa la Promesa */}
                      {aiConfig.allowGracePromise && (
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                              Duración de la Prórroga de Gracia (Horas)
                            </span>
                            <p className="text-[11px] text-zinc-500">
                              Tiempo límite de reactivación temporal antes
                              de volver a suspender por mora.
                            </p>
                          </div>
                          <div className="w-24">
                            <Input
                              type="number"
                              min={1}
                              max={72}
                              value={aiConfig.graceHours}
                              onChange={(e) =>
                                setAiConfig({
                                  ...aiConfig,
                                  graceHours: Number(e.target.value),
                                })
                              }
                              className="h-8 rounded-xl text-xs font-bold text-center"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Technical Visit Slots */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                        Cupos Máximos de Visitas Técnicas (Por Jornada)
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-zinc-500">
                            Mañana (8:00 AM - 1:00 PM)
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={aiConfig.morningVisitSlots}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                morningVisitSlots: Number(e.target.value),
                              })
                            }
                            className="h-8 rounded-xl text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] text-zinc-500">
                            Tarde (1:00 PM - 6:00 PM)
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={aiConfig.afternoonVisitSlots}
                            onChange={(e) =>
                              setAiConfig({
                                ...aiConfig,
                                afternoonVisitSlots: Number(e.target.value),
                              })
                            }
                            className="h-8 rounded-xl text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* VIEW D: JSON OF FLOW (ONLY IN RULES_BOT) */}
              {isRulesBot && activeTab === "json" && (
                <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          Estructura JSON del Flujo (Campo flow_config)
                        </h3>
                        <p className="text-xs text-zinc-500">
                          Estructura JSON almacenada directamente en la base de datos de la marca.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              JSON.stringify(flow, null, 2)
                            );
                            toast.success("JSON copiado al portapapeles.");
                          }}
                          className="h-8 text-xs rounded-xl gap-1"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copiar JSON
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResetFlowToDefault}
                          className="h-8 text-xs rounded-xl gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restablecer Estándar
                        </Button>
                      </div>
                    </div>

                    <pre className="p-4 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-xs overflow-x-auto max-h-[500px]">
                      {JSON.stringify(flow, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* RIGHT 4-5 COLS: LIVE INTERACTIVE WHATSAPP SIMULATOR */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-6">
              <WhatsAppFlowSimulator
                botName={aiConfig.botName}
                brandName={activeBrand?.name || "Serkoi Telecom"}
                flow={flow}
                templateType={aiConfig.templateType}
                brandId={activeBrandId}
                hasIspAiApiKey={envStatus?.hasIspAiApiKey ?? true}
                onActionExecuted={loadTestingSubscriber}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
