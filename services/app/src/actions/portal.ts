"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { verifyPaymentToken, generatePaymentToken } from "@/lib/payment-token";
import { buildDaviPayCheckoutData } from "@/lib/payments/davipay";
import { grantPaymentPromise } from "@/lib/payments/billing-cycle";
import type {
  ApiResponse,
  PublicContractPaymentInfo,
} from "@/types";

/**
 * Retrieves public billing and service information for a subscriber via their Magic Link token.
 */
export async function getPublicContractPaymentInfo(
  token: string,
  originUrl?: string
): Promise<ApiResponse<PublicContractPaymentInfo>> {
  try {
    const verified = verifyPaymentToken(token);
    if (!verified.valid || !verified.contractId) {
      return {
        success: false,
        error: verified.error || "Enlace de pago inválido o expirado.",
      };
    }

    const contract = await prisma.contract.findUnique({
      where: { id: verified.contractId },
      include: {
        client: true,
        plan: true,
        brand: {
          include: {
            whatsappConfigs: {
              where: { connectionStatus: "open" },
              take: 1,
            },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!contract) {
      return { success: false, error: "Contrato de servicio no encontrado." };
    }

    // Check gateway configurations for this brand
    const gateways = await prisma.paymentGatewayConfig.findMany({
      where: {
        brandId: contract.brandId,
        isEnabled: true,
      },
    });

    const daviPayGateway = gateways.find((g) => g.provider === "DAVIPAY");
    const efectyGateway = gateways.find((g) => g.provider === "EFECTY");

    let daviPayCheckoutData = null;
    if (daviPayGateway && daviPayGateway.publicKey) {
      const checkoutRes = await buildDaviPayCheckoutData(
        contract.id,
        originUrl
      );
      if (checkoutRes.success && checkoutRes.data) {
        daviPayCheckoutData = checkoutRes.data;
      }
    }

    const recentPayments = contract.payments.map((p) => ({
      receiptNumber: p.receiptNumber,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      createdAt: p.createdAt,
      status: p.status,
    }));

    const paymentInfo: PublicContractPaymentInfo = {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      brandName: contract.brand.name,
      brandLogo: contract.brand.logo,
      brandSupportPhone:
        contract.brand.whatsappConfigs[0]?.phoneNumber ?? null,
      brandCurrency: contract.brand.currency || "COP",
      clientName: contract.client.fullName,
      clientDocType: contract.client.documentType,
      clientDocNumber: contract.client.documentNumber,
      serviceAddress: contract.address,
      city: contract.city,
      planName: contract.plan.name,
      downloadSpeedMbps: contract.plan.downloadSpeedMbps,
      uploadSpeedMbps: contract.plan.uploadSpeedMbps,
      monthlyAmountCop: contract.plan.priceCop,
      billingDay: contract.plan.billingDay,
      billingStatus: contract.billingStatus,
      serviceStatus: contract.serviceStatus,
      hasDaviPay: Boolean(daviPayGateway && daviPayCheckoutData),
      daviPayCheckoutData,
      hasEfecty: Boolean(efectyGateway && efectyGateway.agreementCode),
      efectyAgreementCode: efectyGateway?.agreementCode ?? null,
      efectyReference: contract.contractNumber,
      recentPayments,
    };

    return { success: true, data: paymentInfo };
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Error consultando información de pago.";
    return { success: false, error: msg };
  }
}

/**
 * Allows a suspended subscriber to request a 24-hour payment promise directly from the portal.
 */
export async function requestPublicPaymentPromise(
  token: string,
  notes?: string
): Promise<ApiResponse<{ promiseHours: number }>> {
  try {
    const verified = verifyPaymentToken(token);
    if (!verified.valid || !verified.contractId) {
      return {
        success: false,
        error: verified.error || "Enlace de pago inválido o expirado.",
      };
    }

    const justification =
      notes?.trim() ||
      "Prórroga de 24h solicitada por el abonado desde el Portal de Pago.";

    await grantPaymentPromise({
      contractId: verified.contractId,
      hours: 24,
      notes: justification,
      actor: "Abonado (Portal de Pago)",
    });

    return { success: true, data: { promiseHours: 24 } };
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Error procesando solicitud de prórroga.";
    return { success: false, error: msg };
  }
}

/**
 * Generates the Magic Payment Link for a contract (called from CRM by authenticated users).
 */
export async function getContractPaymentLinkAction(
  contractId: string
): Promise<ApiResponse<{ token: string; url: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "No autenticado." };
    }

    if (!contractId) {
      return { success: false, error: "ID de contrato requerido." };
    }

    const token = generatePaymentToken(contractId, 30);
    const baseOrigin =
      process.env.NEXTAUTH_URL ||
      process.env.APP_URL ||
      "";

    const cleanOrigin = baseOrigin ? baseOrigin.replace(/\/+$/, "") : "";
    const url = cleanOrigin
      ? `${cleanOrigin}/pago/${token}`
      : `/pago/${token}`;

    return {
      success: true,
      data: {
        token,
        url,
      },
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Error al generar enlace de pago.";
    return { success: false, error: msg };
  }
}
