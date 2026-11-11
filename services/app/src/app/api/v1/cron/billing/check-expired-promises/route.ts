import { NextResponse } from "next/server";
import { checkAndCutExpiredPromises } from "@/lib/payments/billing-cycle";

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization") || "";
  const apiKey = request.headers.get("x-api-key") || "";

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : apiKey.trim();

  if (!token) return false;

  const validSecrets = [
    process.env.CRON_SECRET,
    process.env.N8N_API_KEY,
    process.env.AUTH_SECRET,
  ]
    .filter(Boolean)
    .map((s) => s?.trim());

  return validSecrets.includes(token);
}

export async function POST(request: Request) {
  const startTime = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "No autorizado: Token de cron o API inválido." },
      { status: 401 }
    );
  }

  try {
    let brandId: string | undefined;

    try {
      const body = await request.json();
      if (body.brandId) brandId = body.brandId;
    } catch {
      const { searchParams } = new URL(request.url);
      if (searchParams.get("brandId")) {
        brandId = searchParams.get("brandId") ?? undefined;
      }
    }

    const result = await checkAndCutExpiredPromises({
      brandId,
      actor: "CRON_RECORTE_AUTOMATICO",
    });

    const durationMs = Date.now() - startTime;
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      durationMs,
      ...result,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Error interno en re-corte de promesas.";
    return NextResponse.json(
      { ok: false, error: errorMsg, durationMs: Date.now() - startTime },
      { status: 500 }
    );
  }
}

