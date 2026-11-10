import { NextResponse } from "next/server";
import { processEfectyPayment } from "@/lib/payments/efecty";
import type { EfectyPaymentRequest } from "@/types";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Kontrol-ISP Efecty WS Notificación de Pagos",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    let body: EfectyPaymentRequest = {
      convenio: "",
      referencia: "",
      valor: 0,
      transaccionId: "",
    };
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = (await request.json()) as EfectyPaymentRequest;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      body = {
        convenio: String(formData.get("convenio") || ""),
        referencia: String(formData.get("referencia") || ""),
        valor: Number(formData.get("valor") || 0),
        transaccionId: String(formData.get("transaccionId") || ""),
        fecha: formData.get("fecha") ? String(formData.get("fecha")) : undefined,
        token: formData.get("token") ? String(formData.get("token")) : undefined,
      };
    } else {
      try {
        body = (await request.json()) as EfectyPaymentRequest;
      } catch {
        // empty body fallback
      }
    }

    if (!body.convenio || !body.referencia || !body.transaccionId) {
      return NextResponse.json(
        {
          estado: "ERROR",
          codigo: "001",
          mensaje: "Convenio, referencia y transaccionId son obligatorios.",
        },
        { status: 400 }
      );
    }

    const response = await processEfectyPayment(body);
    const status = response.estado === "EXITO" ? 200 : 400;

    return NextResponse.json(response, { status });
  } catch (err) {
    const mensaje =
      err instanceof Error ? err.message : "Error procesando pago de Efecty.";
    return NextResponse.json(
      { estado: "ERROR", codigo: "999", mensaje },
      { status: 500 }
    );
  }
}

