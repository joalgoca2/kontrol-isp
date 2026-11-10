-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('DAVIPAY', 'EFECTY');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'DAVIPAY';

-- CreateTable
CREATE TABLE "payment_gateway_configs" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_test_mode" BOOLEAN NOT NULL DEFAULT true,
    "customer_id" TEXT,
    "public_key" TEXT,
    "private_key" TEXT,
    "p_key" TEXT,
    "agreement_code" TEXT,
    "secret_key" TEXT,
    "validation_mode" TEXT NOT NULL DEFAULT 'DOCUMENT',
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateway_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_gateway_configs_brand_id_idx" ON "payment_gateway_configs"("brand_id");

-- CreateIndex
CREATE INDEX "payment_gateway_configs_agreement_code_idx" ON "payment_gateway_configs"("agreement_code");

-- CreateIndex
CREATE INDEX "payment_gateway_configs_customer_id_idx" ON "payment_gateway_configs"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateway_configs_brand_id_provider_key" ON "payment_gateway_configs"("brand_id", "provider");

-- AddForeignKey
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
