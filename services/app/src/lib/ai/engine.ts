import type { AiEngineResponse, AiChatMessage, AiProviderType } from "@/types";
import { buildSystemPrompt, type UserContextForAi } from "./knowledge";
import { processGuidedBotResponse } from "./guided-bot";

export async function processAiMessage(
  userMessage: string,
  userContext: UserContextForAi,
  history: AiChatMessage[] = []
): Promise<AiEngineResponse> {
  const apiKey =
    process.env.AI_API_KEY ||
    process.env.ISP_AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY;

  const rawProvider = (
    process.env.AI_PROVIDER ||
    process.env.ISP_AI_PROVIDER ||
    (apiKey ? "openai" : "guided")
  ).toLowerCase();

  const provider = (
    rawProvider === "guided" ? "guided" : rawProvider
  ) as AiProviderType;

  const systemPrompt = buildSystemPrompt(userContext);
  const isGenerativeAllowed = userContext.hasAiAgentAccess !== false;

  // Generative Provider 1: OpenAI
  if (isGenerativeAllowed && provider === "openai" && apiKey) {
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
          model: process.env.AI_MODEL || process.env.ISP_AI_MODEL || "gpt-4o-mini",
          messages,
          temperature: 0.5,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { total_tokens?: number };
        };
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return {
            message: content,
            provider: "openai",
            tokensUsed: data.usage?.total_tokens,
          };
        }
      }
    } catch (_err: unknown) {
      // Fall back gracefully to guided bot if API call fails
    }
  }

  // Generative Provider 2: Google Gemini
  if (isGenerativeAllowed && provider === "gemini" && apiKey) {
    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `gemini-1.5-flash:generateContent?key=${apiKey}`;

      const contents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        ...history.map((h) => ({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        })),
        { role: "user", parts: [{ text: userMessage }] },
      ];

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { message: text, provider: "gemini" };
        }
      }
    } catch (_err: unknown) {
      // Fall back gracefully to guided bot if API call fails
    }
  }

  // Deterministic Decision-Tree Guided Menu Bot (Default / Fallback)
  const guidedText = processGuidedBotResponse(userMessage, userContext);

  return {
    message: guidedText,
    provider: provider === "guided" ? "guided" : "mock",
  };
}
