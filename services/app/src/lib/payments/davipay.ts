import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { triggerOutboundWebhook } from "@/lib/webhook";
import { setClientSuspensionOnRouter } from "@/lib/mikrotik/node-manager";
import { sendWhatsappReceipt } from "@/lib/evolution-api";
import { decryptSecret } from "@/lib/crypto";
import type { DaviPayWebhookPayload } from "@/types";

export interface DaviPayProcessingResult {
  success: boolean;
  message: string;
  paymentId?: string;
  status?: string;
}

export interface DaviPayCheckoutData {
  publicKey: string;
  amount: number;
  tax: number;
  taxBase: number;
  name: string;
  description: string;
  currency: string;
  invoice: string;
  country: string;
  test: boolean;
  external: boolean;
  response: string;
  confirmation: string;
  extra1: string;
  extra2: string;
  nameBilling?: string;
  addressBilling?: string;
  typeDocBilling?: string;
  numberDoc?: string;
  mobilephoneBilling?: string;
}

/**
 * Validates the SHA-256 signature sent by DaviPay / ePayco.
 */
export function verifyDaviPaySignature(
  payload: DaviPayWebhookPayload,
  pKey: string
): boolean {
  if (!payload.x_signature || !pKey) return false;

  const customerId = String(payload.x_cust_id_cliente ?? "").trim();
  const refPayco = String(payload.x_ref_payco ?? "").trim();
  const transactionId = String(payload.x_transaction_id ?? "").trim();
  const amount = String(payload.x_amount ?? "").trim();
  const currency = String(payload.x_currency_code ?? "COP").trim();

  const rawString =
    `${customerId}^${pKey}^${refPayco}^${transactionId}^${amount}^${currency}`;
  const computedHash = crypto
    .createHash("sha256")
    .update(rawString)
    .digest("hex")
    .toLowerCase();

  return computedHash === String(payload.x_signature).toLowerCase().trim();
}

/**
 * Processes an incoming DaviPay / ePayco payment webhook confirmation.
 * Supports asynchronous PSE lifecycle: PENDIENTE -> APROBADO with router unblock.
 */
