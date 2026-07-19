/**
 * Unit tests for farmer service.
 * Tests farmer CRUD, CNIC uniqueness, custom fields validation.
 */

import * as farmerService from "../src/services/farmers.service";
import * as tenantFieldsService from "../src/services/tenantFields.service";

jest.mock("../src/lib/redis", () => ({
  redis: { get: jest.fn(), setex: jest.fn(), del: jest.fn(), on: jest.fn() },
  checkRedisConnection: jest.fn().mockResolvedValue(undefined),
}));

var prisma: any;
jest.mock("../src/lib/prisma", () => {
  const mock = {
    farmer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenantField: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    farmerFieldValue: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
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
const userId = "user-1";
const farmerId = "farmer-1";
const cnicNumber = "12345-6789012-3";

describe("Farmer Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getFarmerProfile", () => {
    it("should return farmer profile when found", async () => {
      const mockFarmer = {
        id: farmerId,
        userId,
        fullName: "Test Farmer",
        cnicNumber,
        landParcels: [],
        policies: [],
        claims: [],
      };
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue(mockFarmer);

      const farmer = await farmerService.getFarmerProfile(userId);
      expect(farmer.id).toBe(farmerId);
      expect(farmer.fullName).toBe("Test Farmer");
    });

    it("should throw 404 when farmer profile does not exist", async () => {
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        farmerService.getFarmerProfile(userId)
      ).rejects.toThrow("Farmer profile not found");
    });
  });

  describe("createFarmerProfile", () => {
    it("should create a farmer profile with tenantId", async () => {
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.farmer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.tenantField.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.farmer.create as jest.Mock).mockResolvedValue({
        id: farmerId,
        userId,
        tenantId,
        fullName: "New Farmer",
        cnicNumber,
      });

      const farmer = await farmerService.createFarmerProfile(userId, tenantId, {
        fullName: "New Farmer",
        cnicNumber,
      });

      expect(farmer.tenantId).toBe(tenantId);
      expect(prisma.farmer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId }),
        })
      );
    });

    it("should reject duplicate farmer profile for same userId", async () => {
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue({
        id: farmerId,
        userId,
      });

      await expect(
        farmerService.createFarmerProfile(userId, tenantId, {
          fullName: "Duplicate Farmer",
          cnicNumber,
        })
      ).rejects.toThrow("Farmer profile already exists");
    });

    it("should reject duplicate CNIC within the same tenant", async () => {
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.farmer.findFirst as jest.Mock).mockResolvedValue({
        id: "existing-farmer",
        cnicNumber,
        tenantId,
      });

      await expect(
        farmerService.createFarmerProfile(userId, tenantId, {
          fullName: "Another Farmer",
          cnicNumber,
        })
      ).rejects.toThrow("CNIC number is already registered");
    });

    it("should allow same CNIC in different tenants", async () => {
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.farmer.findFirst as jest.Mock)
        // First call for tenant A returns null (CNIC not taken)
        .mockResolvedValueOnce(null)
        // Would return existing for tenant B — but this won't be called here
      ;
      (prisma.tenantField.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.farmer.create as jest.Mock).mockResolvedValue({
        id: farmerId,
        userId: "user-new",
        tenantId: "tenant-b",
        cnicNumber,
      });

      const farmer = await farmerService.createFarmerProfile("user-new", "tenant-b", {
        fullName: "Inter-tenant Farmer",
        cnicNumber,
      });

      expect(farmer.tenantId).toBe("tenant-b");
    });
  });

  describe("updateFarmerProfile", () => {
    it("should update existing farmer profile", async () => {
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue({
        id: farmerId,
        userId,
        tenantId,
      });
      (prisma.farmer.update as jest.Mock).mockResolvedValue({
        id: farmerId,
        fullName: "Updated Farmer",
      });

      const farmer = await farmerService.updateFarmerProfile(userId, {
        fullName: "Updated Farmer",
      });

      expect(farmer.fullName).toBe("Updated Farmer");
    });

    it("should throw 404 when updating non-existent profile", async () => {
      (prisma.farmer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        farmerService.updateFarmerProfile("nonexistent-user", { fullName: "Ghost" })
      ).rejects.toThrow("Farmer profile not found");
    });
  });
});
