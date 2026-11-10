import { NextResponse } from "next/server";
import { queryEfectyDebt } from "@/lib/payments/efecty";
import type { EfectyQueryRequest } from "@/types";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Kontrol-ISP Efecty WS Consulta Deuda",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    let body: EfectyQueryRequest = { convenio: "", referencia: "" };
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = (await request.json()) as EfectyQueryRequest;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      body = {
        convenio: String(formData.get("convenio") || ""),
        referencia: String(formData.get("referencia") || ""),
        token: formData.get("token") ? String(formData.get("token")) : undefined,
      };
    } else {
      try {
        body = (await request.json()) as EfectyQueryRequest;
      } catch {
        // empty body fallback
      }
    }

    if (!body.convenio || !body.referencia) {
      return NextResponse.json(
        {
          estado: "ERROR",
          codigo: "001",
          mensaje: "Parámetros 'convenio' y 'referencia' son requeridos.",
        },
        { status: 400 }
      );
    }

    const response = await queryEfectyDebt(body);
    const status = response.estado === "EXITO" ? 200 : 404;

    return NextResponse.json(response, { status });
  } catch (err) {
    const mensaje =
      err instanceof Error ? err.message : "Error interno en consulta Efecty.";
    return NextResponse.json(
      { estado: "ERROR", codigo: "999", mensaje },
      { status: 500 }
    );
  }
}

