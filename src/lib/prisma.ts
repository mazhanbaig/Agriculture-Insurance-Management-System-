import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

let prisma: PrismaClient;

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;

  if (!url || typeof url !== "string") {
    throw new Error("DATABASE_URL is not set or not a string");
  }

  const adapter = new PrismaNeonHttp(url, {});

  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
}

// Eager init at module load time — wrapped so failure doesn't crash the process
try {
  prisma = globalForPrisma.prisma ?? getPrisma();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
} catch (err) {
  console.error("Prisma eager init failed — server will retry on first use:", err);
}

export { prisma };
