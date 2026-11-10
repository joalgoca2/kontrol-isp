-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CC', 'NIT', 'CE', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "TechnologyType" AS ENUM ('FIBRA_OPTICA', 'MICROONDAS');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVO', 'AVISO_VENCIMIENTO', 'SUSPENDIDO_MORA', 'RETIRADO', 'CORTESIA');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DESCONOCIDO');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('ONLINE', 'OFFLINE', 'WARNING', 'UNREACHABLE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'EFECTY', 'NEQUI', 'DAVIPLATA', 'BANCOLOMBIA', 'PAYU', 'OTRO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('APROBADO', 'PENDIENTE', 'RECHAZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('WHATSAPP_AI', 'TELEFONO', 'PORTAL', 'PRESENCIAL');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('CORTE_TOTAL', 'LENTITUD', 'CAMBIO_WIFI', 'FALLA_FISICA_LOS', 'CARTERA', 'OTRO');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ABIERTO', 'EN_DIAGNOSTICO_IA', 'TRANSFERIDO_HUMANO', 'VISITA_AGENDADA', 'RESUELTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('AGENDADA', 'EN_RUTA', 'COMPLETADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bio" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "showWalkthrough" BOOLEAN NOT NULL DEFAULT true,
    "walkthroughStep" INTEGER NOT NULL DEFAULT 0,
    "walkthroughDoneAt" TIMESTAMP(3),
    "securityPin" TEXT,
    "webauthnCredential" TEXT,
    "brandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "users_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "roles_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "roles_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "expire_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "logo" TEXT,
    "apiKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "billingWebhookUrl" TEXT,
    "generalWebhookUrl" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mikrotik_nodes" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8728,
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "fallbackHost" TEXT,
    "useTls" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "NodeStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastCheckAt" TIMESTAMP(3),
    "latencyMs" INTEGER,
    "activeSessions" INTEGER NOT NULL DEFAULT 0,
    "cpuUsage" INTEGER,
    "routerOsVersion" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mikrotik_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "client_code" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'CC',
    "documentNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phonePrimary" TEXT NOT NULL,
    "phoneSecondary" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Soacha',
    "department" TEXT NOT NULL DEFAULT 'Cundinamarca',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "contractDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address" TEXT NOT NULL,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Soacha',
    "department" TEXT NOT NULL DEFAULT 'Cundinamarca',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "nodeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "technology" "TechnologyType" NOT NULL DEFAULT 'FIBRA_OPTICA',
    "pppoeUser" TEXT NOT NULL,
    "pppoePassword" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'ACTIVO',
    "serviceStatus" "ServiceStatus" NOT NULL DEFAULT 'DESCONOCIDO',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_equipment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "routerBrand" TEXT,
    "routerModel" TEXT,
    "routerMac" TEXT,
    "routerSerial" TEXT,
    "antennaType" TEXT,
    "antennaMac" TEXT,
    "antennaIp" TEXT,
    "cableMeters" INTEGER NOT NULL DEFAULT 0,
    "opticalPowerRx" DOUBLE PRECISION,
    "onuTemperature" DOUBLE PRECISION,
    "fiberPort" TEXT,
    "notes" TEXT,
    "installationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "downloadSpeedMbps" INTEGER NOT NULL,
    "uploadSpeedMbps" INTEGER NOT NULL,
    "rateLimit" TEXT NOT NULL,
    "priceCop" DOUBLE PRECISION NOT NULL,
    "billingDay" INTEGER NOT NULL DEFAULT 10,
    "mikrotikProfile" TEXT,
    "technology" "TechnologyType" NOT NULL DEFAULT 'FIBRA_OPTICA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "receiptNumber" SERIAL NOT NULL,
    "invoiceNumber" TEXT,
    "periodBilled" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
    "externalReference" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'APROBADO',
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "channel" "TicketChannel" NOT NULL DEFAULT 'WHATSAPP_AI',
    "issueType" "IssueType" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIA',
    "status" "TicketStatus" NOT NULL DEFAULT 'ABIERTO',
    "description" TEXT NOT NULL,
    "diagnosticSnapshot" JSONB,
    "assignedUserId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_visits" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "technicianName" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'AGENDADA',
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_config" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "instance_name" TEXT NOT NULL DEFAULT 'serkoi-telecom',
    "phone_number" TEXT,
    "connection_status" TEXT NOT NULL DEFAULT 'close',
    "qr_code" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_logs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contractId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "senderIdentifier" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "toolsInvoked" JSONB,
    "transferredToHuman" BOOLEAN NOT NULL DEFAULT false,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_ai_configs" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "template_type" TEXT NOT NULL DEFAULT 'BAILEYS_AI',
    "bot_name" TEXT NOT NULL DEFAULT 'SerkoiBot',
    "tone" TEXT NOT NULL DEFAULT 'AMABLE',
    "system_prompt" TEXT,
    "flow_config" JSONB,
    "allow_diagnostic_mikrotik" BOOLEAN NOT NULL DEFAULT true,
    "allow_kick_session" BOOLEAN NOT NULL DEFAULT true,
    "allow_grace_promise" BOOLEAN NOT NULL DEFAULT true,
    "grace_hours" INTEGER NOT NULL DEFAULT 24,
    "allow_schedule_visits" BOOLEAN NOT NULL DEFAULT true,
    "morning_visit_slots" INTEGER NOT NULL DEFAULT 4,
    "afternoon_visit_slots" INTEGER NOT NULL DEFAULT 4,
    "allow_billing_balance" BOOLEAN NOT NULL DEFAULT true,
    "allow_transfer_human" BOOLEAN NOT NULL DEFAULT true,
    "allow_check_visits" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_brandId_idx" ON "users"("brandId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "users_roles_userId_idx" ON "users_roles"("userId");

-- CreateIndex
CREATE INDEX "users_roles_roleId_idx" ON "users_roles"("roleId");

-- CreateIndex
CREATE INDEX "roles_permissions_roleId_idx" ON "roles_permissions"("roleId");

-- CreateIndex
CREATE INDEX "roles_permissions_permissionId_idx" ON "roles_permissions"("permissionId");

-- CreateIndex
CREATE INDEX "login_history_userId_idx" ON "login_history"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_apiKey_key" ON "brands"("apiKey");

-- CreateIndex
CREATE INDEX "mikrotik_nodes_brandId_idx" ON "mikrotik_nodes"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "mikrotik_nodes_brandId_code_key" ON "mikrotik_nodes"("brandId", "code");

-- CreateIndex
CREATE INDEX "clients_brandId_idx" ON "clients"("brandId");

-- CreateIndex
CREATE INDEX "clients_brandId_client_code_idx" ON "clients"("brandId", "client_code");

-- CreateIndex
CREATE UNIQUE INDEX "clients_brandId_documentNumber_key" ON "clients"("brandId", "documentNumber");

-- CreateIndex
CREATE INDEX "contracts_brandId_idx" ON "contracts"("brandId");

-- CreateIndex
CREATE INDEX "contracts_clientId_idx" ON "contracts"("clientId");

-- CreateIndex
CREATE INDEX "contracts_nodeId_idx" ON "contracts"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_brandId_contractNumber_key" ON "contracts"("brandId", "contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_brandId_pppoeUser_key" ON "contracts"("brandId", "pppoeUser");

-- CreateIndex
CREATE UNIQUE INDEX "contract_equipment_contractId_key" ON "contract_equipment"("contractId");

-- CreateIndex
CREATE INDEX "plans_brandId_idx" ON "plans"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_brandId_name_key" ON "plans"("brandId", "name");

-- CreateIndex
CREATE INDEX "payments_brandId_idx" ON "payments"("brandId");

-- CreateIndex
CREATE INDEX "payments_contractId_idx" ON "payments"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_tickets_brandId_idx" ON "support_tickets"("brandId");

-- CreateIndex
CREATE INDEX "support_tickets_contractId_idx" ON "support_tickets"("contractId");

-- CreateIndex
CREATE INDEX "whatsapp_config_brandId_idx" ON "whatsapp_config"("brandId");

-- CreateIndex
CREATE INDEX "ai_conversation_logs_brandId_idx" ON "ai_conversation_logs"("brandId");

-- CreateIndex
CREATE INDEX "ai_conversation_logs_senderIdentifier_idx" ON "ai_conversation_logs"("senderIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "brand_ai_configs_brand_id_key" ON "brand_ai_configs"("brand_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mikrotik_nodes" ADD CONSTRAINT "mikrotik_nodes_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "mikrotik_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_equipment" ADD CONSTRAINT "contract_equipment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_visits" ADD CONSTRAINT "technician_visits_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_config" ADD CONSTRAINT "whatsapp_config_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_logs" ADD CONSTRAINT "ai_conversation_logs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_logs" ADD CONSTRAINT "ai_conversation_logs_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_ai_configs" ADD CONSTRAINT "brand_ai_configs_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Extensión unaccent y función obligatoria de búsqueda
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT public.unaccent('public.unaccent', $1);
$$;
