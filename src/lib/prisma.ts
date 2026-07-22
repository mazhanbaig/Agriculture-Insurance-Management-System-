import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let prisma: PrismaClient;

/**
 * Create a PrismaClient instance.
 *
 * Railway runs a persistent Node.js server (not serverless edge functions),
 * so the standard PrismaClient with a direct TCP connection pool is the
 * correct choice. The Neon HTTP adapter (neon serverless) is only needed
 * in serverless/edge runtimes (Vercel Edge, Cloudflare Workers, etc.)
 * where TCP connections aren't available.
 *
 * If the environment needs the Neon adapter (e.g., future Vercel deployment),
 * set USE_NEON_ADAPTER=true in the environment.
 */
function createPrismaClient(): PrismaClient {
  // Check if we should use the Neon serverless adapter
  if (process.env.USE_NEON_ADAPTER === "true") {
    try {
      // Use require() to avoid TypeScript declaration issues with Neon packages
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
      console.log("Using Neon serverless adapter for Prisma");
      return new PrismaClient({ adapter });
    } catch (adapterError) {
      console.warn(
        "Neon adapter init failed, falling back to standard PrismaClient:",
        adapterError instanceof Error ? adapterError.message : adapterError
      );
    }
  }

  // Default: standard PrismaClient with direct database connection
  return new PrismaClient();
}

// Singleton accessor
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
}

// Initialize eagerly at module load time
prisma = globalForPrisma.prisma ?? getPrisma();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { prisma };

/**
 * @deprecated Use `getPrisma()` or the exported `prisma` singleton instead.
 * Kept for backward compatibility.
 */
export async function getNeonPrisma(): Promise<PrismaClient> {
  return getPrisma();
}
