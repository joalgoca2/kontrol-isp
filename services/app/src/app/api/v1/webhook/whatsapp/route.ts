import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processIspMessage } from "@/lib/ai/isp-engine";
import { sendWhatsappTextMessage } from "@/lib/evolution-api";
import type { AiChatMessage } from "@/types";

interface EvolutionWebhookPayload {
  event?: string;
  instance?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
      imageMessage?: {
        caption?: string;
      };
    };
    body?: string;
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Meta Cloud API Webhook Verification Handshake
  if (mode === "subscribe" && token && challenge) {
    const matchedConfig = await prisma.whatsappConfig.findFirst({
      where: { metaWebhookVerifyToken: token },
    });

    if (matchedConfig) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Forbidden: token no coincide", { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    service: "Kontrol-ISP WhatsApp Webhook",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as EvolutionWebhookPayload;

    // 1. Resolve Target Brand by Evolution instance name
    const rawInstance = (rawBody?.instance || "").trim();
    if (!rawInstance) {
      return NextResponse.json(
        {
          ok: false,
          error: "Petición rechazada: instancia ausente en payload.",
        },
        { status: 400 }
      );
    }

    const whatsappConfig = await prisma.whatsappConfig.findFirst({
      where: {
        instanceName: {
          equals: rawInstance,
          mode: "insensitive",
        },
      },
      include: { brand: true },
    });

    let brand =
      whatsappConfig?.brand && whatsappConfig.brand.isActive
        ? whatsappConfig.brand
        : null;

    if (!brand) {
      const slugCandidate = rawInstance.replace(/^isp_/i, "").toLowerCase();
      brand = await prisma.brand.findFirst({
        where: {
          slug: {
            equals: slugCandidate,
            mode: "insensitive",
          },
          isActive: true,
        },
      });
    }

    if (!brand) {
      return NextResponse.json(
        {
          ok: false,
          error: "Instancia no autorizada o no asociada a ninguna marca activa.",
        },
        { status: 401 }
      );
    }

    // 2. Bidirectional Security: Validate Container, Brand, or Evolution Token
    const masterKey = (process.env.EVOLUTION_API_KEY || "").trim();
    const brandKey = (brand.apiKey || "").trim();
    const evolutionToken = (whatsappConfig?.evolutionToken || "").trim();

    const headerKey = (
      request.headers.get("apikey") ||
      request.headers.get("x-api-key") ||
      request.headers.get("x-webhook-secret") ||
      request.headers.get("authorization")?.replace(/^bearer\s+/i, "") ||
      ""
    ).trim();

    const url = new URL(request.url);
    const queryKey = (
      url.searchParams.get("secret") ||
      url.searchParams.get("token") ||
      url.searchParams.get("apikey") ||
      ""
    ).trim();

    const incomingKey = headerKey || queryKey;
    const isAuthorized =
      (masterKey !== "" && incomingKey === masterKey) ||
      (brandKey !== "" && incomingKey === brandKey) ||
      (evolutionToken !== "" && incomingKey === evolutionToken);

    if (!isAuthorized) {
      return NextResponse.json(
        {
          ok: false,
          error: "Acceso no autorizado: clave de webhook no válida o ausente.",
        },
        { status: 401 }
      );
    }

    const effectiveInstanceName = whatsappConfig?.instanceName || rawInstance;

    // 3. Validate payload structure
    const data = rawBody?.data;
    const key = data?.key;
    const fromMe = Boolean(key?.fromMe);

    // Ignore outbound messages sent from the bot or human operator
    if (fromMe) {
      return NextResponse.json({ ok: true, ignored: "from_me" });
    }

    const remoteJid = key?.remoteJid || "";

    // Ignore group chats or broadcast statuses
    if (remoteJid.includes("@g.us") || remoteJid.includes("broadcast")) {
      return NextResponse.json({ ok: true, ignored: "group_or_broadcast" });
    }

    // Extract clean phone number
    const senderPhone = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
    if (!senderPhone || senderPhone.length < 8) {
      return NextResponse.json({ ok: true, ignored: "invalid_sender" });
    }

    // Extract incoming text
    const messageObj = data?.message;
    const userMessage = (
      messageObj?.conversation ||
      messageObj?.extendedTextMessage?.text ||
      messageObj?.imageMessage?.caption ||
      data?.body ||
      ""
    ).trim();

    if (!userMessage) {
      return NextResponse.json({ ok: true, ignored: "empty_text" });
    }

    // 4. Check if thread is already transferred to human operator
    const lastLog = await prisma.aiConversationLog.findFirst({
      where: {
        brandId: brand.id,
        senderIdentifier: senderPhone,
      },
      orderBy: { createdAt: "desc" },
    });

    if (lastLog?.transferredToHuman) {
      // Log client incoming message silently for the human agent inbox
      await prisma.aiConversationLog.create({
        data: {
          brandId: brand.id,
          senderIdentifier: senderPhone,
          userMessage,
          aiResponse: "",
          transferredToHuman: true,
          channel: "WHATSAPP",
        },
      });

      return NextResponse.json({
        ok: true,
        status: "transferred_to_human_silent",
      });
    }

    // 4. Retrieve recent thread history (last 10 turns)
    const recentLogs = await prisma.aiConversationLog.findMany({
      where: {
        brandId: brand.id,
        senderIdentifier: senderPhone,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    recentLogs.reverse();
    const history: AiChatMessage[] = [];
    for (let i = 0; i < recentLogs.length; i++) {
      const log = recentLogs[i];
      if (log.userMessage && log.userMessage.trim()) {
        history.push({
          id: `${log.id}-u`,
          role: "user",
          content: log.userMessage,
          createdAt: log.createdAt.toISOString(),
        });
      }
      if (log.aiResponse && log.aiResponse.trim()) {
        history.push({
          id: `${log.id}-b`,
          role: "assistant",
          content: log.aiResponse,
          createdAt: log.createdAt.toISOString(),
        });
      }
    }

    // 5. Process message through ISP AI Engine
    const aiResult = await processIspMessage({
      userMessage,
      brandId: brand.id,
      senderIdentifier: senderPhone,
      history,
    });

    const replyText = aiResult.message;

    // 6. Deliver outbound message back via Evolution API
    if (replyText && replyText.trim()) {
      await sendWhatsappTextMessage(
        senderPhone,
        replyText,
        effectiveInstanceName
      );
    }

    return NextResponse.json({
      ok: true,
      delivered: true,
      provider: aiResult.provider,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Error interno en webhook WhatsApp";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}

