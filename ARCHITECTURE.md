# Architecture Overview

## System Diagram

```
┌──────────────────────┐     HTTP/JSON     ┌──────────────────────┐
│   AIMSFrontend       │ ────────────────→ │   AIMS Backend       │
│   Next.js 15         │ ←──────────────── │   Express 5          │
│   App Router         │   Bearer + Tenant │   REST API           │
│                      │     Headers       │                      │
└──────────────────────┘                   └───────┬──────────────┘
                                                    │
                                            ┌───────┴──────────────┐
                                            │   PostgreSQL          │
                                            │   (Prisma ORM)       │
                                            └───────┬──────────────┘
                                                    │
                                            ┌───────┴──────────────┐
                                            │   Redis               │
                                            │   (BullMQ + Cache)   │
                                            └──────────────────────┘
```

## Backend Request Lifecycle

```
Request → requestId middleware → helmet → CORS → pino-http → rate limiter → tenant resolver → auth → roleGuard → controller → service → prisma → response
```

- **requestId:** assigns UUID for tracing
- **helmet:** security headers
- **CORS:** restricted to `FRONTEND_URL` env var (+ localhost:3000)
- **pino-http:** request logging
- **rate limiter:** global + auth + upload limits (opt-out with `RATE_LIMIT_ENABLED=false`)
- **tenant resolver:** reads `x-tenant-slug` header → looks up tenant → sets `req.user.tenantId`
- **auth:** verifies Supabase JWT (or dev token bypass)
- **roleGuard:** checks `req.user.role` against required roles/permissions

## Frontend Data Flow

```
Page → Hook (React Query) → API Client (Axios) → Backend → Response
                                                    ↓
                                          Hook normalises shape
                                                    ↓
                                          Component renders data
```

- **React Query** manages server-state caching, refetching, and invalidation
- **Zustand** stores manage client-only state (auth, UI, notifications, tenant)
- **API Client** interceptors attach Bearer token + tenant slug automatically
- **Hooks** normalise backend paginated responses to `{ data, pagination }`

## Auth Flow

1. User submits credentials → `signIn('credentials', ...)` → POST `/api/v1/auth/login`
2. Backend validates credentials → returns JWT + user data
3. NextAuth JWT callback stores token + user fields in encrypted cookie
4. Axios interceptor reads `session.accessToken` → sends as `Authorization: Bearer`
5. Session synced to Zustand `authStore` for role/permission checks

## Key Design Decisions

- **Tenant isolation:** All queries include `tenantId` filter; `x-tenant-slug` header resolves to tenant ID
- **Pagination:** Consistent `items` + `pagination` shape across all list endpoints
- **Fraud analysis:** Sync forensic checks on claim creation + async AI/satellite/weather analysis via BullMQ
- **Permissions:** IAM system with roles + granular permissions; backend-enforced with frontend hints
