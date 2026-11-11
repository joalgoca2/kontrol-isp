import { prisma } from "@/lib/prisma";
import {
  setClientSuspensionOnRouter,
  kickClientSession,
} from "@/lib/mikrotik/node-manager";
import { triggerOutboundWebhook } from "@/lib/webhook";
import type { Prisma } from "@prisma/client";

export interface MonthlyBillingResult {
  brandId: string;
  brandName: string;
  period: string;
  generatedCount: number;
  skippedCount: number;
  totalAmountCop: number;
}

export interface PaymentPromiseResult {
  contractId: string;
  contractNumber: string;
  clientName: string;
  hours: number;
  limitDate: Date;
  ticketNumber: string;
}

export interface ExpiredPromisesResult {
  evaluatedCount: number;
  suspendedCount: number;
  resolvedCount: number;
}

const MONTH_NAMES_ES: readonly string[] = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export async function generateMonthlyInvoices(params: {
  brandId: string;
  year: number;
  month: number;
  actor?: string | null;
}): Promise<MonthlyBillingResult> {
  const { brandId, year, month, actor } = params;

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, name: true },
  });

  if (!brand) {
    throw new Error(`Marca no encontrada con ID: ${brandId}`);
  }

  const monthPadded = String(month).padStart(2, "0");
  const period = `${year}-${monthPadded}`;
  const monthName = MONTH_NAMES_ES[month - 1] ?? `Mes ${month}`;

  // 1. Query all active or billable contracts for this brand
  const contracts = await prisma.contract.findMany({
    where: {
      brandId,
      billingStatus: { not: "RETIRADO" },
    },
    include: {
      plan: true,
      client: true,
    },
  });

  // 2. Query already generated payments for this period to ensure idempotency
  const existingPayments = await prisma.payment.findMany({
    where: {
      brandId,
      periodBilled: period,
    },
    select: {
      contractId: true,
    },
  });

  const billedContractIds = new Set(
    existingPayments.map((p) => p.contractId)
  );

  let generatedCount = 0;
  let skippedCount = 0;
  let totalAmountCop = 0;

  const systemActor = actor ?? "SISTEMA_CICLO_MENSUAL";
  const systemUserId = "SYSTEM_BILLING_CYCLE";

  for (const contract of contracts) {
    if (billedContractIds.has(contract.id)) {
      skippedCount++;
      continue;
    }

    const price = contract.plan?.priceCop ?? 0;
    const invSuffix = contract.contractNumber.replace(/[^a-zA-Z0-9]/g, "");
    const invoiceNumber = `FAC-${year}${monthPadded}-${invSuffix}`;

    await prisma.payment.create({
      data: {
        brandId,
        contractId: contract.id,
        invoiceNumber,
        periodBilled: period,
        amount: price,
        paymentMethod: "EFECTIVO",
        status: "PENDIENTE",
        recordedByUserId: systemUserId,
        notes: `Facturación mensual ${monthName} ${year} - Plan: ${contract.plan?.name ?? "N/A"}`,
        createdBy: systemActor,
        updatedBy: systemActor,
      },
    });

    generatedCount++;
    totalAmountCop += price;
  }

  // 3. Dispatch outbound webhook asynchronously
  triggerOutboundWebhook("billing", {
    event: "billing.cycle_generated",
    brandId,
    data: {
      brandName: brand.name,
      period,
      generatedCount,
      skippedCount,
      totalAmountCop,
    },
  });

  return {
    brandId,
    brandName: brand.name,
    period,
    generatedCount,
    skippedCount,
    totalAmountCop,
  };
}

