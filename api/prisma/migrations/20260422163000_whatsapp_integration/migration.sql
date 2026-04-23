DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppSessionStatus') THEN
    CREATE TYPE "WhatsAppSessionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'QR_REQUIRED', 'CONNECTED', 'ERROR');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WhatsAppInstance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'EVOLUTION_API',
  "instanceName" TEXT NOT NULL,
  "apiBaseUrl" TEXT NOT NULL,
  "apiKey" TEXT NOT NULL,
  "webhookSecret" TEXT,
  "status" "WhatsAppSessionStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "phoneNumber" TEXT,
  "qrCodeBase64" TEXT,
  "connectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "botEnabled" BOOLEAN NOT NULL DEFAULT true,
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WhatsAppInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppInstance_tenantId_key" ON "WhatsAppInstance"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppInstance_instanceName_key" ON "WhatsAppInstance"("instanceName");
CREATE INDEX IF NOT EXISTS "WhatsAppInstance_status_idx" ON "WhatsAppInstance"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppInstance_tenantId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppInstance"
      ADD CONSTRAINT "WhatsAppInstance_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WhatsAppWebhookEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "instanceId" TEXT,
  "eventType" TEXT,
  "externalMessageId" TEXT,
  "fromPhone" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_tenantId_externalMessageId_key"
  ON "WhatsAppWebhookEvent"("tenantId", "externalMessageId");
CREATE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_tenantId_createdAt_idx"
  ON "WhatsAppWebhookEvent"("tenantId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppWebhookEvent_tenantId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppWebhookEvent"
      ADD CONSTRAINT "WhatsAppWebhookEvent_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppWebhookEvent_instanceId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppWebhookEvent"
      ADD CONSTRAINT "WhatsAppWebhookEvent_instanceId_fkey"
      FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WhatsAppOutboundLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "instanceId" TEXT,
  "orderId" TEXT,
  "customerId" TEXT,
  "toPhone" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "providerMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WhatsAppOutboundLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WhatsAppOutboundLog_tenantId_createdAt_idx"
  ON "WhatsAppOutboundLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppOutboundLog_tenantId_status_idx"
  ON "WhatsAppOutboundLog"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "WhatsAppOutboundLog_orderId_idx"
  ON "WhatsAppOutboundLog"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppOutboundLog_tenantId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppOutboundLog"
      ADD CONSTRAINT "WhatsAppOutboundLog_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppOutboundLog_instanceId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppOutboundLog"
      ADD CONSTRAINT "WhatsAppOutboundLog_instanceId_fkey"
      FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppOutboundLog_orderId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppOutboundLog"
      ADD CONSTRAINT "WhatsAppOutboundLog_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppOutboundLog_customerId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppOutboundLog"
      ADD CONSTRAINT "WhatsAppOutboundLog_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
