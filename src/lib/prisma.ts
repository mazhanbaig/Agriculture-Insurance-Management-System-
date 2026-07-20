import "dotenv/config";
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Initialize the Neon serverless adapter and create PrismaClient.
 * Prisma 7 requires an adapter when the schema datasource has no `url` field.
 * Uses require() so TypeScript's narrowed neon() declaration is bypassed —
 * the runtime function accepts 1 or 2 arguments.
 */
function createPrismaClient(): PrismaClient {
  const { neon } = require("@neondatabase/serverless");
  const { PrismaNeonHttp } = require("@prisma/adapter-neon");
  const sql = neon(process.env.DATABASE_URL!);
  const adapter = new PrismaNeonHttp(sql);
  return new PrismaClient({ adapter });
}

if (process.env.NODE_ENV === "production") {
  prisma = createPrismaClient();
} else {
  prisma = globalForPrisma.prisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
}

export { prisma };

/**
 * Creates a PrismaClient configured with the Neon serverless driver adapter.
 * Used in production to handle Neon's auto-suspend and connection limits.
 * Delegates to createPrismaClient() to avoid duplicating the adapter setup.
 * The async wrapper is required by the server.ts call site.
 */
export async function getNeonPrisma(): Promise<PrismaClient> {
  return createPrismaClient();
}
