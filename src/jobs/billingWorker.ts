import { Job, Worker, Queue } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { FRAUD_TIERS, type FraudTier } from "../config/fraudTiers";
import { notificationQueue } from "../lib/bullmq";
import logger from "../utils/logger";

/**
 * Generate an invoice number like INV-{YYYYMM}-{XXXX}.
 */
function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${yyyymm}-${rand}`;
}

/**
 * Run monthly billing for a single tenant.
 * 1. Aggregate usage from UsageLog for the period
 * 2. Add tier base fee
 * 3. Create Invoice with InvoiceLineItems
 * 4. Log results
 */
export async function generateTenantInvoice(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ invoiceId: string; invoiceNumber: string; totalAmount: number } | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    logger.warn({ tenantId }, "Tenant not found for invoice generation");
    return null;
  }

  // Fetch usage logs for the period
  const usageLogs = await prisma.usageLog.findMany({
    where: {
      tenantId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  });

  if (usageLogs.length === 0 && !tenant.config) {
    logger.info({ tenantId }, "No usage data for tenant this period — skipping invoice");
    return null;
  }

  // Determine tier and base fee
  const tenantConfig = (tenant.config || {}) as Record<string, any>;
  const tierName = (tenantConfig.fraudTier || "forge") as FraudTier;
  const tierConfig = FRAUD_TIERS[tierName] || FRAUD_TIERS.forge;

  // Build line items
  const lineItems: { description: string; amount: number; quantity?: number; unitPrice?: number }[] = [];

  // Base monthly fee (only if > 0)
  if (tierConfig.baseMonthlyFee > 0) {
    lineItems.push({
      description: `${tierConfig.label} Tier — Base Monthly Fee`,
      amount: tierConfig.baseMonthlyFee,
      quantity: 1,
      unitPrice: tierConfig.baseMonthlyFee,
    });
  }

  // Aggregate usage by service
  const byService = new Map<string, { calls: number; totalCost: number }>();
  for (const log of usageLogs) {
    const existing = byService.get(log.service) || { calls: 0, totalCost: 0 };
    existing.calls += log.quantity;
    existing.totalCost += log.totalCost;
    byService.set(log.service, existing);
  }

  for (const [service, data] of byService) {
    const unitPrice = data.calls > 0 ? Math.round((data.totalCost / data.calls) * 10000) / 10000 : 0;
    lineItems.push({
      description: `${service.charAt(0).toUpperCase() + service.slice(1)} API Calls (${tierConfig.label})`,
      amount: Math.round(data.totalCost * 100) / 100,
      quantity: data.calls,
      unitPrice,
    });
  }

  if (lineItems.length === 0) {
    logger.info({ tenantId }, "No chargeable items for tenant this period — skipping invoice");
    return null;
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const invoiceNumber = generateInvoiceNumber();
  const dueDate = new Date(periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days after period end

  // Create invoice with line items in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        periodStart,
        periodEnd,
        totalAmount: Math.round(totalAmount * 100) / 100,
        currency: "USD",
        status: "DRAFT",
        dueDate,
      },
    });

    for (const item of lineItems) {
      await tx.invoiceLineItem.create({
        data: {
          invoiceId: inv.id,
          description: item.description,
          amount: Math.round(item.amount * 100) / 100,
          quantity: item.quantity || null,
          unitPrice: item.unitPrice ? Math.round(item.unitPrice * 100) / 100 : null,
        },
      });
    }

    return inv;
  });

  // Notify tenant admin(s)
  const tenantAdmins = await prisma.user.findMany({
    where: { tenantId, role: "TENANT_ADMIN", isActive: true },
    select: { id: true },
  });

  for (const admin of tenantAdmins) {
    await notificationQueue.add("invoice-generated", {
      userId: admin.id,
      type: "INVOICE_GENERATED",
      title: "New Invoice Ready",
      message: `Invoice ${invoiceNumber} for ${Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalAmount)} is ready. Due: ${dueDate.toLocaleDateString()}`,
      relatedEntityType: "Invoice",
      relatedEntityId: invoice.id,
    });
  }

  logger.info({
    tenantId,
    invoiceId: invoice.id,
    invoiceNumber,
    totalAmount,
    lineItemCount: lineItems.length,
  }, "Invoice generated for tenant");

  return { invoiceId: invoice.id, invoiceNumber, totalAmount };
}

/**
 * The billing worker processes monthly invoice generation jobs.
 */
const billingWorker = new Worker(
  "billing",
  async (job: Job) => {
    const { tenantId, periodStart, periodEnd }: { tenantId?: string; periodStart?: string; periodEnd?: string } = job.data;

    logger.info({ jobId: job.id, tenantId }, "Processing billing job");

    if (tenantId) {
      // Generate invoice for a single tenant
      const start = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
      const end = periodEnd ? new Date(periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59);
      await generateTenantInvoice(tenantId, start, end);
    } else {
      // Generate invoices for all tenants
      const tenants = await prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      const start = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
      const end = periodEnd ? new Date(periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59);

      for (const tenant of tenants) {
        try {
          await generateTenantInvoice(tenant.id, start, end);
        } catch (error) {
          logger.error({ error, tenantId: tenant.id }, "Failed to generate invoice for tenant");
        }
      }
    }

    logger.info({ jobId: job.id }, "Billing job completed");
  },
  { connection: redis, concurrency: 2 }
);

billingWorker.on("completed", (job) => logger.info({ jobId: job.id }, "Billing job done"));
billingWorker.on("failed", (job, error) => logger.error({ jobId: job?.id, error }, "Billing job failed"));

logger.info("Billing worker initialized");

export { billingWorker };

/**
 * Schedule a monthly billing check.
 * Runs on the 1st of every month at 02:00 AM.
 */
export async function scheduleMonthlyBilling(): Promise<void> {
  const billingQueue = new Queue("billing", { connection: redis });
  await billingQueue.add(
    "monthly-billing",
    {},
    {
      repeat: {
        pattern: "0 2 1 * *", // 1st day of every month at 2:00 AM
      },
    }
  );
  logger.info("Monthly billing scheduled: 1st of every month at 02:00 AM");
}
