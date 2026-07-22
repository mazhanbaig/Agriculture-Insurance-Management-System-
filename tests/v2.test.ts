/**
 * Unit tests for v2 spec features:
 * 1. Tenant approval gate — signup, approve, suspend
 * 2. PolicyRequest state machine — create, review, convert
 * 3. Fraud pipeline ordering — sequential 3-tier (Sentinel → Weather → LLM)
 */

// Mocks must be declared before imports
jest.mock("../src/lib/redis", () => ({
  redis: { get: jest.fn(), setex: jest.fn(), del: jest.fn(), on: jest.fn() },
  checkRedisConnection: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } },
}));

jest.mock("../src/lib/bullmq", () => ({
  notificationQueue: { add: jest.fn() },
  ocrQueue: { add: jest.fn() },
  importQueue: { add: jest.fn() },
  fraudQueue: { add: jest.fn() },
  createOcrWorker: jest.fn(),
  createNotificationWorker: jest.fn(),
  createImportWorker: jest.fn(),
}));

jest.mock("../src/lib/cloudinary", () => ({
  cloudinary: { uploader: { upload: jest.fn(), destroy: jest.fn() } },
}));

// Mock external API libraries for fraud pipeline tests
const mockCompareNDVI = jest.fn();
jest.mock("../src/lib/sentinel", () => ({ compareNDVI: mockCompareNDVI }));

const mockCheckWeatherForClaim = jest.fn();
jest.mock("../src/lib/weather", () => ({ checkWeatherForClaim: mockCheckWeatherForClaim }));

const mockAnalyzeWithFallback = jest.fn();
jest.mock("../src/lib/openrouter", () => ({ analyzeWithFallback: mockAnalyzeWithFallback }));

// Mock usage service to isolate fraud tests
jest.mock("../src/services/usage.service", () => ({
  logUsage: jest.fn().mockResolvedValue(undefined),
  getUsageSummary: jest.fn().mockResolvedValue({ totalCalls: 0, totalRawCost: 0, totalBilledCost: 0, markupAmount: 0, markupPercent: 10, byService: {}, byDate: {} }),
}));

var prisma: any;
jest.mock("../src/lib/prisma", () => {
  const mock = {
    tenant: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    farmer: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    landParcel: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    policyPlan: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    policy: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    claim: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    claimStatusHistory: { create: jest.fn(), findMany: jest.fn() },
    claimDocument: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
    fraudAuditLog: { create: jest.fn(), findMany: jest.fn() },
    autoTriggerLog: { create: jest.fn(), findMany: jest.fn() },
    payment: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), aggregate: jest.fn() },
    notification: { create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    usageLog: { create: jest.fn(), findMany: jest.fn() },
    customRole: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    invoice: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    invoiceLineItem: { create: jest.fn() },
    policyRequest: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn().mockImplementation((cb: any) => {
      // For $transaction with a callback, create a transaction proxy
      const tx = {
        policy: { create: jest.fn() },
        policyRequest: { update: jest.fn() },
      };
      return cb(tx);
    }),
  };
  prisma = mock;
  return { prisma: mock };
});

// ─────────────────────────────────────────────────────────────────
// Imports (must come after mocks)
// ─────────────────────────────────────────────────────────────────
import * as platformService from "../src/services/platform.service";
import * as policyRequestService from "../src/services/policyRequests.service";
import * as fraudService from "../src/services/fraud.service";

// ─────────────────────────────────────────────────────────────────
// Shared test data
// ─────────────────────────────────────────────────────────────────
const tenantId = "test-tenant-id";
const farmerId = "test-farmer-id";
const userId = "test-user-id";
const staffUserId = "test-staff-user-id";
const planId = "test-plan-id";
const parcelId = "test-parcel-id";

