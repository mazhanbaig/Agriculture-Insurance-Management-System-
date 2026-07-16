import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  prisma = globalForPrisma.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
}

export { prisma };

/**
 * Creates a PrismaClient configured with the Neon serverless driver adapter.
 * Used in production to handle Neon's auto-suspend and connection limits.
 */
export async function getNeonPrisma(): Promise<PrismaClient> {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  // Use Prisma client with Neon serverless connection
  try {
    // Dynamic path to avoid TypeScript static module resolution
    const adapterPath = "@neondatabase/serverless/prisma";
    const { PrismaNeon } = await import(adapterPath);
    const adapter = new PrismaNeon(sql);
    return new PrismaClient({ adapter });
  } catch {
    // Fall back to standard PrismaClient if Neon adapter is not available
    return new PrismaClient();
  }
}
