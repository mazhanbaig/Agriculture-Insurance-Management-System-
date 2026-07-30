# AIMS — Agricultural Insurance Management System

## Tech Stack
- **Runtime:** Node.js 22, TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Supabase JWT (dev bypass available)
- **Queue:** BullMQ (Redis)
- **Validation:** express-validator
- **Logging:** pino + pino-http
- **Rate Limiting:** express-rate-limit

## Getting Started

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## API Response Shape

| Type | Format |
|---|---|
| Single item | `{ status: "success", data: { ... } }` |
| Paginated list | `{ status: "success", items: [...], pagination: { page, limit, total, totalPages } }` |
| Error | `{ status: "error", message: "..." }` |

## Project Structure

```
src/
  server.ts          — Express app setup, middleware, routes
  controllers/       — Request handlers (thin, delegates to services)
  services/          — Business logic + Prisma queries
  middleware/        — auth.ts, roleGuard.ts, tenant.ts, rateLimiter.ts, errorHandler.ts
  lib/               — prisma client, redis, bullmq, socket.io
  utils/             — logger, helpers
prisma/
  schema.prisma      — 24 models (User, Farmer, Policy, Claim, etc.)
tests/               — Jest test suites
```

## Key Conventions
- All routes are under `/api/v1/`
- Tenant isolation via `x-tenant-slug` header → `req.user.tenantId`
- Role guards via `requireRole(...)` or `requirePermission(...)`
- Rate limiters are opt-out: set `RATE_LIMIT_ENABLED=false` to disable
- Paginated list endpoints support `?page=`, `?limit=`, `?search=`, `?status=` query params
