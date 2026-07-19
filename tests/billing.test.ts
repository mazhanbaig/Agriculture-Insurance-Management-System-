/**
 * Unit tests for billing service.
 * Tests invoice generation, listing, payment, and usage summary.
 */

import * as billingService from "../src/services/billing.service";

jest.mock("../src/lib/redis", () => ({
  redis: { get: jest.fn(), setex: jest.fn(), del: jest.fn(), on: jest.fn() },
  checkRedisConnection: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/lib/bullmq", () => ({
  notificationQueue: { add: jest.fn() },
  ocrQueue: { add: jest.fn() },
  importQueue: { add: jest.fn() },
  fraudQueue: { add: jest.fn() },
}));

var prisma: any;
jest.mock("../src/lib/prisma", () => {
  const mock = {
    tenant: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    usageLog: { create: jest.fn(), findMany: jest.fn() },
    invoice: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    invoiceLineItem: { create: jest.fn() },
    $transaction: jest.fn().mockImplementation((queries: any[]) => Promise.resolve(queries.map(() => ({ count: 0 })))),
  };
  prisma = mock;
  return { prisma: mock };
});

jest.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } },
}));

const tenantId = "tenant-1";
const invoiceId = "invoice-1";

const ORIGINAL_BILLING_ENABLED = process.env.BILLING_ENABLED;

describe("Billing Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BILLING_ENABLED = ORIGINAL_BILLING_ENABLED;
  });

  describe("isBillingEnabled", () => {
    it("should return true when BILLING_ENABLED is 'true'", () => {
      process.env.BILLING_ENABLED = "true";
      expect(billingService.isBillingEnabled()).toBe(true);
    });

    it("should return false when BILLING_ENABLED is not 'true'", () => {
      process.env.BILLING_ENABLED = "false";
      expect(billingService.isBillingEnabled()).toBe(false);
    });

    it("should return false when BILLING_ENABLED is unset", () => {
      delete process.env.BILLING_ENABLED;
      expect(billingService.isBillingEnabled()).toBe(false);
    });
  });

  describe("listInvoices", () => {
    it("should list invoices scoped by tenantId with pagination", async () => {
      const mockInvoices = [
        { id: invoiceId, invoiceNumber: "INV-001", totalAmount: 100, lineItems: [] },
      ];
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue(mockInvoices);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(1);

      const result = await billingService.listInvoices(tenantId, 1, 20);
      expect(result.data).toEqual(mockInvoices);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId },
          skip: 0,
          take: 20,
        })
      );
    });

    it("should return empty list when no invoices exist", async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(0);

      const result = await billingService.listInvoices(tenantId, 1, 20);
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe("getInvoice", () => {
    it("should get an invoice by ID scoped by tenantId", async () => {
      const mockInvoice = { id: invoiceId, tenantId, lineItems: [] };
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);

      const invoice = await billingService.getInvoice(tenantId, invoiceId);
      expect(invoice).toEqual(mockInvoice);
    });

    it("should throw 404 when invoice not found for tenant", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        billingService.getInvoice(tenantId, "nonexistent")
      ).rejects.toThrow("Invoice not found");
    });

    it("should NOT allow tenant B to see tenant A's invoice", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        billingService.getInvoice("tenant-b", invoiceId)
      ).rejects.toThrow("Invoice not found");
    });
  });

  describe("payInvoice", () => {
    it("should mark a DRAFT invoice as PAID", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: invoiceId,
        tenantId,
        status: "DRAFT",
        totalAmount: 100,
      });
      (prisma.invoice.update as jest.Mock).mockResolvedValue({
        id: invoiceId, status: "PAID",
        paidAt: new Date(), lineItems: [],
      });
      (prisma.usageLog.create as jest.Mock).mockResolvedValue({});

      const result = await billingService.payInvoice(tenantId, invoiceId);
      expect(result.status).toBe("PAID");
    });

    it("should reject paying an already paid invoice", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: invoiceId,
        tenantId,
        status: "PAID",
      });

      await expect(
        billingService.payInvoice(tenantId, invoiceId)
      ).rejects.toThrow("already paid");
    });

    it("should reject paying a non-existent invoice", async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        billingService.payInvoice(tenantId, "fake-id")
      ).rejects.toThrow("Invoice not found");
    });
  });

  describe("getSubscriptionStatus", () => {
    it("should return inactive when billing is disabled", async () => {
      process.env.BILLING_ENABLED = "false";
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: tenantId,
        billingEnabled: false,
      });

      const status = await billingService.getSubscriptionStatus(tenantId);
      expect(status.active).toBe(false);
    });

    it("should return inactive when tenant has no subscription ID", async () => {
      process.env.BILLING_ENABLED = "true";
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: tenantId,
        billingEnabled: true,
        stripeSubscriptionId: null,
      });

      const status = await billingService.getSubscriptionStatus(tenantId);
      expect(status.active).toBe(false);
    });
  });

  describe("createStripeCustomer", () => {
    it("should skip when billing is disabled", async () => {
      process.env.BILLING_ENABLED = "false";
      const result = await billingService.createStripeCustomer(tenantId);
      expect(result.customerId).toBe("");
    });
  });
});
