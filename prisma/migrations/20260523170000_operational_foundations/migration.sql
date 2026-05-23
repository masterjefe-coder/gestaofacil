-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Quote" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Order" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Charge" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "NfseDocument" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT,
    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_workspaceId_deletedAt_idx" ON "Customer"("workspaceId", "deletedAt");
CREATE INDEX "Quote_workspaceId_deletedAt_idx" ON "Quote"("workspaceId", "deletedAt");
CREATE INDEX "Order_workspaceId_deletedAt_idx" ON "Order"("workspaceId", "deletedAt");
CREATE INDEX "Charge_workspaceId_deletedAt_idx" ON "Charge"("workspaceId", "deletedAt");
CREATE INDEX "NfseDocument_workspaceId_deletedAt_idx" ON "NfseDocument"("workspaceId", "deletedAt");
CREATE UNIQUE INDEX "BackgroundJob_type_dedupeKey_key" ON "BackgroundJob"("type", "dedupeKey");
CREATE INDEX "BackgroundJob_status_availableAt_idx" ON "BackgroundJob"("status", "availableAt");
CREATE INDEX "BackgroundJob_workspaceId_status_idx" ON "BackgroundJob"("workspaceId", "status");
CREATE UNIQUE INDEX "RateLimitBucket_scope_identifier_windowKey_key" ON "RateLimitBucket"("scope", "identifier", "windowKey");
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
