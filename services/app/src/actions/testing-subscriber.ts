"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { promesaPagoTool } from "@/lib/ai/isp-tools";
import type { ApiResponse } from "@/types";

export interface TestingSubscriberSummary {
  client: {
    id: string;
    fullName: string;
    documentNumber: string;
    phonePrimary: string;
    address: string;
    city: string;
  };
  contract: {
    id: string;
    contractNumber: string;
    pppoeUser: string;
    ipAddress: string | null;
    billingStatus: string;
    serviceStatus: string;
    planName: string;
    nodeName: string;
    opticalPowerRx: number | null;
  };
  pendingDebt: {
    total: number;
    invoicesCount: number;
    invoiceNumber: string | null;
  };
  openTicketsCount: number;
  scheduledVisitsCount: number;
}

export async function ensureTestingSubscriberAction(
  targetBrandId?: string
): Promise<ApiResponse<TestingSubscriberSummary>> {
  try {
    let session = null;
    try {
      session = await auth();
    } catch (_authErr) {
      // Safe fallback when executed outside Next request context (e.g. CLI seed)
    }
    let brandId = targetBrandId || session?.user?.brandId;

    if (!brandId || brandId === "ALL") {
      const firstBrand = await prisma.brand.findFirst({ select: { id: true } });
      if (!firstBrand) {
        return { success: false, error: "No se encontró ninguna marca en el sistema." };
      }
      brandId = firstBrand.id;
    }

    const node = await prisma.mikrotikNode.findFirst({
      where: { brandId },
      select: { id: true, name: true },
    });

    const plan = await prisma.plan.findFirst({
      where: { brandId },
      select: { id: true, name: true },
    });

    if (!node || !plan) {
      return {
        success: false,
        error: "Se requiere al menos un nodo y un plan configurados en la marca.",
      };
    }

    const adminUser = await prisma.user.findFirst({
      where: { brandId },
      select: { id: true, email: true },
    });
    const actorEmail = session?.user?.email || adminUser?.email || "system@kontrol.local";
    const recordedUserId = adminUser?.id || session?.user?.id || "system";

    // 1. Upsert Client
    const client = await prisma.client.upsert({
      where: {
        brandId_documentNumber: {
          brandId,
          documentNumber: "1234567890",
        },
      },
      create: {
        brandId,
        documentType: "CC",
        documentNumber: "1234567890",
        fullName: "Carlos Prueba NOC",
        email: "carlos.testing@serkoi.com",
        phonePrimary: "573001234567",
        phoneSecondary: "3001234567",
        address: "Calle 10 # 5-20, Centro",
        city: "Soacha",
        department: "Cundinamarca",
        isActive: true,
        createdBy: actorEmail,
        updatedBy: actorEmail,
      },
      update: {
        fullName: "Carlos Prueba NOC",
        phonePrimary: "573001234567",
        phoneSecondary: "3001234567",
        address: "Calle 10 # 5-20, Centro",
        city: "Soacha",
        department: "Cundinamarca",
        isActive: true,
        updatedBy: actorEmail,
      },
    });

    // 2. Upsert Contract
    const contract = await prisma.contract.upsert({
      where: {
        brandId_contractNumber: {
          brandId,
          contractNumber: "TEST-001",
        },
      },
      create: {
        brandId,
        clientId: client.id,
        contractNumber: "TEST-001",
        nodeId: node.id,
        planId: plan.id,
        technology: "FIBRA_OPTICA",
        pppoeUser: "test_carlos_noc",
        pppoePassword: "test_password_123",
        ipAddress: "192.168.196.250",
        macAddress: "6C:68:A4:99:88:77",
        address: "Calle 10 # 5-20, Centro",
        city: "Soacha",
        department: "Cundinamarca",
        billingStatus: "SUSPENDIDO_MORA",
        serviceStatus: "OFFLINE",
        createdBy: actorEmail,
        updatedBy: actorEmail,
      },
      update: {
        nodeId: node.id,
        planId: plan.id,
        ipAddress: "192.168.196.250",
        macAddress: "6C:68:A4:99:88:77",
        updatedBy: actorEmail,
      },
      include: {
        plan: true,
        node: true,
        equipment: true,
      },
    });

    // 3. Upsert Equipment
    await prisma.contractEquipment.upsert({
      where: { contractId: contract.id },
      create: {
        contractId: contract.id,
        routerBrand: "Huawei",
        routerModel: "Huawei HG8245H5",
        routerMac: "6C:68:A4:99:88:77",
        routerSerial: "HWTC68A49988",
        opticalPowerRx: -19.8,
        onuTemperature: 42.5,
        cableMeters: 45,
      },
      update: {
        routerBrand: "Huawei",
        routerModel: "Huawei HG8245H5",
        routerMac: "6C:68:A4:99:88:77",
        opticalPowerRx: -19.8,
        onuTemperature: 42.5,
      },
    });

    // 4. Ensure Pending Payment (Debt of $65.000 COP)
    const existingPayment = await prisma.payment.findFirst({
      where: {
        contractId: contract.id,
        status: "PENDIENTE",
      },
    });

    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          brandId,
          contractId: contract.id,
          invoiceNumber: "FAC-TEST-001",
          periodBilled: "Noviembre 2026",
          amount: 65000,
          paymentMethod: "EFECTIVO",
          recordedByUserId: recordedUserId,
          status: "PENDIENTE",
          notes: "Factura de prueba para testing de cobranza y chatbot.",
          createdBy: actorEmail,
          updatedBy: actorEmail,
        },
      });
    }

    return getTestingSubscriberStatusAction(brandId);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error creando abonado de prueba.";
    return { success: false, error: msg };
  }
}

