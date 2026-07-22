import { prisma } from "../lib/prisma";
import logger from "../utils/logger";

/**
 * Seed script to create the default tenant and PLATFORM_ADMIN user.
 * The admin auth user must be created manually in Supabase dashboard.
 * Run with: npx ts-node src/scripts/seed.ts
 */
async function seed() {
  logger.info("Starting seed...");

  // Create default tenant
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Insurance",
      slug: "default",
      status: "ACTIVE",
      billingEnabled: false,
      config: {
        branding: {
          primaryColor: "#1A73E8",
          logoUrl: null,
        },
        claimFields: [],
        requiredDocs: [],
      },
    },
  });
  logger.info({ tenantId: defaultTenant.id }, "Default tenant created/verified");

  // Create PLATFORM_ADMIN user if not exists
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@aims.app";
  const existingAdmin = await prisma.user.findFirst({
    where: { email: adminEmail, tenantId: defaultTenant.id },
  });

  if (!existingAdmin) {
    // Note: The Supabase auth user must be created first in Supabase dashboard.
    // Get the user's Supabase auth ID from Supabase dashboard > Authentication > Users.
    // Then set SEED_ADMIN_AUTH_ID env var, or use a well-known placeholder.
    const supabaseAuthId =
      process.env.SEED_ADMIN_AUTH_ID || `seed-admin-placeholder`;

    const admin = await prisma.user.create({
      data: {
        tenantId: defaultTenant.id,
        authId: supabaseAuthId,
        email: adminEmail,
        role: "PLATFORM_ADMIN",
        isActive: true,
      },
    });
    logger.info(
      { userId: admin.id, email: admin.email },
      "PLATFORM_ADMIN created. Update SEED_ADMIN_AUTH_ID env var with the actual Supabase user ID."
    );
  } else {
    logger.info({ userId: existingAdmin.id }, "PLATFORM_ADMIN already exists");
  }

  logger.info("Seed completed successfully");
}

seed()
  .catch((error) => {
    logger.error({ error }, "Seed failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
