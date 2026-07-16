/**
 * Multi-Tenant Data Migration Script
 *
 * This script creates a default tenant ("Default Insurance") and backfills
 * tenantId for all existing rows in the database. Run this after applying
 * the multi-tenant migration.
 *
 * Usage: npx ts-node src/scripts/migrateTenant.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_TENANT_NAME = "Default Insurance";
const DEFAULT_TENANT_SLUG = "default";

async function migrate() {
  console.log("Starting multi-tenant data migration...");

  // Check if a default tenant already exists
  let tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
  });

  if (!tenant) {
    console.log(`Creating default tenant: "${DEFAULT_TENANT_NAME}"`);
    tenant = await prisma.tenant.create({
      data: {
        name: DEFAULT_TENANT_NAME,
        slug: DEFAULT_TENANT_SLUG,
        billingEnabled: false,
      },
    });
    console.log(`Default tenant created with ID: ${tenant.id}`);
  } else {
    console.log(`Default tenant already exists with ID: ${tenant.id}`);
  }

  const tenantId = tenant.id;

  // Backfill User records — use separate query for each batch
  const userCount = await prisma.user.count({ where: { tenantId: { equals: null as any } } });
  if (userCount > 0) {
    console.log(`Backfilling tenantId for ${userCount} users...`);
    await prisma.user.updateMany({
      where: { tenantId: { equals: null as any } },
      data: { tenantId },
    });
  }

  // Backfill Farmer records
  const farmerCount = await prisma.farmer.count({ where: { tenantId: { equals: null as any } } });
  if (farmerCount > 0) {
    console.log(`Backfilling tenantId for ${farmerCount} farmers...`);
    await prisma.farmer.updateMany({
      where: { tenantId: { equals: null as any } },
      data: { tenantId },
    });
  }

  // Backfill LandParcel records
  const parcelCount = await prisma.landParcel.count({ where: { tenantId: { equals: null as any } } });
  if (parcelCount > 0) {
    console.log(`Backfilling tenantId for ${parcelCount} land parcels...`);
    await prisma.landParcel.updateMany({
      where: { tenantId: { equals: null as any } },
      data: { tenantId },
    });
  }

  // Backfill PolicyPlan records
  const planCount = await prisma.policyPlan.count({ where: { tenantId: { equals: null as any } } });
  if (planCount > 0) {
    console.log(`Backfilling tenantId for ${planCount} policy plans...`);
    await prisma.policyPlan.updateMany({
      where: { tenantId: { equals: null as any } },
      data: { tenantId },
    });
  }

  // Backfill Policy records
  const policyCount = await prisma.policy.count({ where: { tenantId: { equals: null as any } } });
  if (policyCount > 0) {
    console.log(`Backfilling tenantId for ${policyCount} policies...`);
    await prisma.policy.updateMany({
      where: { tenantId: { equals: null as any } },
      data: { tenantId },
    });
  }

  // Backfill Claim records
  const claimCount = await prisma.claim.count({ where: { tenantId: { equals: null as any } } });
  if (claimCount > 0) {
    console.log(`Backfilling tenantId for ${claimCount} claims...`);
    await prisma.claim.updateMany({
      where: { tenantId: { equals: null as any } },
      data: { tenantId },
    });
  }

  // Backfill Payment records
  const paymentCount = await prisma.payment.count({ where: { tenantId: { equals: null as any } } });
  if (paymentCount > 0) {
    console.log(`Backfilling tenantId for ${paymentCount} payments...`);
    await prisma.payment.updateMany({
      where: { tenantId: { equals: null as any } },
      data: { tenantId },
    });
  }

  console.log("Migration complete! All records have been assigned to the default tenant.");
  console.log(`Tenant ID: ${tenantId}`);
}

migrate()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
