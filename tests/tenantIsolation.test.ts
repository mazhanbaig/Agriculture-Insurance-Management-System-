import * as claimService from "../src/services/claims.service";
import * as policyPlanService from "../src/services/policyPlans.service";
import * as paymentsService from "../src/services/payments.service";
import * as adminService from "../src/services/admin.service";
import * as landParcelService from "../src/services/landParcels.service";
import * as farmerService from "../src/services/farmers.service";
import * as policyService from "../src/services/policies.service";

// Mock Redis
jest.mock("../src/lib/redis", () => ({
  redis: { get: jest.fn(), setex: jest.fn(), del: jest.fn(), on: jest.fn() },
  checkRedisConnection: jest.fn().mockResolvedValue(undefined),
}));

// Mock Prisma — define the mock object INSIDE the factory to avoid hoisting issues
// Use var instead of let/const to avoid temporal dead zone during jest.mock hoisting
var prisma: any;
jest.mock("../src/lib/prisma", () => {
  const mock = {
    tenant: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    farmer: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    landParcel: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    policyPlan: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    policy: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    claim: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    claimStatusHistory: { create: jest.fn(), findMany: jest.fn() },
    claimDocument: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
    fraudAuditLog: { create: jest.fn(), findMany: jest.fn() },
    payment: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), aggregate: jest.fn() },
    notification: { create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    tenantField: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
    farmerFieldValue: { findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
    usageLog: { create: jest.fn(), findMany: jest.fn() },
    customRole: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    $transaction: jest.fn().mockImplementation((queries: any[]) => Promise.resolve(queries.map(() => ({ count: 0 })))),
  };
  prisma = mock;
  return { prisma: mock };
});

// Mock Supabase to prevent initialization errors
jest.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

// Mock BullMQ
jest.mock("../src/lib/bullmq", () => ({
  notificationQueue: { add: jest.fn() },
  ocrQueue: { add: jest.fn() },
  importQueue: { add: jest.fn() },
  fraudQueue: { add: jest.fn() },
  createOcrWorker: jest.fn(),
  createNotificationWorker: jest.fn(),
  createImportWorker: jest.fn(),
}));

// Mock Cloudinary
jest.mock("../src/lib/cloudinary", () => ({
  cloudinary: { uploader: { upload: jest.fn(), destroy: jest.fn() } },
}));

