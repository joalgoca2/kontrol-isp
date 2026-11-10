import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientPppSession } from "@/lib/mikrotik/node-manager";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey =
      request.headers.get("x-api-key") ||
      searchParams.get("api_key") ||
      "";

    // 1. Authenticate via Brand API Key or System Token
    let brandId: string | null = null;
    if (apiKey) {
      const brand = await prisma.brand.findUnique({
        where: { apiKey },
        select: { id: true },
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

    // 2. Extract Identifier - Strictly Contract Number
    const contrato = (
      searchParams.get("contrato") ||
      searchParams.get("numero_contrato") ||
      searchParams.get("contractNumber") ||
      ""
    ).trim();

    if (!contrato) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Parámetro requerido: 'contrato' (número de contrato registrado).",
        },
        { status: 400 }
      );
    }

    const debugMode =
      searchParams.get("debug") === "1" ||
      searchParams.get("debug") === "true";
    const diagLogs: string[] = [];

    const logDiag = (msg: string) => {
      diagLogs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    logDiag(`Iniciando diagnóstico para contrato '${contrato}'`);

    // 3. Find Contract strictly by contractNumber
    const contract = await prisma.contract.findFirst({
      where: {
        ...(brandId ? { brandId } : {}),
        contractNumber: contrato,
      },
      include: {
        client: true,
        node: true,
        equipment: true,
        plan: true,
      },
    });

    if (!contract) {
      logDiag("Contrato no encontrado.");
      return NextResponse.json(
        {
          ok: false,
          encontrado: false,
          mensaje: `No se encontró ningún contrato con el número '${contrato}'.`,
        },
        { status: 404 }
      );
    }

    const eq = contract.equipment;
    logDiag(
      `Abonado: '${contract.client.fullName}' | PPPoE: '${contract.pppoeUser}' | Nodo: '${contract.node.name}'`
    );

    let estadoEnlace = "OFFLINE";
    let mensaje = "";
    let detallesConexion: Record<string, unknown> = {};

    // 4. Check Billing State
    if (contract.billingStatus === "SUSPENDIDO_MORA") {
      estadoEnlace = "SUSPENDIDO_MORA";
      mensaje =
        "El servicio del cliente está suspendido en el sistema por cartera/facturación pendiente.";
      logDiag("Cliente suspendido por mora en base de datos.");
    } else {
      logDiag(`Consultando RouterOS en nodo '${contract.node.name}' (${contract.node.host})...`);
      const diagResult = await getClientPppSession(
        contract.node,
        contract.pppoeUser,
        contract.ipAddress
      );

      if (diagResult.connected) {
        if (diagResult.sessionFound && diagResult.session) {
          estadoEnlace = "ONLINE";
          mensaje = "Sesión PPPoE activa en MikroTik con tráfico normal.";
          detallesConexion = {
            uptime: diagResult.session.uptime,
            ip_activa: diagResult.session.address,
            caller_id_mac: diagResult.session.callerId,
            session_id: diagResult.session.id,
          };
          logDiag(`Sesión activa confirmada. IP: ${diagResult.session.address}, Uptime: ${diagResult.session.uptime}`);
        } else {
          estadoEnlace = "OFFLINE";
          mensaje =
            "No hay sesión activa en MikroTik. El router/ONU del cliente parece estar apagado o con el cable/fibra desconectado.";
          logDiag("Sin sesión PPPoE activa en router.");
        }
      } else {
        estadoEnlace = "ERROR_ROUTER";
        mensaje =
          "No fue posible comunicarse con el router MikroTik del nodo para consultar en tiempo real.";
        detallesConexion = {
          error: "ROUTER_UNREACHABLE",
          detalle: diagResult.error,
        };
        logDiag(`Error de conexión con RouterOS: ${diagResult.error}`);
      }
    }

    const response = {
      ok: true,
      cliente_id: contract.clientId,
      numero_contrato: contract.contractNumber,
      nombre_titular: contract.client.fullName,
      tecnologia: contract.technology,
      estado_enlace: estadoEnlace,
      usuario_pppoe: contract.pppoeUser,
      mensaje_diagnostico: mensaje,
      detalles_enlace: detallesConexion,
      equipos_instalados: {
        router: eq?.routerBrand || "Desconocido",
        router_modelo: eq?.routerModel || null,
        mac_router: eq?.routerMac || null,
        antena: eq?.antennaType || null,
        ip_antena: eq?.antennaIp || null,
        potencia_optica_rx: eq?.opticalPowerRx || null,
      },
      nodo_conectado: {
        id: contract.node.id,
        nombre: contract.node.name,
        ubicacion: contract.node.location,
        host: contract.node.host,
      },
      ...(debugMode ? { debug_logs: diagLogs } : {}),
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
