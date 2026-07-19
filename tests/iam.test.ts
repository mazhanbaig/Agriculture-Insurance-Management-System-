/**
 * Unit tests for IAM service.
 * Tests custom role CRUD, permission resolution, and role assignment.
 */

import * as iamService from "../src/services/iam.service";
import { PERMISSIONS } from "../src/config/permissions";

// Mock Prisma
jest.mock("../src/lib/redis", () => ({
  redis: { get: jest.fn(), setex: jest.fn(), del: jest.fn(), on: jest.fn() },
  checkRedisConnection: jest.fn().mockResolvedValue(undefined),
}));

var prisma: any;
jest.mock("../src/lib/prisma", () => {
  const mock = {
    customRole: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
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
const roleId = "role-1";
const userId = "user-1";

describe("IAM Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listCustomRoles", () => {
    it("should list custom roles scoped by tenantId", async () => {
      const mockRoles = [{ id: roleId, name: "claims-manager", tenantId }];
      (prisma.customRole.findMany as jest.Mock).mockResolvedValue(mockRoles);

      const roles = await iamService.listCustomRoles(tenantId);
      expect(roles).toEqual(mockRoles);
      expect(prisma.customRole.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId } })
      );
    });
  });

  describe("createCustomRole", () => {
    it("should create a custom role with valid permissions", async () => {
      (prisma.customRole.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.customRole.create as jest.Mock).mockResolvedValue({
        id: roleId,
        tenantId,
        name: "claims-reviewer",
        permissions: [PERMISSIONS.CLAIM_VIEW_TENANT, PERMISSIONS.CLAIM_REVIEW],
      });

      const role = await iamService.createCustomRole(tenantId, {
        name: "claims-reviewer",
        permissions: [PERMISSIONS.CLAIM_VIEW_TENANT, PERMISSIONS.CLAIM_REVIEW],
      });
      expect(role.id).toBe(roleId);
    });

    it("should reject invalid permissions", async () => {
      await expect(
        iamService.createCustomRole(tenantId, {
          name: "hacker-role",
          permissions: ["invalid:permission:xyz"],
        })
      ).rejects.toThrow("Invalid permissions");
    });

    it("should reject duplicate role names within same tenant", async () => {
      (prisma.customRole.findUnique as jest.Mock).mockResolvedValue({
        id: "existing",
        tenantId,
        name: "claims-reviewer",
      });

      await expect(
        iamService.createCustomRole(tenantId, {
          name: "claims-reviewer",
          permissions: [PERMISSIONS.CLAIM_VIEW_TENANT],
        })
      ).rejects.toThrow("already exists");
    });
  });

  describe("deleteCustomRole", () => {
    it("should delete a custom role with no assigned users", async () => {
      (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({
        id: roleId,
        tenantId,
        name: "test-role",
      });
      (prisma.user.count as jest.Mock).mockResolvedValue(0);
      (prisma.customRole.delete as jest.Mock).mockResolvedValue({ id: roleId });

      await iamService.deleteCustomRole(roleId, tenantId);
      expect(prisma.customRole.delete).toHaveBeenCalledWith({ where: { id: roleId } });
    });

    it("should NOT delete a role that has assigned users", async () => {
      (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({
        id: roleId,
        tenantId,
        name: "test-role",
      });
      (prisma.user.count as jest.Mock).mockResolvedValue(3);

      await expect(
        iamService.deleteCustomRole(roleId, tenantId)
      ).rejects.toThrow("3 user(s) are assigned");
    });
  });

  describe("assignCustomRole", () => {
    it("should assign a custom role to a user", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: userId,
        tenantId,
        role: "UNDERWRITER",
      });
      (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({
        id: roleId,
        tenantId,
        isActive: true,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: userId,
        email: "user@test.com",
        role: "UNDERWRITER",
        customRoleId: roleId,
      });

      await iamService.assignCustomRole(userId, roleId, tenantId);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { customRoleId: roleId },
        })
      );
    });

    it("should clear a custom role assignment when passing null", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: userId,
        tenantId,
        role: "UNDERWRITER",
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: userId, customRoleId: null,
      });

      await iamService.assignCustomRole(userId, null, tenantId);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { customRoleId: null },
        })
      );
    });

    it("should NOT allow assigning custom roles to PLATFORM_ADMIN", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: userId,
        tenantId,
        role: "PLATFORM_ADMIN",
      });

      await expect(
        iamService.assignCustomRole(userId, roleId, tenantId)
      ).rejects.toThrow("Cannot assign custom role to platform admins");
    });

    it("should NOT allow assigning an inactive custom role", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: userId,
        tenantId,
        role: "UNDERWRITER",
      });
      (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({
        id: roleId,
        tenantId,
        isActive: false,
      });

      await expect(
        iamService.assignCustomRole(userId, roleId, tenantId)
      ).rejects.toThrow("inactive");
    });
  });

  describe("resolveUserPermissions", () => {
    it("should return all permissions for PLATFORM_ADMIN", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        role: "PLATFORM_ADMIN",
        customRole: null,
      });

      const permissions = await iamService.resolveUserPermissions(userId);
      expect(permissions).toEqual(Object.values(PERMISSIONS));
    });

    it("should return custom role permissions when user has a custom role", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        role: "UNDERWRITER",
        customRole: { id: roleId, isActive: true, permissions: ["claim:view:tenant", "claim:review"] },
      });

      const permissions = await iamService.resolveUserPermissions(userId);
      expect(permissions).toContain("claim:view:tenant");
      expect(permissions).toContain("claim:review");
      expect(permissions).not.toContain("claim:approve");
    });

    it("should fall back to built-in role defaults when no custom role", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        role: "FARMER",
        customRole: null,
      });

      const permissions = await iamService.resolveUserPermissions(userId);
      expect(permissions).toContain("claim:view:own");
      expect(permissions).toContain("policy:purchase");
      expect(permissions).not.toContain("claim:approve");
    });
  });

  describe("getAllPermissions", () => {
    it("should return all permissions with categories", () => {
      const allPerms = iamService.getAllPermissions();
      expect(allPerms.length).toBeGreaterThan(30);
      expect(allPerms[0]).toHaveProperty("key");
      expect(allPerms[0]).toHaveProperty("value");
      expect(allPerms[0]).toHaveProperty("category");
    });
  });
});
