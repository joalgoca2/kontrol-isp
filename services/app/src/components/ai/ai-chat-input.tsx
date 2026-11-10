"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";

interface AiChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export function AiChatInput({ onSendMessage, isLoading }: AiChatInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    onSendMessage(text.trim());
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-center border-t border-zinc-200 p-3 dark:border-zinc-800"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("aiChat.placeholder", "Escribe una pregunta sobre la app...")}
        rows={1}
        disabled={isLoading}
        className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-amber-500 dark:focus:bg-zinc-950"
      />
      <button
        type="submit"
        disabled={!text.trim() || isLoading}
        className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-40"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
        ) : (
          <Send className="h-4 w-4 text-zinc-950" />
        )}
      </button>
    </form>
  );
}
