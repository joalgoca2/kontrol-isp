-- AlterTable
ALTER TABLE "whatsapp_config" ADD COLUMN     "evolution_token" TEXT,
ADD COLUMN     "meta_access_token" TEXT,
ADD COLUMN     "meta_app_secret" TEXT,
ADD COLUMN     "meta_phone_number_id" TEXT,
ADD COLUMN     "meta_waba_id" TEXT,
ADD COLUMN     "meta_webhook_verify_token" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'EVOLUTION';
