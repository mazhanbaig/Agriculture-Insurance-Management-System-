import app from "../src/server";
import request from "supertest";

jest.mock("../src/lib/redis", () => ({
  redis: { get: jest.fn(), setex: jest.fn(), del: jest.fn(), on: jest.fn() },
  checkRedisConnection: jest.fn().mockResolvedValue(undefined),
}));

const mockDb: Record<string, any> = {};

function mockResolvedValue(val: any) {
  return jest.fn().mockResolvedValue(val);
}

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    tenant: { findUnique: mockResolvedValue({ id: "t1", config: {} }), findFirst: mockResolvedValue(null) },
    user: { findUnique: mockResolvedValue({ id: "u1", tenantId: "t1", email: "test@test.com" }), findFirst: mockResolvedValue(null) },
    farmer: { findUnique: mockResolvedValue(null) },
    landParcel: { findMany: mockResolvedValue([]) },
    policyPlan: { findUnique: mockResolvedValue({ id: "pp1", name: "Test Plan", cropType: "Wheat", coveragePerAcre: 50000, premiumRate: 0.05, termMonths: 6 }), findMany: mockResolvedValue([]), count: mockResolvedValue(0) },
    policy: { findUnique: mockResolvedValue(null), findFirst: mockResolvedValue(null), findMany: mockResolvedValue([]), count: mockResolvedValue(0), update: mockResolvedValue({}) },
    claim: { findUnique: mockResolvedValue(null), findFirst: mockResolvedValue(null), findMany: mockResolvedValue([]), count: mockResolvedValue(0) },
    claimDocument: { findUnique: mockResolvedValue(null), findFirst: mockResolvedValue(null), findMany: mockResolvedValue([]), update: mockResolvedValue({}) },
    claimStatusHistory: { create: mockResolvedValue({}) },
    conversation: { findUnique: mockResolvedValue(null), findFirst: mockResolvedValue({ id: "conv1", claimId: "c1", tenantId: "t1", messages: [] }), create: mockResolvedValue({ id: "conv1", claimId: "c1", tenantId: "t1", title: "Test", messages: [] }), findMany: mockResolvedValue([]), count: mockResolvedValue(0), update: mockResolvedValue({}) },
    message: { create: mockResolvedValue({ id: "msg1", conversationId: "conv1", senderId: "u1", content: "hello", createdAt: new Date() }), findMany: mockResolvedValue([]), count: mockResolvedValue(0) },
    visit: { create: mockResolvedValue({ id: "v1", claimId: "c1", tenantId: "t1", assignedToId: "u1", status: "SCHEDULED" }), findUnique: mockResolvedValue({ id: "v1", claimId: "c1", tenantId: "t1", assignedToId: "u1" }), findFirst: mockResolvedValue(null), findMany: mockResolvedValue([]), count: mockResolvedValue(0), update: mockResolvedValue({ id: "v1", status: "COMPLETED" }) },
    damageAssessment: { findUnique: mockResolvedValue(null), findFirst: mockResolvedValue(null), create: mockResolvedValue({ id: "da1" }), update: mockResolvedValue({}) },
    fraudAuditLog: { create: mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((queries: any[]) => Promise.resolve(queries.map(() => ({ count: 0 })))),
  },
}));

jest.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } },
}));

jest.mock("../src/lib/bullmq", () => ({
  notificationQueue: { add: jest.fn() },
  ocrQueue: { add: jest.fn() },
  importQueue: { add: jest.fn() },
  fraudQueue: { add: jest.fn() },
  autoTriggerQueue: { add: jest.fn() },
  createOcrWorker: jest.fn(),
  createNotificationWorker: jest.fn(),
  createImportWorker: jest.fn(),
}));

jest.mock("../src/lib/cloudinary", () => ({
  cloudinary: { uploader: { upload: jest.fn(), destroy: jest.fn() } },
}));

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../src/lib/socket", () => ({
  getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) })),
  initSocket: jest.fn(),
  sendToUser: jest.fn(),
  sendToClaim: jest.fn(),
  sendToTenant: jest.fn(),
  notifyFraudUpdate: jest.fn(),
}));

describe("Chat System", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/v1/chat/conversations");
    expect(res.status).toBe(401);
  });

  it("should return 401 for message list without auth", async () => {
    const res = await request(app).get("/api/v1/chat/conversations/conv1/messages");
    expect(res.status).toBe(401);
  });
});

describe("Visit System", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/v1/visits");
    expect(res.status).toBe(401);
  });
});

describe("Damage Assessment", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/v1/damage/c1");
    expect(res.status).toBe(401);
  });

  it("should return 401 for calculate without auth", async () => {
    const res = await request(app).post("/api/v1/damage/calculate/c1");
    expect(res.status).toBe(401);
  });
});

describe("Export Endpoints", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/v1/import/export/farmers");
    expect(res.status).toBe(401);
  });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/v1/import/export/claims");
    expect(res.status).toBe(401);
  });
});

describe("Service Module Integrity", () => {
  it("should import forensics service", () => {
    expect(() => require("../src/services/forensics.service")).not.toThrow();
  });

  it("should import chat service", () => {
    expect(() => require("../src/services/chat.service")).not.toThrow();
  });

  it("should import visit service", () => {
    expect(() => require("../src/services/visit.service")).not.toThrow();
  });

  it("should import damage service", () => {
    expect(() => require("../src/services/damage.service")).not.toThrow();
  });

  it("should import socket lib", () => {
    expect(() => require("../src/lib/socket")).not.toThrow();
  });
});
