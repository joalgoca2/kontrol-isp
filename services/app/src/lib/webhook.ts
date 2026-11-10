import { prisma } from "@/lib/prisma";

export interface OutboundWebhookPayload {
  event: string;
  brandId: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

export function triggerOutboundWebhook(
  type: "billing" | "general",
  payload: OutboundWebhookPayload
): void {
  // Execute asynchronously without blocking the calling Server Action
  (async () => {
    try {
      const brand = await prisma.brand.findUnique({
        where: { id: payload.brandId },
        select: { billingWebhookUrl: true, generalWebhookUrl: true },
      });

      const targetUrl =
        type === "billing"
          ? brand?.billingWebhookUrl || process.env.N8N_URL
          : brand?.generalWebhookUrl || process.env.N8N_URL;

      if (!targetUrl) return;

      const body = JSON.stringify({
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      });

      await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Kontrol-ISP-Webhook/1.0",
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
    } catch (_err) {
      // Ignored for non-blocking outbound webhook delivery
    }
  })();
}
