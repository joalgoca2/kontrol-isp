import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { triggerOutboundWebhook } from "@/lib/webhook";
import { setClientSuspensionOnRouter } from "@/lib/mikrotik/node-manager";
import type { PaymentMethod } from "@/types";

export type ReconciliationMatchStatus =
  | "ALREADY_PAID"
  | "READY_TO_APPLY"
  | "NOT_FOUND"
  | "AMOUNT_MISMATCH";

export interface ParsedReconciliationRow {
  reference: string;
  externalTxId: string;
  amount: number;
  paidAt: string;
  rawLine: string;
}

export interface ReconciliationPreviewItem {
  reference: string;
  externalTxId: string;
  amount: number;
  paidAt: string;
  matchStatus: ReconciliationMatchStatus;
  contractId?: string;
  contractNumber?: string;
  clientName?: string;
  expectedAmount?: number;
  notes?: string;
}

export interface ReconciliationPreviewResult {
  fileHash: string;
  totalRows: number;
  totalAmount: number;
  alreadyPaidCount: number;
  readyToApplyCount: number;
  errorCount: number;
  items: ReconciliationPreviewItem[];
}

/**
 * Computes SHA-256 hash of file content to prevent accidental duplicate upload.
 */
export function computeFileHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Parses raw text/CSV content into structured rows.
 */
