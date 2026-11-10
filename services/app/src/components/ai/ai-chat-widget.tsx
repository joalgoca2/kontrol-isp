"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Trash2, Bot } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/components/providers/i18n-provider";
import { sendAiChatMessageAction } from "@/actions/ai";
import { AiChatMessages } from "./ai-chat-messages";
import { AiChatInput } from "./ai-chat-input";
import type { AiChatMessage } from "@/types";

const STORAGE_KEY = "ai_chat_history_v1";

export function AiChatWidget() {
  const { t } = useTranslation();
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_CHAT !== "false";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load chat history from LocalStorage (0 DB Overhead)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch (_err) {
      // Ignore storage errors
    }
  }, []);

  // Save chat history to LocalStorage
  const saveMessages = (newMessages: AiChatMessage[]) => {
    setMessages(newMessages);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages));
    } catch (_err) {
      // Ignore storage errors
    }
  };

  const handleClearHistory = () => {
    saveMessages([]);
    toast.success(t("aiChat.clearHistory", "Historial de chat limpiado."));
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const updated = [...messages, userMsg];
    saveMessages(updated);
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendAiChatMessageAction({
        message: text,
        history: historyPayload,
      });

      if (res.success && res.data) {
        saveMessages([...updated, res.data]);
      } else {
        toast.error(res.error || "Error al comunicarse con el asistente.");
      }
    } catch (_error) {
      toast.error("Error de conexión con el asistente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t("aiChat.title", "Asistente IA")}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/30 border border-emerald-400/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <div className="relative">
            <Sparkles className="h-6 w-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-80" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
            </span>
          </div>
        )}
      </button>

      {/* Floating Drawer / Slide-out Sheet Panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-50 flex h-[520px] max-h-[calc(100vh-120px)] w-[calc(100vw-32px)] max-w-[420px] sm:w-[400px] flex-col rounded-3xl border border-zinc-200 bg-white/95 backdrop-blur-md shadow-2xl transition-all dark:border-zinc-800 dark:bg-zinc-900/95"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t("aiChat.title", "Asistente IA")}
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {t("aiChat.disclaimer", "Respuestas en tiempo real del sistema")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  title={t("aiChat.clearHistory", "Limpiar chat")}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <AiChatMessages
            messages={messages}
            isLoading={isLoading}
            onSelectSuggestion={handleSendMessage}
          />

          {/* Input Box */}
          <AiChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      )}
    </>
  );
}
