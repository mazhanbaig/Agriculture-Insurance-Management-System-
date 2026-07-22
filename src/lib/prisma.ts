import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let prisma: PrismaClient;

/**
 * Create a PrismaClient with the Neon serverless adapter.
 * Uses try/catch with a standard PrismaClient fallback so the
 * application never crashes on startup due to adapter issues.
 *
 * The `@neondatabase/serverless` package exports { neon, sql, ... }.
 * `neon()` receives a connection URL string and returns a `sql` tagged-template
 * function. `PrismaNeonHttp()` wraps that `sql` function as a Prisma adapter.
 */
function createPrismaClient(): PrismaClient {
  try {
    // Use require() to avoid TypeScript declaration issues with the Neon packages
    const { neon } = require("@neondatabase/serverless");
    const { PrismaNeonHttp } = require("@prisma/adapter-neon");

    if (typeof neon !== "function") {
      throw new Error(
        `@neondatabase/serverless exports a non-function neon: ${typeof neon}`
      );
    }

    const url = process.env.DATABASE_URL;
    if (!url || typeof url !== "string") {
      throw new Error("DATABASE_URL is not set or not a string");
    }

    const sql = neon(url);
    const adapter = new PrismaNeonHttp(sql);
    return new PrismaClient({ adapter });
  } catch (adapterError) {
    console.warn(
      "Neon serverless adapter initialization failed — falling back to standard PrismaClient.",
      adapterError instanceof Error ? adapterError.message : adapterError
    );
    return new PrismaClient();
  }
}

// Singleton accessor — creates the PrismaClient at module load time (eager)
// using the Neon adapter, with a try/catch fallback to standard PrismaClient.
// The try/catch ensures the app never crashes on startup due to adapter issues.
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
}

// Initialize eagerly at module load time so all imports of `prisma` work immediately.
prisma = globalForPrisma.prisma ?? getPrisma();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { prisma };

/**
 * @deprecated Use `getPrisma()` or the exported `prisma` singleton instead.
 * This function creates a separate PrismaClient instance and should not be
 * used externally — kept only for backward compatibility.
 */
export async function getNeonPrisma(): Promise<PrismaClient> {
  return getPrisma();
}