export async function getTestingSubscriberStatusAction(
  targetBrandId?: string
): Promise<ApiResponse<TestingSubscriberSummary>> {
  try {
    let session = null;
    try {
      session = await auth();
    } catch (_authErr) {
      // CLI / background invocation
    }
    let brandId = targetBrandId || session?.user?.brandId;

    if (!brandId || brandId === "ALL") {
      const firstBrand = await prisma.brand.findFirst({ select: { id: true } });
      if (!firstBrand) {
        return { success: false, error: "No se encontró marca activa." };
      }
      brandId = firstBrand.id;
    }

    const client = await prisma.client.findFirst({
      where: {
        brandId,
        documentNumber: "1234567890",
      },
      include: {
        contracts: {
          where: { contractNumber: "TEST-001" },
          include: {
            plan: true,
            node: true,
            equipment: true,
            payments: {
              where: { status: "PENDIENTE" },
            },
            tickets: {
              where: { status: { notIn: ["CERRADO", "RESUELTO"] } },
              include: {
                technicianVisits: {
                  where: { status: "AGENDADA" },
                },
              },
            },
          },
        },
      },
    });

    if (!client || client.contracts.length === 0) {
      // Auto-create if not yet created
      return ensureTestingSubscriberAction(brandId);
    }

    const contract = client.contracts[0];
    const pendingTotal = contract.payments.reduce((acc, p) => acc + p.amount, 0);
    const scheduledVisits = contract.tickets.reduce(
      (acc, t) => acc + t.technicianVisits.length,
      0
    );

    const summary: TestingSubscriberSummary = {
      client: {
        id: client.id,
        fullName: client.fullName,
        documentNumber: client.documentNumber,
        phonePrimary: client.phonePrimary,
        address: client.address || "",
        city: client.city,
      },
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        pppoeUser: contract.pppoeUser,
        ipAddress: contract.ipAddress,
        billingStatus: contract.billingStatus,
        serviceStatus: contract.serviceStatus,
        planName: contract.plan.name,
        nodeName: contract.node.name,
        opticalPowerRx: contract.equipment?.opticalPowerRx ?? null,
      },
      pendingDebt: {
        total: pendingTotal,
        invoicesCount: contract.payments.length,
        invoiceNumber: contract.payments[0]?.invoiceNumber ?? null,
      },
      openTicketsCount: contract.tickets.length,
      scheduledVisitsCount: scheduledVisits,
    };

    return { success: true, data: summary };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error consultando abonado de prueba.";
    return { success: false, error: msg };
  }
}