export async function processDaviPayWebhook(
  payload: DaviPayWebhookPayload
): Promise<DaviPayProcessingResult> {
  const customerId = String(payload.x_cust_id_cliente ?? "").trim();
  if (!customerId) {
    return { success: false, message: "x_cust_id_cliente ausente en webhook." };
  }

  const gateway = await prisma.paymentGatewayConfig.findFirst({
    where: {
      provider: "DAVIPAY",
      customerId,
      isEnabled: true,
    },
    include: { brand: true },
  });

  if (!gateway) {
    return {
      success: false,
      message: `Pasarela DaviPay inactiva o no encontrada para cliente '${customerId}'.`,
    };
  }

  const decryptedPKey = decryptSecret(gateway.pKey ?? "");
  const isValidSignature = verifyDaviPaySignature(payload, decryptedPKey);

  if (!isValidSignature && !gateway.isTestMode) {
    return {
      success: false,
      message: "Firma criptográfica x_signature inválida.",
    };
  }

  const refPayco = String(payload.x_ref_payco ?? "").trim();
  if (!refPayco) {
    return { success: false, message: "x_ref_payco es requerido." };
  }

  const codResponse = Number(payload.x_cod_response ?? 0);
  const actor = "webhook:davipay";

  // Check if payment was previously recorded (e.g. earlier as PENDIENTE via PSE)
  const existingPayment = await prisma.payment.findFirst({
    where: {
      brandId: gateway.brandId,
      externalReference: refPayco,
    },
  });

  if (existingPayment) {
    if (existingPayment.status === "APROBADO") {
      return {
        success: true,
        message: "Pago previamente aprobado (idempotente).",
        paymentId: existingPayment.id,
        status: existingPayment.status,
      };
    }

    // PSE transition: PENDIENTE -> APROBADO
    if (existingPayment.status === "PENDIENTE" && codResponse === 1) {
      const contract = await prisma.contract.findUnique({
        where: { id: existingPayment.contractId },
        include: { client: true, plan: true, node: true },
      });

      const updatedPayment = await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: "APROBADO",
          notes:
            `${existingPayment.notes ?? ""} | ` +
            `Aprobado PSE: ${payload.x_transaction_id ?? ""}`,
          updatedBy: actor,
        },
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
          );
        }
      }

      triggerOutboundWebhook("billing", {
        event: "payment.recorded",
        brandId: gateway.brandId,
        data: {
          paymentId: updatedPayment.id,
          contractNumber: contract?.contractNumber ?? "",
          clientName: contract?.client.fullName ?? "",
          amount: updatedPayment.amount,
          period: updatedPayment.periodBilled,
          method: "DAVIPAY",
          status: "APROBADO",
          externalReference: refPayco,
        },
      });

      if (contract?.client.phonePrimary) {
        await sendWhatsappReceipt({
          recipientPhone: contract.client.phonePrimary,
          clientName: contract.client.fullName,
          receiptNumber: updatedPayment.receiptNumber,
          amount: updatedPayment.amount,
          periodBilled: updatedPayment.periodBilled,
          paymentMethod: "DAVIPAY",
          brandName: gateway.brand.name,
          currency: (gateway.brand.currency as "COP" | "USD") || "COP",
        }).catch(() => null);
      }

      return {
        success: true,
        message: "Pago PSE confirmado y servicio reactivado exitosamente.",
        paymentId: updatedPayment.id,
        status: "APROBADO",
      };
    }

    // PSE transition: PENDIENTE -> RECHAZADO
    if (
      existingPayment.status === "PENDIENTE" &&
      (codResponse === 2 || codResponse === 4)
    ) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: "RECHAZADO",
          notes:
            `${existingPayment.notes ?? ""} | ` +
            `Rechazo: ${payload.x_response_reason_text ?? ""}`,
          updatedBy: actor,
        },
      });

      return {
        success: true,
        message: "Pago PSE actualizado a RECHAZADO por el banco.",
        paymentId: existingPayment.id,
        status: "RECHAZADO",
      };
    }

    return {
      success: true,
      message: `Pago previamente registrado con estado ${existingPayment.status}.`,
      paymentId: existingPayment.id,
      status: existingPayment.status,
    };
  }

  // Identify contract from extra1 (contractId, contractNumber, or clientId)
  const identifier = String(payload.x_extra1 ?? "").trim();
  const contract = await prisma.contract.findFirst({
    where: {
      brandId: gateway.brandId,
      OR: [
        { id: identifier },
        { contractNumber: identifier },
        { client: { documentNumber: identifier } },
      ],
    },
    include: {
      client: true,
      plan: true,
      node: true,
    },
  });

  if (!contract) {
    return {
      success: false,
      message: `Contrato no encontrado para la referencia '${identifier}'.`,
    };
  }

  let paymentStatus: "APROBADO" | "PENDIENTE" | "RECHAZADO" = "PENDIENTE";
  if (codResponse === 1) {
    paymentStatus = "APROBADO";
  } else if (codResponse === 2 || codResponse === 4) {
    paymentStatus = "RECHAZADO";
  }

  const amount = Number(payload.x_amount ?? contract.plan.priceCop);
  const now = new Date();
  const periodBilled =
    `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  const adminUser = await prisma.user.findFirst({
    where: { brandId: gateway.brandId },
    select: { id: true },
  });
  const systemUserId = adminUser?.id ?? "system";

  const savedPayment = await prisma.payment.create({
    data: {
      brandId: gateway.brandId,
      contractId: contract.id,
      periodBilled,
      amount,
      paymentMethod: "DAVIPAY",
      externalReference: refPayco,
      recordedByUserId: systemUserId,
      status: paymentStatus,
      notes:
        `DaviPay ref: ${refPayco}, tx: ${payload.x_transaction_id ?? "N/A"}` +
        (payload.x_franchise ? ` (${payload.x_franchise})` : ""),
      createdBy: actor,
      updatedBy: actor,
    },
  });

  // Auto-reactivate contract if payment is approved and contract was suspended
  if (
    paymentStatus === "APROBADO" &&
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
      );
    }
  }

  triggerOutboundWebhook("billing", {
    event: "payment.recorded",
    brandId: gateway.brandId,
    data: {
      paymentId: savedPayment.id,
      contractNumber: contract.contractNumber,
      clientName: contract.client.fullName,
      amount,
      period: periodBilled,
      method: "DAVIPAY",
      status: paymentStatus,
      externalReference: refPayco,
    },
  });

  if (paymentStatus === "APROBADO" && contract.client.phonePrimary) {
    await sendWhatsappReceipt({
      recipientPhone: contract.client.phonePrimary,
      clientName: contract.client.fullName,
      receiptNumber: savedPayment.receiptNumber,
      amount,
      periodBilled,
      paymentMethod: "DAVIPAY",
      brandName: gateway.brand.name,
      currency: (gateway.brand.currency as "COP" | "USD") || "COP",
    }).catch(() => null);
  }

  return {
    success: true,
    message: `Pago registrado exitosamente con estado ${paymentStatus}.`,
    paymentId: savedPayment.id,
    status: paymentStatus,
  };
}

/**
 * Builds DaviPay / ePayco Checkout parameters for online subscriber payments.
 */
export async function buildDaviPayCheckoutData(
  contractId: string,
  originUrl?: string
): Promise<{ success: boolean; data?: DaviPayCheckoutData; error?: string }> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        client: true,
        plan: true,
        brand: true,
      },
    });

    if (!contract) {
      return { success: false, error: "Contrato no encontrado." };
    }

    const gateway = await prisma.paymentGatewayConfig.findFirst({
      where: {
        brandId: contract.brandId,
        provider: "DAVIPAY",
        isEnabled: true,
      },
    });

    if (!gateway || !gateway.publicKey) {
      return {
        success: false,
        error: "Pasarela DaviPay no configurada o inactiva en esta marca.",
      };
    }

    const baseOrigin =
      originUrl || process.env.NEXTAUTH_URL || "https://kontrol.isp";
    const now = new Date();
    const periodStr =
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const invoiceNumber = `FAC-${contract.contractNumber}-${periodStr}`;

    const checkoutData: DaviPayCheckoutData = {
      publicKey: gateway.publicKey,
      amount: contract.plan.priceCop,
      tax: 0,
      taxBase: 0,
      name: `Mensualidad Internet - ${contract.plan.name}`,
      description: `Pago servicio internet Contrato #${contract.contractNumber}`,
      currency: contract.brand.currency || "COP",
      invoice: invoiceNumber,
      country: "CO",
      test: gateway.isTestMode,
      external: false,
      response: `${baseOrigin}/pago/resultado`,
      confirmation: `${baseOrigin}/api/v1/webhook/davipay`,
      extra1: contract.id,
      extra2: contract.brandId,
      nameBilling: contract.client.fullName,
      addressBilling: contract.address,
      typeDocBilling: contract.client.documentType,
      numberDoc: contract.client.documentNumber,
      mobilephoneBilling: contract.client.phonePrimary,
    };

    return { success: true, data: checkoutData };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Error al generar sesión de checkout.";
    return { success: false, error: msg };
  }
}
