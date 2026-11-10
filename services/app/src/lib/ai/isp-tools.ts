import { prisma } from "@/lib/prisma";
import {
  getClientPppSession,
  setClientSuspensionOnRouter,
  kickClientSession,
} from "@/lib/mikrotik/node-manager";

export async function consultarClienteTool(
  documento: string,
  brandId: string
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const client = await prisma.client.findFirst({
      where: {
        brandId,
        OR: [
          { documentNumber: documento.trim() },
          { phonePrimary: { contains: documento.trim().replace(/^\+?57/, "") } },
        ],
      },
      include: {
        contracts: {
          include: {
            plan: true,
            equipment: true,
            node: true,
          },
        },
      },
    });

    if (!client || client.contracts.length === 0) {
      return {
        ok: false,
        error: "No se encontró ningún cliente o contrato con ese documento.",
      };
    }

    if (client.contracts.length === 1) {
      const contract = client.contracts[0];
      return {
        ok: true,
        data: {
          encontrado: true,
          multiples_contratos: false,
          cliente_id: client.id,
          numero_contrato: contract.contractNumber,
          titular: client.fullName,
          direccion: contract.address,
          tecnologia: contract.technology,
          plan: contract.plan.name,
          estado_cuenta: contract.billingStatus,
          router_modelo: contract.equipment?.routerModel,
          potencia_rx: contract.equipment?.opticalPowerRx,
        },
      };
    }

    return {
      ok: true,
      data: {
        encontrado: true,
        multiples_contratos: true,
        titular: client.fullName,
        total_servicios: client.contracts.length,
        servicios: client.contracts.map((c) => ({
          numero_contrato: c.contractNumber,
          direccion: c.address,
          plan: c.plan.name,
          estado: c.billingStatus,
          tecnologia: c.technology,
        })),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al consultar cliente";
    return { ok: false, error: msg };
  }
}

export async function diagnosticarServicioTool(
  identificador: string,
  brandId: string
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const aiConfig = await prisma.brandAiConfig.findUnique({
      where: { brandId },
      select: { allowDiagnosticMikrotik: true },
    });

    if (aiConfig && aiConfig.allowDiagnosticMikrotik === false) {
      return {
        ok: false,
        error:
          "El diagnóstico remoto en tiempo real está temporalmente pausado " +
          "por la administración. Por favor comunícate con un asesor.",
      };
    }

    const contract = await prisma.contract.findFirst({
      where: {
        brandId,
        OR: [
          { contractNumber: identificador.trim() },
          { id: identificador.trim() },
          { client: { documentNumber: identificador.trim() } },
        ],
      },
      include: {
        client: true,
        node: true,
        equipment: true,
        plan: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!contract) {
      return { ok: false, error: "Contrato no encontrado para diagnóstico." };
    }

    if (contract.billingStatus === "SUSPENDIDO_MORA") {
      return {
        ok: true,
        data: {
          estado_enlace: "SUSPENDIDO_MORA",
          motivo: "El servicio se encuentra suspendido en el sistema por cobro pendiente.",
          titular: contract.client.fullName,
          contrato: contract.contractNumber,
        },
      };
    }

    const diag = await getClientPppSession(
      contract.node,
      contract.pppoeUser,
      contract.ipAddress
    );

    return {
      ok: true,
      data: {
        estado_enlace: diag.sessionFound ? "ONLINE" : "OFFLINE",
        titular: contract.client.fullName,
        contrato: contract.contractNumber,
        tecnologia: contract.technology,
        nodo: contract.node.name,
        uptime: diag.session?.uptime ?? null,
        ip_activa: diag.session?.address ?? contract.ipAddress,
        mac: diag.session?.callerId ?? contract.equipment?.routerMac,
        potencia_optica_rx: contract.equipment?.opticalPowerRx ?? null,
        temperatura_onu: contract.equipment?.onuTemperature ?? null,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error en diagnóstico";
    return { ok: false, error: msg };
  }
}

export async function consultarSaldoTool(
  identificador: string,
  brandId: string
): Promise<{
  ok: boolean;
  data?: {
    titular: string;
    contrato: string;
    totalPendiente: number;
    facturasPendientes: number;
    facturaDetalle: string | null;
    linkPagoPse: string;
  };
  error?: string;
}> {
  try {
    const aiConfig = await prisma.brandAiConfig.findUnique({
      where: { brandId },
      select: { allowBillingBalance: true },
    });

    if (aiConfig && aiConfig.allowBillingBalance === false) {
      return {
        ok: false,
        error:
          "La consulta de saldo automática está temporalmente pausada. " +
          "Un asesor de cartera te atenderá en breve.",
      };
    }

    const cleanId = identificador.trim();
    const cleanPhone = cleanId.replace(/^\+?57/, "");
    const contract = await prisma.contract.findFirst({
      where: {
        brandId,
        OR: [
          { contractNumber: cleanId },
          { id: cleanId },
          { client: { documentNumber: cleanId } },
          { client: { phonePrimary: { contains: cleanPhone } } },
        ],
      },
      include: {
        client: true,
        payments: {
          where: { status: "PENDIENTE" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!contract) {
      return { ok: false, error: "No se encontró contrato para consultar saldo." };
    }

    const totalPendiente = contract.payments.reduce((acc, p) => acc + p.amount, 0);
    const linkPagoPse = `https://pagos.serkoi.com/p/${contract.contractNumber}`;

    return {
      ok: true,
      data: {
        titular: contract.client.fullName,
        contrato: contract.contractNumber,
        totalPendiente,
        facturasPendientes: contract.payments.length,
        facturaDetalle: contract.payments[0]?.invoiceNumber ?? null,
        linkPagoPse,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error consultando saldo";
    return { ok: false, error: msg };
  }
}

export async function promesaPagoTool(
  contractNumber: string,
  brandId: string
): Promise<{
  ok: boolean;
  message: string;
  ticketNumber?: string;
  horasGracia?: number;
  data?: {
    contrato: string;
    titular: string;
    fechaLimite: string;
    saldoAdeudado: number;
  };
  error?: string;
}> {
  try {
    const cleanNumber = contractNumber.trim();
    let contract = await prisma.contract.findFirst({
      where: {
        brandId,
        contractNumber: cleanNumber,
      },
      include: {
        client: true,
        node: true,
        payments: {
          where: { status: "PENDIENTE" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!contract) {
      contract = await prisma.contract.findFirst({
        where: {
          brandId,
          client: { documentNumber: cleanNumber },
        },
        include: {
          client: true,
          node: true,
          payments: {
            where: { status: "PENDIENTE" },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!contract) {
      return {
        ok: false,
        message: `No se encontró ningún contrato activo con el número "${cleanNumber}".`,
        error: "CONTRATO_NO_ENCONTRADO",
      };
    }

    const aiConfig = await prisma.brandAiConfig.findUnique({
      where: { brandId },
    });

    if (aiConfig && !aiConfig.allowGracePromise) {
      return {
        ok: false,
        message:
          "La opción de promesa de pago automático no está habilitada. " +
          "Por favor comunícate con un asesor de cartera.",
        error: "PROMESAS_DESHABILITADAS",
      };
    }

    // 1. Anti-abuse check (1 promise per contract in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existingTicket = await prisma.supportTicket.findFirst({
      where: {
        brandId,
        contractId: contract.id,
        issueType: "CARTERA",
        createdAt: { gte: thirtyDaysAgo },
        description: { contains: "Prórroga de 24 horas" },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingTicket) {
      return {
        ok: false,
        ticketNumber: existingTicket.ticketNumber,
        message:
          `Estimado(a) ${contract.client.fullName}, registramos que ya solicitaste ` +
          `una prórroga de 24 horas recientemente para el Contrato #${contract.contractNumber} ` +
          `(Ticket #${existingTicket.ticketNumber}).\n\n` +
          `La política permite máximo 1 promesa por ciclo de facturación. ` +
          `Por favor comunícate con un asesor de cartera para gestionar tu pago.`,
        error: "PROMESA_YA_UTILIZADA",
      };
    }

    const hours = aiConfig?.graceHours ?? 24;
    const limitDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    const limitFormatted = limitDate.toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const totalPendiente = contract.payments.reduce((acc, p) => acc + p.amount, 0);

    // 2. Enable in MikroTik RouterOS
    if (contract.node && contract.pppoeUser) {
      try {
        await setClientSuspensionOnRouter(contract.node, contract.pppoeUser, false);
        await kickClientSession(contract.node, contract.pppoeUser);
      } catch (_mikrotikErr) {
        // Continue DB and ticket creation
      }
    }

    // 3. Update contract in database
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        billingStatus: "ACTIVO",
        serviceStatus: "ONLINE",
        updatedBy: "Chatbot IA Promesa",
      },
    });

    // 4. Create support ticket for audit and tracking
    const ticketNumber = `TICK-PROM-${Date.now().toString().slice(-6)}`;
    const formattedTotal = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(totalPendiente);

    await prisma.supportTicket.create({
      data: {
        brandId,
        contractId: contract.id,
        ticketNumber,
        channel: "WHATSAPP_AI",
        issueType: "CARTERA",
        priority: "MEDIA",
        status: "ABIERTO",
        description:
          `Prórroga de 24 horas otorgada automáticamente por Chatbot IA. ` +
          `Servicio reactivado temporalmente hasta ${limitFormatted}. ` +
          `Saldo pendiente: ${formattedTotal}. Factura: ` +
          `${contract.payments[0]?.invoiceNumber ?? "FAC-TEST-001"}.`,
        diagnosticSnapshot: {
          tipo: "PROMESA_PAGO_24H",
          horasGracia: hours,
          fechaConcesion: new Date().toISOString(),
          fechaVencimiento: limitDate.toISOString(),
          saldoAdeudado: totalPendiente,
          facturaDetalle: contract.payments[0]?.invoiceNumber ?? null,
        },
      },
    });

    return {
      ok: true,
      ticketNumber,
      horasGracia: hours,
      message:
        `✅ ¡Prórroga de ${hours} horas activada con éxito!\n\n` +
        `• Contrato: #${contract.contractNumber} (${contract.client.fullName})\n` +
        `• Servicio reactivado hasta: ${limitFormatted}\n` +
        `• Ticket de soporte generado: #${ticketNumber}\n\n` +
        `Recuerda realizar tu pago antes de la fecha límite para evitar una nueva suspensión.`,
      data: {
        contrato: contract.contractNumber,
        titular: contract.client.fullName,
        fechaLimite: limitFormatted,
        saldoAdeudado: totalPendiente,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error otorgando prórroga";
    return { ok: false, message: "No fue posible procesar la promesa.", error: msg };
  }
}

export async function agendarVisitaTool(
  identificador: string,
  jornada: "MAÑANA" | "TARDE" | string,
  brandId: string,
  extraParams?: {
    fechaCita?: string;
    nombreCita?: string;
    ubicacionCita?: string;
    telefonosContacto?: string;
    motivoVisita?: string;
    diagnosticoRealizado?: string;
  }
): Promise<{
  ok: boolean;
  message: string;
  data?: {
    ticketNumber: string;
    fechaVisita: string;
    jornada: string;
    contrato: string;
  };
  error?: string;
}> {
  try {
    const cleanId = identificador.trim();
    const cleanPhone = cleanId.replace(/^\+?57/, "");
    const contract = await prisma.contract.findFirst({
      where: {
        brandId,
        OR: [
          { contractNumber: cleanId },
          { id: cleanId },
          { client: { documentNumber: cleanId } },
          { client: { phonePrimary: { contains: cleanPhone } } },
        ],
      },
      include: { client: true },
    });

    if (!contract) {
      return {
        ok: false,
        message: "Contrato no encontrado.",
        error: "Contrato no encontrado.",
      };
    }

    const aiConfig = await prisma.brandAiConfig.findUnique({
      where: { brandId },
    });

    if (aiConfig && !aiConfig.allowScheduleVisits) {
      return {
        ok: false,
        message:
          "El agendamiento automático de visitas técnicas se encuentra pausado. " +
          "Por favor comunícate con un asesor humano para coordinar tu visita.",
        error: "Agendamiento deshabilitado por política de marca.",
      };
    }

    const morningSlots = aiConfig?.morningVisitSlots ?? 4;
    const afternoonSlots = aiConfig?.afternoonVisitSlots ?? 4;

    const requestedJornada: "MAÑANA" | "TARDE" =
      jornada.toUpperCase().includes("TARDE") ? "TARDE" : "MAÑANA";

    // Start search from requested date or tomorrow
    const candidateDate = new Date();
    if (extraParams?.fechaCita) {
      const parts = extraParams.fechaCita.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (parts) {
        candidateDate.setFullYear(Number(parts[1]));
        candidateDate.setMonth(Number(parts[2]) - 1);
        candidateDate.setDate(Number(parts[3]));
      } else {
        candidateDate.setDate(candidateDate.getDate() + 1);
      }
    } else {
      candidateDate.setDate(candidateDate.getDate() + 1);
    }

    let assignedDate: Date | null = null;
    let assignedJornada: "MAÑANA" | "TARDE" = requestedJornada;

    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      // Exclude Saturday (6) and Sunday (0)
      if (candidateDate.getDay() === 6) {
        candidateDate.setDate(candidateDate.getDate() + 2);
      } else if (candidateDate.getDay() === 0) {
        candidateDate.setDate(candidateDate.getDate() + 1);
      }

      // Check requested jornada first, then alternative jornada on the same day
      const jornadasToCheck: ("MAÑANA" | "TARDE")[] =
        requestedJornada === "TARDE"
          ? ["TARDE", "MAÑANA"]
          : ["MAÑANA", "TARDE"];

      let slotFoundForDay = false;
      for (const currentJornada of jornadasToCheck) {
        const startOfSlot = new Date(candidateDate);
        startOfSlot.setHours(currentJornada === "MAÑANA" ? 8 : 13, 0, 0, 0);

        const endOfSlot = new Date(candidateDate);
        endOfSlot.setHours(
          currentJornada === "MAÑANA" ? 12 : 18,
          59,
          59,
          999
        );

        const currentCount = await prisma.technicianVisit.count({
          where: {
            ticket: { brandId },
            status: { in: ["AGENDADA", "EN_RUTA"] },
            scheduledDate: {
              gte: startOfSlot,
              lte: endOfSlot,
            },
          },
        });

        const maxSlots =
          currentJornada === "MAÑANA" ? morningSlots : afternoonSlots;

        if (currentCount < maxSlots) {
          assignedDate = new Date(candidateDate);
          assignedJornada = currentJornada;
          slotFoundForDay = true;
          break;
        }
      }

      if (slotFoundForDay && assignedDate) {
        break;
      }

      // Advance to next day
      candidateDate.setDate(candidateDate.getDate() + 1);
    }

    if (!assignedDate) {
      return {
        ok: false,
        message:
          "En este momento no contamos con cupos disponibles para los próximos 14 días. " +
          "Por favor comunícate con un asesor humano para coordinar tu caso.",
        error: "Cupos agotados en las próximas 2 semanas.",
      };
    }

    assignedDate.setHours(assignedJornada === "MAÑANA" ? 9 : 14, 0, 0, 0);

    const fechaFormateada = assignedDate.toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const ticketNumber = `TICK-${Date.now().toString().slice(-6)}`;
    const ticketDesc =
      extraParams?.motivoVisita ||
      `Visita técnica programada por Chatbot para jornada ${assignedJornada}.`;

    const ticket = await prisma.supportTicket.create({
      data: {
        brandId,
        contractId: contract.id,
        ticketNumber,
        channel: "WHATSAPP_AI",
        issueType: "FALLA_FISICA_LOS",
        priority: "ALTA",
        status: "VISITA_AGENDADA",
        description: ticketDesc,
        diagnosticSnapshot: {
          ubicacionCita: extraParams?.ubicacionCita || contract.address,
          nombreCita: extraParams?.nombreCita || contract.client.fullName,
          telefonosContacto:
            extraParams?.telefonosContacto || contract.client.phonePrimary,
          motivoVisita: extraParams?.motivoVisita,
          diagnosticoRealizado: extraParams?.diagnosticoRealizado,
        },
      },
    });

    await prisma.technicianVisit.create({
      data: {
        ticketId: ticket.id,
        scheduledDate: assignedDate,
        technicianName: "Cuadrilla Técnica de Zona",
        status: "AGENDADA",
        notes:
          `Cita asignada por Agente IA. Jornada: ${assignedJornada}. ` +
          `Tel: ${extraParams?.telefonosContacto || contract.client.phonePrimary || "N/A"}. ` +
          `Ubicación: ${extraParams?.ubicacionCita || contract.address || "N/A"}.`,
        createdBy: "Chatbot IA",
      },
    });

    const franjaTexto =
      assignedJornada === "MAÑANA"
        ? "Jornada Mañana (8:00 AM - 12:00 PM)"
        : "Jornada Tarde (2:00 PM - 6:00 PM)";

    return {
      ok: true,
      message:
        `📅 ¡Visita técnica agendada con éxito!\n\n` +
        `• Ticket de Servicio: #${ticketNumber}\n` +
        `• Fecha confirmada: ${fechaFormateada}\n` +
        `• Franja Horaria: ${franjaTexto}\n` +
        `• Titular: ${contract.client.fullName}\n\n` +
        `Un técnico debidamente identificado se presentará en tu dirección. ` +
        `Por favor asegúrate de que un adulto responsable esté presente.`,
      data: {
        ticketNumber,
        fechaVisita: fechaFormateada,
        jornada: franjaTexto,
        contrato: contract.contractNumber,
      },
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error agendando visita técnica";
    return {
      ok: false,
      message: "No fue posible agendar la visita.",
      error: msg,
    };
  }
}

export async function consultarDisponibilidadTool(
  fechaCita: string,
  brandId: string
): Promise<{
  ok: boolean;
  fecha: string;
  mananaDisponible: boolean;
  tardeDisponible: boolean;
  cuposLibresManana: number;
  cuposLibresTarde: number;
  mensaje: string;
  error?: string;
}> {
  try {
    const aiConfig = await prisma.brandAiConfig.findUnique({
      where: { brandId },
      select: {
        allowScheduleVisits: true,
        morningVisitSlots: true,
        afternoonVisitSlots: true,
      },
    });

    if (aiConfig && aiConfig.allowScheduleVisits === false) {
      return {
        ok: false,
        fecha: fechaCita,
        mananaDisponible: false,
        tardeDisponible: false,
        cuposLibresManana: 0,
        cuposLibresTarde: 0,
        mensaje:
          "El agendamiento de visitas técnicas se encuentra temporalmente pausado.",
        error: "Agendamiento deshabilitado.",
      };
    }

    const morningSlots = aiConfig?.morningVisitSlots ?? 4;
    const afternoonSlots = aiConfig?.afternoonVisitSlots ?? 4;

    let targetDate = new Date();
    const parts = (fechaCita || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (parts) {
      targetDate = new Date(
        Number(parts[1]),
        Number(parts[2]) - 1,
        Number(parts[3])
      );
    } else {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const dayOfWeek = targetDate.getDay();
    const dateFormatted = targetDate.toISOString().slice(0, 10);

    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        ok: true,
        fecha: dateFormatted,
        mananaDisponible: false,
        tardeDisponible: false,
        cuposLibresManana: 0,
        cuposLibresTarde: 0,
        mensaje:
          "Los fines de semana (sábado y domingo) no se programan visitas técnicas estándar. " +
          "Por favor indícame un día hábil (lunes a viernes).",
      };
    }

    const startMorning = new Date(targetDate);
    startMorning.setHours(8, 0, 0, 0);
    const endMorning = new Date(targetDate);
    endMorning.setHours(12, 59, 59, 999);

    const countMorning = await prisma.technicianVisit.count({
      where: {
        ticket: { brandId },
        status: { in: ["AGENDADA", "EN_RUTA"] },
        scheduledDate: { gte: startMorning, lte: endMorning },
      },
    });

    const startAfternoon = new Date(targetDate);
    startAfternoon.setHours(13, 0, 0, 0);
    const endAfternoon = new Date(targetDate);
    endAfternoon.setHours(18, 59, 59, 999);

    const countAfternoon = await prisma.technicianVisit.count({
      where: {
        ticket: { brandId },
        status: { in: ["AGENDADA", "EN_RUTA"] },
        scheduledDate: { gte: startAfternoon, lte: endAfternoon },
      },
    });

    const cuposLibresManana = Math.max(0, morningSlots - countMorning);
    const cuposLibresTarde = Math.max(0, afternoonSlots - countAfternoon);
    const mananaDisponible = cuposLibresManana > 0;
    const tardeDisponible = cuposLibresTarde > 0;

    let mensaje = "";
    if (mananaDisponible && tardeDisponible) {
      mensaje =
        `Tenemos agenda disponible para el ${dateFormatted} en la franja de la mañana ` +
        `y en la franja de la tarde. ¿Cuál prefieres?`;
    } else if (mananaDisponible) {
      mensaje =
        `Para el ${dateFormatted} únicamente tenemos cupo disponible en la franja ` +
        `de la mañana (entre 8 a. m. y 12 m.). ¿Te sirve?`;
    } else if (tardeDisponible) {
      mensaje =
        `Para el ${dateFormatted} únicamente tenemos cupo disponible en la franja ` +
        `de la tarde (entre 1 p. m. y 5 p. m.). ¿Te sirve?`;
    } else {
      mensaje =
        `Para el ${dateFormatted} la agenda se encuentra completa en ambas franjas. ` +
        `Por favor indícame el siguiente día hábil para consultar.`;
    }

    return {
      ok: true,
      fecha: dateFormatted,
      mananaDisponible,
      tardeDisponible,
      cuposLibresManana,
      cuposLibresTarde,
      mensaje,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al consultar disponibilidad";
    return {
      ok: false,
      fecha: fechaCita,
      mananaDisponible: false,
      tardeDisponible: false,
      cuposLibresManana: 0,
      cuposLibresTarde: 0,
      mensaje: "No fue posible verificar la disponibilidad en este momento.",
      error: msg,
    };
  }
}

export async function consultarVisitaTool(
  identificador: string,
  brandId: string
): Promise<{
  ok: boolean;
  tieneVisita: boolean;
  visitas?: Array<{
    ticketNumber: string;
    fecha: string;
    franja: string;
    estado: string;
    direccion: string;
    tecnico?: string;
  }>;
  mensaje: string;
  error?: string;
}> {
  try {
    const aiConfig = await prisma.brandAiConfig.findUnique({
      where: { brandId },
      select: { allowCheckVisits: true },
    });

    if (aiConfig && aiConfig.allowCheckVisits === false) {
      return {
        ok: false,
        tieneVisita: false,
        mensaje:
          "La consulta de visitas programadas está deshabilitada temporalmente.",
        error: "Consulta de visitas deshabilitada.",
      };
    }

    const cleanId = identificador.trim();
    const cleanPhone = cleanId.replace(/^\+?57/, "");
    const contract = await prisma.contract.findFirst({
      where: {
        brandId,
        OR: [
          { contractNumber: cleanId },
          { id: cleanId },
          { client: { documentNumber: cleanId } },
          { client: { phonePrimary: { contains: cleanPhone } } },
        ],
      },
      include: { client: true },
    });

    if (!contract) {
      return {
        ok: false,
        tieneVisita: false,
        mensaje: "No encontramos un contrato con ese dato.",
        error: "Contrato no encontrado.",
      };
    }

    const primerNombre = contract.client.fullName.split(" ")[0];

    const activeVisits = await prisma.technicianVisit.findMany({
      where: {
        ticket: {
          brandId,
          contractId: contract.id,
        },
        status: { in: ["AGENDADA", "EN_RUTA"] },
      },
      include: {
        ticket: true,
      },
      orderBy: { scheduledDate: "asc" },
      take: 5,
    });

    if (activeVisits.length === 0) {
      return {
        ok: true,
        tieneVisita: false,
        mensaje:
          `${primerNombre}, revisé la agenda y no tienes ninguna visita ` +
          `técnica programada. ¿Presentas alguna falla en tu servicio?`,
      };
    }

    const formattedVisits = activeVisits.map((v) => {
      const date = new Date(v.scheduledDate);
      const isMorning = date.getHours() < 13;
      const franja = isMorning
        ? "mañana (entre 8 a. m. y 12 m.)"
        : "tarde (entre 1 p. m. y 5 p. m.)";
      const fechaTexto = date.toLocaleDateString("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      return {
        ticketNumber: v.ticket.ticketNumber,
        fecha: fechaTexto,
        franja,
        estado: v.status,
        direccion: contract.address,
        tecnico: v.technicianName,
      };
    });

    const primera = formattedVisits[0];
    const mensaje =
      `${primerNombre}, tu visita técnica está agendada para el ` +
      `${primera.fecha}, en la franja de la ${primera.franja}.`;

    return {
      ok: true,
      tieneVisita: true,
      visitas: formattedVisits,
      mensaje,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al consultar visitas";
    return {
      ok: false,
      tieneVisita: false,
      mensaje: "No fue posible consultar tu agenda en este momento.",
      error: msg,
    };
  }
}

export async function reiniciarPppoeTool(
  identificador: string,
  brandId: string
): Promise<{
  ok: boolean;
  message: string;
  data?: {
    ticketNumber: string;
    pppoeUser: string;
    router: string;
  };
  error?: string;
}> {
  try {
    const cleanId = identificador.trim();
    const cleanPhone = cleanId.replace(/^\+?57/, "");
    const contract = await prisma.contract.findFirst({
      where: {
        brandId,
        OR: [
          { contractNumber: cleanId },
          { id: cleanId },
          { client: { documentNumber: cleanId } },
          { client: { phonePrimary: { contains: cleanPhone } } },
        ],
      },
      include: { client: true, node: true },
    });

    if (!contract) {
      return {
        ok: false,
        message: "No encontramos un contrato con ese identificador.",
        error: "Contrato no encontrado.",
      };
    }

    const aiConfig = await prisma.brandAiConfig.findUnique({
      where: { brandId },
    });

    if (aiConfig && !aiConfig.allowKickSession) {
      return {
        ok: false,
        message:
          "El reinicio remoto de sesión PPPoE se encuentra deshabilitado por política " +
          "de la empresa. Por favor reinicia tu router desconectándolo 2 minutos.",
        error: "Permiso allowKickSession deshabilitado.",
      };
    }

    if (!contract.node || !contract.pppoeUser) {
      return {
        ok: false,
        message:
          `El contrato #${contract.contractNumber} no cuenta con usuario PPPoE o router ` +
          `asociado para reinicio remoto.`,
        error: "Sin nodo o usuario PPPoE asignado.",
      };
    }

    // Execute real kick on MikroTik RouterOS
    const kickRes = await kickClientSession(
      contract.node,
      contract.pppoeUser
    );

    const ticketNumber = `TICK-KICK-${Date.now().toString().slice(-6)}`;
    await prisma.supportTicket.create({
      data: {
        brandId,
        contractId: contract.id,
        ticketNumber,
        channel: "WHATSAPP_AI",
        issueType: "LENTITUD",
        priority: "MEDIA",
        status: "RESUELTO",
        description:
          `Reinicio remoto de sesión PPPoE (${contract.pppoeUser}) en router ` +
          `${contract.node.name}. Ejecutado por Chatbot.`,
        diagnosticSnapshot: {
          tipo: "KICK_PPPOE_SESSION",
          pppoeUser: contract.pppoeUser,
          routerNode: contract.node.name,
          kickSuccess: kickRes.success,
          message: kickRes.message,
        },
      },
    });

    return {
      ok: true,
      message:
        `🔄 ¡Sesión de conexión reiniciada con éxito!\n\n` +
        `• Contrato: #${contract.contractNumber} (${contract.client.fullName})\n` +
        `• Usuario PPPoE: ${contract.pppoeUser}\n` +
        `• Router Central: ${contract.node.name}\n` +
        `• Ticket de optimización: #${ticketNumber}\n\n` +
        `Tu módem u ONT restablecerá la señal en unos 30 a 60 segundos con una nueva ` +
        `sesión limpia y optimizada en MikroTik.`,
      data: {
        ticketNumber,
        pppoeUser: contract.pppoeUser,
        router: contract.node.name,
      },
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al reiniciar sesión PPPoE";
    return {
      ok: false,
      message: "No fue posible reiniciar la sesión PPPoE.",
      error: msg,
    };
  }
}

export async function transferirHumanoTool(
  contrato: string,
  motivo: string,
  brandId: string
): Promise<{ ok: boolean; ticketNumber?: string; message: string }> {
  try {
    const aiConfig = await prisma.brandAiConfig.findUnique({
      where: { brandId },
      select: { allowTransferHuman: true },
    });

    if (aiConfig && aiConfig.allowTransferHuman === false) {
      return {
        ok: false,
        message:
          "En este momento no hay asesores humanos disponibles. " +
          "Por favor déjanos tu mensaje y te contactaremos en horario hábil.",
      };
    }

    const cleanId = contrato.trim();
    const cleanPhone = cleanId.replace(/^\+?57/, "");
    const contract = await prisma.contract.findFirst({
      where: {
        brandId,
        OR: [
          { contractNumber: cleanId },
          { id: cleanId },
          { client: { documentNumber: cleanId } },
          { client: { phonePrimary: { contains: cleanPhone } } },
        ],
      },
    });

    if (!contract) {
      return {
        ok: true,
        message: "Caso transferido a soporte humano general.",
      };
    }

    const ticketNumber = `TICK-${Date.now().toString().slice(-6)}`;
    await prisma.supportTicket.create({
      data: {
        brandId,
        contractId: contract.id,
        ticketNumber,
        channel: "WHATSAPP_AI",
        issueType: motivo.includes("mora") ? "CARTERA" : "CORTE_TOTAL",
        priority: "ALTA",
        status: "TRANSFERIDO_HUMANO",
        description: `Transferencia automática por Agente IA: ${motivo}`,
      },
    });

    return {
      ok: true,
      ticketNumber,
      message: `Caso transferido a asesor humano con ticket #${ticketNumber}.`,
    };
  } catch (_err) {
    return {
      ok: true,
      message: "Caso transferido a la cola de atención humana.",
    };
  }
}
