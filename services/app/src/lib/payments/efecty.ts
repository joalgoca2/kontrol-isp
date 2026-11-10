import { prisma } from "@/lib/prisma";
import { triggerOutboundWebhook } from "@/lib/webhook";
import { setClientSuspensionOnRouter } from "@/lib/mikrotik/node-manager";
import { sendWhatsappReceipt } from "@/lib/evolution-api";
import { decryptSecret } from "@/lib/crypto";
import type {
  EfectyQueryRequest,
  EfectyQueryResponse,
  EfectyPaymentRequest,
  EfectyPaymentResponse,
} from "@/types";

/**
 * Authenticates an incoming Efecty Web Service request.
 */
async function authenticateEfectyGateway(convenio: string, token?: string) {
  const cleanConvenio = convenio.trim();
  if (!cleanConvenio) {
    return { success: false, error: "Convenio ausente." };
  }

  const gateway = await prisma.paymentGatewayConfig.findFirst({
    where: {
      provider: "EFECTY",
      agreementCode: cleanConvenio,
      isEnabled: true,
    },
    include: { brand: true },
  });

  if (!gateway) {
    return {
      success: false,
      error: `Convenio '${cleanConvenio}' inactivo o no configurado en el sistema.`,
    };
  }

  if (gateway.secretKey) {
    const expectedSecret = decryptSecret(gateway.secretKey);
    if (token && token.trim() !== expectedSecret.trim()) {
      return { success: false, error: "Token de autenticación de Efecty inválido." };
    }
  }

  return { success: true, gateway };
}

/**
 * Resolves client debt for Efecty POS cashiers.
 */
export async function queryEfectyDebt(
  request: EfectyQueryRequest
): Promise<EfectyQueryResponse> {
  const authRes = await authenticateEfectyGateway(
    request.convenio,
    request.token
  );
  if (!authRes.success || !authRes.gateway) {
    return {
      estado: "ERROR",
      codigo: "001",
      mensaje: authRes.error || "Convenio no autorizado.",
    };
  }

  const { gateway } = authRes;
  const ref = request.referencia.trim();

  const isDocumentMode = gateway.validationMode === "DOCUMENT";
  const contract = await prisma.contract.findFirst({
    where: {
      brandId: gateway.brandId,
      ...(isDocumentMode
        ? { client: { documentNumber: ref } }
        : { contractNumber: ref }),
    },
    include: {
      client: true,
      plan: true,
    },
  });

  if (!contract) {
    return {
      estado: "ERROR",
      codigo: "002",
      mensaje: `Abonado con ${isDocumentMode ? "documento" : "contrato"} '${ref}' no encontrado.`,
    };
  }

  // Calculate billing period and amount
  const now = new Date();
  const period = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 20)
    .toISOString()
    .split("T")[0];

  return {
    estado: "EXITO",
    codigo: "000",
    cliente: contract.client.fullName,
    referencia: ref,
    factura: `FAC-${contract.contractNumber}-${period.replace("/", "")}`,
    valor: contract.plan.priceCop,
    fechaLimite: dueDate,
  };
}

/**
 * Processes confirmed cash payment from an Efecty POS cashier.
 */
export async function processEfectyPayment(
  request: EfectyPaymentRequest
): Promise<EfectyPaymentResponse> {
  const authRes = await authenticateEfectyGateway(
    request.convenio,
    request.token
  );
  if (!authRes.success || !authRes.gateway) {
    return {
      estado: "ERROR",
      codigo: "001",
      mensaje: authRes.error || "Convenio no autorizado.",
    };
  }

  const { gateway } = authRes;
  const transaccionId = request.transaccionId.trim();

  // Idempotency check: verify if transaccionId was already applied
  const existing = await prisma.payment.findFirst({
    where: {
      brandId: gateway.brandId,
      externalReference: transaccionId,
    },
  });

  if (existing) {
    return {
      estado: "EXITO",
      codigo: "000",
      mensaje: "Pago previamente procesado (idempotente).",
      reciboId: existing.id,
      transaccionId,
    };
  }

  const ref = request.referencia.trim();
  const isDocumentMode = gateway.validationMode === "DOCUMENT";
  const contract = await prisma.contract.findFirst({
    where: {
      brandId: gateway.brandId,
      ...(isDocumentMode
        ? { client: { documentNumber: ref } }
        : { contractNumber: ref }),
    },
    include: {
      client: true,
      plan: true,
      node: true,
    },
  });

  if (!contract) {
    return {
      estado: "ERROR",
      codigo: "002",
      mensaje: `Contrato no encontrado para la referencia '${ref}'.`,
    };
  }

  const now = new Date();
  const periodBilled = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  const adminUser = await prisma.user.findFirst({
    where: { brandId: gateway.brandId },
    select: { id: true },
  });
  const systemUserId = adminUser?.id ?? "system";
  const actor = "pos:efecty";

  const savedPayment = await prisma.payment.create({
    data: {
      brandId: gateway.brandId,
      contractId: contract.id,
      periodBilled,
      amount: request.valor,
      paymentMethod: "EFECTY",
      externalReference: transaccionId,
      recordedByUserId: systemUserId,
      status: "APROBADO",
      notes: `Recaudo en taquilla Efecty convenio ${request.convenio}, tx ${transaccionId}`,
      createdBy: actor,
      updatedBy: actor,
    },
  });

  // Auto-reactivate contract if payment is approved and contract was suspended
  if (
    contract.billingStatus === "SUSPENDIDO_MORA" ||
    contract.billingStatus === "AVISO_VENCIMIENTO"
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
      await setClientSuspensionOnRouter(contract.node, contract.pppoeUser, false);
    }
  }

  // Dispatch outbound webhook
  triggerOutboundWebhook("billing", {
    event: "payment.recorded",
    brandId: gateway.brandId,
    data: {
      paymentId: savedPayment.id,
      contractNumber: contract.contractNumber,
      clientName: contract.client.fullName,
      amount: request.valor,
      period: periodBilled,
      method: "EFECTY",
      status: "APROBADO",
      externalReference: transaccionId,
    },
  });

  // Send WhatsApp receipt if client phone exists
  if (contract.client.phonePrimary) {
    await sendWhatsappReceipt({
      recipientPhone: contract.client.phonePrimary,
      clientName: contract.client.fullName,
      receiptNumber: savedPayment.receiptNumber,
      amount: request.valor,
      periodBilled,
      paymentMethod: "EFECTY",
      brandName: gateway.brand.name,
      currency: (gateway.brand.currency as "COP" | "USD") || "COP",
    }).catch(() => null);
  }

  return {
    estado: "EXITO",
    codigo: "000",
    reciboId: savedPayment.id,
    transaccionId,
    referencia: ref,
    mensaje: "Pago aplicado y servicio reactivado exitosamente.",
  };
}
