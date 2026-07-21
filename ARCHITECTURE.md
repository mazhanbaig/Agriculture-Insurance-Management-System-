<!-- ============================================================== -->
<!-- 🗂️ FILE PURPOSE: System architecture documentation              -->
<!--    Layers, data model, multi-tenant isolation, security,        -->
<!--    async jobs, API route map, caching strategy, testing         -->
<!-- ============================================================== -->

# AIMS Backend — Architecture Document

> **Agricultural Insurance Management System**  
> Express + TypeScript + Prisma 7 multi-tenant backend

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Layered Architecture](#2-layered-architecture)
3. [Request Lifecycle](#3-request-lifecycle)
4. [Module Map](#4-module-map)
5. [Data Model](#5-data-model)
6. [Multi-Tenant Isolation Model](#6-multi-tenant-isolation-model)
7. [Asynchronous Job Architecture](#7-asynchronous-job-architecture)
8. [Security Layers](#8-security-layers)
9. [External Integrations](#9-external-integrations)
10. [File Structure](#10-file-structure)
11. [API Route Map](#11-api-route-map)
12. [Error Handling Strategy](#12-error-handling-strategy)
13. [Caching Strategy](#13-caching-strategy)
14. [Testing Architecture](#14-testing-architecture)

---

## 1. System Overview

**Live Deployment:** [agriculture-insurance-management-system.up.railway.app](https://agriculture-insurance-management-system.up.railway.app/health)

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐  │
│  │  Mobile  │  │   Web    │  │   Admin   │  │ Platform │  │
│  │   App    │  │  (React) │  │ Dashboard │  │  Portal  │  │
│  └────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────┬─────┘  │
│       │              │              │              │        │
└───────┼──────────────┼──────────────┼──────────────┼────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                   API GATEWAY LAYER                          │
│                                                             │
│  Express Server (src/server.ts)                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Global Middleware Pipeline (order matters):         │    │
│  │  Helmet → CORS → Stripe Webhook (raw body) → JSON   │    │
│  │  → URL-encoded → Pino HTTP Logger → Rate Limiter    │    │
│  │  → resolveTenant (subdomain/header)                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                ROUTE LAYER  (src/routes/)                    │
│                                                             │
│  Every route file:                                          │
│  1. Router()                                                │
│  2. requireAuth (JWT/Supabase Auth)                         │
│  3. requireTenantAccess (tenant isolation guard)            │
│  4. requireRole(...) (role-based access)                    │
│  5. validate(schema) (Zod body validation)                  │
│  6. → controller method                                     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│             CONTROLLER LAYER  (src/controllers/)            │
│                                                             │
│  - Thin layer: parse req params → call service → respond    │
│  - Catches errors → passes to next(error)                   │
│  - No business logic, no Prisma calls                       │
│  - 15 controller files (14 domain + 1 webhook)              │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              SERVICE LAYER  (src/services/)                  │
│                                                             │
│  - All business logic lives here                            │
│  - Prisma queries, Stripe calls, BullMQ job enqueuing       │
│  - Every read query scoped by tenantId                      │
│  - One function = one job (no dense one-liners)             │
│  - Paginated list endpoints (offset + limit)                │
│  - No N+1 queries (Promise.all for counts + data)           │
│  - 14 service files                                         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER  (src/lib/)              │
│                                                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Prisma  │  │  Redis   │  │ BullMQ   │  │ Cloudinary │  │
│  │ Client  │  │ (ioredis)│  │(Queues+  │  │  SDK       │  │
│  │         │  │          │  │ Workers) │  │            │  │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └──────┬─────┘  │
│       │            │             │                │        │
└───────┼────────────┼─────────────┼────────────────┼────────┘
        │            │             │                │
        ▼            ▼             │                ▼
┌──────────────┐  ┌────────┐      │        ┌──────────────┐
│  PostgreSQL  │  │  Redis │      │        │  Cloudinary  │
│   (Neon)     │  │(Upstash)      │        │   (CDN)      │
└──────────────┘  └────────┘      │        └──────────────┘
                                   │
                          ┌────────┴────────┐
                          │   BullMQ Jobs   │
                          │  ┌────────────┐ │
                          │  │ OCR Worker │ │
                          │  │ Notif.     │ │
                          │  │ Worker     │ │
                          │  │ Import     │ │
                          │  │ Worker     │ │
                          │  └────────────┘ │
                          └─────────────────┘

    External Services:
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐
    │ Supabase│  │  Stripe  │  │ Nodemail│  │  Neon   │
    │ Auth     │  │ Payments │  │  Email   │  │ Server- │
    │ (JWT)    │  │ + Billing│  │ (SMTP)   │  │  less   │
    └──────────┘  └──────────┘  └──────────┘  └─────────┘
    ┌──────────┐  ┌──────────┐  ┌───────────┐
    │ OpenRouter│  │ Sentinel │  │ OpenWeather│
    │ (AI/LLM)  │  │  Hub     │  │  Weather  │
    └──────────┘  └──────────┘  └───────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Layered architecture** (Routes → Controllers → Services → Lib) | Clean separation of concerns; swap any layer independently |
| **Flat folder structure** (`routes/`, `controllers/`, `services/`) | Organized by role, not by feature — scales to 14+ modules without nested subfolders |
| **BullMQ for all external calls** | OCR, email, Stripe, import — never inline in request/response cycle |
| **Prisma 7 with Neon serverless driver** | Free-tier compatible: handles Neon auto-suspend via `@neondatabase/serverless` adapter |
| **Zod validation on every route** | Type-safe request validation with descriptive error messages |
| **tenantId on every Prisma query** | Tenant isolation enforced at the data layer, not just middleware |
| **OpenRouter as unified LLM gateway** | Single API key for Gemini, GPT-4o, Claude — replaces separate AI modules |
| **Env var validation on startup** | Server fails fast with clear error if required vars are missing |
| **Request ID tracking** | Every request gets a UUID for log tracing through the system |

---

## 2. Layered Architecture

### 2.1 Route Layer (`src/routes/`)

Each route file:
1. Creates an Express `Router`
2. Applies `authLimiter` (rate limit for auth endpoints)
3. Applies `requireAuth` (validates Supabase JWT)
4. Optionally applies `requireTenantAccess` (tenant isolation guard) or `requireRole` (role guard)
4. Applies `validate(schema)` on POST/PATCH/PUT endpoints
5. Delegates to the controller method

```typescript
// Example: src/routes/claims.routes.ts
router.use(requireAuth);
router.use(requireTenantAccess);
router.get("/", claimsController.listAllClaims);
router.post("/", validate(createClaimSchema), claimsController.createClaim);
router.patch("/:id/status", validate(updateClaimStatusSchema), claimsController.updateClaimStatus);
```

### 2.2 Controller Layer (`src/controllers/`)

Controllers are thin — they parse request parameters and call service functions:

```typescript
// Pattern
export async function createClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await claimService.createClaim(req.user!.id, req.body);
    res.status(201).json({ status: "success", data: result });
  } catch (error) { next(error); }
}
```

### 2.3 Service Layer (`src/services/`)

Services contain all business logic:

- **Read operations**: Always filter by `tenantId`, paginated with `skip`/`take`, use `Promise.all` for concurrent count queries (no N+1)
- **Write operations**: Validate ownership (e.g., "claim belongs to your tenant"), check duplicates, create with status history
- **External calls**: Enqueue BullMQ jobs, never await inline
- **Cache**: Redis cache for expensive dashboard aggregations (300s TTL)

```typescript
// Pattern for paginated reads
export async function listAllClaims(tenantId: string, page: number, limit: number, status?: string) {
  const skip = (page - 1) * limit;
  const where: Record<string, any> = { tenantId };
  if (status) where.status = status;
  const [claims, total] = await Promise.all([
    prisma.claim.findMany({ where, skip, take: limit, orderBy: { submittedAt: "desc" }, include: ... }),
    prisma.claim.count({ where }),
  ]);
  return { claims, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
```

### 2.4 Infrastructure Layer (`src/lib/`)

| File | Purpose |
|------|---------|
| `prisma.ts` | PrismaClient singleton with global caching for dev hot-reload + Neon adapter factory |
| `redis.ts` | ioredis singleton with error logging |
| `bullmq.ts` | 5 queues (OCR, notification, import, fraud, auto-trigger) with factory functions for workers |
| `cloudinary.ts` | Cloudinary SDK configured from env vars |
| `openrouter.ts` | OpenRouter unified LLM client (text + vision) — also `analyzeWithFallback()` for retry chain |
| `sentinel.ts` | Sentinel Hub NDVI comparison client |
| `stripe.ts` | Lazy-initialized Stripe client singleton |
| `supabase.ts` | Supabase client for JWT verification |
| `weather.ts` | OpenWeather weather verification (historical + current) |

---

## 3. Request Lifecycle

```
Client Request
     │
     ▼
[1] Express Server
     │  helmet() — security headers
     │  cors() — CORS headers
     │  Stripe webhook route (raw body, before JSON parser)
     │  express.json() — parse JSON body (10MB limit)
     │  express.urlencoded() — parse URL-encoded
     │  pinoHttp — HTTP request logging
     │  apiLimiter — rate limiting (100 req / 15 min)
     │  resolveTenant — resolve tenant from subdomain/header
     ▼
[2] Route
│  authLimiter — rate limit (20 req / 15 min)
│  requireAuth — validate Bearer token via Supabase Auth
│  requireTenantAccess — verify user belongs to resolved tenant
│  requireRole — check user role (e.g., TENANT_ADMIN, CLAIMS_OFFICER)
     │  validate(schema) — Zod body validation
     ▼
[3] Controller
     │  Parse: req.params, req.query, req.body, req.user
     │  Call service function
     │  Send: res.json({ status: "success", data: ... })
     ▼
[4] Service
     │  Business logic (calculations, ownership checks, duplicate detection)
     │  Prisma queries (all scoped by tenantId)
     │  External calls via BullMQ (never inline)
     ▼
[5] Response
     │  { status: "success", data: ... }
     │  or
     │  { status: "error", message: "..." }
     │  (via errorHandler middleware)
```

---

## 4. Module Map

| # | Module | Routes | Services | Key Entities |
|---|--------|--------|----------|--------------|
| 1 | **Auth** | `/api/v1/auth` | `auth.service.ts` | User sessions, profile, role mgmt |
| 2 | **Farmers** | `/api/v1/farmers` | `farmers.service.ts` | Farmer profiles, CNIC validation |
| 3 | **Land Parcels** | `/api/v1/land-parcels` | `landParcels.service.ts` | Land records, geo data, area |
| 4 | **Policy Plans** | `/api/v1/policy-plans` | `policyPlans.service.ts` | Insurance plans, quote calculator |
| 5 | **Policies** | `/api/v1/policies` | `policies.service.ts` | Policy purchase, coverage calc |
| 6 | **Claims** | `/api/v1/claims` | `claims.service.ts` | Claim submission, state machine |
| 7 | **Documents** | `/api/v1/documents` | `documents.service.ts` | File upload, OCR pipeline |
| 8 | **Payments** | `/api/v1/payments` | `payments.service.ts` | Premium collection, claim payouts |
| 9 | **Notifications** | `/api/v1/notifications` | `notifications.service.ts` | In-app + email notifications |
| 10 | **Admin** | `/api/v1/admin` | `admin.service.ts` | Staff mgmt, dashboard, analytics |
| 11 | **Platform** | `/api/v1/platform` | `platform.service.ts` | Tenant CRUD, seeding, onboarding |
| 12 | **Settings** | `/api/v1/settings` | `tenantSettings.service.ts` | Tenant config & branding |
| 13 | **Import** | `/api/v1/import` | `import.service.ts` | CSV/JSON bulk import |
| 14 | **Billing** | `/api/v1/billing` | `billing.service.ts` | Stripe subscriptions |

### Cross-Cutting Modules

| Module | File | Purpose |
|--------|------|---------|
| Rate Limiter | `middleware/rateLimiter.ts` | API, auth, and upload rate limits |
| Error Handler | `middleware/errorHandler.ts` | AppError and ZodError handling |
| Auth Guard | `middleware/auth.ts` | Supabase Auth JWT verification + user sync |
| Role Guard | `middleware/roleGuard.ts` | Role-based + tenant access guards |
| Validator | `middleware/validate.ts` | Zod schema middleware factory |

---

## 5. Data Model

### Entity Relationship Diagram

```
Tenant ──────────┬── User ─────────── Farmer ───┬── LandParcel
                 │        │                     │
                 │        │                     ├── Policy ─────── PolicyPlan
                 │        │                     │      │
                 │        │                     │      └── Payment
                 │        │                     │
                 │        │                     └── Claim ───┬── ClaimDocument
                 │        │                            │     └── ClaimStatusHistory
                 │        │                            └── Payment
                 │        │
                 │        └── Notification
                 │
                 └── PolicyPlan
```

### Core Models (19 total)

| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **Tenant** | `id`, `name` (unique), `slug` (unique), `config` (JSON), `stripeCustomerId`, `billingEnabled` | → User, PolicyPlan, Farmer |
| **User** | `id`, `tenantId`, `authId` (unique Supabase ID), `email`, `role` (enum), `isActive`, `customRoleId?` | → Tenant, → Farmer, → Notification, → CustomRole |
| **Farmer** | `id`, `tenantId`, `userId` (unique), `fullName`, `cnicNumber` | → User, → LandParcel, → Policy, → Claim, → FarmerFieldValue |
| **LandParcel** | `id`, `tenantId`, `farmerId`, `address`, `areaAcres`, `cropType`, `latitude`, `longitude` | → Farmer, → Policy |
| **PolicyPlan** | `id`, `tenantId`, `name`, `cropType`, `coveragePerAcre`, `premiumRate`, `termMonths`, `config` (auto-trigger JSON) | → Tenant, → Policy |
| **Policy** | `id`, `policyNumber` (unique), `tenantId`, `farmerId`, `landParcelId`, `policyPlanId`, `coverageAmount`, `premiumAmount`, `status` (enum) | → Farmer, LandParcel, PolicyPlan, User, Claim, Payment |
| **Claim** | `id`, `claimNumber` (unique), `tenantId`, `policyId`, `farmerId`, `incidentType`, `claimedAmount`, `approvedAmount`, `fraudScore`, `fraudVerdict`, `status` (enum) | → Policy, Farmer, User (officer), ClaimDocument, ClaimStatusHistory, Payment, FraudAuditLog |
| **ClaimDocument** | `id`, `claimId`, `url` (Cloudinary), `type`, `fileHash`, `fileSize`, `mimeType`, `ocrExtractedData` (JSON) | → Claim, User (uploader) |
| **ClaimStatusHistory** | `id`, `claimId`, `fromStatus`, `toStatus`, `note` | → Claim, User (changer) |
| **FraudAuditLog** | `id`, `claimId`, `score`, `verdict`, `flags` (JSON), `ruleResults` (JSON), `rawMetadata` (JSON) | → Claim (immutable) |
| **AutoTriggerLog** | `id`, `tenantId`, `policyId`, `landParcelId`, `ndviPre`, `ndviPost`, `ndviDrop`, `weatherEvent`, `triggerMatched`, `claimId?` | → Policy, LandParcel |
| **Payment** | `id`, `tenantId`, `policyId?`, `claimId?`, `type` (PREMIUM/PAYOUT), `amount`, `gatewayTransactionId`, `status` | → Policy?, Claim? |
| **Notification** | `id`, `userId`, `type`, `title`, `message`, `isRead`, `relatedEntityType?`, `relatedEntityId?` | → User |
| **TenantField** | `id`, `tenantId`, `fieldKey`, `label`, `fieldType`, `options` (JSON), `required`, `order` | → Tenant (dynamic farmer fields) |
| **FarmerFieldValue** | `id`, `farmerId`, `fieldKey`, `value` (JSON) | → Farmer (dynamic field values) |
| **CustomRole** | `id`, `tenantId`, `name`, `description`, `permissions` (JSON array), `isActive` | → Tenant, → User (IAM) |
| **UsageLog** | `id`, `tenantId`, `service`, `tier`, `model`, `cost`, `totalCost`, `createdAt` | → Tenant (usage-based billing) |
| **Invoice** | `id`, `tenantId`, `invoiceNumber` (unique), `totalAmount`, `status`, `dueDate`, `paidAt` | → Tenant, → InvoiceLineItem |
| **InvoiceLineItem** | `id`, `invoiceId`, `description`, `amount`, `quantity` | → Invoice |

### Indexes

- `Tenant` → index on `slug` (subdomain lookup)
- `User` → compound unique on `[tenantId, authId]` and `[tenantId, email]`, index on `tenantId`, `role`
- `Farmer` → compound unique on `[tenantId, cnicNumber]`, index on `tenantId`, `userId`
- `LandParcel` → index on `tenantId`, `farmerId`
- `PolicyPlan` → index on `tenantId`, `isActive`
- `Policy` → index on `tenantId`, `farmerId`, `status`
- `Claim` → index on `tenantId`, `policyId`, `status`, `farmerId`
- `ClaimDocument` → index on `claimId`, `fileHash`
- `ClaimStatusHistory` → index on `claimId`
- `Payment` → index on `tenantId`, `policyId`, `claimId`
- `Notification` → index on `[userId, isRead]`
- `TenantField` → index on `tenantId`
- `FarmerFieldValue` → index on `farmerId`
- `CustomRole` → index on `tenantId`
- `UsageLog` → index on `tenantId`, `createdAt`
- `Invoice` → index on `tenantId`, `status`

### Role Enum

| Role | Access Level |
|------|-------------|
| `PLATFORM_ADMIN` | Cross-tenant: manage all tenants, seed plans, manage staff |
| `TENANT_ADMIN` | Single tenant: manage staff, dashboard, settings, import, view fraud reports |
| `UNDERWRITER` | Create/update policy plans, verify land documents |
| `CLAIMS_OFFICER` | Assign claims, update claim status, request evidence |
| `SENIOR_CLAIMS_OFFICER` | All Claims Officer + override decisions, approve high-value claims, trigger payouts |
| `FIELD_AGENT` | Register farmers, virtual + physical inspections, upload evidence |
| `FARMER` | Self-service: buy policies, file claims, upload documents, track status |

### Custom Roles (IAM — 40+ Permissions)

Tenants can create custom roles with granular permissions beyond the 7 fixed roles:

| Permission Prefix | Example Permissions |
|------------------|-------------------|
| `claim:` | `view:own`, `view:all`, `create`, `approve`, `reject`, `assign`, `payout` |
| `farmer:` | `create`, `view`, `update`, `delete` |
| `policy:` | `view`, `purchase`, `cancel` |
| `plan:` | `view`, `create`, `update`, `delete` |
| `user:` | `create`, `view`, `update`, `deactivate` |
| `payment:` | `view`, `refund` |
| `settings:` | `view`, `update` |
| `import:` | `execute`, `view` |

---

## 6. Multi-Tenant Isolation Model

### 6.1 Three-Layer Isolation

```
Layer 1: Middleware (requireTenantAccess)
  ──────────────────────────────────────
  Checks req.user.tenantId === req.tenant.id
  Platform admins bypass (can see all tenants)

Layer 2: Service Layer (tenantId filter)
  ──────────────────────────────────────
  Every Prisma query includes where: { tenantId: req.user.tenantId }
  findFirst() and findMany() always scoped

Layer 3: Data Layer (database indexes + schema)
  ──────────────────────────────────────
  tenantId on every tenant-scoped model
  Unique constraints include tenantId (e.g., @@unique([tenantId, email]))
```

### 6.2 Tenant Resolution Flow

```
Request arrives
     │
     ▼
[auth.ts: resolveTenant()]  ← runs on every request
     │
     ├── x-tenant-slug header present?
     │   └── Yes → Look up tenant by slug
     │
     ├── Subdomain present? (e.g., acme.aims.com)
     │   └── Yes → Extract "acme" as slug
     │
     └── Neither → req.tenant stays undefined
                     (will use user's own tenantId from auth)
     │
     ▼
[auth.ts: requireAuth()]  ← runs on protected routes
     │
     ├── Verify Supabase Auth JWT token
     ├── Look up / create local User row
     ├── req.user = { id, tenantId, authId, email, role }
     │
     ▼
[roleGuard.ts: requireTenantAccess()]  ← runs on tenant-scoped routes
     │
     ├── Platform admin? → Skip check
     ├── req.tenant exists & user.tenantId !== tenant.id? → 403
     └── OK → Continue
```

### 6.3 Data Scoping Example

All service functions scope every query:

```typescript
// Correct — scoped by tenantId
export async function getClaim(claimId: string, tenantId: string) {
  return prisma.claim.findFirst({ where: { id: claimId, tenantId }, ... });
}
```

---

## 7. Asynchronous Job Architecture

### 7.1 Queue Design

```
 ┌─────────────────────────────────────────────────────┐
 │                  Redis (Upstash)                     │
 │                                                      │
 │  ┌───────────────────┐  ┌──────────────────────┐    │
 │  │   ocr queue       │  │  notification queue  │    │
 │  │   (BullMQ)        │  │  (BullMQ)            │    │
 │  │                   │  │                      │    │
 │  │ Jobs:             │  │  Jobs:               │    │
 │  │ - process-ocr     │  │  - claim-submitted   │    │
 │  │                   │  │  - claim-status-     │    │
 │  └────────┬──────────┘  │    changed           │    │
 │           │             │  - claim-assigned    │    │
 │           │             │  - tenant-created    │    │
 │           │             └──────────┬───────────┘    │
 │           │                        │                │
 │  ┌────────┴──────────┐             │                │
 │  │   import queue    │             │                │
 │  │   (BullMQ)        │             │                │
 │  │                   │             │                │
 │  │ Jobs:             │             │                │
 │  │ - policy-plans    │             │                │
 │  │ - farmers-        │             │                │
 │  │   policies        │             │                │
 │  └────────┬──────────┘             │                │
 │           │                        │                │
 └───────────┼────────────────────────┼────────────────┘
             │                        │
             ▼                        ▼
 ┌──────────────────┐    ┌───────────────────────┐
 │  OCR Worker      │    │  Notification Worker  │
 │  src/jobs/       │    │  src/jobs/            │
 │  ocrWorker.ts    │    │  notificationWorker.ts│
 │                  │    │                       │
 │  - Simulate OCR  │    │  - Create DB notif    │
 │  - Update        │    │  - Send email via     │
 │    ocrExtracted  │            │    Nodemailer        │
 │    Data on doc   │    │                       │
 └──────────────────┘    └───────────────────────┘

             ┌──────────────────────────┐
             │  Import Worker           │
             │  src/jobs/importWorker.ts│
             │                          │
             │  - Parse CSV/JSON        │
             │  - Validate rows         │
             │  - Bulk create entities  │
             │  - Return error report   │
             └──────────────────────────┘
```

### 7.2 Job Configuration

| Setting | Value |
|---------|-------|
| Max attempts per job | 3 (fraud: tier-dependent) |
| Backoff | Exponential, 2s initial delay |
| `removeOnComplete` | Keep last 100 |
| `removeOnFail` | Keep last 50 |
| Fraud concurrency | 5 |
| Fraud rate limit | 10 requests/second |

### 7.3 Worker Responsibilities

| Worker | Files | Function |
|--------|-------|----------|
| **OCR Worker** | `jobs/ocrWorker.ts` | Updates `ClaimDocument.ocrExtractedData` with simulated OCR results |
| **Notification Worker** | `jobs/notificationWorker.ts` | Creates DB notification row + sends email via Nodemailer SMTP |
| **Import Worker** | `jobs/importWorker.ts` | Routes to `importPolicyPlans()` or `importFarmersPolicies()` based on job type |
| **Fraud Worker** | `jobs/fraud-worker.ts` | Runs async fraud analysis — tier-based OpenRouter AI, Sentinel NDVI, OpenWeather, CNIC cross-check |
| **Auto-Trigger Worker** | `jobs/auto-trigger-worker.ts` | Every 6h: checks NDVI + weather for auto-trigger policies, creates claims |
| **Billing Worker** | `jobs/billingWorker.ts` | Monthly: aggregates UsageLog → generates invoices → sends email notifications |

---

## 8. Security Layers

### 8.1 Authentication

- **Supabase Auth** (JWT-based session management)
- Bearer token in `Authorization` header
- Server-side token verification via `supabase.auth.getUser()`
- Three-strategy user lookup: authId → email → create new
- Links admin-created users to their Supabase identity on first login
- Updates `lastLoginAt` and `email` on subsequent logins

### 8.2 Authorization (Role Guard)

```typescript
// Usage examples
requireRole("TENANT_ADMIN", "PLATFORM_ADMIN")  // Admin routes
requireRole("FARMER")                           // Farmer self-service
requireRole("CLAIMS_OFFICER")                   // Claims processing
```

### 8.3 Tenant Isolation Guard

- `requireTenantAccess` middleware runs after auth
- Compares `req.user.tenantId` with `req.tenant.id`
- Platform admins (`PLATFORM_ADMIN`) bypass the check
- Applies to every tenant-scoped route

### 8.4 Rate Limiting

| Limiter | Window | Max Requests | Applied To |
|---------|--------|-------------|------------|
| `apiLimiter` | 15 min | 100 | All routes |
| `authLimiter` | 15 min | 20 | Auth endpoints |
| `uploadLimiter` | 1 hour | 50 | Document uploads |

### 8.5 HTTP Security

- `helmet()` — security headers (CSP, XSS, clickjacking, etc.)
- `cors()` — cross-origin access
- `express-rate-limit` — request throttling
- `pino-http` — request logging (GDPR-safe: no body logging by default)

### 8.6 Input Validation

- Every POST/PATCH/PUT route uses Zod schema validation
- Validates types, required fields, string lengths, number ranges
- Returns 400 with detailed field errors on validation failure

---

## 9. External Integrations

| Service | Purpose | Integration Point | Free Tier Handling |
|---------|---------|------------------|--------------------|
| **Supabase Auth** | JWT-based authentication | `middleware/auth.ts` via `@supabase/supabase-js` | 50K users free |
| **Neon (PostgreSQL)** | Database | `lib/prisma.ts` via `prisma` + `@neondatabase/serverless` adapter | Adapter handles auto-suspend; connection pooling managed by Neon |
| **Redis (Upstash)** | BullMQ queues + caching | `lib/redis.ts` via `ioredis` | Minimal queues (5), small job payloads (URLs, not files) |
| **Cloudinary** | Document storage & transformation | `lib/cloudinary.ts` via `cloudinary` SDK | Auto-compression on upload (`q_auto`, `f_auto`, 1200px limit) |
| **Stripe** | Premium payments + subscription billing | `services/payments.service.ts` + `services/billing.service.ts` | Test keys for development |
| **Nodemailer** | Email notifications via SMTP | `jobs/notificationWorker.ts` | Ethereal/SendGrid/Gmail SMTP |
| **BullMQ** | Async job processing | `lib/bullmq.ts` | 5 queues (OCR, notif, import, fraud, auto-trigger) |
| **OpenRouter** | AI/LLM image + text analysis (fraud detection) | `lib/openrouter.ts` | Free models available (Gemini Flash) |
| **Sentinel Hub** | Satellite NDVI vegetation monitoring | `lib/sentinel.ts` | 30K requests/month free |
| **OpenWeather** | Weather event verification for claims | `lib/weather.ts` | 60 calls/min free (historical via One Call 3.0) |

### Neon Adapter Fallback

```typescript
// src/lib/prisma.ts
export async function getNeonPrisma(): Promise<PrismaClient> {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  try {
    const { PrismaNeon } = await import("@neondatabase/serverless/prisma");
    const adapter = new PrismaNeon(sql);
    return new PrismaClient({ adapter });
  } catch {
    // Fallback to standard client if adapter unavailable
    console.warn("Falling back to standard PrismaClient.");
    return new PrismaClient();
  }
}
```

---

## 10. File Structure

```
AIMS/
├── .env                          # Environment variables (not committed)
├── .gitignore
├── package.json
├── tsconfig.json
├── jest.config.js                # Jest config with ts-jest preset
├── prisma.config.ts              # Prisma 7.x datasource config
├── prisma/
│   ├── schema.prisma             # Database schema (19 models, 5 enums)
│   └── migrations/
│       ├── init/
│       │   └── migration.sql     # Initial schema migration
│       └── multi_tenant/
│           └── migration.sql     # Multi-tenant migration (Tenant model, tenantId fields)
├── src/
│   ├── server.ts                 # Express app bootstrap & startup
│   ├── scripts/
│   │   └── migrateTenant.ts      # One-time data migration (default tenant + backfill)
│   ├── lib/
│   │   ├── prisma.ts             # PrismaClient singleton + Neon adapter factory
│   │   ├── redis.ts              # ioredis singleton
│   │   ├── bullmq.ts             # 5 BullMQ queues + worker factories
│   │   ├── cloudinary.ts         # Cloudinary SDK config
│   │   ├── openrouter.ts         # OpenRouter unified LLM client
│   │   ├── sentinel.ts           # Sentinel Hub NDVI client
│   │   ├── stripe.ts             # Stripe client singleton
│   │   └── supabase.ts           # Supabase client for JWT verification
│   ├── middleware/
│   │   ├── auth.ts               # requireAuth + resolveTenant (Supabase JWT + subdomain)
│   │   ├── roleGuard.ts          # requireRole (role check) + requireTenantAccess (tenant isolation)
│   │   ├── rateLimiter.ts        # 3 rate limiters (API, auth, upload)
│   │   ├── errorHandler.ts       # AppError + ZodError handler
│   │   └── validate.ts           # Zod schema validation middleware factory
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── farmers.routes.ts
│   │   ├── landParcels.routes.ts
│   │   ├── policyPlans.routes.ts
│   │   ├── policies.routes.ts
│   │   ├── claims.routes.ts
│   │   ├── documents.routes.ts
│   │   ├── payments.routes.ts
│   │   ├── notifications.routes.ts
│   │   ├── admin.routes.ts
│   │   ├── platform.routes.ts
│   │   ├── tenantSettings.routes.ts
│   │   ├── import.routes.ts
│   │   └── billing.routes.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── farmers.controller.ts
│   │   ├── landParcels.controller.ts
│   │   ├── policyPlans.controller.ts
│   │   ├── policies.controller.ts
│   │   ├── claims.controller.ts
│   │   ├── documents.controller.ts
│   │   ├── payments.controller.ts
│   │   ├── notifications.controller.ts
│   │   ├── admin.controller.ts
│   │   ├── platform.controller.ts
│   │   ├── tenantSettings.controller.ts
│   │   ├── import.controller.ts
│   │   ├── billing.controller.ts
│   │   └── billingWebhook.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── farmers.service.ts
│   │   ├── landParcels.service.ts
│   │   ├── policyPlans.service.ts
│   │   ├── policies.service.ts
│   │   ├── claims.service.ts
│   │   ├── documents.service.ts
│   │   ├── payments.service.ts
│   │   ├── notifications.service.ts
│   │   ├── admin.service.ts
│   │   ├── platform.service.ts
│   │   ├── tenantSettings.service.ts
│   │   ├── import.service.ts
│   │   └── billing.service.ts
│   ├── validators/
│   │   ├── auth.validator.ts
│   │   ├── farmers.validator.ts
│   │   ├── landParcels.validator.ts
│   │   ├── policyPlans.validator.ts
│   │   ├── policies.validator.ts
│   │   ├── claims.validator.ts
│   │   ├── documents.validator.ts
│   │   ├── payments.validator.ts
│   │   ├── notifications.validator.ts
│   │   ├── admin.validator.ts
│   │   ├── platform.validator.ts
│   │   ├── tenantSettings.validator.ts
│   │   ├── import.validator.ts
│   │   └── billing.validator.ts
│   │   ├── tenantFields.validator.ts
│   │   └── iam.validator.ts
│   ├── config/
│   │   ├── fraudTiers.ts         # 3-tier fraud detection model config
│   │   ├── permissions.ts        # 40+ permission definitions
│   │   ├── paymentGateways.ts    # Gateway adapter factory
│   │   └── autoTriggerConfig.ts  # NDVI + weather thresholds
│   ├── utils/
│   │   ├── fraud-helpers.ts      # Fraud score weights, verdict mapping
│   │   ├── generators.ts         # Claim/policy number generation
│   │   ├── geo.ts                # Haversine distance calculator
│   │   └── logger.ts             # Pino logger with request ID
│   └── jobs/
│       ├── ocrWorker.ts          # OCR processing (simulated)
│       ├── notificationWorker.ts # In-app + email notification dispatch
│       ├── importWorker.ts       # Bulk import (CSV/JSON) routing
│       ├── fraud-worker.ts       # Async fraud analysis (AI, satellite, weather)
│       ├── auto-trigger-worker.ts # 6-hour parametric monitoring cron
│       └── billingWorker.ts      # Monthly invoice generation cron
├── tests/
│   ├── setup.js                  # Test environment setup (DATABASE_URL)
│   ├── setup.ts                  # Test setup (unused, kept for reference)
│   ├── claims.test.ts            # 8 tests: claim submission, state machine
│   ├── tenantIsolation.test.ts   # 18 tests: multi-tenant isolation
│   ├── utils.test.ts             # 19 tests: generators, fraud scoring, geo
│   ├── iam.test.ts               # 14 tests: custom role CRUD, permissions
│   ├── billing.test.ts           # 14 tests: invoices, payments, subscription
│   ├── farmers.test.ts           # 8 tests: farmer CRUD, CNIC, custom fields
│   ├── policyPlans.test.ts       # 14 tests: plans, quote calc, config merge
│   └── smoke.test.ts             # 39 tests: full system, 14 areas
├── PROGRESS.md                   # Development progress tracker
├── REPORT.md                     # Comprehensive project report
├── ARCHITECTURE.md               # ← This document
├── README.md                     # Project readme
└── ENV_SETUP_GUIDE.md            # Environment variables setup guide
```

### File Count Summary

| Layer | Count |
|-------|-------|
| `routes/` | 17 (14 domain + 3 webhook/gateway) |
| `controllers/` | 17 (15 domain + 2 webhook) |
| `services/` | 17 (14 domain + 3 cross-cutting) |
| `validators/` | 16 |
| `middleware/` | 5 |
| `lib/` | 9 |
| `config/` | 4 |
| `utils/` | 4 |
| `jobs/` | 6 |
| `scripts/` | 1 |
| `tests/` | 9 |
| **Total `.ts` files** | **~105** |

---

## 11. API Route Map

### Auth (`/api/v1/auth`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/me` | Any authenticated | Get current user with farmer+tenant |
| PATCH | `/profile` | Any authenticated | Update phone number |
| PATCH | `/role` | PLATFORM_ADMIN | Change user role |
| GET | `/users` | PLATFORM_ADMIN | List all users |

### Farmers (`/api/v1/farmers`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | FARMER | Get own farmer profile |
| POST | `/` | FARMER | Create farmer profile |
| PATCH | `/` | FARMER | Update farmer profile |

### Land Parcels (`/api/v1/land-parcels`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | FARMER | List own land parcels |
| GET | `/:id` | FARMER | Get parcel details |
| POST | `/` | FARMER | Register new parcel |
| PATCH | `/:id` | FARMER | Update parcel |
| DELETE | `/:id` | FARMER | Delete parcel |

### Policy Plans (`/api/v1/policy-plans`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | Any authenticated | List active plans |
| GET | `/:id` | Any authenticated | Get plan details |
| POST | `/` | TENANT_ADMIN | Create new plan |
| PATCH | `/:id` | TENANT_ADMIN | Update plan |
| POST | `/quote` | Any authenticated | Calculate premium quote |

### Policies (`/api/v1/policies`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | FARMER | List own policies |
| GET | `/:id` | FARMER/STAFF | Get policy details |
| POST | `/` | FARMER | Purchase policy |

### Claims (`/api/v1/claims`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | FARMER | List own claims |
| GET | `/:id` | FARMER/STAFF | Get claim details |
| POST | `/` | FARMER | Submit new claim |
| PATCH | `/:id/status` | CLAIMS_OFFICER | Update claim status |
| GET | `/admin/all` | TENANT_ADMIN | List all claims |
| PATCH | `/admin/:id/assign` | TENANT_ADMIN | Assign claims officer |

### Documents (`/api/v1/documents`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/upload` | FARMER | Upload claim document |
| GET | `/claim/:claimId` | Any authenticated | List claim documents |
| GET | `/:id` | Any authenticated | Get document details |
| DELETE | `/:id` | FARMER | Delete document |

### Payments (`/api/v1/payments`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/premium` | FARMER | Create premium payment intent |
| POST | `/premium/confirm` | FARMER | Confirm premium payment |
| POST | `/payout/:claimId` | TENANT_ADMIN | Process claim payout |
| GET | `/policy/:policyId` | Any authenticated | Get policy payments |
| GET | `/claim/:claimId` | Any authenticated | Get claim payments |

### Notifications (`/api/v1/notifications`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | Any authenticated | List user notifications |
| PATCH | `/read` | Any authenticated | Mark specific as read |
| PATCH | `/read-all` | Any authenticated | Mark all as read |

### Admin (`/api/v1/admin`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/staff` | TENANT_ADMIN | Create staff user |
| GET | `/staff` | TENANT_ADMIN | List staff users |
| PATCH | `/staff/:id/toggle-status` | TENANT_ADMIN | Activate/deactivate staff |
| GET | `/dashboard` | TENANT_ADMIN | Dashboard aggregates |
| GET | `/analytics/claims` | TENANT_ADMIN | Claims analytics |

### Platform (`/api/v1/platform`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/tenants` | PLATFORM_ADMIN | Create tenant |
| GET | `/tenants` | PLATFORM_ADMIN | List tenants |
| GET | `/tenants/:id` | PLATFORM_ADMIN | Get tenant details |
| PATCH | `/tenants/:id` | PLATFORM_ADMIN | Update tenant |
| DELETE | `/tenants/:id` | PLATFORM_ADMIN | Deactivate tenant |
| POST | `/tenants/:id/seed` | PLATFORM_ADMIN | Seed tenant with policy plans |

### Settings (`/api/v1/settings`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | TENANT_ADMIN | Get tenant settings |
| PATCH | `/` | TENANT_ADMIN | Update tenant settings |

### Import (`/api/v1/import`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/policy-plans` | TENANT_ADMIN | Import policy plans (CSV/JSON) |
| POST | `/farmers-policies` | TENANT_ADMIN | Import farmers & policies (CSV/JSON) |
| GET | `/jobs/:jobId` | TENANT_ADMIN | Check import job status |

### Billing (`/api/v1/billing`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/subscribe` | TENANT_ADMIN | Create subscription session |
| POST | `/cancel` | TENANT_ADMIN | Cancel subscription |
| GET | `/status` | TENANT_ADMIN | Get subscription status |
| POST | `/webhook` | Public | Stripe webhook (raw body) |

---

## 12. Error Handling Strategy

### Exception Types

```typescript
// Custom application error
export class AppError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.isOperational = true;
  }
}
```

### Error Handling Flow

```
Service throws AppError("Claim not found", 404)
         │
         ▼
Controller catches → next(error)
         │
         ▼
errorHandler middleware:
  ├── AppError → res.status(err.statusCode).json({ status: "error", message })
  ├── ZodError → res.status(400).json({ status: "error", message: "Validation failed", errors })
  └── Unknown  → res.status(500).json({ status: "error", message: "Internal server error" })
                  + pino.error({ err }, "Unhandled error")
```

### Common Error Patterns

| Situation | HTTP Status | Error Message |
|-----------|-------------|---------------|
| Missing auth token | 401 | "Missing or invalid authorization header" |
| Invalid session | 401 | "Invalid or expired session" |
| Wrong tenant | 403 | "User does not belong to the specified tenant" |
| Wrong role | 403 | "Access denied. Required role: TENANT_ADMIN" |
| Duplicate CNIC/email | 409 | "CNIC number is already registered" |
| Resource not found | 404 | "Claim not found" |
| Invalid state transition | 400 | "Cannot transition from SUBMITTED to PAID" |
| Rate limited | 429 | "Too many requests, please try again later" |

---

## 13. Caching Strategy

### Redis Cache Usage

| Cache Key | Data | TTL | Module |
|-----------|------|-----|--------|
| `admin:dashboard:{tenantId}` | Dashboard aggregates (farmer count, policy count, premium collected, payouts) | 300s | Admin |

### Caching Pattern

```typescript
// Read-through cache with silent failure
const cacheKey = `admin:dashboard:${tenantId}`;
try {
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
} catch { /* cache miss — proceed to compute */ }

// Compute fresh data
const dashboard = await computeDashboard(tenantId);

// Set cache (non-blocking)
try {
  await redis.setex(cacheKey, 300, JSON.stringify(dashboard));
} catch { /* cache write failure — non-critical */ }

return dashboard;
```

**Design rationale:** Cache is always optional. If Redis is down, the system continues to work by computing data fresh on every request. No `await` is used for cache writes.

---

## 14. Testing Architecture

### Test Suites

| Suite | File | Tests | Type | Coverage |
|-------|------|-------|------|----------|
| Claims | `tests/claims.test.ts` | 8 | Integration (Supertest) | State machine, duplicate detection, claim numbers |
| Tenant Isolation | `tests/tenantIsolation.test.ts` | 18 | Unit (mocked) | Tenant isolation across all 8 service modules |
| Utils | `tests/utils.test.ts` | 19 | Unit | Generators, fraud scoring, geo distances |
| IAM | `tests/iam.test.ts` | 14 | Unit (mocked) | Custom role CRUD, permission resolution |
| Billing | `tests/billing.test.ts` | 14 | Unit (mocked) | Invoice CRUD, payment flow, subscription |
| Farmers | `tests/farmers.test.ts` | 8 | Unit (mocked) | Farmer CRUD, CNIC uniqueness, custom fields |
| Policy Plans | `tests/policyPlans.test.ts` | 14 | Unit (mocked) | Plan CRUD, quote calc, config merging |
| Smoke | `tests/smoke.test.ts` | 39 | Integration | Full system: 14 areas, all imports, security headers |
| **Total** | **8 files** | **134** | | |

### Testing Pattern

```typescript
// Mock Prisma module
jest.mock("../src/lib/prisma", () => {
  const mockPrisma = { /* mocked methods */ };
  prisma = mockPrisma;
  return { prisma: mockPrisma };
});
```

### Running Tests

```bash
npm test                    # Full suite
npm run test:watch          # Watch mode
```

---

## Appendix: Key Design Decisions & Trade-offs

| Decision | Trade-off |
|----------|-----------|
| **Flat folder structure** (not per-feature modules) | Pros: Simple, predictable file locations. Cons: Becomes harder to navigate at 71+ files |
| **`as any` type casts for Prisma enums** | Avoids Prisma enum type mismatch — allows dynamic role assignment. Risk: loses type safety on enum fields |
| **BullMQ for all async tasks** | Pros: Fault-tolerant, retries, visibility. Cons: Requires Redis, additional infrastructure |
| **Neon serverless adapter** | Pros: Handles free-tier auto-suspend. Cons: Adds import complexity; fallback to standard client needed |
| **Redis caching with silent failure** | Pros: Resilient to Redis outages. Cons: Cache misses are invisible in logs |
| **Fabricated authId for imported users** | Pros: Allows bulk import without Supabase Auth dependency. Cons: Imported users must go through sign-up to log in |
| **Single PrismaClient singleton** | Pros: Connection pooling, global caching for dev. Cons: Potential for connection leaks in long-running processes |
| **Zod over class-validator/joi** | Pros: TypeScript-native, composable, lightweight. Cons: Less ecosystem support than class-validator |

---

> **Document version:** 2.0  
> **Last updated:** July 21, 2026  
> **Project:** Agricultural Insurance Management System (AIMS)