export async function toggleTestSubscriberCutAction(
  targetBrandId?: string,
  cut = true
): Promise<ApiResponse<{ billingStatus: string; serviceStatus: string }>> {
  try {
    let session = null;
    try {
      session = await auth();
    } catch (_authErr) {
      // CLI / background invocation
    }
    let brandId = targetBrandId || session?.user?.brandId;

    if (!brandId || brandId === "ALL") {
      const firstBrand = await prisma.brand.findFirst({ select: { id: true } });
      brandId = firstBrand?.id;
    }

    if (!brandId) {
      return { success: false, error: "Marca no válida." };
    }

    const actorEmail = session?.user?.email || "system@kontrol.local";
    const nextBilling = cut ? "SUSPENDIDO_MORA" : "ACTIVO";
    const nextService = cut ? "OFFLINE" : "ONLINE";

    const contract = await prisma.contract.findFirst({
      where: { brandId, contractNumber: "TEST-001" },
    });

    if (!contract) {
      await ensureTestingSubscriberAction(brandId);
    }

    await prisma.contract.updateMany({
      where: { brandId, contractNumber: "TEST-001" },
      data: {
        billingStatus: nextBilling,
        serviceStatus: nextService,
        updatedBy: actorEmail,
      },
    });

    // If cut is true, ensure pending invoice exists
    if (cut) {
      const hasPending = await prisma.payment.findFirst({
        where: {
          brandId,
          contract: { contractNumber: "TEST-001" },
          status: "PENDIENTE",
        },
      });

      if (!hasPending && contract) {
        const adminUser = await prisma.user.findFirst({ where: { brandId } });
        await prisma.payment.create({
          data: {
            brandId,
            contractId: contract.id,
            invoiceNumber: "FAC-TEST-001",
            periodBilled: "Noviembre 2026",
            amount: 65000,
            paymentMethod: "EFECTIVO",
            recordedByUserId: adminUser?.id || "system",
            status: "PENDIENTE",
            notes: "Factura de prueba regenerada al cortar servicio.",
            createdBy: actorEmail,
            updatedBy: actorEmail,
          },
        });
      }
    }

    return {
      success: true,
      data: { billingStatus: nextBilling, serviceStatus: nextService },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error alternando corte de servicio.";
    return { success: false, error: msg };
  }
}

export async function grantTestSubscriberGraceAction(
  targetBrandId?: string
): Promise<ApiResponse<{ message: string; hours: number }>> {
  try {
    let session = null;
    try {
      session = await auth();
    } catch (_authErr) {
      // CLI / background invocation
    }
    let brandId = targetBrandId || session?.user?.brandId;

    if (!brandId || brandId === "ALL") {
      const firstBrand = await prisma.brand.findFirst({ select: { id: true } });
      brandId = firstBrand?.id;
    }

    if (!brandId) {
      return { success: false, error: "Marca no válida." };
    }

    const toolRes = await promesaPagoTool("TEST-001", brandId);
    if (!toolRes.ok) {
      return { success: false, error: toolRes.message };
    }

    return {
      success: true,
      data: {
        message: toolRes.message,
        hours: toolRes.horasGracia ?? 24,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error otorgando prórroga.";
    return { success: false, error: msg };
  }
}

export async function resetTestSubscriberAction(
  targetBrandId?: string
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  try {
    let session = null;
    try {
      session = await auth();
    } catch (_authErr) {
      // CLI / background invocation
    }
    let brandId = targetBrandId || session?.user?.brandId;

    if (!brandId || brandId === "ALL") {
      const firstBrand = await prisma.brand.findFirst({ select: { id: true } });
      brandId = firstBrand?.id;
    }

    if (!brandId) {
      return { success: false, error: "Marca no válida." };
    }

    const contract = await prisma.contract.findFirst({
      where: { brandId, contractNumber: "TEST-001" },
      select: { id: true },
    });

    if (contract) {
      // 1. Delete associated tickets and cascading visits
      await prisma.supportTicket.deleteMany({
        where: { contractId: contract.id },
      });

      // 2. Delete test conversations
      await prisma.aiConversationLog.deleteMany({
        where: {
          brandId,
          OR: [
            { contractId: contract.id },
            { senderIdentifier: { in: ["1234567890", "573001234567", "TEST-001"] } },
          ],
        },
      });

      // 3. Mark all payments as PENDIENTE (ensure debt)
      await prisma.payment.updateMany({
        where: { contractId: contract.id },
        data: { status: "PENDIENTE" },
      });
    }

    // 4. Re-run ensure to restore base state (SUSPENDIDO_MORA / OFFLINE)
    await ensureTestingSubscriberAction(brandId);
    await toggleTestSubscriberCutAction(brandId, true);

    return {
      success: true,
      data: {
        success: true,
        message: "Escenario de pruebas reiniciado: Mora activa, sin tickets ni visitas.",
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error reiniciando escenario.";
    return { success: false, error: msg };
  }
}
