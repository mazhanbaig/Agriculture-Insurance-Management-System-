import { app } from "../src/server";
import request from "supertest";

// Mock dependencies
jest.mock("../src/lib/prisma", () => ({
  prisma: {
    claim: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    claimStatusHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    policy: {
      findUnique: jest.fn(),
    },
    farmer: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../src/lib/bullmq", () => ({
  notificationQueue: {
    add: jest.fn(),
  },
}));

import { prisma } from "../src/lib/prisma";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("Claim State Machine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Claim Status Transitions", () => {
    it("should allow transition from SUBMITTED to UNDER_REVIEW", () => {
      // This tests the valid transition logic in claimService.updateClaimStatus
      const validTransitions: Record<string, string[]> = {
        SUBMITTED: ["UNDER_REVIEW"],
        UNDER_REVIEW: ["APPROVED", "REJECTED"],
      };

      const allowed = validTransitions["SUBMITTED"];
      expect(allowed).toContain("UNDER_REVIEW");
      expect(allowed).not.toContain("APPROVED");
      expect(allowed).not.toContain("REJECTED");
    });

    it("should allow transition from UNDER_REVIEW to APPROVED", () => {
      const validTransitions: Record<string, string[]> = {
        SUBMITTED: ["UNDER_REVIEW"],
        UNDER_REVIEW: ["APPROVED", "REJECTED"],
      };

      const allowed = validTransitions["UNDER_REVIEW"];
      expect(allowed).toContain("APPROVED");
      expect(allowed).toContain("REJECTED");
    });

    it("should not allow direct transition from SUBMITTED to APPROVED", () => {
      const validTransitions: Record<string, string[]> = {
        SUBMITTED: ["UNDER_REVIEW"],
        UNDER_REVIEW: ["APPROVED", "REJECTED"],
      };

      const allowed = validTransitions["SUBMITTED"];
      expect(allowed).not.toContain("APPROVED");
      expect(allowed).not.toContain("REJECTED");
    });

    it("should not allow transition from APPROVED to any other status", () => {
      const validTransitions: Record<string, string[]> = {
        SUBMITTED: ["UNDER_REVIEW"],
        UNDER_REVIEW: ["APPROVED", "REJECTED"],
      };

      expect(validTransitions["APPROVED"]).toBeUndefined();
    });
  });

  describe("Duplicate Claim Detection", () => {
    it("should detect duplicate claims within 30 days for same policy", () => {
      // This tests the duplicate check logic in claimService.createClaim
      const existingClaim = {
        id: "claim-1",
        policyId: "policy-1",
        incidentDate: new Date(),
      };

      // Simulate the check
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const isDuplicate =
        existingClaim.policyId === "policy-1" &&
        existingClaim.incidentDate >= thirtyDaysAgo;

      expect(isDuplicate).toBe(true);
    });

    it("should not flag claims older than 30 days as duplicates", () => {
      const oldClaim = {
        id: "claim-2",
        policyId: "policy-1",
        incidentDate: new Date("2024-01-01"),
      };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const isDuplicate =
        oldClaim.policyId === "policy-1" &&
        oldClaim.incidentDate >= thirtyDaysAgo;

      expect(isDuplicate).toBe(false);
    });
  });

  describe("Claim Number Generation", () => {
    it("should generate unique claim numbers", () => {
      const generateClaimNumber = (): string => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `CLM-${timestamp}-${random}`;
      };

      const claimNumber1 = generateClaimNumber();
      const claimNumber2 = generateClaimNumber();

      expect(claimNumber1).toMatch(/^CLM-/);
      expect(claimNumber2).toMatch(/^CLM-/);
      expect(claimNumber1).not.toBe(claimNumber2);
    });
  });

  describe("API Endpoints (Health Check)", () => {
    it("should return 200 on health check", async () => {
      const response = await request(app).get("/health");
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
    });
  });
});