export async function grantPaymentPromise(params: {
  contractId: string;
  hours: number;
  notes?: string | null;
  actor?: string | null;
}): Promise<PaymentPromiseResult> {
  const { contractId, hours, notes, actor } = params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
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
    throw new Error("Contrato no encontrado.");
  }

  const safeHours = Math.max(1, Math.min(168, hours));
  const limitDate = new Date(Date.now() + safeHours * 60 * 60 * 1000);
  const operatorName = actor ?? "Operador Web";

  // 1. Unblock in MikroTik RouterOS if node and PPPoE user exist
  if (contract.node && contract.pppoeUser) {
    try {
      await setClientSuspensionOnRouter(
        contract.node,
        contract.pppoeUser,
        false
      );
      await kickClientSession(contract.node, contract.pppoeUser);
    } catch (_mikrotikErr) {
      // Continue DB updates even if router is unreachable
    }
  }

  // 2. Reactivate contract in database
  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      billingStatus: "ACTIVO",
      serviceStatus: "ONLINE",
      updatedBy: operatorName,
    },
  });

  // 3. Create audit Support Ticket
  const totalDebt = contract.payments.reduce((acc, p) => acc + p.amount, 0);
  const ticketNumber = `TICK-PROM-${Date.now().toString().slice(-6)}`;
  const limitFormatted = limitDate.toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const desc = notes
    ? `Prórroga de ${safeHours}h concedida por ${operatorName} ` +
      `hasta ${limitFormatted}. Nota: ${notes}`
    : `Prórroga de ${safeHours}h concedida por ${operatorName} hasta ${limitFormatted}.`;

  const snapshot: Prisma.JsonObject = {
    tipo: "PROMESA_PAGO_24H",
    horasGracia: safeHours,
    fechaConcesion: new Date().toISOString(),
    fechaVencimiento: limitDate.toISOString(),
    saldoAdeudado: totalDebt,
    operador: operatorName,
    notas: notes ?? null,
  };

  await prisma.supportTicket.create({
    data: {
      brandId: contract.brandId,
      contractId: contract.id,
      ticketNumber,
      channel: "PORTAL",
      issueType: "CARTERA",
      priority: "MEDIA",
      status: "ABIERTO",
      description: desc,
      diagnosticSnapshot: snapshot,
      createdBy: operatorName,
      updatedBy: operatorName,
    },
  });

  // 4. Trigger Outbound Webhook
  triggerOutboundWebhook("billing", {
    event: "billing.promise_granted",
    brandId: contract.brandId,
    data: {
      contractNumber: contract.contractNumber,
      clientName: contract.client.fullName,
      hours: safeHours,
      limitDate: limitDate.toISOString(),
      ticketNumber,
    },
  });

  return {
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    clientName: contract.client.fullName,
    hours: safeHours,
    limitDate,
    ticketNumber,
  };
}

export async function checkAndCutExpiredPromises(params?: {
  brandId?: string;
  actor?: string | null;
}): Promise<ExpiredPromisesResult> {
  const brandId = params?.brandId;
  const actor = params?.actor ?? "SISTEMA_CRON_RECORTE";

  const openTickets = await prisma.supportTicket.findMany({
    where: {
      issueType: "CARTERA",
      status: "ABIERTO",
      ...(brandId && brandId !== "ALL" ? { brandId } : {}),
    },
    include: {
      contract: {
        include: {
          node: true,
          payments: {
            where: { status: "PENDIENTE" },
          },
        },
      },
    },
  });

  let evaluatedCount = 0;
  let suspendedCount = 0;
  let resolvedCount = 0;
  const now = new Date();

  for (const ticket of openTickets) {
    const snapshot = ticket.diagnosticSnapshot as Record<string, unknown> | null;
    if (snapshot?.tipo !== "PROMESA_PAGO_24H" || !snapshot?.fechaVencimiento) {
      continue;
    }

    const vencimiento = new Date(String(snapshot.fechaVencimiento));
    if (vencimiento > now) {
      continue;
    }

    evaluatedCount++;
    const hasPendingPayments = ticket.contract.payments.length > 0;

    if (hasPendingPayments) {
      // Re-suspend in MikroTik
      if (ticket.contract.node && ticket.contract.pppoeUser) {
        try {
          await setClientSuspensionOnRouter(
            ticket.contract.node,
            ticket.contract.pppoeUser,
            true
          );
          await kickClientSession(
            ticket.contract.node,
            ticket.contract.pppoeUser
          );
        } catch (_err) {
          // Continue updating DB status
        }
      }

      await prisma.contract.update({
        where: { id: ticket.contract.id },
        data: {
          billingStatus: "SUSPENDIDO_MORA",
          serviceStatus: "OFFLINE",
          updatedBy: actor,
        },
      });

      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: "CERRADO",
          description:
            `${ticket.description}\n[${now.toISOString()}] ` +
            "Plazo de prórroga expiró sin pago registrado. " +
            "Servicio suspendido en MikroTik.",
          updatedBy: actor,
        },
      });

      suspendedCount++;
    } else {
      // Contract paid within promise window! Resolve ticket.
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: "RESUELTO",
          description:
            `${ticket.description}\n[${now.toISOString()}] ` +
            "Pago confirmado dentro del plazo. Prórroga finalizada con éxito.",
          updatedBy: actor,
        },
      });

      resolvedCount++;
    }
  }

  return {
    evaluatedCount,
    suspendedCount,
    resolvedCount,
  };
}
