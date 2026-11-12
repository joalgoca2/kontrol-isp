import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Multi-Tenant ISP database seed...");

  // Ensure PostgreSQL unaccent extension is enabled
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS unaccent;");

  // 1. Seed Roles
  console.log("  -> Seeding RBAC roles...");
  const superAdminRole = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    update: {},
    create: {
      name: "SUPER_ADMIN",
      description: "Superadministrador de la plataforma (acceso global multi-marca).",
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description: "Administrador de marca / ISP (acceso total a su tenant).",
    },
  });

  const technicianRole = await prisma.role.upsert({
    where: { name: "TECHNICIAN" },
    update: {},
    create: {
      name: "TECHNICIAN",
      description: "Técnico de campo, instalaciones y soporte de red NOC.",
    },
  });

  const billingRole = await prisma.role.upsert({
    where: { name: "BILLING" },
    update: {},
    create: {
      name: "BILLING",
      description: "Contabilidad, caja, facturación y conciliación bancaria.",
    },
  });

  const supportRole = await prisma.role.upsert({
    where: { name: "SUPPORT" },
    update: {},
    create: {
      name: "SUPPORT",
      description: "Mesa de ayuda, atención al cliente y soporte de incidencias.",
    },
  });

  // Keep legacy USER role for backwards compatibility during migration
  const userRole = await prisma.role.upsert({
    where: { name: "USER" },
    update: {},
    create: {
      name: "USER",
      description: "Rol legado (migrado a TECHNICIAN).",
    },
  });

  // 2. Seed Permissions
  console.log("  -> Seeding permissions...");
  const permissionsList = [
    { name: "brands:manage", description: "Crear y configurar marcas" },
    { name: "nodes:manage", description: "Administrar nodos MikroTik" },
    { name: "nodes:read", description: "Ver estado y telemetría de nodos" },
    { name: "clients:manage", description: "Crear y editar titulares/clientes" },
    {
      name: "clients:delete",
      description: "Eliminar titulares de la base de datos",
    },
    { name: "clients:read", description: "Ver clientes" },
    { name: "contracts:manage", description: "Gestionar contratos y cortes" },
    {
      name: "contracts:delete",
      description: "Eliminar contratos del sistema",
    },
    { name: "contracts:read", description: "Consultar contratos" },
    { name: "plans:manage", description: "Configurar planes y tarifas" },
    { name: "billing:manage", description: "Registrar cobros y emitir recibos" },
    { name: "tickets:manage", description: "Gestionar tickets y visitas técnicas" },
    {
      name: "tickets:delete",
      description: "Eliminar tickets de soporte del historial de auditoría",
    },
    { name: "users:manage", description: "Gestionar usuarios y credenciales" },
    { name: "settings:manage", description: "Configuración del sistema" },
  ];

  const technicianPerms = [
    "nodes:read",
    "clients:read",
    "contracts:read",
    "tickets:manage",
  ];

  const billingPerms = [
    "billing:manage",
    "clients:read",
    "clients:manage",
    "contracts:read",
    "contracts:manage",
    "tickets:manage",
    "plans:manage",
  ];

  const supportPerms = [
    "tickets:manage",
    "clients:read",
    "contracts:read",
    "plans:manage",
  ];

  for (const perm of permissionsList) {
    const createdPerm = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });

    // SuperAdmin has all permissions
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: createdPerm.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: createdPerm.id,
      },
    });

    // Brand admin permissions (all except brands:manage)
    if (perm.name !== "brands:manage") {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: createdPerm.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: createdPerm.id,
        },
      });
    }

    // Technician permissions
    if (technicianPerms.includes(perm.name)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: technicianRole.id,
            permissionId: createdPerm.id,
          },
        },
        update: {},
        create: {
          roleId: technicianRole.id,
          permissionId: createdPerm.id,
        },
      });
    }

    // Billing permissions
    if (billingPerms.includes(perm.name)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: billingRole.id,
            permissionId: createdPerm.id,
          },
        },
        update: {},
        create: {
          roleId: billingRole.id,
          permissionId: createdPerm.id,
        },
      });
    }

    // Support permissions
    if (supportPerms.includes(perm.name)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: supportRole.id,
            permissionId: createdPerm.id,
          },
        },
        update: {},
        create: {
          roleId: supportRole.id,
          permissionId: createdPerm.id,
        },
      });
    }
  }

  // 3. Seed Brand Principal (Serkoi Telecom)
  console.log("  -> Seeding default Brand (Serkoi Telecom)...");
  const defaultBrand = await prisma.brand.upsert({
    where: { slug: "serkoi" },
    update: {},
    create: {
      name: "Serkoi",
      slug: "serkoi",
      legalName: "SERKOI S.A.S.",
      taxId: "901234567-1",
      apiKey: "isp_live_serkoi_token_2026",
      locale: "es",
      timezone: "America/Bogota",
      currency: "COP",
      billingWebhookUrl: "https://n8n.serkoi.com/webhook/billing",
      generalWebhookUrl: "https://n8n.serkoi.com/webhook/general",
    },
  });

  // Seed Default BrandAiConfig
  console.log("  -> Seeding default BrandAiConfig...");
  await prisma.brandAiConfig.upsert({
    where: { brandId: defaultBrand.id },
    update: {},
    create: {
      brandId: defaultBrand.id,
      templateType: "BAILEYS_AI",
      botName: "SerkoiBot",
      tone: "AMABLE",
      systemPrompt:
        "Eres el asistente virtual oficial de Serkoi SAS. Ayudas a diagnosticar " +
        "conexión, conceder promesas de pago y agendar visitas técnicas.",
      allowKickSession: true,
      allowGracePromise: true,
      graceHours: 24,
      allowScheduleVisits: true,
      morningVisitSlots: 4,
      afternoonVisitSlots: 4,
    },
  });

  // 4. Seed Users
  const hashedPassword = await bcrypt.hash("password123", 10);

  console.log("  -> Seeding SuperAdmin user...");
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@remotemonkeys.ai" },
    update: {},
    create: {
      email: "admin@remotemonkeys.ai",
      name: "SuperAdmin Global",
      password: hashedPassword,
      isActive: true,
      brandId: null,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: superAdmin.id,
      roleId: superAdminRole.id,
    },
  });

  console.log("  -> Seeding Brand Admin user...");
  const brandAdmin = await prisma.user.upsert({
    where: { email: "soporte@serkoi.com" },
    update: {},
    create: {
      email: "soporte@serkoi.com",
      name: "Administrador Serkoi",
      password: hashedPassword,
      isActive: true,
      brandId: defaultBrand.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: brandAdmin.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: brandAdmin.id,
      roleId: adminRole.id,
    },
  });

  console.log("  -> Seeding Technician user...");
  const operatorUser = await prisma.user.upsert({
    where: { email: "tecnico@serkoi.com" },
    update: {},
    create: {
      email: "tecnico@serkoi.com",
      name: "Técnico Soporte Serkoi",
      password: hashedPassword,
      isActive: true,
      brandId: defaultBrand.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: operatorUser.id,
        roleId: technicianRole.id,
      },
    },
    update: {},
    create: {
      userId: operatorUser.id,
      roleId: technicianRole.id,
    },
  });

  // 5. Automatic Migration: Reassign all legacy USER roles to TECHNICIAN
  console.log("  -> Migrating legacy USER roles to TECHNICIAN...");
  const legacyUserRoles = await prisma.userRole.findMany({
    where: { roleId: userRole.id },
  });

  for (const lur of legacyUserRoles) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: lur.userId,
          roleId: technicianRole.id,
        },
      },
      update: {},
      create: {
        userId: lur.userId,
        roleId: technicianRole.id,
      },
    });

    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: lur.userId,
          roleId: userRole.id,
        },
      },
    });
  }
  /*
    // 5. Seed MikroTik Nodes
    console.log("  -> Seeding MikroTik Nodes...");
    const nodeSoacha = await prisma.mikrotikNode.upsert({
      where: {
        brandId_code: {
          brandId: defaultBrand.id,
          code: "NOD-SOA-01",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        name: "Nodo Central Soacha - CCR1009",
        code: "NOD-SOA-01",
        location: "Soacha Centro (Cra 5 # 12-30)",
        host: "190.242.115.10",
        port: 8728,
        username: "api_kontrol",
        passwordEncrypted: "serkoi2026_mikrotik",
        fallbackHost: "192.168.21.1",
        status: "ONLINE",
        activeSessions: 142,
        latencyMs: 14,
        cpuUsage: 18,
        routerOsVersion: "RouterOS v7.14.3",
      },
    });
  
    const nodeCazuca = await prisma.mikrotikNode.upsert({
      where: {
        brandId_code: {
          brandId: defaultBrand.id,
          code: "NOD-CAZ-02",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        name: "Nodo Cazucá - CCR2004",
        code: "NOD-CAZ-02",
        location: "Altos de Cazucá (Torre Mirador)",
        host: "38.52.120.45",
        port: 8728,
        username: "api_kontrol",
        passwordEncrypted: "serkoi2026_cazuca",
        fallbackHost: "192.168.30.1",
        status: "ONLINE",
        activeSessions: 89,
        latencyMs: 22,
        cpuUsage: 25,
        routerOsVersion: "RouterOS v7.14.3",
      },
    });
  
    // 6. Seed Plans
    console.log("  -> Seeding Internet Plans...");
    const plan30M = await prisma.plan.upsert({
      where: {
        brandId_name: {
          brandId: defaultBrand.id,
          name: "30M Fibra Óptica Residencial",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        name: "30M Fibra Óptica Residencial",
        downloadSpeedMbps: 30,
        uploadSpeedMbps: 30,
        rateLimit: "30M/30M",
        priceCop: 50000,
        billingDay: 10,
        mikrotikProfile: "PLAN_30M",
        technology: "FIBRA_OPTICA",
      },
    });
  
    const plan50M = await prisma.plan.upsert({
      where: {
        brandId_name: {
          brandId: defaultBrand.id,
          name: "50M Fibra Óptica Residencial",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        name: "50M Fibra Óptica Residencial",
        downloadSpeedMbps: 50,
        uploadSpeedMbps: 50,
        rateLimit: "50M/50M",
        priceCop: 65000,
        billingDay: 10,
        mikrotikProfile: "PLAN_50M",
        technology: "FIBRA_OPTICA",
      },
    });
  
    const plan20MWireless = await prisma.plan.upsert({
      where: {
        brandId_name: {
          brandId: defaultBrand.id,
          name: "20M Microondas Rural",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        name: "20M Microondas Rural",
        downloadSpeedMbps: 20,
        uploadSpeedMbps: 20,
        rateLimit: "20M/20M",
        priceCop: 55000,
        billingDay: 15,
        mikrotikProfile: "PLAN_20M_AIR",
        technology: "MICROONDAS",
      },
    });
  
    // 7. Seed Clients & Multi-Contract Subscriptions
    console.log("  -> Seeding Client 1 with 2 Contracts (Multi-Service)...");
    const client1 = await prisma.client.upsert({
      where: {
        brandId_documentNumber: {
          brandId: defaultBrand.id,
          documentNumber: "1024567890",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        documentType: "CC",
        documentNumber: "1024567890",
        fullName: "Juan Carlos González",
        email: "carlos.gonzalez@example.com",
        phonePrimary: "3101234567",
        phoneSecondary: "3159876543",
        address: "Cra 5 # 12-34",
        city: "Soacha",
        department: "Cundinamarca",
      },
    });
  
    // Contract 1 of Client 1 (Fiber, Node Soacha)
    const contract1 = await prisma.contract.upsert({
      where: {
        brandId_contractNumber: {
          brandId: defaultBrand.id,
          contractNumber: "SER-1042",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        clientId: client1.id,
        contractNumber: "SER-1042",
        address: "Cra 5 # 12-34 Apto 302",
        neighborhood: "Centro",
        city: "Soacha",
        department: "Cundinamarca",
        nodeId: nodeSoacha.id,
        planId: plan30M.id,
        technology: "FIBRA_OPTICA",
        pppoeUser: "carlos.gonzalez",
        pppoePassword: "pppoe_password_1042",
        ipAddress: "10.10.20.14",
        billingStatus: "ACTIVO",
        serviceStatus: "ONLINE",
      },
    });
  
    await prisma.contractEquipment.upsert({
      where: { contractId: contract1.id },
      update: {},
      create: {
        contractId: contract1.id,
        routerBrand: "Huawei",
        routerModel: "EchoLife HG8145V5",
        routerMac: "48:57:02:AA:BB:CC",
        routerSerial: "HWTC1042ABCD",
        cableMeters: 45,
        opticalPowerRx: -22.4,
        onuTemperature: 28.5,
        fiberPort: "GPON-01/04",
        notes: "Instalación de fibra con potencia óptica excelente (-22.4 dBm).",
      },
    });
  
    // Contract 2 of Client 1 (Microwave, Node Cazuca - Local Comercial)
    const contract2 = await prisma.contract.upsert({
      where: {
        brandId_contractNumber: {
          brandId: defaultBrand.id,
          contractNumber: "SER-1085",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        clientId: client1.id,
        contractNumber: "SER-1085",
        address: "Av 30 # 45-10 Local 1",
        neighborhood: "Cazucá Comercial",
        city: "Soacha",
        department: "Cundinamarca",
        nodeId: nodeCazuca.id,
        planId: plan20MWireless.id,
        technology: "MICROONDAS",
        pppoeUser: "carlos.local",
        pppoePassword: "pppoe_password_1085",
        ipAddress: "10.10.30.44",
        billingStatus: "ACTIVO",
        serviceStatus: "ONLINE",
      },
    });
  
    await prisma.contractEquipment.upsert({
      where: { contractId: contract2.id },
      update: {},
      create: {
        contractId: contract2.id,
        routerBrand: "TP-Link",
        routerModel: "Archer C6",
        routerMac: "50:C7:BF:11:22:33",
        antennaType: "Ubiquiti LiteBeam 5AC Gen2",
        antennaMac: "78:8A:20:99:88:77",
        antennaIp: "192.168.1.50",
        cableMeters: 25,
        notes: "Radioenlace punto a punto hacia Torre Cazucá. Señal -62 dBm.",
      },
    });
  
    // Client 2 with Delinquent Contract
    console.log("  -> Seeding Client 2 (with suspended contract)...");
    const client2 = await prisma.client.upsert({
      where: {
        brandId_documentNumber: {
          brandId: defaultBrand.id,
          documentNumber: "52987654",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        documentType: "CC",
        documentNumber: "52987654",
        fullName: "María Fernanda Rodríguez",
        email: "maria.rodriguez@example.com",
        phonePrimary: "3129876543",
        address: "Diagonal 15 # 8-22",
        city: "Soacha",
        department: "Cundinamarca",
      },
    });
  
    const contract3 = await prisma.contract.upsert({
      where: {
        brandId_contractNumber: {
          brandId: defaultBrand.id,
          contractNumber: "SER-2015",
        },
      },
      update: {},
      create: {
        brandId: defaultBrand.id,
        clientId: client2.id,
        contractNumber: "SER-2015",
        address: "Diagonal 15 # 8-22 Casa 4",
        neighborhood: "Compartir",
        city: "Soacha",
        department: "Cundinamarca",
        nodeId: nodeSoacha.id,
        planId: plan50M.id,
        technology: "FIBRA_OPTICA",
        pppoeUser: "maria.rodriguez",
        pppoePassword: "pppoe_password_2015",
        ipAddress: "10.10.20.25",
        billingStatus: "SUSPENDIDO_MORA",
        serviceStatus: "OFFLINE",
      },
    });
  
    await prisma.contractEquipment.upsert({
      where: { contractId: contract3.id },
      update: {},
      create: {
        contractId: contract3.id,
        routerBrand: "ZTE",
        routerModel: "F670L Dual Band",
        routerMac: "6C:F3:7F:DD:EE:FF",
        cableMeters: 30,
        opticalPowerRx: -23.1,
        notes: "Suspendido por mora de 2 meses.",
      },
    });
  
    // 8. Seed sample Payment for Contract 1
    console.log("  -> Seeding sample payment for Contract 1...");
    await prisma.payment.upsert({
      where: { id: "seed-payment-1042-oct" },
      update: {},
      create: {
        id: "seed-payment-1042-oct",
        brandId: defaultBrand.id,
        contractId: contract1.id,
        invoiceNumber: "FAC-2026-001042",
        periodBilled: "2026-10",
        amount: 50000,
        paymentMethod: "NEQUI",
        externalReference: "M104298112",
        recordedByUserId: brandAdmin.id,
        status: "APROBADO",
        notes: "Pago oportuno mensualidad octubre.",
      },
    });
  
  */
  // 9. Seed WhatsApp configuration for Brand
  await prisma.whatsappConfig.upsert({
    where: { id: "default-serkoi" },
    update: {},
    create: {
      id: "default-serkoi",
      brandId: defaultBrand.id,
      instanceName: "serkoi",
      connectionStatus: "open",
      phoneNumber: "+573101234567",
    },
  });

  console.log("✅ Multi-Tenant ISP database seed finished successfully!");

}
main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