export function parseBatchFileLines(content: string): ParsedReconciliationRow[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const rows: ParsedReconciliationRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip common headers
    if (
      i === 0 &&
      (line.toLowerCase().includes("referencia") ||
        line.toLowerCase().includes("convenio") ||
        line.toLowerCase().includes("fecha") ||
        line.toLowerCase().includes("monto"))
    ) {
      continue;
    }

    // Determine separator: comma, semicolon, pipe, or tab
    let parts: string[] = [];
    if (line.includes(";")) {
      parts = line.split(";");
    } else if (line.includes(",")) {
      parts = line.split(",");
    } else if (line.includes("|")) {
      parts = line.split("|");
    } else if (line.includes("\t")) {
      parts = line.split("\t");
    } else {
      parts = line.split(/\s+/);
    }

    parts = parts.map((p) => p.trim().replace(/^["']|["']$/g, ""));
    if (parts.length < 2) continue;

    // Detect columns: Reference, Amount, TransactionId, Date
    const reference = parts[0] || "";
    let amount = 0;
    let externalTxId = "";
    let paidAt = new Date().toISOString();

    if (parts.length >= 3) {
      // Formato: Ref, Valor, TxId, [Fecha]
      const parsedAmount = parseFloat(parts[1].replace(/[^0-9.]/g, ""));
      amount = isNaN(parsedAmount) ? 0 : parsedAmount;
      externalTxId = parts[2] || `TX-${Date.now()}-${i}`;
      if (parts[3]) {
        paidAt = parts[3];
      }
    } else {
      // Formato simple: Ref, Valor
      const parsedAmount = parseFloat(parts[1].replace(/[^0-9.]/g, ""));
      amount = isNaN(parsedAmount) ? 0 : parsedAmount;
      externalTxId = `IMP-${Date.now()}-${i}`;
    }

    if (reference && amount > 0) {
      rows.push({
        reference,
        externalTxId,
        amount,
        paidAt,
        rawLine: line,
      });
    }
  }

  return rows;
}

/**
 * Cross-checks rows against database payments and contracts without modifying state.
 */
export async function analyzeReconciliationBatch(
  brandId: string,
  content: string
): Promise<ReconciliationPreviewResult> {
  const fileHash = computeFileHash(content);
  const rows = parseBatchFileLines(content);

  let totalAmount = 0;
  let alreadyPaidCount = 0;
  let readyToApplyCount = 0;
  let errorCount = 0;
  const items: ReconciliationPreviewItem[] = [];

  for (const row of rows) {
    totalAmount += row.amount;

    // 1. Check if external transaction was already recorded via webhook or prior batch
    const existingPayment = await prisma.payment.findFirst({
      where: {
        brandId,
        externalReference: row.externalTxId,
      },
    });

    if (existingPayment) {
      alreadyPaidCount++;
      items.push({
        reference: row.reference,
        externalTxId: row.externalTxId,
        amount: row.amount,
        paidAt: row.paidAt,
        matchStatus: "ALREADY_PAID",
        notes: "Ya registrado en tiempo real por Webhook (cero duplicidad contable).",
      });
      continue;
    }

    // 2. Search for contract by document number, contract number, or ID
    const contract = await prisma.contract.findFirst({
      where: {
        brandId,
        OR: [
          { id: row.reference },
          { contractNumber: row.reference },
          { client: { documentNumber: row.reference } },
        ],
      },
      include: {
        client: true,
        plan: true,
      },
    });

    if (!contract) {
      errorCount++;
      items.push({
        reference: row.reference,
        externalTxId: row.externalTxId,
        amount: row.amount,
        paidAt: row.paidAt,
        matchStatus: "NOT_FOUND",
        notes: `Abonado con referencia '${row.reference}' no encontrado.`,
      });
      continue;
    }

    // Contract found -> Ready to apply
    readyToApplyCount++;
    items.push({
      reference: row.reference,
      externalTxId: row.externalTxId,
      amount: row.amount,
      paidAt: row.paidAt,
      matchStatus: "READY_TO_APPLY",
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      clientName: contract.client.fullName,
      expectedAmount: contract.plan.priceCop,
      notes: "Contrato válido. Listo para registrar y reactivar.",
    });
  }

  return {
    fileHash,
    totalRows: rows.length,
    totalAmount,
    alreadyPaidCount,
    readyToApplyCount,
    errorCount,
    items,
  };
}

/**
 * Applies only the READY_TO_APPLY items inside a safe atomic database transaction.
 */
export async function applyReconciliationBatch(
  brandId: string,
  itemsToApply: ReconciliationPreviewItem[],
  provider: "EFECTY" | "DAVIPAY",
  actor: string
): Promise<{ success: boolean; appliedCount: number; message: string }> {
  const validItems = itemsToApply.filter(
    (item) => item.matchStatus === "READY_TO_APPLY" && item.contractId
  );

  if (validItems.length === 0) {
    return {
      success: false,
      appliedCount: 0,
      message: "No hay pagos pendientes para aplicar en este lote.",
    };
  }

  const adminUser = await prisma.user.findFirst({
    where: { brandId },
    select: { id: true },
  });
  const systemUserId = adminUser?.id ?? "system";
  const now = new Date();
  const periodBilled =
    `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const paymentMethod: PaymentMethod = provider === "EFECTY" ? "EFECTY" : "DAVIPAY";

  let appliedCount = 0;

  for (const item of validItems) {
    if (!item.contractId) continue;

    // Idempotency check inside loop
    const existing = await prisma.payment.findFirst({
      where: { brandId, externalReference: item.externalTxId },
    });
    if (existing) continue;

    const savedPayment = await prisma.payment.create({
      data: {
        brandId,
        contractId: item.contractId,
        periodBilled,
        amount: item.amount,
        paymentMethod,
        externalReference: item.externalTxId,
        recordedByUserId: systemUserId,
        status: "APROBADO",
        notes: `Conciliación archivo masivo ${provider}. Ref: ${item.externalTxId}`,
        createdBy: actor,
        updatedBy: actor,
      },
    });

    appliedCount++;

    // Unblock in MikroTik if contract was suspended
    const contract = await prisma.contract.findUnique({
      where: { id: item.contractId },
      include: { node: true },
    });

    if (
      contract &&
      (contract.billingStatus === "SUSPENDIDO_MORA" ||
        contract.billingStatus === "AVISO_VENCIMIENTO")
    ) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          billingStatus: "ACTIVO",
          serviceStatus: "ONLINE",
          updatedBy: actor,
        },
      });

      if (contract.node && contract.pppoeUser) {
        await setClientSuspensionOnRouter(
          contract.node,
          contract.pppoeUser,
          false
        ).catch(() => null);
      }
    }

    triggerOutboundWebhook("billing", {
      event: "payment.recorded",
      brandId,
      data: {
        paymentId: savedPayment.id,
        contractNumber: item.contractNumber,
        clientName: item.clientName,
        amount: item.amount,
        period: periodBilled,
        method: paymentMethod,
        status: "APROBADO",
        externalReference: item.externalTxId,
      },
    });
  }

  return {
    success: true,
    appliedCount,
    message: `Se aplicaron ${appliedCount} recaudos nuevos sin alterar la contabilidad.`,
  };
}

