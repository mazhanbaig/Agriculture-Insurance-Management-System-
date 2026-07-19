/**
 * Unit tests for policy plan service.
 * Tests CRUD, quote calculation, and autoTrigger config merging.
 */

import * as policyPlanService from "../src/services/policyPlans.service";

jest.mock("../src/lib/redis", () => ({
  redis: { get: jest.fn(), setex: jest.fn(), del: jest.fn(), on: jest.fn() },
  checkRedisConnection: jest.fn().mockResolvedValue(undefined),
}));

var prisma: any;
jest.mock("../src/lib/prisma", () => {
  const mock = {
    policyPlan: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((queries: any[]) => Promise.resolve(queries.map(() => ({ count: 0 })))),
  };
  prisma = mock;
  return { prisma: mock };
});

jest.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } },
}));

const tenantId = "tenant-1";
const planId = "plan-1";

describe("Policy Plan Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listPolicyPlans", () => {
    it("should list active policy plans with pagination", async () => {
      const mockPlans = [
        { id: planId, name: "Wheat Plan", cropType: "Wheat", isActive: true, tenantId },
      ];
      (prisma.policyPlan.findMany as jest.Mock).mockResolvedValue(mockPlans);
      (prisma.policyPlan.count as jest.Mock).mockResolvedValue(1);

      const result = await policyPlanService.listPolicyPlans(tenantId, 1, 20);
      expect(result.plans).toEqual(mockPlans);
      expect(result.pagination.total).toBe(1);
    });

    it("should only return active plans", async () => {
      (prisma.policyPlan.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.policyPlan.count as jest.Mock).mockResolvedValue(0);

      await policyPlanService.listPolicyPlans(tenantId, 1, 20);

      expect(prisma.policyPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });
  });

  describe("getPolicyPlan", () => {
    it("should return a policy plan scoped by tenantId", async () => {
      const mockPlan = {
        id: planId,
        tenantId,
        name: "Rice Plan",
        cropType: "Rice",
        coveragePerAcre: 2000,
        premiumRate: 0.05,
        termMonths: 12,
        isActive: true,
      };
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue(mockPlan);

      const plan = await policyPlanService.getPolicyPlan(planId, tenantId);
      expect(plan.id).toBe(planId);
      expect(prisma.policyPlan.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: planId, tenantId },
        })
      );
    });

    it("should throw 404 when plan not found for tenant", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        policyPlanService.getPolicyPlan("nonexistent", tenantId)
      ).rejects.toThrow("Policy plan not found");
    });
  });

  describe("createPolicyPlan", () => {
    it("should create a policy plan with tenantId", async () => {
      (prisma.policyPlan.create as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        name: "New Plan",
        config: null,
      });

      const plan = await policyPlanService.createPolicyPlan(tenantId, {
        name: "New Plan",
        cropType: "Maize",
        coveragePerAcre: 1500,
        premiumRate: 0.04,
        termMonths: 6,
      });

      expect(plan.tenantId).toBe(tenantId);
    });

    it("should create a policy plan with autoTrigger config", async () => {
      const autoTriggerConfig = {
        autoTrigger: {
          enabled: true,
          ndviThreshold: 0.4,
          weatherCheck: true,
          claimPercentage: 0.6,
          autoApprove: true,
          autoApproveMaxScore: 25,
        },
      };

      (prisma.policyPlan.create as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        name: "Auto Plan",
        config: autoTriggerConfig,
      });

      const plan = await policyPlanService.createPolicyPlan(tenantId, {
        name: "Auto Plan",
        cropType: "Wheat",
        coveragePerAcre: 2000,
        premiumRate: 0.05,
        termMonths: 12,
        config: autoTriggerConfig,
      });

      expect(plan.config).toEqual(autoTriggerConfig);
      expect(prisma.policyPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ config: autoTriggerConfig }),
        })
      );
    });
  });

  describe("updatePolicyPlan", () => {
    it("should update an existing policy plan", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        config: null,
      });
      (prisma.policyPlan.update as jest.Mock).mockResolvedValue({
        id: planId,
        name: "Updated Plan",
      });

      const plan = await policyPlanService.updatePolicyPlan(planId, tenantId, {
        name: "Updated Plan",
      });

      expect(prisma.policyPlan.update).toHaveBeenCalled();
    });

    it("should merge config with existing config on update", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        config: { existingKey: "keep-me" },
      });
      (prisma.policyPlan.update as jest.Mock).mockResolvedValue({
        id: planId,
        config: { existingKey: "keep-me", autoTrigger: { enabled: true } },
      });

      await policyPlanService.updatePolicyPlan(planId, tenantId, {
        config: { autoTrigger: { enabled: true } },
      });

      // Verify that the update merged config (existingKey kept)
      const updateCall = (prisma.policyPlan.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.config).toHaveProperty("existingKey");
      expect(updateCall.data.config).toHaveProperty("autoTrigger");
    });

    it("should throw 404 when updating non-existent plan", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        policyPlanService.updatePolicyPlan("nonexistent", tenantId, { name: "Ghost" })
      ).rejects.toThrow("Policy plan not found");
    });
  });

  describe("calculateQuote", () => {
    it("should calculate premium and coverage correctly", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        name: "Wheat Plan",
        cropType: "Wheat",
        coveragePerAcre: 1000,
        premiumRate: 0.05,
        termMonths: 12,
        isActive: true,
      });

      const quote = await policyPlanService.calculateQuote(planId, tenantId, 10);

      expect(quote.coverageAmount).toBe(10000); // 1000 * 10
      expect(quote.premiumAmount).toBe(500);    // 0.05 * 1000 * 10
      expect(quote.areaAcres).toBe(10);
      expect(quote.planName).toBe("Wheat Plan");
    });

    it("should throw error for inactive plan", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        isActive: false,
      });

      await expect(
        policyPlanService.calculateQuote(planId, tenantId, 5)
      ).rejects.toThrow("no longer active");
    });

    it("should enforce minimum area requirement", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        name: "Minimum Plan",
        coveragePerAcre: 1000,
        premiumRate: 0.05,
        termMonths: 12,
        isActive: true,
        minAreaAcres: 5,
        maxAreaAcres: 50,
      });

      await expect(
        policyPlanService.calculateQuote(planId, tenantId, 2)
      ).rejects.toThrow("Minimum area");
    });

    it("should enforce maximum area requirement", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        name: "Max Plan",
        coveragePerAcre: 1000,
        premiumRate: 0.05,
        termMonths: 12,
        isActive: true,
        minAreaAcres: 5,
        maxAreaAcres: 50,
      });

      await expect(
        policyPlanService.calculateQuote(planId, tenantId, 100)
      ).rejects.toThrow("Maximum area");
    });

    it("should respect custom termMonths when provided", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        name: "Flex Plan",
        coveragePerAcre: 1000,
        premiumRate: 0.05,
        termMonths: 12,
        isActive: true,
      });

      const quote = await policyPlanService.calculateQuote(planId, tenantId, 10, 6);
      expect(quote.termMonths).toBe(6);
    });
  });
});