// ═════════════════════════════════════════════════════════════════
// 1. TENANT APPROVAL GATE
// ═════════════════════════════════════════════════════════════════
describe("Tenant Approval Gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("signupTenant", () => {
    it("should create tenant with PENDING_APPROVAL status", async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null); // no conflict
      (prisma.tenant.create as jest.Mock).mockResolvedValue({
        id: tenantId,
        name: "Test Insurer",
        slug: "test-insurer",
        status: "PENDING_APPROVAL",
      });
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: userId,
        tenantId,
        email: "admin@test.com",
        role: "TENANT_ADMIN",
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]); // no platform admins to notify

      const result = await platformService.signupTenant({
        name: "Test Insurer",
        slug: "test-insurer",
        adminEmail: "admin@test.com",
      });

      expect(result.tenant.status).toBe("PENDING_APPROVAL");
      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PENDING_APPROVAL" }),
        })
      );
    });

    it("should reject duplicate slug on signup", async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: "existing",
        slug: "test-insurer",
      });

      await expect(
        platformService.signupTenant({
          name: "Test Insurer",
          slug: "test-insurer",
          adminEmail: "admin@test.com",
        })
      ).rejects.toThrow("slug already exists");
    });
  });

  describe("approveTenant", () => {
    it("should set pending tenant to ACTIVE", async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: tenantId,
        name: "Test Insurer",
        status: "PENDING_APPROVAL",
      });
      (prisma.tenant.update as jest.Mock).mockResolvedValue({
        id: tenantId,
        status: "ACTIVE",
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await platformService.approveTenant(tenantId);
      expect(result.status).toBe("ACTIVE");
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tenantId },
          data: { status: "ACTIVE" },
        })
      );
    });

    it("should reject approving a non-pending tenant", async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: tenantId,
        status: "ACTIVE",
      });

      await expect(
        platformService.approveTenant(tenantId)
      ).rejects.toThrow("not in pending approval");
    });

    it("should throw 404 for non-existent tenant", async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        platformService.approveTenant("nonexistent")
      ).rejects.toThrow("Tenant not found");
    });
  });

  describe("suspendTenant", () => {
    it("should set active tenant to SUSPENDED", async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: tenantId,
        status: "ACTIVE",
      });
      (prisma.tenant.update as jest.Mock).mockResolvedValue({
        id: tenantId,
        status: "SUSPENDED",
      });

      const result = await platformService.suspendTenant(tenantId);
      expect(result.status).toBe("SUSPENDED");
    });

    it("should reject suspending already-suspended tenant", async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: tenantId,
        status: "SUSPENDED",
      });

      await expect(
        platformService.suspendTenant(tenantId)
      ).rejects.toThrow("already suspended");
    });
  });

  describe("listTenants with status filter", () => {
    it("should filter by status when provided", async () => {
      (prisma.tenant.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.tenant.count as jest.Mock).mockResolvedValue(0);

      await platformService.listTenants(1, 20, "PENDING_APPROVAL");

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PENDING_APPROVAL" },
        })
      );
    });

    it("should return all tenants when no status filter", async () => {
      (prisma.tenant.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.tenant.count as jest.Mock).mockResolvedValue(0);

      await platformService.listTenants(1, 20);

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// 2. POLICYREQUEST STATE MACHINE
// ═════════════════════════════════════════════════════════════════
describe("PolicyRequest State Machine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createPolicyRequest", () => {
    it("should create a PENDING request when valid", async () => {
      (prisma.landParcel.findFirst as jest.Mock).mockResolvedValue({
        id: parcelId,
        farmerId,
        tenantId,
      });
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        isActive: true,
        name: "Wheat Plan",
        coveragePerAcre: 1000,
        premiumRate: 0.05,
        termMonths: 12,
      });
      (prisma.policyRequest.findFirst as jest.Mock).mockResolvedValue(null); // no pending duplicate
      (prisma.policyRequest.create as jest.Mock).mockResolvedValue({
        id: "req-1",
        tenantId,
        farmerId,
        landParcelId: parcelId,
        policyPlanId: planId,
        status: "PENDING",
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]); // no staff to notify

      const request = await policyRequestService.createPolicyRequest(
        farmerId,
        tenantId,
        { policyPlanId: planId, landParcelId: parcelId }
      );

      expect(request.status).toBe("PENDING");
      expect(prisma.policyRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PENDING" }),
        })
      );
    });

    it("should reject if land parcel belongs to different farmer", async () => {
      (prisma.landParcel.findFirst as jest.Mock).mockResolvedValue({
        id: parcelId,
        farmerId: "other-farmer",
        tenantId,
      });

      await expect(
        policyRequestService.createPolicyRequest(farmerId, tenantId, {
          policyPlanId: planId,
          landParcelId: parcelId,
        })
      ).rejects.toThrow("does not belong to you");
    });

    it("should reject if policy plan is inactive", async () => {
      (prisma.landParcel.findFirst as jest.Mock).mockResolvedValue({
        id: parcelId,
        farmerId,
        tenantId,
      });
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        isActive: false,
      });

      await expect(
        policyRequestService.createPolicyRequest(farmerId, tenantId, {
          policyPlanId: planId,
          landParcelId: parcelId,
        })
      ).rejects.toThrow("no longer active");
    });

    it("should reject duplicate pending requests", async () => {
      (prisma.landParcel.findFirst as jest.Mock).mockResolvedValue({
        id: parcelId,
        farmerId,
        tenantId,
      });
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: planId,
        tenantId,
        isActive: true,
      });
      (prisma.policyRequest.findFirst as jest.Mock).mockResolvedValue({
        id: "existing",
        status: "PENDING",
      });

      await expect(
        policyRequestService.createPolicyRequest(farmerId, tenantId, {
          policyPlanId: planId,
          landParcelId: parcelId,
        })
      ).rejects.toThrow("already have a pending request");
    });
  });

  describe("reviewPolicyRequest", () => {
    const requestId = "req-1";

    it("should approve a PENDING request (→ APPROVED)", async () => {
      (prisma.policyRequest.findFirst as jest.Mock).mockResolvedValue({
        id: requestId,
        tenantId,
        status: "PENDING",
        farmer: { userId: "farmer-user-id", fullName: "Test Farmer" },
      });
      (prisma.policyRequest.update as jest.Mock).mockResolvedValue({
        id: requestId,
        status: "APPROVED",
        reviewedByUserId: staffUserId,
      });

      const result = await policyRequestService.reviewPolicyRequest(
        requestId,
        tenantId,
        staffUserId,
        { status: "APPROVED", reviewNote: "Looks good" }
      );

      expect(result.status).toBe("APPROVED");
      expect(prisma.policyRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: requestId },
          data: expect.objectContaining({ status: "APPROVED" }),
        })
      );
    });

    it("should reject a PENDING request (→ REJECTED)", async () => {
      (prisma.policyRequest.findFirst as jest.Mock).mockResolvedValue({
        id: requestId,
        tenantId,
        status: "PENDING",
        farmer: { userId: "farmer-user-id", fullName: "Test Farmer" },
      });
      (prisma.policyRequest.update as jest.Mock).mockResolvedValue({
        id: requestId,
        status: "REJECTED",
      });

      const result = await policyRequestService.reviewPolicyRequest(
        requestId,
        tenantId,
        staffUserId,
        { status: "REJECTED", reviewNote: "Incomplete documentation" }
      );

      expect(result.status).toBe("REJECTED");
    });

    it("should reject reviewing a non-PENDING request", async () => {
      (prisma.policyRequest.findFirst as jest.Mock).mockResolvedValue({
        id: requestId,
        tenantId,
        status: "APPROVED",
        farmer: { userId: "farmer-user-id" },
      });

      await expect(
        policyRequestService.reviewPolicyRequest(requestId, tenantId, staffUserId, {
          status: "APPROVED",
        })
      ).rejects.toThrow("already APPROVED");
    });
  });

  describe("convertPolicyRequest", () => {
    const requestId = "req-1";

    it("should convert APPROVED request to Policy (→ CONVERTED)", async () => {
      const mockPolicy = { id: "policy-1", policyNumber: "POL-TEST-001", status: "ACTIVE" };

      (prisma.policyRequest.findFirst as jest.Mock).mockResolvedValue({
        id: requestId,
        tenantId,
        farmerId,
        landParcelId: parcelId,
        policyPlanId: planId,
        status: "APPROVED",
        convertedPolicyId: null,
        policyPlan: {
          name: "Wheat Plan",
          coveragePerAcre: 1000,
          premiumRate: 0.05,
          termMonths: 12,
        },
        landParcel: { areaAcres: 10, address: "Farm Address" },
        farmer: { userId, fullName: "Test Farmer" },
      });

      // Mock $transaction callback
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
        const tx = {
          policy: { create: jest.fn().mockResolvedValue(mockPolicy) },
          policyRequest: { update: jest.fn().mockResolvedValue({ id: requestId, status: "CONVERTED" }) },
        };
        return cb(tx);
      });

      const result = await policyRequestService.convertPolicyRequest(
        requestId,
        tenantId,
        staffUserId
      );

      expect(result).toEqual(mockPolicy);
      // Verify the transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("should reject converting a PENDING request", async () => {
      (prisma.policyRequest.findFirst as jest.Mock).mockResolvedValue({
        id: requestId,
        status: "PENDING",
        policyPlan: {},
        landParcel: {},
        farmer: {},
      });

      await expect(
        policyRequestService.convertPolicyRequest(requestId, tenantId, staffUserId)
      ).rejects.toThrow("Only approved requests");
    });

    it("should reject converting an already-converted request", async () => {
      (prisma.policyRequest.findFirst as jest.Mock).mockResolvedValue({
        id: requestId,
        status: "APPROVED",
        convertedPolicyId: "existing-policy-id",
        policyPlan: {},
        landParcel: {},
        farmer: {},
      });

      await expect(
        policyRequestService.convertPolicyRequest(requestId, tenantId, staffUserId)
      ).rejects.toThrow("already been converted");
    });
  });

  describe("listPolicyRequests", () => {
    it("should scope requests by farmerId when user is FARMER", async () => {
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue({
        id: farmerId,
        userId,
      });
      (prisma.policyRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.policyRequest.count as jest.Mock).mockResolvedValue(0);

      await policyRequestService.listPolicyRequests(
        userId,
        "FARMER",
        tenantId,
        1,
        20
      );

      expect(prisma.policyRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ farmerId }),
        })
      );
    });

    it("should return all tenant requests when user is STAFF", async () => {
      (prisma.policyRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.policyRequest.count as jest.Mock).mockResolvedValue(0);

      await policyRequestService.listPolicyRequests(
        "staff-id",
        "UNDERWRITER",
        tenantId,
        1,
        20
      );

      // Staff should NOT query farmer - just tenantId
      expect(prisma.farmer.findUnique).not.toHaveBeenCalled();
      expect(prisma.policyRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId },
        })
      );
    });

    it("should filter by status when provided", async () => {
      (prisma.policyRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.policyRequest.count as jest.Mock).mockResolvedValue(0);

      await policyRequestService.listPolicyRequests(
        "staff-id",
        "TENANT_ADMIN",
        tenantId,
        1,
        20,
        "PENDING"
      );

      expect(prisma.policyRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "PENDING" }),
        })
      );
    });
  });

  describe("getPolicyRequest", () => {
    it("should enforce tenant isolation", async () => {
      (prisma.policyRequest.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        policyRequestService.getPolicyRequest("req-1", "other-tenant")
      ).rejects.toThrow("Policy request not found");

      expect(prisma.policyRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1", tenantId: "other-tenant" },
        })
      );
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// 3. FRAUD PIPELINE ORDERING (sequential 3-tier)
// ═════════════════════════════════════════════════════════════════
describe("Fraud Pipeline — Sequential 3-Tier Ordering", () => {
  const claimId = "claim-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should execute Tier 1 (Sentinel) before Tier 2 (Weather) before Tier 3 (LLM)", async () => {
    // Setup base claim with all data needed for all 3 tiers
    (prisma.claim.findFirst as jest.Mock).mockResolvedValue({
      id: claimId,
      tenantId,
      fraudScore: 0,
      incidentDate: new Date("2024-06-01"),
      incidentLocation: "Test Location",
      policy: {
        landParcel: { latitude: 31.5, longitude: 74.3 },
      },
      farmer: { cnicNumber: "12345-6789012-3" },
      documents: [
        { id: "doc-1", url: "https://img.test/photo.jpg", type: "photo" },
        { id: "doc-2", url: "https://img.test/cnic.jpg", type: "photo" },
      ],
    });

    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      config: { fraudTier: "forge" },
    });

    // Mock Tier 1: Sentinel returns NDVI data (threshold NOT breached → fraud signal)
    mockCompareNDVI.mockResolvedValue({
      ndviPre: 0.7,
      ndviPost: 0.6,
      ndviDrop: 0.1,
      thresholdBreached: false,
    });

    // Mock Tier 2: Weather does NOT confirm severe event (fraud signal)
    mockCheckWeatherForClaim.mockResolvedValue({
      confirmed: false,
      event: undefined,
      method: "historical",
    });

    // Mock Tier 3: LLM says NO damage (fraud signal)
    mockAnalyzeWithFallback.mockResolvedValue({
      result: "NO, the field appears healthy with green vegetation.",
      modelUsed: "google/gemini-2.0-flash-001",
      fallbackUsed: false,
    });

    await fraudService.runAsyncFraudAnalysis(claimId, tenantId);

    // Verify execution order: Sentinel called before Weather
    const sentinelCallOrder = mockCompareNDVI.mock.invocationCallOrder[0];
    const weatherCallOrder = mockCheckWeatherForClaim.mock.invocationCallOrder[0];
    const llmCallOrder = mockAnalyzeWithFallback.mock.invocationCallOrder[0];

    expect(sentinelCallOrder).toBeLessThan(weatherCallOrder);
    expect(weatherCallOrder).toBeLessThan(llmCallOrder);

    // Verify Tier 3 prompt contains Sentinel + Weather context
    const llmPromptArg = mockAnalyzeWithFallback.mock.calls[0][1]; // Second arg = prompt
    expect(llmPromptArg).toContain("NDVI");
    expect(llmPromptArg).toContain("threshold breached");
    expect(llmPromptArg).toContain("Weather");
    expect(llmPromptArg).toContain("severe weather event");
  });

  it("should store tier-separated results in FraudAuditLog", async () => {
    (prisma.claim.findFirst as jest.Mock).mockResolvedValue({
      id: claimId,
      tenantId,
      fraudScore: 0,
      incidentDate: new Date("2024-06-01"),
      incidentLocation: "Test",
      policy: {
        landParcel: { latitude: 31.5, longitude: 74.3 },
      },
      farmer: { cnicNumber: "12345-6789012-3" },
      documents: [],
    });

    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      config: { fraudTier: "forge" },
    });

    mockCompareNDVI.mockResolvedValue({
      ndviPre: 0.8,
      ndviPost: 0.4,
      ndviDrop: 0.4,
      thresholdBreached: true,
    });

    mockCheckWeatherForClaim.mockResolvedValue({
      confirmed: true,
      event: "Thunderstorm",
      method: "historical",
    });

    await fraudService.runAsyncFraudAnalysis(claimId, tenantId);

    const auditLogData = (prisma.fraudAuditLog.create as jest.Mock).mock.calls[0][0].data;

    // Verify each tier's result is stored separately
    expect(auditLogData.sentinelResult).toBeDefined();
    expect(auditLogData.weatherResult).toBeDefined();
    expect(auditLogData.llmResult).toBeDefined();

    // Verify tier metadata
    expect(auditLogData.sentinelResult.tier).toBe(1);
    expect(auditLogData.sentinelResult.name).toBe("Satellite NDVI");
    expect(auditLogData.weatherResult.tier).toBe(2);
    expect(auditLogData.weatherResult.name).toBe("Weather Verification");
    expect(auditLogData.rawMetadata.pipeline).toBe("sequential-3-tier");
  });

  it("should handle missing Sentinel configuration gracefully", async () => {
    (prisma.claim.findFirst as jest.Mock).mockResolvedValue({
      id: claimId,
      tenantId,
      fraudScore: 0,
      incidentDate: new Date("2024-06-01"),
      incidentLocation: "Test",
      policy: { landParcel: null }, // No lat/lon → Sentinel skipped
      farmer: null,
      documents: [],
    });

    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      config: { fraudTier: "forge" },
    });

    await fraudService.runAsyncFraudAnalysis(claimId, tenantId);

    const auditLogData = (prisma.fraudAuditLog.create as jest.Mock).mock.calls[0][0].data;

    // Sentinel should be skipped, not errored
    expect(auditLogData.sentinelResult.skipped).toBe(true);
    expect(auditLogData.llmResult.skipped).toBe(true); // No documents
  });
});