describe("Tenant Isolation", () => {
  const tenantA = "tenant-a-id";
  const tenantB = "tenant-b-id";
  const farmerAId = "farmer-a-id";
  const farmerBId = "farmer-b-id";
  const policyAPlanId = "plan-a-id";
  const claimAId = "claim-a-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Farmer Service Isolation", () => {
    it("should enforce tenantId when creating farmers (CNIC uniqueness per tenant)", async () => {
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.farmer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.farmer.create as jest.Mock).mockResolvedValue({
        id: "new-farmer",
        userId: "user-1",
        tenantId: tenantA,
      });

      await farmerService.createFarmerProfile("user-1", tenantA, {
        fullName: "Farmer A",
        cnicNumber: "12345",
      });

      expect(prisma.farmer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: tenantA }),
        })
      );
    });

    it("should check CNIC uniqueness within the same tenant", async () => {
      const mockFindFirst = jest.fn().mockImplementation(
        ({ where: { cnicNumber, tenantId } }: any) => {
          if (cnicNumber === "12345" && tenantId === tenantA) {
            return { id: "existing", cnicNumber: "12345", tenantId };
          }
          return null;
        }
      );
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.farmer.findFirst as jest.Mock).mockImplementation(mockFindFirst);

      await expect(
        farmerService.createFarmerProfile("user-2", tenantA, {
          fullName: "Duplicate Farmer",
          cnicNumber: "12345",
        })
      ).rejects.toThrow("CNIC");
    });
  });

  describe("Land Parcel Service Isolation", () => {
    it("should enforce tenantId when creating land parcels", async () => {
      (prisma.landParcel.create as jest.Mock).mockResolvedValue({
        id: "parcel-1",
        farmerId: farmerAId,
        tenantId: tenantA,
      });

      await landParcelService.createLandParcel(farmerAId, tenantA, {
        address: "Test Address",
        areaAcres: 10,
        cropType: "Wheat",
      });

      expect(prisma.landParcel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: tenantA }),
        })
      );
    });

    it("should scope getLandParcels by tenantId", async () => {
      (prisma.landParcel.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.landParcel.count as jest.Mock).mockResolvedValue(0);

      await landParcelService.getLandParcels(farmerAId, tenantA, 1, 20);

      expect(prisma.landParcel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA, farmerId: farmerAId }),
        })
      );
    });
  });

  describe("Policy Plan Service Isolation", () => {
    it("should scope listPolicyPlans by tenantId", async () => {
      (prisma.policyPlan.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.policyPlan.count as jest.Mock).mockResolvedValue(0);

      await policyPlanService.listPolicyPlans(tenantA, 1, 20);

      expect(prisma.policyPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA }),
        })
      );
    });

    it("should scope getPolicyPlan by tenantId (tenant B cannot access tenant A's plan)", async () => {
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: policyAPlanId,
        tenantId: tenantA,
        isActive: true,
        coveragePerAcre: 1000,
        premiumRate: 0.05,
        termMonths: 12,
        name: "Plan A",
        cropType: "Wheat",
      });

      const plan = await policyPlanService.getPolicyPlan(policyAPlanId, tenantA);
      expect(plan).toBeDefined();

      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        policyPlanService.getPolicyPlan(policyAPlanId, tenantB)
      ).rejects.toThrow("Policy plan not found");
    });

    it("should scope createPolicyPlan by tenantId", async () => {
      (prisma.policyPlan.create as jest.Mock).mockResolvedValue({
        id: "new-plan",
        tenantId: tenantA,
      });

      await policyPlanService.createPolicyPlan(tenantA, {
        name: "Test Plan",
        cropType: "Wheat",
        coveragePerAcre: 1000,
        premiumRate: 0.05,
        termMonths: 12,
      });

      expect(prisma.policyPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: tenantA }),
        })
      );
    });
  });

  describe("Policies Service Isolation", () => {
    it("should scope purchasePolicy by tenantId", async () => {
      (prisma.landParcel.findFirst as jest.Mock).mockResolvedValue({
        id: "parcel-1",
        farmerId: farmerAId,
        tenantId: tenantA,
        areaAcres: 10,
      });
      (prisma.policyPlan.findFirst as jest.Mock).mockResolvedValue({
        id: "plan-1",
        tenantId: tenantA,
        isActive: true,
        coveragePerAcre: 1000,
        premiumRate: 0.05,
        termMonths: 12,
      });
      (prisma.policy.create as jest.Mock).mockResolvedValue({
        id: "policy-1",
        tenantId: tenantA,
      });

      await policyService.purchasePolicy(farmerAId, tenantA, {
        policyPlanId: "plan-1",
        landParcelId: "parcel-1",
        startDate: new Date().toISOString(),
      });

      expect(prisma.policy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: tenantA }),
        })
      );
    });

    it("should scope getPolicy by tenantId", async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: "policy-1",
        tenantId: tenantA,
      });

      const policy = await policyService.getPolicy("policy-1", tenantA);
      expect(policy).toBeDefined();
    });
  });

  describe("Claim Service Isolation", () => {
    it("should scope createClaim by tenantId", async () => {
      (prisma.policy.findFirst as jest.Mock).mockResolvedValue({
        id: "policy-1",
        farmerId: farmerAId,
        tenantId: tenantA,
        status: "ACTIVE",
      });
      (prisma.claim.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.claim.create as jest.Mock).mockResolvedValue({
        id: claimAId,
        claimNumber: "CLM-TEST-001",
        tenantId: tenantA,
      });
      (prisma.claimStatusHistory.create as jest.Mock).mockResolvedValue({});

      await claimService.createClaim(farmerAId, tenantA, "user-1", {
        policyId: "policy-1",
        incidentType: "Flood",
        incidentDate: new Date().toISOString(),
        description: "Test flood damage",
        claimedAmount: 50000,
      });

      expect(prisma.claim.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: tenantA }),
        })
      );
    });

    it("should scope listAllClaims by tenantId", async () => {
      (prisma.claim.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.claim.count as jest.Mock).mockResolvedValue(0);

      await claimService.listAllClaims(tenantA, 1, 20);

      expect(prisma.claim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA }),
        })
      );
    });
  });

  describe("Payments Service Isolation", () => {
    it("should scope getPaymentsForPolicy by tenantId", async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      await paymentsService.getPaymentsForPolicy("policy-1", tenantA);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { policyId: "policy-1", tenantId: tenantA },
        })
      );
    });

    it("should scope getPaymentsForClaim by tenantId", async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      await paymentsService.getPaymentsForClaim(claimAId, tenantA);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { claimId: claimAId, tenantId: tenantA },
        })
      );
    });
  });

  describe("Admin Service Isolation", () => {
    it("should scope listStaffUsers by tenantId", async () => {
      const mockStaff = [
        { id: "staff-1", email: "staff@tenant-a.com", role: "UNDERWRITER" },
      ];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockStaff);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const result = await adminService.listStaffUsers(tenantA, 1, 20);
      expect(result.users).toEqual(mockStaff);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA }),
        })
      );
    });

    it("should scope getDashboardAggregates by tenantId", async () => {
      (prisma.farmer.count as jest.Mock).mockResolvedValue(5);
      (prisma.policy.count as jest.Mock).mockResolvedValue(10);
      (prisma.claim.count as jest.Mock).mockResolvedValue(3);
      (prisma.payment.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 10000 },
      });

      await adminService.getDashboardAggregates(tenantA);

      const farmerCallArgs = (prisma.farmer.count as jest.Mock).mock.calls[0][0];
      expect(farmerCallArgs).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA }),
        })
      );
    });

    it("should scope toggleUserStatus by tenantId (tenant B cannot toggle tenant A's user)", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: "user-1",
        tenantId: tenantA,
        isActive: true,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: "user-1",
        isActive: false,
      });

      await adminService.toggleUserStatus("user-1", tenantA);
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1", tenantId: tenantA },
        })
      );

      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        adminService.toggleUserStatus("user-1", tenantB)
      ).rejects.toThrow("User not found");
    });
  });

  describe("Role Guard Logic", () => {
    it("should allow PLATFORM_ADMIN to bypass tenant access checks", () => {
      const guard = (req: any, next: any) => {
        if (req.user?.role === "PLATFORM_ADMIN") { next(); return; }
        if (req.tenant && req.user?.tenantId !== req.tenant?.id) {
          next(new Error("Access denied. User does not belong to this tenant."));
          return;
        }
        next();
      };

      const mockReq = {
        user: { id: "admin-1", role: "PLATFORM_ADMIN", tenantId: tenantA },
        tenant: { id: tenantB },
      };
      const nextMock = jest.fn();
      guard(mockReq, nextMock);
      expect(nextMock).toHaveBeenCalledWith();
    });

    it("should block FARMER from accessing another tenant's resources", () => {
      const guard = (req: any, next: any) => {
        if (req.user?.role === "PLATFORM_ADMIN") { next(); return; }
        if (req.tenant && req.user?.tenantId !== req.tenant?.id) {
          next(new Error("Access denied."));
          return;
        }
        next();
      };

      const mockReq = {
        user: { id: "farmer-1", role: "FARMER", tenantId: tenantA },
        tenant: { id: tenantB },
      };
      const nextMock = jest.fn();
      guard(mockReq, nextMock);
      expect(nextMock).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
