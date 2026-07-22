/**
 * Unit tests for billing markup math.
 * Tests the flat 10% markup on rawCost in logUsage.
 * This is a separate file so we can import the real usage.service
 * without the mock interference from other test files.
 */

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

jest.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } },
}));

var prisma: any;
jest.mock("../src/lib/prisma", () => {
  const mock = {
    usageLog: { create: jest.fn(), findMany: jest.fn() },
    tenant: { findUnique: jest.fn() },
  };
  prisma = mock;
  return { prisma: mock };
});

// Import the REAL logUsage implementation
import { logUsage } from "../src/services/usage.service";

const tenantId = "test-tenant-id";

describe("Billing Markup — Flat 10%", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should compute billedCost as rawCost × 1.10 rounded to cents", async () => {
    (prisma.usageLog.create as jest.Mock).mockResolvedValue({});

    // FORGE tier: openrouter imageCostPerCall = $0.001
    await logUsage({
      tenantId,
      service: "openrouter",
      tier: "forge",
      quantity: 1,
    });

    expect(prisma.usageLog.create).toHaveBeenCalled();
    const createCall = (prisma.usageLog.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.rawCost).toBe(0.001);
    expect(createCall.data.billedCost).toBe(0.0011); // 0.001 × 1.10
  });

  it("should handle multiple quantity correctly", async () => {
    (prisma.usageLog.create as jest.Mock).mockResolvedValue({});

    // FORGE tier: sentinel satelliteCostPerCall = $0.02, quantity = 3
    await logUsage({
      tenantId,
      service: "sentinel",
      tier: "forge",
      quantity: 3,
    });

    const createCall = (prisma.usageLog.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.rawCost).toBe(0.06); // 0.02 × 3
    expect(createCall.data.billedCost).toBe(0.066); // 0.06 × 1.10
  });

  it("should correctly calculate markup = billedCost - rawCost", async () => {
    (prisma.usageLog.create as jest.Mock).mockResolvedValue({});

    // TITAN tier: openrouter imageCostPerCall = $0.005
    await logUsage({
      tenantId,
      service: "openrouter",
      tier: "titan",
    });

    const createCall = (prisma.usageLog.create as jest.Mock).mock.calls[0][0];
    const rawCost = createCall.data.rawCost;
    const billedCost = createCall.data.billedCost;
    const markup = createCall.data.markup;

    expect(rawCost).toBe(0.005);
    expect(billedCost).toBe(0.0055); // 0.005 × 1.10
    expect(markup).toBeCloseTo(0.0005, 6); // billedCost - rawCost
  });

  it("should handle GOAT tier costs correctly", async () => {
    (prisma.usageLog.create as jest.Mock).mockResolvedValue({});

    await logUsage({
      tenantId,
      service: "openrouter",
      tier: "goat",
    });

    const createCall = (prisma.usageLog.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.rawCost).toBe(0.015);
    expect(createCall.data.billedCost).toBe(0.0165); // 0.015 × 1.10
  });

  it("should populate both old (cost/totalCost) and new (rawCost/billedCost) fields", async () => {
    (prisma.usageLog.create as jest.Mock).mockResolvedValue({});

    await logUsage({
      tenantId,
      service: "openweather",
      tier: "forge",
    });

    const createCall = (prisma.usageLog.create as jest.Mock).mock.calls[0][0];
    // Old fields populated for backward compat
    expect(createCall.data.cost).toBe(0.001); // weatherCostPerCall
    expect(createCall.data.totalCost).toBe(0.0011); // 0.001 × 1.10
    // New fields
    expect(createCall.data.rawCost).toBe(0.001);
    expect(createCall.data.billedCost).toBe(0.0011);
  });

  it("should skip logging if tier is not found", async () => {
    (prisma.usageLog.create as jest.Mock).mockResolvedValue({});

    await logUsage({
      tenantId,
      service: "openrouter",
      tier: "nonexistent",
    });

    expect(prisma.usageLog.create).not.toHaveBeenCalled();
  });

  it("should use correct per-unit costs from FRAUD_TIERS config", async () => {
    (prisma.usageLog.create as jest.Mock).mockResolvedValue({});

    // FORGE: satelliteCostPerCall = $0.02
    await logUsage({
      tenantId,
      service: "sentinel",
      tier: "forge",
      quantity: 5,
    });

    const createCall = (prisma.usageLog.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.rawCost).toBe(0.10); // 0.02 × 5
    expect(createCall.data.billedCost).toBe(0.11); // 0.10 × 1.10
  });
});
