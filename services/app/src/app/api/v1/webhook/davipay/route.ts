import { NextResponse } from "next/server";
import { processDaviPayWebhook } from "@/lib/payments/davipay";
import type { DaviPayWebhookPayload } from "@/types";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Kontrol-ISP DaviPay/ePayco Webhook",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    let payload: DaviPayWebhookPayload = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = (await request.json()) as DaviPayWebhookPayload;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const entries: Record<string, string> = {};
      formData.forEach((value, key) => {
        entries[key] = String(value);
      });
      payload = entries as unknown as DaviPayWebhookPayload;
    } else {
      // Fallback try json
      try {
        payload = (await request.json()) as DaviPayWebhookPayload;
      } catch {
        payload = {};
      }
    }

    const result = await processDaviPayWebhook(payload);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      paymentId: result.paymentId,
      status: result.status,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error procesando webhook de DaviPay";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

