-- Multi-Tenant Migration
-- This migration adds the Tenant model and tenantId columns to existing tables.

-- CreateEnum (redefine with new values)
-- Note: If running on a fresh DB, the init migration already has the old enum.
-- This handles the upgrade path. For fresh DBs, use the updated init schema directly.

-- CreateTable: Tenant
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "billingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");
CREATE UNIQUE INDEX "Tenant_stripeSubscriptionId_key" ON "Tenant"("stripeSubscriptionId");
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- Add tenantId columns (nullable initially for data migration)
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "LandParcel" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "PolicyPlan" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Policy" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Claim" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "tenantId" TEXT;

-- Add foreign key constraints
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LandParcel" ADD CONSTRAINT "LandParcel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PolicyPlan" ADD CONSTRAINT "PolicyPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes on tenantId for query performance
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "Farmer_tenantId_idx" ON "Farmer"("tenantId");
CREATE INDEX "LandParcel_tenantId_idx" ON "LandParcel"("tenantId");
CREATE INDEX "PolicyPlan_tenantId_idx" ON "PolicyPlan"("tenantId");
CREATE INDEX "Policy_tenantId_idx" ON "Policy"("tenantId");
CREATE INDEX "Claim_tenantId_idx" ON "Claim"("tenantId");
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- Migrate Role enum: ADMIN → PLATFORM_ADMIN or TENANT_ADMIN
-- First, cast the column to text temporarily
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT;
UPDATE "User" SET "role" = 'PLATFORM_ADMIN' WHERE "role" = 'ADMIN';
-- If no new Role enum exists yet (fresh migration scenario), handle gracefully
-- The enum should already include the new values from the init migration

-- Drop global unique constraints (now scoped per-tenant)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
ALTER TABLE "Farmer" DROP CONSTRAINT IF EXISTS "Farmer_cnicNumber_key";
ALTER TABLE "PolicyPlan" DROP CONSTRAINT IF EXISTS "PolicyPlan_name_key";
