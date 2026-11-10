"use client";

import React, { useRef, useEffect } from "react";
import { Bot, User, Sparkles } from "lucide-react";
import type { AiChatMessage } from "@/types";
import { useTranslation } from "@/components/providers/i18n-provider";

interface AiChatMessagesProps {
  messages: AiChatMessage[];
  isLoading: boolean;
  onSelectSuggestion: (prompt: string) => void;
}

function FormattedMarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-1" />;
        }

        const regex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
        const parts = line.split(regex);

        return (
          <p key={lineIdx}>
            {parts.map((part, partIdx) => {
              if (
                part.startsWith("[") &&
                part.includes("](") &&
                part.endsWith(")")
              ) {
                const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
                if (match) {
                  const [, label, url] = match;
                  return (
                    <a
                      key={partIdx}
                      href={url}
                      className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      {label} 🔗
                    </a>
                  );
                }
              }
              if (
                part.startsWith("**") &&
                part.endsWith("**") &&
                part.length > 4
              ) {
                return (
                  <strong
                    key={partIdx}
                    className="font-extrabold text-zinc-900 dark:text-zinc-100"
                  >
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (
                part.startsWith("*") &&
                part.endsWith("*") &&
                part.length > 2
              ) {
                return (
                  <em
                    key={partIdx}
                    className="italic text-zinc-700 dark:text-zinc-300"
                  >
                    {part.slice(1, -1)}
                  </em>
                );
              }
              if (
                part.startsWith("`") &&
                part.endsWith("`") &&
                part.length > 2
              ) {
                return (
                  <code
                    key={partIdx}
                    className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700/80 font-mono text-[11px]"
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function AiChatMessages({
  messages,
  isLoading,
  onSelectSuggestion,
}: AiChatMessagesProps) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const suggestions = [
    t("aiChat.suggestion1", "¿Cómo registro un nuevo abonado y contrato?"),
    t("aiChat.suggestion2", "¿Cómo vinculo un nodo MikroTik y planes?"),
    t("aiChat.suggestion3", "¿Cómo funciona la facturación y corte por mora?"),
    t("aiChat.suggestion4", "¿Cómo configuro WhatsApp y el bot de soporte?"),
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center space-y-4">
          <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
              {t("aiChat.title", "Asistente IA")}
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">
              {t("aiChat.subtitle", "Soporte inteligente y ayuda del sistema")}
            </p>
          </div>

          <div className="w-full pt-4 text-left space-y-2">
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {t("aiChat.suggestionTitle", "Preguntas frecuentes:")}
            </p>
            {suggestions.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSuggestion(prompt)}
                className="w-full text-left p-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-emerald-500/10 hover:border-emerald-500/40 text-xs text-zinc-700 transition-all dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-emerald-500/10 dark:hover:border-emerald-500/40"
              >
                💡 {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => {
        const isUser = msg.role === "user";
        return (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${
              isUser ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isUser
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                  : "bg-emerald-600 text-white"
              }`}
            >
              {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>

            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                isUser
                  ? "bg-emerald-600 text-white font-medium shadow-sm"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60"
              }`}
            >
              {isUser ? msg.content : <FormattedMarkdownText text={msg.content} />}
            </div>
          </div>
        );
      })}

      {isLoading && (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div className="rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
            <span className="ml-1 text-xs">
              {t("aiChat.typing", "El asistente está pensando...")}
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
