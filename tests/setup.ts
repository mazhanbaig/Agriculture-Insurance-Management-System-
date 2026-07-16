/**
 * Jest setup file — runs before all test suites.
 * Sets DATABASE_URL to prevent PrismaClient initialization error
 * since all Prisma operations are mocked in tests.
 */
process.env.DATABASE_URL = "postgresql://dummy:5432/test";
process.env.NODE_ENV = "test";
