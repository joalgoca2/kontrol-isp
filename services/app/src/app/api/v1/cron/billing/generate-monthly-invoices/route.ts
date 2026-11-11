import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateMonthlyInvoices,
  type MonthlyBillingResult,
} from "@/lib/payments/billing-cycle";

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
    let year: number = new Date().getFullYear();
    let month: number = new Date().getMonth() + 1;

    try {
      const body = await request.json();
      if (body.brandId) brandId = body.brandId;
      if (body.year) year = Number(body.year);
      if (body.month) month = Number(body.month);
    } catch {
      // If no JSON body, read URL search params
      const { searchParams } = new URL(request.url);
      if (searchParams.get("brandId")) {
        brandId = searchParams.get("brandId") ?? undefined;
      }
      if (searchParams.get("year")) {
        year = Number(searchParams.get("year"));
      }
      if (searchParams.get("month")) {
        month = Number(searchParams.get("month"));
      }
    }

    const brandsToProcess = await prisma.brand.findMany({
      where: brandId && brandId !== "ALL" ? { id: brandId } : { isActive: true },
      select: { id: true, name: true },
    });

    const results: MonthlyBillingResult[] = [];

    for (const b of brandsToProcess) {
      const res = await generateMonthlyInvoices({
        brandId: b.id,
        year,
        month,
        actor: "CRON_ORQUESTADOR_MENSUAL",
      });
      results.push(res);
    }

    const durationMs = Date.now() - startTime;
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      durationMs,
      processedBrands: results.length,
      results,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Error interno en generación.";
    return NextResponse.json(
      { ok: false, error: errorMsg, durationMs: Date.now() - startTime },
      { status: 500 }
    );
  }
}

