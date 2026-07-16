-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'UNDERWRITER', 'CLAIMS_OFFICER', 'FIELD_AGENT', 'FARMER');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PREMIUM', 'PAYOUT');

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeSubscriptionId_key" ON "Tenant"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- AlterTable: Add tenantId column (nullable initially for migration)
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "LandParcel" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "PolicyPlan" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Policy" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Claim" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "tenantId" TEXT;

-- Note: email uniqueness is now scoped to tenant; drop the global unique first
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_pkey";
-- We'll recreate these after data migration

-- Drop old Role enum values and create new ones requires a CAST
-- Since PostgreSQL doesn't allow ALTER TYPE to rename values easily,
-- we do: CREATE TYPE, ALTER columns, DROP old type
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT;
UPDATE "User" SET "role" = 'PLATFORM_ADMIN' WHERE "role" = 'ADMIN';
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";
