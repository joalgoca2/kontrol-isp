import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey =
      request.headers.get("x-api-key") ||
      searchParams.get("api_key") ||
      "";

    // 1. Authenticate via Brand API Key or System Default
    let brandId: string | null = null;
    if (apiKey) {
      const brand = await prisma.brand.findUnique({
        where: { apiKey },
        select: { id: true, name: true },
      });
      if (brand) {
        brandId = brand.id;
      }
    }

    const systemToken = (process.env.N8N_API_KEY || "").trim();
    const isAuthorized = Boolean(
      brandId || (systemToken !== "" && apiKey === systemToken)
    );

    if (!isAuthorized) {
      return NextResponse.json(
        { ok: false, error: "No autorizado: Se requiere cabecera X-API-KEY válida." },
        { status: 401 }
      );
    }

    // 2. Extract strictly Document (cédula o NIT)
    const documento = (
      searchParams.get("documento") ||
      searchParams.get("numero_documento") ||
      searchParams.get("cedula") ||
      ""
    ).trim();

    if (!documento) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Parámetro requerido: 'documento' (cédula o NIT del titular).",
        },
        { status: 400 }
      );
    }

    // 3. Find Client strictly by documentNumber
    const client = await prisma.client.findFirst({
      where: {
        ...(brandId ? { brandId } : {}),
        documentNumber: documento,
      },
      include: {
        contracts: {
          include: {
            plan: true,
            equipment: true,
            node: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!client || client.contracts.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          encontrado: false,
          mensaje: "No se encontró ningún cliente o servicio con los datos suministrados.",
        },
        { status: 404 }
      );
    }

    // Select primary contract
    const targetContract = client.contracts[0];

    const eq = targetContract.equipment;
    const plan = targetContract.plan;

    const response = {
      ok: true,
      encontrado: true,
      cliente_id:
        client.clientCode || client.id.replace("serkoi-client-", ""),
      cliente_uid: client.id,
      numero_contrato: targetContract.contractNumber,
      nombre_titular: client.fullName,
      identificacion: client.documentNumber,
      telefono: client.phonePrimary || client.phoneSecondary || "",
      correo: client.email || "",
      direccion: targetContract.address || client.address || "",
      ciudad: targetContract.city,
      departamento: targetContract.department,
      estado_cuenta: targetContract.billingStatus,
      tecnologia: targetContract.technology,
      plan_contratado_mbps: plan.downloadSpeedMbps,
      plan_nombre: plan.name,
      usuario_pppoe: targetContract.pppoeUser,
      ip_asignada: targetContract.ipAddress || "",
      equipos: {
        tipo_instalacion:
          targetContract.technology === "MICROONDAS" ? "Antena" : "Fibra",
        marca_router: eq?.routerBrand || null,
        router_mac: eq?.routerMac || null,
        tipo_antena: eq?.antennaType || null,
        mac_antena: eq?.antennaMac || null,
        ip_antena: eq?.antennaIp || null,
        potencia_optica_rx: eq?.opticalPowerRx || null,
      },
      total_contratos: client.contracts.length,
      contratos_disponibles:
        client.contracts.length > 1
          ? client.contracts.map((c) => ({
              numero_contrato: c.contractNumber,
              direccion: c.address,
              plan: c.plan.name,
              estado: c.billingStatus,
              tecnologia: c.technology,
            }))
          : undefined,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
