# AIMS Backend — Comprehensive Technical Report

> **Agricultural Insurance Management System**  
> Version 1.0 · Multi‑tenant · Express + TypeScript + Prisma 7  
> Generated: July 2026  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Data Model (Prisma Schema)](#3-data-model-prisma-schema)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Middleware](#5-middleware)
6. [API Routes — Complete Mapping](#6-api-routes--complete-mapping)
7. [Controllers](#7-controllers)
8. [Services (Business Logic)](#8-services-business-logic)
9. [Validators (Zod Schemas)](#9-validators-zod-schemas)
10. [Async Jobs (BullMQ)](#10-async-jobs-bullmq)
11. [Security Measures](#11-security-measures)
12. [Testing Strategy](#12-testing-strategy)
13. [Key Flows (Walkthroughs)](#13-key-flows-walkthroughs)
14. [API Examples](#14-api-examples)
15. [Deployment & Environment](#15-deployment--environment)
16. [Known Limitations & Future Work](#16-known-limitations--future-work)

---

## 1. System Overview

### What It Does

AIMS is a **multi‑tenant agricultural insurance management platform** that enables insurance companies (tenants) to manage their entire policy lifecycle — from farmer registration and land parcel mapping to policy purchase, claim processing, document management, and payment disbursement. Each tenant operates in complete isolation, seeing only their own farmers, policies, claims, and data.

### Target Users

| User Role | Description |
|-----------|-------------|
| **PLATFORM_ADMIN** | Cross-tenant operator: creates tenants, seeds plans, manages staff globally |
| **TENANT_ADMIN** | Tenant-level operator: manages staff, configures settings, runs bulk imports, views dashboards |
| **UNDERWRITER** | Creates/manages policy plans, reviews policy applications |
| **CLAIMS_OFFICER** | Assigns claims, reviews evidence, approves/rejects up to threshold |
| **SENIOR_CLAIMS_OFFICER** | Overrides decisions, handles high-risk claims, triggers payouts |
| **FIELD_AGENT** | Registers farmers in the field, performs inspections, uploads evidence |
| **FARMER** | Self-service end user: manages profile, purchases policies, submits claims |

### High-Level Architecture

```
Client (Mobile / Web / Admin Portal)
        │
        ▼
   Express Server (src/server.ts)
   ┌─────────────────────────────────────────────────┐
   │  Global Middleware Pipeline (execution order)    │
   │  Helmet → CORS → Webhook (raw body) → JSON      │
   │  → URL-encoded → Pino Logger → Rate Limiter     │
   │  → resolveTenant (subdomain/header)              │
   └────────────────────────┬────────────────────────┘
                            │
                      ┌─────┴─────┐
                      │   Routes  │  (14 route files)
                      └─────┬─────┘
                            │
                      ┌─────┴─────┐
                      │Controllers│  (15 files — thin layer)
                      └─────┬─────┘
                            │
                      ┌─────┴─────┐
                      │  Services │  (14 files — all business logic)
                      └─────┬─────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────┴────┐        ┌────┴────┐        ┌─────┴─────┐
   │ Prisma  │        │  Redis  │        │  BullMQ   │
   │  (Neon) │        │(Upstash)│        │  (Queues) │
   └────┬────┘        └─────────┘        └─────┬─────┘
        │                                      │
   ┌────┴────┐                          ┌──────┴──────┐
   │Postgres │                          │ OCR / Email │
   │ (Neon)  │                          │ / Import    │
   └─────────┘                          │ Workers     │
                                        └─────────────┘

   External Services:
   Supabase Auth (JWT) · Stripe (payments + billing) · Nodemailer (SMTP email) · Cloudinary (documents) · OpenRouter (AI/LLM)
```

### Key Design Principles

1. **Tenant Isolation** — Every Prisma query is scoped by `tenantId`. Enforced at three levels: middleware (guard), service (filter), and database (index + constraint).
2. **Async Everything External** — OCR, email, Stripe, and bulk import are always queued via BullMQ, never inline in the request/response cycle.
3. **Role-Based Access** — Every endpoint has an explicit role guard. Seven roles from `FARMER` to `PLATFORM_ADMIN`.
4. **Validation on Every Input** — Zod schemas validate every POST/PATCH/PUT request body.
5. **Free-Tier Conscious** — Designed to run on Neon free tier (auto-suspend handling), Upstash Redis (minimal queues), and Cloudinary free tier (auto-compression).
6. **Pagination Everywhere** — All list endpoints return paginated results with `{ page, limit, total, totalPages }`.
7. **AI/LLM via OpenRouter** — All AI analysis (images, documents) goes through OpenRouter as a single unified gateway (Gemini, GPT-4o, Claude, etc.), no separate API modules.

---

## 2. Technology Stack

| Dependency | Version | Role |
|-----------|---------|------|
| **express** | ^5.2.1 | HTTP framework (Express 5 with async error handling) |
| **typescript** | ^5.x | Type safety and compilation |
| **ts-node-dev** | ^2.0.0 | Development server with auto-restart |
| **@prisma/client** | ^7.8.0 | Database ORM (Prisma 7) |
| **prisma** | ^7.8.0 | Prisma CLI (migrations, generate) |
| **@neondatabase/serverless** | ^1.1.0 | Neon PostgreSQL serverless driver (production) |
| **@supabase/supabase-js** | ^2.x | Authentication provider (JWT verification) |
| **zod** | ^4.4.3 | Request body validation schemas |
| **bullmq** | ^5.80.5 | Redis-backed async job queues |
| **ioredis** | ^5.11.1 | Redis client (BullMQ + caching) |
| **cloudinary** | ^2.10.0 | Document/image upload and transformation |
| **multer** | ^2.2.0 | Multipart file upload handling |
| **stripe** | ^22.3.2 | Payment processing + subscription billing |
| **nodemailer** | ^9.0.3 | Transactional email (SMTP) |
| **helmet** | ^8.3.0 | HTTP security headers |
| **cors** | ^2.8.6 | Cross-origin resource sharing |
| **express-rate-limit** | ^8.5.2 | Request rate limiting |
| **pino** | ^10.3.1 | Structured JSON logger |
| **pino-http** | ^11.0.0 | HTTP request/response logging |
| **csv-parse** | ^7.0.1 | CSV parsing for bulk import |
| **jest** | ^30.4.2 | Test runner |
| **supertest** | ^7.2.2 | HTTP assertion library |
| **ts-jest** | ^29.4.11 | Jest TypeScript transformer |

---

## 3. Data Model (Prisma Schema)

### 3.1 Complete Model Reference

There are **11 models** and **4 enums** in `prisma/schema.prisma`.

#### Enum: Role
```
PLATFORM_ADMIN | TENANT_ADMIN | UNDERWRITER | CLAIMS_OFFICER | SENIOR_CLAIMS_OFFICER | FIELD_AGENT | FARMER
```

#### Enum: PolicyStatus
```
ACTIVE | EXPIRED | CANCELLED
```

#### Enum: ClaimStatus
```
SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | PAID
```

#### Enum: PaymentType
```
PREMIUM | PAYOUT
```

---

#### Model: Tenant

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `name` | String | `@unique` | |
| `slug` | String | `@unique` | |
| `logoUrl` | String? | | |
| `isActive` | Boolean | `@default(true)` | |
| `config` | Json? | | |
| `stripeCustomerId` | String? | `@unique` | |
| `stripeSubscriptionId` | String? | `@unique` | |
| `billingEnabled` | Boolean | `@default(false)` | |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |
| | | | → User[ ] |
| | | | → PolicyPlan[ ] |
| | | | → Farmer[ ] |

**Index:** `@@index([slug])`

---

#### Model: User

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `tenantId` | String | | → Tenant |
| `authId` | String | `@unique` | Supabase Auth user UUID |
| `email` | String | | |
| `phone` | String? | | |
| `role` | Role | | |
| `isActive` | Boolean | `@default(true)` | |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |
| `lastLoginAt` | DateTime? | | |
| | | | → Farmer (optional) |
| | | | → Notification[ ] |
| | | | → ClaimStatusHistory[ ] |
| | | | → ClaimDocument[ ] (uploadedBy) |
| | | | → Claim[ ] (assignedClaimsOfficer) |
| | | | → Policy[ ] (underwriter) |

**Constraints:**
- `@@unique([tenantId, authId])`
- `@@unique([tenantId, email])`

**Indexes:** `@@index([tenantId])`, `@@index([role])`

---

#### Model: Farmer

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `tenantId` | String | | → Tenant |
| `userId` | String | `@unique` | → User |
| `fullName` | String | | |
| `guardianName` | String? | | |
| `cnicNumber` | String | | National ID |
| `dateOfBirth` | DateTime? | | |
| `gender` | String? | | |
| `address` | String? | | |
| `city` | String? | | |
| `province` | String? | | |
| `bankName` | String? | | |
| `bankAccountNumber` | String? | | |
| `accountTitle` | String? | | |
| `profilePhotoUrl` | String? | | |
| `createdAt` | DateTime | `@default(now())` | |
| | | | → LandParcel[ ] |
| | | | → Policy[ ] |
| | | | → Claim[ ] |

**Constraint:** `@@unique([tenantId, cnicNumber])`
**Indexes:** `@@index([tenantId])`, `@@index([userId])`

---

#### Model: LandParcel

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `tenantId` | String | | |
| `farmerId` | String | | → Farmer |
| `landTitleNumber` | String? | | |
| `address` | String | | |
| `latitude` | Float? | | |
| `longitude` | Float? | | |
| `areaAcres` | Float | | |
| `soilType` | String? | | |
| `cropType` | String | | |
| `irrigationType` | String? | | |
| `ownershipType` | String? | | |
| `district` | String? | | |
| `createdAt` | DateTime | `@default(now())` | |
| | | | → Policy[ ] |

**Indexes:** `@@index([tenantId])`, `@@index([farmerId])`

---

#### Model: PolicyPlan

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `tenantId` | String | | → Tenant |
| `name` | String | | |
| `cropType` | String | | |
| `coveragePerAcre` | Float | | |
| `premiumRate` | Float | | |
| `minAreaAcres` | Float? | | |
| `maxAreaAcres` | Float? | | |
| `termMonths` | Int | | |
| `description` | String? | | |
| `isActive` | Boolean | `@default(true)` | |
| `config` | Json? | | Auto-trigger thresholds, custom fields |
| `createdAt` | DateTime | `@default(now())` | |
| | | | → Policy[ ] |

**Constraint:** `@@unique([tenantId, name])`
**Indexes:** `@@index([tenantId])`, `@@index([isActive])`

---

#### Model: Policy

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `tenantId` | String | | |
| `policyNumber` | String | `@unique` | Auto-generated |
| `farmerId` | String | | → Farmer |
| `landParcelId` | String | | → LandParcel |
| `policyPlanId` | String | | → PolicyPlan |
| `underwriterId` | String? | | → User (Underwriter) |
| `coverageAmount` | Float | | |
| `premiumAmount` | Float | | |
| `premiumPaid` | Boolean | `@default(false)` | |
| `paymentDate` | DateTime? | | |
| `startDate` | DateTime | | |
| `endDate` | DateTime | | |
| `status` | PolicyStatus | `@default(ACTIVE)` | |
| `certificateUrl` | String? | | |
| `createdAt` | DateTime | `@default(now())` | |
| | | | → Claim[ ] |
| | | | → Payment[ ] |

**Indexes:** `@@index([tenantId])`, `@@index([farmerId])`, `@@index([status])`

---

#### Model: Claim

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `tenantId` | String | | |
| `claimNumber` | String | `@unique` | Auto-generated |
| `policyId` | String | | → Policy |
| `farmerId` | String | | → Farmer |
| `assignedClaimsOfficerId` | String? | | → User |
| `incidentType` | String | | |
| `incidentDate` | DateTime | | |
| `incidentLocation` | String? | | |
| `description` | String | | |
| `estimatedLossPercentage` | Float? | | |
| `claimedAmount` | Float | | |
| `approvedAmount` | Float? | | |
| `fraudScore` | Int? | `@default(0)` | Computed by fraud engine |
| `fraudVerdict` | String? | | LOW / MEDIUM / HIGH / CRITICAL |
| `status` | ClaimStatus | `@default(SUBMITTED)` | |
| `rejectionReason` | String? | | |
| `submittedAt` | DateTime | `@default(now())` | |
| `resolvedAt` | DateTime? | | |
| | | | → ClaimDocument[ ] |
| | | | → ClaimStatusHistory[ ] |
| | | | → Payment[ ] |
| | | | → FraudAuditLog[ ] |

**Indexes:** `@@index([tenantId])`, `@@index([policyId])`, `@@index([status])`, `@@index([farmerId])`

---

#### Model: ClaimDocument

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `claimId` | String | | → Claim |
| `uploadedByUserId` | String | | → User |
| `url` | String | | Cloudinary URL |
| `type` | String | | Document type (photo, report, etc.) |
| `fileSize` | Int? | | |
| `mimeType` | String? | | |
| `ocrExtractedData` | Json? | | Populated by OCR worker |
| `uploadedAt` | DateTime | `@default(now())` | |

**Index:** `@@index([claimId])`

---

#### Model: ClaimStatusHistory

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `claimId` | String | | → Claim |
| `fromStatus` | String | | |
| `toStatus` | String | | |
| `changedByUserId` | String | | → User |
| `note` | String? | | |
| `changedAt` | DateTime | `@default(now())` | |

**Index:** `@@index([claimId])`

---

#### Model: Payment

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `tenantId` | String | | |
| `policyId` | String? | | → Policy |
| `claimId` | String? | | → Claim |
| `type` | PaymentType | | PREMIUM or PAYOUT |
| `amount` | Float | | |
| `gatewayTransactionId` | String? | | Stripe PI/transfer ID |
| `status` | String | | e.g., "pending", "completed" |
| `paidAt` | DateTime? | | |
| `createdAt` | DateTime | `@default(now())` | |

**Indexes:** `@@index([tenantId])`, `@@index([policyId])`, `@@index([claimId])`

---

#### Model: Notification

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `userId` | String | | → User |
| `type` | String | | e.g., CLAIM_SUBMITTED, TENANT_CREATED |
| `title` | String | | |
| `message` | String | | |
| `isRead` | Boolean | `@default(false)` | |
| `relatedEntityType` | String? | | |
| `relatedEntityId` | String? | | |
| `createdAt` | DateTime | `@default(now())` | |

**Index:** `@@index([userId, isRead])`

---

#### Model: FraudAuditLog (Immutable Fraud Trail)

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `claimId` | String | | → Claim |
| `score` | Int | | Fraud score (0-100) |
| `verdict` | String | | LOW / MEDIUM / HIGH / CRITICAL |
| `flags` | Json? | | Triggered fraud flags |
| `ruleResults` | Json? | | Per-rule check results |
| `rawMetadata` | Json? | | AI outputs, GPS data, etc. |
| `createdAt` | DateTime | `@default(now())` | |

**Indexes:** `@@index([claimId])`, `@@index([score])`

---

#### Model: AutoTriggerLog (Satellite Monitoring Audit)

| Field | Type | Attributes | Relations |
|-------|------|-----------|-----------|
| `id` | String | `@id @default(uuid())` | |
| `tenantId` | String | | |
| `policyId` | String | | |
| `landParcelId` | String | | |
| `ndviPre` | Float | | Vegetation index before incident |
| `ndviPost` | Float | | Vegetation index after incident |
| `ndviDrop` | Float | | Calculated drop |
| `weatherEvent` | String? | | Severe weather event detected |
| `weatherData` | Json? | | Raw weather API response |
| `triggerMatched` | Boolean | | Whether conditions met |
| `claimId` | String? | | Auto-created claim (if triggered) |
| `checkedAt` | DateTime | `@default(now())` | |

**Indexes:** `@@index([tenantId])`, `@@index([policyId])`, `@@index([checkedAt])`

---

### 3.2 Tenant Isolation in the Schema

Every tenant-scoped model includes `tenantId: String`. Unique constraints are scoped to the tenant:
- `@@unique([tenantId, authId])` — a user's auth ID is unique within a tenant
- `@@unique([tenantId, email])` — email is unique within a tenant
- `@@unique([tenantId, name])` — policy plan name is unique within a tenant
- `@@unique([tenantId, cnicNumber])` — national ID is unique within a tenant

The `Tenant` model itself enforces globally unique `name` and `slug`.

---

## 4. Authentication & Authorization

### 4.1 Supabase Auth Integration

Authentication uses **Supabase Auth** (`@supabase/supabase-js`). A Supabase client is initialized in `src/lib/supabase.ts` using the anon key (safe for client-side and server-side use). On every protected route:

1. The client sends a Bearer JWT token in the `Authorization` header
2. `requireAuth` middleware calls `supabase.auth.getUser(token)` to verify the token with Supabase Auth
3. If valid, the middleware looks up the local `User` row by `authId` (the Supabase user UUID)
4. **Lookup strategy** (3-step):
   - **Step 1:** Look up by `authId` (Supabase user UUID) — fastest path for returning users
   - **Step 2:** If not found, look up by `email` — handles admin-created users who had placeholder `authId`s before their Supabase sign-up
   - **Step 3:** If not found at all, create a new local user with `role: "FARMER"`
5. If found by email (Step 2), the middleware updates the `authId` to the real Supabase UUID, linking the records
6. On each login, `lastLoginAt` and `email` are updated

```typescript
// Core logic from middleware/auth.ts
const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
const authId = supabaseUser.id;
const email = supabaseUser.email || "";
// Strategy 1: authId lookup
let localUser = await prisma.user.findUnique({ where: { authId } });
if (!localUser && email) {
  // Strategy 2: email lookup (links admin-created users)
  localUser = await prisma.user.findFirst({ where: { email, tenantId } });
}
if (!localUser) {
  // Strategy 3: create new
  localUser = await prisma.user.create({ data: { tenantId, authId, email, role: "FARMER" } });
}
```

### 4.2 Middleware Flow

For every protected route, middleware executes in this order:

```
Request
  │
  ├── [1] resolveTenant()  ← Reads subdomain or x-tenant-slug header
  │                          Attaches req.tenant (id, name, slug, config)
  │
  ├── [2] requireAuth()    ← Verifies Bearer JWT via Supabase Auth
  │                          3-strategy user lookup (authId → email → create)
  │                          Attaches req.user (id, tenantId, authId, email, role)
  │
  ├── [3] requireTenantAccess()  ← If req.tenant exists, verify
  │                                req.user.tenantId === req.tenant.id
  │                                PLATFORM_ADMIN bypasses this check
  │
  ├── [4] requireRole(...)  ← Checks req.user.role is in allowed list
  │
  ├── [5] validate(schema) ← Zod schema validation of req.body
  │
  └── Controller → Service → Response
```

### 4.3 Tenant Resolution

Tenant is resolved from two sources (in priority order):

1. **`x-tenant-slug` header** — used by API clients (e.g., Postman, mobile apps)
2. **Subdomain** — extracted from the hostname (e.g., `acme.aims.com` → slug = `acme`)

The `resolveTenant` middleware in `src/middleware/auth.ts`:
- Splits `req.hostname` by `.`
- If the first part is not `www` or `api`, uses it as the tenant slug
- Looks up the tenant by slug in the database
- Attaches `req.tenant` if found and active

```typescript
const parts = host.split(".");
if (parts.length >= 2) {
  const subdomain = parts[0];
  if (subdomain && subdomain !== "www" && subdomain !== "api") {
    slug = subdomain;
  }
}
```

### 4.4 PLATFORM_ADMIN Bypass

In `requireTenantAccess`:
```typescript
if (req.user.role === "PLATFORM_ADMIN") {
  next();  // Platform admins can access any tenant's data
  return;
}
```

This allows the platform admin to view and manage all tenants without being blocked by the tenant isolation guard.

### 4.5 Role Guard Usage

Every endpoint has an explicit role requirement. Examples:
- `requireRole("FARMER")` — farmer self-service endpoints
- `requireRole("TENANT_ADMIN", "PLATFORM_ADMIN")` — admin endpoints
- `requireRole("CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN")` — claims processing
- `requireRole("PLATFORM_ADMIN")` — tenant management

---

## 5. Middleware

### 5.1 Middleware Execution Order (in `server.ts`)

| # | Middleware | File | Purpose |
|---|-----------|------|---------|
| 1 | `helmet()` | — | Sets security headers (CSP, XSS, clickjacking, etc.) |
| 2 | `cors()` | — | Enables cross-origin requests |
| 3 | Stripe webhook route | `server.ts` line 25 | Raw body parser for webhook (before JSON) |
| 4 | `express.json({ limit: "10mb" })` | — | Parses JSON bodies, 10MB limit |
| 5 | `express.urlencoded({ extended: true })` | — | Parses URL-encoded bodies |
| 6 | `pinoHttp(...)` | — | HTTP request/response logging |
| 7 | `apiLimiter` | `rateLimiter.ts` | 100 requests per 15 minutes |
| 8 | `resolveTenant` | `auth.ts` | Resolves tenant from subdomain/header |
| 9 | Route-level middleware | (per route) | requireAuth, requireTenantAccess, requireRole, validate |
| 10 | `errorHandler` | `errorHandler.ts` | Catches all errors, formats response |

### 5.2 Middleware Details

#### `resolveTenant` (`middleware/auth.ts`)
- **When:** Runs on every request
- **What:** Checks `x-tenant-slug` header, then subdomain
- **Attaches:** `req.tenant = { id, name, slug, config }`
- **On failure:** Silently continues without tenant (non-blocking)

#### `requireAuth` (`middleware/auth.ts`)
- **When:** Runs on every protected route
- **What:** Validates Bearer JWT via `supabase.auth.getUser(token)`, then uses 3-strategy user lookup (authId → email → create new)
- **Attaches:** `req.user = { id, tenantId, authId, email, role }`
- **On failure:** Returns `401` with error message
- **Email linking:** If a user was admin-created with a placeholder `authId`, the middleware finds them by email on first login and links the real Supabase UUID

#### `requireTenantAccess` (`middleware/roleGuard.ts`)
- **When:** Runs on tenant-scoped routes
- **What:** If `req.tenant` exists, verifies `req.user.tenantId === req.tenant.id`
- **Bypass:** Platform admins bypass the check
- **On failure:** Returns `403`

#### `requireRole(...roles)` (`middleware/roleGuard.ts`)
- **When:** Runs on all endpoints
- **What:** Checks if `req.user.role` is in the allowed list
- **On failure:** Returns `403` with `"Access denied. Required role: ..."`

#### `validate(schema)` (`middleware/validate.ts`)
- **When:** Runs on POST/PATCH routes
- **What:** Parses `req.body` against a Zod schema; replaces `req.body` with parsed data
- **On failure:** Returns `400` with Zod error details

#### `errorHandler` (`middleware/errorHandler.ts`)
- **When:** Error handler (4-param middleware)
- **What:**
  - `AppError` → returns `res.status(err.statusCode).json({ status: "error", message })`
  - `ZodError` → returns `res.status(400).json({ status: "error", message: "Validation failed", errors })`
  - Unknown → returns `500` + logs via pino

#### Rate Limiters (`middleware/rateLimiter.ts`)

| Limiter | Window | Max | Applied To |
|---------|--------|-----|------------|
| `apiLimiter` | 15 min | 100 | All routes (global) |
| `authLimiter` | 15 min | 20 | Auth endpoints |
| `uploadLimiter` | 1 hour | 50 | Document uploads |

---

## 6. API Routes — Complete Mapping

### 6.1 Auth (`/api/v1/auth`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| GET | `/me` | Yes | Any | — | `getMe` | Get current user profile with farmer + tenant |
| PATCH | `/profile` | Yes | Any | `updateProfileSchema` | `updateProfile` | Update phone number |
| PATCH | `/role` | Yes | `PLATFORM_ADMIN` | `updateUserRoleSchema` | `updateUserRole` | Change a user's role |
| GET | `/users` | Yes | `PLATFORM_ADMIN` | — | `listUsers` | List all users (paginated) |

### 6.2 Farmers (`/api/v1/farmers`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| GET | `/` | Yes | `FARMER` | — | `getFarmerProfile` | Get own farmer profile |
| POST | `/` | Yes | `FARMER` | `createFarmerSchema` | `createFarmerProfile` | Create farmer profile |
| PATCH | `/` | Yes | `FARMER` | `updateFarmerSchema` | `updateFarmerProfile` | Update farmer profile |

### 6.3 Land Parcels (`/api/v1/land-parcels`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| GET | `/` | Yes | `FARMER` | — | `listLandParcels` | List own land parcels (paginated) |
| GET | `/:id` | Yes | `FARMER` | — | `getLandParcel` | Get parcel details with policies |
| POST | `/` | Yes | `FARMER` | `createLandParcelSchema` | `createLandParcel` | Register new land parcel |
| PATCH | `/:id` | Yes | `FARMER` | `updateLandParcelSchema` | `updateLandParcel` | Update land parcel |
| DELETE | `/:id` | Yes | `FARMER` | — | `deleteLandParcel` | Delete land parcel |

### 6.4 Policy Plans (`/api/v1/policy-plans`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| GET | `/` | Yes | Any | — | `listPolicyPlans` | List active plans (paginated) |
| GET | `/:id` | Yes | Any | — | `getPolicyPlan` | Get plan details |
| POST | `/` | Yes | `TENANT_ADMIN` | `createPolicyPlanSchema` | `createPolicyPlan` | Create new policy plan |
| PATCH | `/:id` | Yes | `TENANT_ADMIN` | `updatePolicyPlanSchema` | `updatePolicyPlan` | Update policy plan |
| POST | `/quote` | Yes | Any | `quotePremiumSchema` | `calculateQuote` | Calculate premium quote |

### 6.5 Policies (`/api/v1/policies`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| GET | `/` | Yes | `FARMER` | — | `listFarmerPolicies` | List own policies (paginated) |
| GET | `/:id` | Yes | `FARMER`, staff roles | — | `getPolicy` | Get policy with plan, parcel, claims |
| POST | `/` | Yes | `FARMER` | `purchasePolicySchema` | `purchasePolicy` | Purchase a policy |

### 6.6 Claims (`/api/v1/claims`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| POST | `/` | Yes | `FARMER` | `createClaimSchema` | `createClaim` | Submit new claim |
| GET | `/my` | Yes | `FARMER` | — | `listMyClaims` | List own claims (paginated) |
| GET | `/my/:id` | Yes | `FARMER` | — | `getClaim` | Get own claim details |
| GET | `/` | Yes | `CLAIMS_OFFICER`, admin roles | — | `listAllClaims` | List all claims (paginated) |
| GET | `/:id` | Yes | `CLAIMS_OFFICER`, admin roles | — | `getClaim` | Get any claim details |
| PATCH | `/:id/assign` | Yes | `CLAIMS_OFFICER`, admin roles | `assignClaimSchema` | `assignClaim` | Assign claims officer |
| PATCH | `/:id/status` | Yes | `CLAIMS_OFFICER`, admin roles | `updateClaimStatusSchema` | `updateClaimStatus` | Update claim status |

### 6.7 Documents (`/api/v1/documents`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| POST | `/upload` | Yes | `FARMER` | multer + `createDocumentSchema` | `uploadDocument` | Upload document to Cloudinary |
| GET | `/claim/:claimId` | Yes | Any | — | `getClaimDocuments` | List claim documents |
| GET | `/:id` | Yes | Any | — | `getDocument` | Get document details |
| DELETE | `/:id` | Yes | `FARMER` | — | `deleteDocument` | Delete document from Cloudinary + DB |

### 6.8 Payments (`/api/v1/payments`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| POST | `/premium` | Yes | `FARMER` | `createPaymentIntentSchema` | `createPremiumPayment` | Create Stripe payment intent |
| POST | `/premium/confirm` | Yes | `FARMER` | — | `confirmPremiumPayment` | Confirm payment from webhook |
| POST | `/payout/:claimId` | Yes | `TENANT_ADMIN` | `processPayoutSchema` | `processPayout` | Process claim payout via Stripe |
| GET | `/policy/:policyId` | Yes | Any | — | `getPaymentsForPolicy` | Get policy payments |
| GET | `/claim/:claimId` | Yes | Any | — | `getPaymentsForClaim` | Get claim payments |

### 6.9 Notifications (`/api/v1/notifications`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| GET | `/` | Yes | Any | — | `listNotifications` | List user notifications (paginated) |
| PATCH | `/read` | Yes | Any | `markReadSchema` | `markAsRead` | Mark specific as read |
| PATCH | `/read-all` | Yes | Any | — | `markAllAsRead` | Mark all as read |

### 6.10 Admin (`/api/v1/admin`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| POST | `/staff` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | `createStaffUserSchema` | `createStaffUser` | Create staff user |
| GET | `/staff` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | — | `listStaffUsers` | List staff users (paginated) |
| PATCH | `/staff/:id/toggle-status` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | — | `toggleUserStatus` | Activate/deactivate staff |
| GET | `/dashboard` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | — | `getDashboard` | Dashboard aggregates (cached) |
| GET | `/analytics/claims` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | — | `getClaimsAnalytics` | Claims analytics |

### 6.11 Platform (`/api/v1/platform`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| POST | `/tenants` | Yes | `PLATFORM_ADMIN` | `createTenantSchema` | `createTenant` | Create tenant + admin user |
| GET | `/tenants` | Yes | `PLATFORM_ADMIN` | — | `listTenants` | List all tenants (paginated) |
| GET | `/tenants/:id` | Yes | `PLATFORM_ADMIN` | — | `getTenant` | Get tenant with counts |
| PATCH | `/tenants/:id` | Yes | `PLATFORM_ADMIN` | `updateTenantSchema` | `updateTenant` | Update tenant |
| DELETE | `/tenants/:id` | Yes | `PLATFORM_ADMIN` | — | `deactivateTenant` | Deactivate tenant |
| POST | `/tenants/:id/seed` | Yes | `PLATFORM_ADMIN` | `seedPlansSchema` | `seedTenantPlans` | Seed tenant with policy plans |

### 6.12 Tenant Settings (`/api/v1/settings`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| GET | `/` | Yes | `TENANT_ADMIN` | — | `getSettings` | Get tenant settings |
| PATCH | `/` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | `updateSettingsSchema` | `updateSettings` | Update tenant settings (config merge) |

### 6.13 Import (`/api/v1/import`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| POST | `/policy-plans` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | `importPolicyPlansSchema` | `importPolicyPlans` | Import policy plans (CSV/JSON) |
| POST | `/farmers-policies` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | `importFarmersPoliciesSchema` | `importFarmersPolicies` | Import farmers & policies (CSV/JSON) |

### 6.14 Billing (`/api/v1/billing`)

| Method | Path | Auth | Roles | Validator | Controller | Description |
|--------|------|------|-------|-----------|------------|-------------|
| POST | `/subscribe` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | — | `subscribe` | Create Stripe Checkout session |
| POST | `/cancel` | Yes | `TENANT_ADMIN`, `PLATFORM_ADMIN` | — | `cancelSubscription` | Cancel subscription |
| GET | `/status` | Yes | Any (tenant-scoped) | — | `getSubscriptionStatus` | Get subscription status |
| POST | `/webhook` | No (raw) | Public | — | `handleWebhook` | Stripe webhook receiver |

**Total endpoints: 48** across 14 route files.

---

## 7. Controllers

Controllers are thin — they parse request parameters, call a single service function, and format the response. Each function follows this pattern:

```typescript
export async function createClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const claim = await claimService.createClaim(
      req.user!.id,                     // userId from auth
      req.user!.tenantId,                // tenantId from auth
      req.body                           // validated body
    );
    res.status(201).json({ status: "success", data: claim });
  } catch (error) { next(error); }
}
```

### 7.1 Controller Details

| Controller | File | Functions | Key Parameters Extracted |
|-----------|------|-----------|------------------------|
| **auth** | `auth.controller.ts` | `getMe`, `updateProfile`, `updateUserRole`, `listUsers` | `req.user.id`, `req.body`, `req.query.page/limit` |
| **farmers** | `farmers.controller.ts` | `getFarmerProfile`, `createFarmerProfile`, `updateFarmerProfile` | `req.user.id`, `req.user.tenantId`, `req.body` |
| **landParcels** | `landParcels.controller.ts` | `listLandParcels`, `getLandParcel`, `createLandParcel`, `updateLandParcel`, `deleteLandParcel` | `req.user.id` (farmerId), `req.user.tenantId`, `req.params.id`, `req.body`, `req.query.page/limit` |
| **policyPlans** | `policyPlans.controller.ts` | `listPolicyPlans`, `getPolicyPlan`, `createPolicyPlan`, `updatePolicyPlan`, `calculateQuote` | `req.user.tenantId`, `req.params.id`, `req.body`, `req.query.page/limit` |
| **policies** | `policies.controller.ts` | `listFarmerPolicies`, `getPolicy`, `purchasePolicy` | `req.user.tenantId`, `req.params.id`, `req.body`, `req.query.page/limit` |
| **claims** | `claims.controller.ts` | `createClaim`, `listMyClaims`, `getClaim`, `listAllClaims`, `assignClaim`, `updateClaimStatus` | `req.user.id`, `req.user.tenantId`, `req.params.id`, `req.body`, `req.query.status/page/limit` |
| **documents** | `documents.controller.ts` | `uploadDocument`, `getClaimDocuments`, `getDocument`, `deleteDocument` | `req.user.id`, `req.user.tenantId`, `req.file`, `req.params.claimId`, `req.body` |
| **payments** | `payments.controller.ts` | `createPremiumPayment`, `confirmPremiumPayment`, `processPayout`, `getPaymentsForPolicy`, `getPaymentsForClaim` | `req.user.tenantId`, `req.params.claimId`, `req.body` |
| **notifications** | `notifications.controller.ts` | `listNotifications`, `markAsRead`, `markAllAsRead` | `req.user.id`, `req.body.notificationIds`, `req.query.unreadOnly/page/limit` |
| **admin** | `admin.controller.ts` | `createStaffUser`, `listStaffUsers`, `toggleUserStatus`, `getDashboard`, `getClaimsAnalytics` | `req.user.tenantId`, `req.params.id`, `req.body`, `req.query.role/page/limit` |
| **platform** | `platform.controller.ts` | `createTenant`, `listTenants`, `getTenant`, `updateTenant`, `deactivateTenant`, `seedTenantPlans` | `req.body`, `req.params.id`, `req.query.page/limit` |
| **tenantSettings** | `tenantSettings.controller.ts` | `getSettings`, `updateSettings` | `req.user?.tenantId`, `req.tenant?.id`, `req.body` |
| **import** | `import.controller.ts` | `importPolicyPlans`, `importFarmersPolicies` | `req.user.tenantId`, `req.body.format/data/columnMapping` |
| **billing** | `billing.controller.ts` | `subscribe`, `cancelSubscription`, `getSubscriptionStatus` | `req.user?.tenantId`, `req.tenant?.id` |
| **billingWebhook** | `billingWebhook.controller.ts` | `handleWebhook` | `req.body` (raw buffer), `req.headers["stripe-signature"]` |

---

## 8. Services (Business Logic)

### 8.1 auth.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `getCurrentUser` | `userId: string` | Finds user with farmer + tenant include; throws 404 if not found |
| `updateProfile` | `userId, { phone? }` | Updates user phone |
| `updateUserRole` | `currentUserId, targetUserId, role` | Verifies caller is PLATFORM_ADMIN; validates target exists; updates role |
| `listUsers` | `page, limit, tenantId?` | Paginated user list; filters by tenantId if provided |

### 8.2 farmers.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `getFarmerProfile` | `userId` | Finds farmer by userId with landParcels, policies, claims |
| `createFarmerProfile` | `userId, tenantId, data` | Checks duplicate profile + CNIC within tenant; creates farmer |
| `updateFarmerProfile` | `userId, data` | Finds farmer by userId; updates fields |

### 8.3 landParcels.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `getLandParcels` | `farmerId, tenantId, page, limit` | Paginated parcels for a farmer (scoped by tenant) |
| `getLandParcel` | `parcelId, tenantId` | Finds by id + tenantId; includes policies |
| `createLandParcel` | `farmerId, tenantId, data` | Creates parcel with farmer + tenant scoping |
| `updateLandParcel` | `parcelId, farmerId, tenantId, data` | Verifies ownership (farmerId match); updates |
| `deleteLandParcel` | `parcelId, farmerId, tenantId` | Verifies ownership; deletes |

### 8.4 policyPlans.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `listPolicyPlans` | `tenantId, page, limit` | Only active plans; paginated |
| `getPolicyPlan` | `planId, tenantId` | Finds by id + tenantId |
| `createPolicyPlan` | `tenantId, data` | Creates plan for tenant |
| `updatePolicyPlan` | `planId, tenantId, data` | Finds by id + tenantId; updates |
| `calculateQuote` | `policyPlanId, tenantId, areaAcres, termMonths?` | Validates plan is active + area constraints; calculates coverageAmount and premiumAmount |

**Premium calculation:**
```
coverageAmount = coveragePerAcre × areaAcres
premiumAmount  = premiumRate × coverageAmount
```

### 8.5 policies.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `purchasePolicy` | `farmerId, tenantId, data: { policyPlanId, landParcelId, startDate }` | Verifies parcel ownership, plan is active; calculates coverage + premium; generates policyNumber; creates policy with ACTIVE status |
| `listFarmerPolicies` | `farmerId, page, limit` | Paginated with plan + parcel includes |
| `getPolicy` | `policyId, tenantId` | Finds by id + tenantId; includes plan, parcel, farmer, claims, payments |

**Policy number format:** `POL-{base36timestamp}-{random4chars}`

### 8.6 claims.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `createClaim` | `farmerId, tenantId, userId, data` | Validates policy exists + belongs to farmer + is ACTIVE; checks for duplicate within 30 days; creates claim with SUBMITTED status; records status history; enqueues notification job |
| `listFarmerClaims` | `farmerId, tenantId, page, limit, status?` | Paginated with plan + documents + history includes |
| `getClaim` | `claimId, tenantId` | Full include: policy, plan, parcel, documents, history, assigned officer |
| `assignClaim` | `claimId, tenantId, claimsOfficerId` | Updates assignedOfficerId |
| `updateClaimStatus` | `claimId, tenantId, changedByUserId, { status, approvedAmount?, rejectionReason?, note? }` | Validates state transition; sets approvedAmount/rejectionReason on final states; records history; enqueues notification |

**State machine (VALID_TRANSITIONS):**
```
SUBMITTED → UNDER_REVIEW
UNDER_REVIEW → APPROVED | REJECTED
APPROVED → PAID  (via payments service, not via this function)
```

**Claim number format:** `CLM-{base36timestamp}-{random4chars}`

### 8.7 documents.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `uploadDocument` | `userId, tenantId, claimId, type, filePath` | Validates claim exists; uploads to Cloudinary with auto-compression; creates ClaimDocument row; enqueues OCR job |
| `getClaimDocuments` | `claimId` | Lists all documents for a claim |
| `getDocument` | `documentId` | Gets document by id |
| `deleteDocument` | `documentId` | Deletes from Cloudinary + database |

**Cloudinary transformation:** `{ quality: "auto", fetch_format: "auto" }` + `{ width: 1200, crop: "limit" }`

### 8.8 payments.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `createPremiumPayment` | `policyId, tenantId` | Creates Stripe PaymentIntent; creates a pending Payment row |
| `confirmPremiumPayment` | `paymentIntentId` | Verifies Stripe intent is succeeded; updates Payment + Policy (premiumPaid = true) |
| `processPayout` | `claimId, tenantId, amount` | Validates claim is APPROVED; creates Stripe transfer; creates Payment row; updates claim status to PAID |
| `getPaymentsForPolicy` | `policyId, tenantId` | Lists payments for a policy |
| `getPaymentsForClaim` | `claimId, tenantId` | Lists payments for a claim |

### 8.9 notifications.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `listNotifications` | `userId, page, limit, unreadOnly?` | Paginated with unread count |
| `markAsRead` | `userId, notificationIds` | Updates isRead on matched notifications |
| `markAllAsRead` | `userId` | Updates all unread to read |

### 8.10 admin.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `createStaffUser` | `tenantId, { email, role, phone? }` | Checks duplicate email; creates user with fabricated `authId` (`staff-{tenantId}-{timestamp}`) |
| `listStaffUsers` | `tenantId, page, limit, role?` | Excludes FARMER role; paginated |
| `toggleUserStatus` | `userId, tenantId` | Toggles isActive |
| `getDashboardAggregates` | `tenantId` | Redis-cached (300s); 8 parallel queries: farmer count, policy count, active policies, total claims, pending/approved claims, premium collected, payouts |
| `getClaimsAnalytics` | `tenantId` | groupBy on claim status + incident type |

### 8.11 platform.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `createTenant` | `{ name, slug, adminEmail, logoUrl?, billingEnabled? }` | Checks unique slug + name; creates Tenant + TENANT_ADMIN User; enqueues welcome notification; optionally creates Stripe customer |
| `listTenants` | `page, limit` | Paginated |
| `getTenant` | `tenantId` | Includes user/farmer/plan counts |
| `updateTenant` | `tenantId, data` | Validates slug/name uniqueness if changed |
| `deactivateTenant` | `tenantId` | Sets isActive = false |
| `seedTenantPlans` | `tenantId, plans[]` | Validates tenant exists + active; bulk creates plans |

### 8.12 tenantSettings.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `getSettings` | `tenantId` | Selects id, name, slug, logoUrl, config, isActive, billingEnabled |
| `updateSettings` | `tenantId, { name?, logoUrl?, config? }` | Merges config (spread operator — doesn't overwrite entirely); validates tenant is active |

### 8.13 import.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `importPolicyPlans` | `tenantId, format, data, columnMapping?` | Parses CSV/JSON; validates required fields per row (name, cropType, coveragePerAcre, premiumRate, termMonths); bulk creates valid plans; returns error report |
| `importFarmersPolicies` | `tenantId, format, data, columnMapping?` | Parses CSV/JSON; validates required fields per row (fullName, cnicNumber, email); finds or creates user with fabricated authId; checks CNIC uniqueness within tenant; creates farmer profile + land parcel; returns error report |

### 8.14 billing.service.ts

| Function | Parameters | Logic |
|----------|-----------|-------|
| `isBillingEnabled` | (none) | Returns `process.env.BILLING_ENABLED === "true"` |
| `createStripeCustomer` | `tenantId` | Creates Stripe customer; stores customerId on Tenant |
| `createSubscriptionSession` | `tenantId` | Creates Stripe Checkout session for subscription |
| `cancelSubscription` | `tenantId` | Cancels Stripe subscription; clears subscriptionId |
| `getSubscriptionStatus` | `tenantId` | Retrieves Stripe subscription status |
| `handleWebhookEvent` | `rawBody, signature` | Verifies signature; handles: checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed |

### 8.15 fraud.service.ts (Fraud Detection Engine)

**Two-phase architecture:** Sync (during claim submission, < 100ms) + Async (BullMQ worker, ~30s).

| Function | Parameters | Logic |
|----------|-----------|-------|
| `runSyncForensics` | `claimId, tenantId, farmerId, data` | Runs in-memory checks: duplicate claim (30-day window), claim amount vs loss % mismatch, farmer history (>3 claims in 1 year). Returns score (0-100) + verdict. Writes `FraudAuditLog`. |
| `enqueueAsyncFraudAnalysis` | `claimId, tenantId` | Enqueues a BullMQ `fraud` job for deeper analysis |
| `runAsyncFraudAnalysis` | `claimId, tenantId` | Runs in worker: (1) AI image analysis via OpenRouter (Gemini/GPT-4o), (2) Satellite NDVI comparison via Sentinel Hub, (3) Weather verification via OpenWeather. Updates score + verdict. Writes `FraudAuditLog`. |

**Fraud scoring thresholds:**
| Score | Verdict | Action |
|-------|---------|--------|
| 0-20 | LOW | Auto-approve possible |
| 21-50 | MEDIUM | Requires human review |
| 51-75 | HIGH | Escalate to SENIOR_CLAIMS_OFFICER |
| 76-100 | CRITICAL | Fraud investigation required |

---

## 9. Validators (Zod Schemas)

| File | Schema(s) | Validates |
|------|-----------|-----------|
| `auth.validator.ts` | `updateProfileSchema` | Optional phone string |
| | `updateUserRoleSchema` | UUID userId + one of 6 Role values |
| `admin.validator.ts` | `createStaffUserSchema` | Email, role (UNDERWRITER/CLAIMS_OFFICER/FIELD_AGENT/TENANT_ADMIN), optional phone |
| `platform.validator.ts` | `createTenantSchema` | Name (1-100 chars), slug (lowercase+hyphens regex), adminEmail, optional logoUrl+billingEnabled |
| | `updateTenantSchema` | All fields optional; logoUrl allows null; config is a record |
| | `seedPlansSchema` | Array of plans (min 1) with name, cropType, coveragePerAcre, premiumRate, termMonths |
| `claims.validator.ts` | `createClaimSchema` | UUID policyId, incidentType, ISO datetime incidentDate, description, optional loss %, positive claimedAmount |
| | `assignClaimSchema` | UUID claimsOfficerId |
| | `updateClaimStatusSchema` | Enum (UNDER_REVIEW/APPROVED/REJECTED), optional approvedAmount/rejectionReason/note |
| `documents.validator.ts` | `createDocumentSchema` | UUID claimId, string type |
| `payments.validator.ts` | `createPaymentIntentSchema` | UUID policyId |
| | `processPayoutSchema` | UUID claimId, positive amount |
| `notifications.validator.ts` | `markReadSchema` | Array of UUID notificationIds |
| `farmers.validator.ts` | `createFarmerSchema` | Required fullName + cnicNumber (13-15 chars); optional DOB, gender, address, bank details, profilePhotoUrl |
| | `updateFarmerSchema` | Same fields, all optional |
| `landParcels.validator.ts` | `createLandParcelSchema` | Required address + positive areaAcres + cropType; optional lat/lng, soilType, irrigationType, ownershipType, district |
| | `updateLandParcelSchema` | Same fields, all optional |
| `policyPlans.validator.ts` | `createPolicyPlanSchema` | Name, cropType, positive coveragePerAcre, positive premiumRate, positive termMonths |
| | `updatePolicyPlanSchema` | Same fields + isActive, all optional |
| | `quotePremiumSchema` | UUID policyPlanId, positive areaAcres, optional positive termMonths |
| `policies.validator.ts` | `purchasePolicySchema` | UUID policyPlanId + landParcelId, ISO datetime startDate |
| `import.validator.ts` | `importPolicyPlansSchema` | Format (csv/json), data string (min 1), optional columnMapping record |
| | `importFarmersPoliciesSchema` | Same as above |
| `tenantSettings.validator.ts` | `updateSettingsSchema` | Optional logoUrl (nullable), config record, name (1-100 chars) |
| `billing.validator.ts` | `subscribeSchema` | Optional returnUrl |
| | `cancelSubscriptionSchema` | Optional immediate boolean (default false) |

---

## 10. Async Jobs (BullMQ)

### 10.1 Queue Configuration

Five queues are defined in `src/lib/bullmq.ts`:

| Queue Name | Queue Variable | Worker Factory | Default Job Options |
|-----------|---------------|----------------|---------------------|
| `ocr` | `ocrQueue` | `createOcrWorker` | 3 attempts, exponential backoff (2s), keep last 100 completed, 50 failed |
| `notification` | `notificationQueue` | `createNotificationWorker` | Same |
| `import` | `importQueue` | `createImportWorker` | Same |
| `fraud` | `fraudQueue` | (inline Worker in `fraud-worker.ts`) | 3 attempts, exponential backoff (2s), keep last 100 completed, 50 failed, concurrency: 5, rate limiter: 10 req/sec |
| `auto-trigger` | `autoTriggerQueue` | (inline Worker in `auto-trigger-worker.ts`) | 2 attempts, exponential backoff (5s), keep last 100 completed, 50 failed, concurrency: 3 |

All queues share the same Redis connection (the `redis` instance from `src/lib/redis.ts`).

### 10.2 Job: OCR Processing (`src/jobs/ocrWorker.ts`)

| Detail | Value |
|--------|-------|
| **Triggered by** | `documents.service.ts` — after Cloudinary upload, enqueues `{ documentId, imageUrl }` |
| **Queue** | `ocr` |
| **Worker function** | `processOcrJob` |
| **Logic** | Simulates OCR by updating `ClaimDocument.ocrExtractedData` with `{ processedAt, textFound: true, confidence: 0.85, documentType: "claim_document" }` |
| **Retry** | 3 attempts, exponential backoff |
| **Note** | Currently simulated; production would call a real OCR service |

### 10.3 Job: Notification Dispatch (`src/jobs/notificationWorker.ts`)

| Detail | Value |
|--------|-------|
| **Triggered by** | `claims.service.ts` (claim-submitted, claim-status-changed), `platform.service.ts` (tenant-created) |
| **Queue** | `notification` |
| **Worker function** | `processNotificationJob` |
| **Logic** | Creates a `Notification` row in the database; sends an email via Nodemailer (SMTP) to the user's email |
| **Email from** | `AIMS <noreply@aims.app>` (configurable via `SMTP_FROM` env var) |
| **Fallback** | If email fails, logs warning but does not fail the job |
| **Retry** | 3 attempts, exponential backoff |

### 10.4 Job: Bulk Import (`src/jobs/importWorker.ts`)

| Detail | Value |
|--------|-------|
| **Triggered by** | `import.controller.ts` — when bulk data exceeds 50 records |
| **Queue** | `import` |
| **Worker function** | `processImportJob` |
| **Job types** | `policy-plans` or `farmers-policies` |
| **Logic** | Routes to `importPolicyPlans()` or `importFarmersPolicies()` from `import.service.ts`; updates job progress to 100% on completion |
| **Retry** | 3 attempts, exponential backoff |

### 10.5 Job: Fraud Analysis (`src/jobs/fraud-worker.ts`)

| Detail | Value |
|--------|-------|
| **Triggered by** | `fraud.service.enqueueAsyncFraudAnalysis` — called inline during `createClaim()` after sync forensics |
| **Queue** | `fraud` |
| **Worker function** | Inline worker in `fraud-worker.ts` |
| **Logic** | Calls `runAsyncFraudAnalysis()` which runs: OpenRouter AI image analysis → Sentinel Hub NDVI comparison → OpenWeather verification. Updates claim `fraudScore` and `fraudVerdict`. Writes `FraudAuditLog`. |
| **Concurrency** | 5 parallel jobs |
| **Rate limit** | 10 jobs/second |
| **Retry** | 3 attempts, exponential backoff |

### 10.6 Job: Auto-Trigger Monitoring (`src/jobs/auto-trigger-worker.ts`)

| Detail | Value |
|--------|-------|
| **Triggered by** | `scheduleAutoTriggerCheck()` — enqueues a batch of active policies every 6 hours |
| **Queue** | `auto-trigger` |
| **Worker function** | Inline worker in `auto-trigger-worker.ts` |
| **Logic** | For each ACTIVE policy with auto-trigger config: (1) Fetch NDVI pre/post incident via Sentinel Hub, (2) Check if NDVI drop exceeds threshold, (3) Verify weather confirms disaster via OpenWeather, (4) If conditions met → auto-create claim, (5) If fraud score < 30 → auto-approve. Logs every check in `AutoTriggerLog`. |
| **Concurrency** | 3 parallel jobs |
| **Retry** | 2 attempts, exponential backoff (5s) |
| **Note** | This is the X-Factor feature — zero-touch parametric insurance payouts |

### 10.7 Job Triggers by Service

| Service Function | Queue | Job Data |
|-----------------|-------|----------|
| `claims.service.createClaim` | notification | `{ userId, type: "CLAIM_SUBMITTED", title, message, relatedEntityType: "Claim", relatedEntityId }` |
| `claims.service.updateClaimStatus` | notification | `{ userId, type: "CLAIM_STATUS_CHANGED", title, message, relatedEntityType: "Claim", relatedEntityId }` |
| `platform.service.createTenant` | notification | `{ userId, type: "TENANT_CREATED", title, message, relatedEntityType: "Tenant", relatedEntityId }` |
| `documents.service.uploadDocument` | ocr | `{ documentId, imageUrl }` |
| `import.controller.importPolicyPlans` | import | `{ type: "policy-plans", tenantId, format, data, columnMapping, userId }` |
| `import.controller.importFarmersPolicies` | import | `{ type: "farmers-policies", tenantId, format, data, columnMapping, userId }` |
| `fraud.service.enqueueAsyncFraudAnalysis` | fraud | `{ claimId, tenantId }` |
| `auto-trigger-worker.scheduleAutoTriggerCheck` | auto-trigger | `{ tenantId?, policyIds? }` (batch of policies) |

---

## 11. Security Measures

### 11.1 Rate Limiting

| Limiter | Windows | Max Requests | Applied Via |
|---------|---------|-------------|------------|
| General API (`apiLimiter`) | 15 minutes | 100 | Global — `app.use(apiLimiter)` |
| Auth (`authLimiter`) | 15 minutes | 20 | Defined but **not wired** to routes |
| Upload (`uploadLimiter`) | 1 hour | 50 | Defined but **not wired** to routes |

**Note:** `authLimiter` and `uploadLimiter` are defined but not currently attached to any route. Only `apiLimiter` is applied globally.

### 11.2 CORS

CORS is enabled globally with `cors()` using default settings (all origins allowed). In production, this should be restricted to specific frontend domains.

### 11.3 Helmet

`helmet()` is applied globally, setting security headers including:
- Content-Security-Policy
- X-Content-Type-Options (nosniff)
- X-Frame-Options (DENY)
- X-XSS-Protection
- Strict-Transport-Security

### 11.4 Input Validation

- All POST/PATCH/PUT requests are validated by Zod schemas before reaching controllers
- Validation errors return `400` with structured field-level errors
- File uploads use Multer with a 10MB body limit

### 11.5 Tenant Isolation (Three-Layer Enforcement)

| Layer | Mechanism | File |
|-------|-----------|------|
| **Middleware** | `requireTenantAccess` compares `req.user.tenantId` with `req.tenant.id` | `middleware/roleGuard.ts` |
| **Service** | Every Prisma query includes `where: { tenantId: req.user.tenantId }` | All `src/services/*.ts` |
| **Database** | `tenantId` column on all tenant-scoped tables; compound unique constraints include `tenantId` | `prisma/schema.prisma` |

### 11.6 Sensitive Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL (`https://*.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (JWT verification) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | Stripe subscription price ID |
| `FRONTEND_URL` | Frontend URL for CORS and email links (`http://localhost:3000`) |
| `BILLING_ENABLED` | Toggle billing feature (`false` by default) |
| `PORT` | Server port (`4000` by default) |
| `REDIS_URL` | Redis connection URL (`redis://localhost:6379` for self-hosted, or Upstash `rediss://...` for managed) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Nodemailer SMTP credentials |
| `OPENROUTER_API_KEY` | OpenRouter AI/LLM API key (single gateway for Gemini, GPT-4o, Claude, Llama, etc.) |
| `SENTINEL_HUB_API_KEY` | Sentinel Hub API key for satellite NDVI data |
| `OPENWEATHER_API_KEY` | OpenWeather API key for weather event verification |

---

## 12. Testing Strategy

### 12.1 Test Files

| File | Type | Tests | Dependencies |
|------|------|-------|-------------|
| `tests/claims.test.ts` | Integration (Supertest) | 8 | Full Express app, prisma mock |
| `tests/tenantIsolation.test.ts` | Unit (mocked) | 18 | Mocked prisma module |
| `tests/setup.js` | Jest setup | — | Sets `DATABASE_URL` env var |
| `tests/setup.ts` | Unused | — | (Kept for reference) |

**Total: 26 tests, 2 test suites.**

### 12.2 Claims Test Suite (`tests/claims.test.ts`) — 8 Tests

Test file uses Supertest against the real Express app with a mocked Prisma. Covers:

1. **Health check** — `GET /health` returns 200
2. **Claim submission** — Farmer submits a claim, checks duplicate detection (409 on repeat submission within 30 days)
3. **Claim state machine** — SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED
4. **Role-based access** — FARMER cannot update claim status (403); CLAIMS_OFFICER can
5. **Invalid state transition** — Cannot transition from SUBMITTED directly to APPROVED (400)
6. **Tenant isolation** — Claims from one tenant are not visible to another tenant

### 12.3 Tenant Isolation Test Suite (`tests/tenantIsolation.test.ts`) — 18 Tests

Unit tests with a fully mocked Prisma module (no database connection required). Covers tenant isolation across all service modules:

| Test Group | Tests | Coverage |
|-----------|-------|----------|
| Auth | 2 | User lookup, role change scoped by tenant |
| Farmers | 2 | Profile creation checks CNIC uniqueness within tenant |
| Land Parcels | 2 | CRUD operations scoped by tenantId |
| Policy Plans | 2 | Quotes and plans scoped by tenantId |
| Policies | 2 | Policy creation checks plan/parcel ownership within tenant |
| Claims | 2 | Claim state machine transitions scoped by tenantId |
| Documents | 2 | Upload + getDocuments scoped by tenantId |
| Notifications | 2 | List + mark-read scoped by userId |
| Role Guard | 2 | requireRole() and requireTenantAccess() middleware behavior |

### 12.4 Test Mock Strategy

```typescript
// Mock Prisma module to avoid database connection
jest.mock("../src/lib/prisma", () => {
  const mockPrisma = {
    user:      { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    farmer:    { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    landParcel:{ findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    policyPlan:{ findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    policy:    { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    claim:     { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    claimDocument: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    claimStatusHistory: { create: jest.fn(), findMany: jest.fn() },
    notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    payment:   { create: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
    tenant:    { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    $disconnect: jest.fn(),
  };
  return { prisma: mockPrisma };
});
```

### 12.5 Known Test Issues

- **Jest exit timeout on Windows**: The `--forceExit` flag may be needed if Redis connection attempts cause Jest to hang
- **Redis ECONNREFUSED**: Redis is not mocked in the claims test suite; this generates noise but tests still pass
- **No coverage yet**: Jest coverage (`--coverage`) has not been configured

### 12.6 Running Tests

```bash
npm test                 # Run all tests (26)
npm run test:watch       # Watch mode for development
```

---

## 13. Key Flows (Walkthroughs)

### 13.1 Tenant Onboarding

```
PLATFORM_ADMIN
     │
     ├── POST /api/v1/platform/tenants
     │   Body: { name: "Acme Insurance", slug: "acme", adminEmail: "admin@acme.com" }
     │
     ├── platform.service.createTenant()
     │   ├── Validates unique slug + name
     │   ├── Creates Tenant row
     │   ├── Creates User row (role: TENANT_ADMIN, authId: "tenant-admin-{id}")
     │   ├── Enqueues notification job (welcome email)
     │   └── Optionally creates Stripe customer (if BILLING_ENABLED=true)
     │
     ├── POST /api/v1/platform/tenants/:id/seed
     │   Body: { plans: [{ name: "Basic", cropType: "Wheat", ... }] }
     │
     └── Tenant admin can now:
         ├── Log in (via Stack Auth, auto-linked by email)
         ├── Import farmers/policies (POST /api/v1/import)
         ├── Configure settings (PATCH /api/v1/settings)
         └── Go live
```

### 13.2 Policy Purchase

```
FARMER (authenticated)
     │
     ├── GET /api/v1/policy-plans  → lists available plans
     │
     ├── POST /api/v1/policy-plans/quote
     │   Body: { policyPlanId, areaAcres }
     │   Response: { coverageAmount, premiumAmount, termMonths }
     │
     ├── POST /api/v1/policies
     │   Body: { policyPlanId, landParcelId, startDate }
     │
     ├── policies.service.purchasePolicy()
     │   ├── Verifies land parcel belongs to farmer
     │   ├── Verifies policy plan is active
     │   ├── Calculates: coverageAmount = coveragePerAcre × areaAcres
     │   ├── Calculates: premiumAmount = premiumRate × coverageAmount
     │   ├── Generates policy number (POL-{ts}-{rand})
     │   └── Creates Policy (status: ACTIVE)
     │
     ├── POST /api/v1/payments/premium
     │   Body: { policyId }
     │   Response: { clientSecret, payment }  ← Stripe PaymentIntent
     │
     └── Stripe Checkout → Payment confirmed → Policy marked premiumPaid=true
```

### 13.3 Claim Submission

```
FARMER (authenticated, has active policy)
     │
     ├── POST /api/v1/claims
     │   Body: {
     │     policyId, incidentType, incidentDate, description,
     │     estimatedLossPercentage, claimedAmount
     │   }
     │
     ├── claims.service.createClaim()
     │   ├── Validates policy exists + belongs to farmer + is ACTIVE
     │   ├── Duplicate check: no claim on same policy within 30 days
     │   ├── Generates claim number (CLM-{ts}-{rand})
     │   ├── Creates Claim (status: SUBMITTED)
     │   ├── Creates ClaimStatusHistory (SUBMITTED → SUBMITTED)
     │   └── Enqueues notification job (CLAIM_SUBMITTED)
     │
     ├── POST /api/v1/documents/upload  (claimant uploads evidence)
     │   ├── Cloudinary upload with auto-compression
     │   ├── Enqueues OCR job (simulated)
     │   └── Returns document URL
     │
     └── Waiting for CLAIMS_OFFICER review
```

### 13.4 Claim Review & Payout

```
CLAIMS_OFFICER (authenticated)
     │
     ├── PATCH /api/v1/claims/:id/assign
     │   Body: { claimsOfficerId }
     │
     ├── PATCH /api/v1/claims/:id/status
     │   Body: { status: "UNDER_REVIEW" }  (if evidence needed)
     │
     ├── PATCH /api/v1/claims/:id/status
     │   Body: {
     │     status: "APPROVED",
     │     approvedAmount: 50000,
     │     note: "Assessment completed"
     │   }
     │
     ├── claims.service.updateClaimStatus()
     │   ├── Validates SUBMITTED → UNDER_REVIEW → APPROVED transition
     │   ├── Sets approvedAmount + resolvedAt
     │   ├── Creates ClaimStatusHistory
     │   └── Enqueues notification (CLAIM_STATUS_CHANGED)
     │
     ├── POST /api/v1/payments/payout/:claimId (TENANT_ADMIN)
     │   Body: { claimId, amount }
     │
     ├── payments.service.processPayout()
     │   ├── Validates claim is APPROVED
     │   ├── Creates Stripe transfer
     │   ├── Creates Payment (type: PAYOUT)
     │   └── Updates claim status to PAID
     │
     └── Flow complete: claim PAID, notification sent, payout recorded
```

### 13.5 Bulk Import

```
TENANT_ADMIN (authenticated)
     │
     ├── POST /api/v1/import/policy-plans
     │   Body: {
     │     format: "csv",
     │     data: "name,cropType,coveragePerAcre,premiumRate,termMonths\nWheat Plan,Wheat,100000,0.05,12",
     │     columnMapping: { "cropType": "crop" }  (optional)
     │   }
     │
     ├── import.controller (checks threshold)
     │   ├── > 50 records → enqueue as BullMQ import job (async)
     │   └── ≤ 50 records → process inline (sync)
     │
     ├── import.service.importPolicyPlans()
     │   ├── Parses CSV (via csv-parse/sync) or JSON
     │   ├── Applies column mapping if provided
     │   ├── Validates each row (required fields, types)
     │   ├── Collects errors per row
     │   └── Bulk creates valid policy plans
     │
     └── Response: { totalRows: 10, imported: 8, errors: [{ row: 3, message: "..." }], plans: [...] }
```

---

## 14. API Examples

### 14.1 Create Tenant (Platform Admin)

```bash
curl -X POST http://localhost:4000/api/v1/platform/tenants \
  -H "Authorization: Bearer <platform-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Insurance Co.",
    "slug": "acme",
    "adminEmail": "admin@acme.com"
  }'
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "tenant": {
      "id": "uuid-here",
      "name": "Acme Insurance Co.",
      "slug": "acme",
      "isActive": true,
      "billingEnabled": false,
      "createdAt": "2026-07-17T..."
    },
    "adminUser": {
      "id": "uuid-here",
      "tenantId": "uuid-here",
      "email": "admin@acme.com",
      "role": "TENANT_ADMIN"
    }
  }
}
```

### 14.2 Purchase Policy (Farmer)

```bash
curl -X POST http://localhost:4000/api/v1/policies \
  -H "Authorization: Bearer <farmer-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "policyPlanId": "plan-uuid",
    "landParcelId": "parcel-uuid",
    "startDate": "2026-08-01T00:00:00.000Z"
  }'
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "id": "policy-uuid",
    "policyNumber": "POL-K7F2-A9B3",
    "coverageAmount": 500000,
    "premiumAmount": 25000,
    "startDate": "2026-08-01T00:00:00.000Z",
    "endDate": "2027-08-01T00:00:00.000Z",
    "status": "ACTIVE"
  }
}
```

### 14.3 Submit Claim (Farmer)

```bash
curl -X POST http://localhost:4000/api/v1/claims \
  -H "Authorization: Bearer <farmer-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "policyId": "policy-uuid",
    "incidentType": "FLOOD",
    "incidentDate": "2026-07-10T00:00:00.000Z",
    "description": "Heavy flooding destroyed 80% of wheat crop",
    "estimatedLossPercentage": 80,
    "claimedAmount": 400000
  }'
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "id": "claim-uuid",
    "claimNumber": "CLM-X9Y2-M7K4",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-17T..."
  }
}
```

### 14.4 Update Claim Status (Claims Officer)

```bash
curl -X PATCH http://localhost:4000/api/v1/claims/claim-uuid/status \
  -H "Authorization: Bearer <officer-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "approvedAmount": 350000,
    "note": "Verified with field assessment"
  }'
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "id": "claim-uuid",
    "status": "APPROVED",
    "approvedAmount": 350000,
    "resolvedAt": "2026-07-17T..."
  }
}
```

### 14.5 Import Policy Plans (Tenant Admin — CSV)

```bash
curl -X POST http://localhost:4000/api/v1/import/policy-plans \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "data": "name,cropType,coveragePerAcre,premiumRate,termMonths\nBasic Wheat,Wheat,100000,0.05,12\nPremium Maize,Maize,150000,0.06,12"
  }'
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "totalRows": 2,
    "imported": 2,
    "errors": [],
    "plans": [{"id": "...", "name": "Basic Wheat", ...}, {"id": "...", "name": "Premium Maize", ...}]
  }
}
```

---

## 15. Deployment & Environment

### 15.1 Deployment Architecture

```
Frontend (Vercel / Netlify)          Backend Node Server          Database (Neon)
┌──────────────────┐                ┌────────────────────┐        ┌──────────┐
│  React / Next.js │  ─── HTTPS ──▶ │  Express + Prisma  │  ───▶ │PostgreSQL│
│  (multi-tenant)  │                │  (Railway / AWS)   │        │  (Neon)  │
└──────────────────┘                └────────┬───────────┘        └──────────┘
                                             │
                                   ┌─────────┼─────────┐
                                   │         │         │
                                   ▼         ▼         ▼
                              ┌────────┐ ┌────────┐ ┌────────┐
                              │ Redis  │ │Cloudin-│ │ Resend │
                              │(Upstash)│ │  ary   │ │ Email  │
                              └────────┘ └────────┘ └────────┘
```

### 15.2 Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL (`https://*.supabase.co`) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (JWT verification) |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (test mode for dev) |
| `STRIPE_WEBHOOK_SECRET` | For billing | Stripe webhook signing secret |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | For billing | Stripe subscription price ID |
| `REDIS_URL` | Yes | Upstash Redis connection URL |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Yes | Nodemailer SMTP credentials for email notifications |
| `BILLING_ENABLED` | No (default: false) | Enables Stripe subscription billing |
| `FRONTEND_URL` | For billing | Frontend URL for Stripe redirects |
| `PORT` | No (default: 4000) | Server port |
| `NODE_ENV` | No (default: development) | Environment mode |

### 15.3 Database Migration Steps

```bash
# 1. Apply Prisma schema migration
npx prisma migrate dev --name init

# 2. Generate Prisma client
npx prisma generate

# 3. Run data migration (creates default tenant + backfills existing records)
npx ts-node src/scripts/migrateTenant.ts
```

### 15.4 Startup

```bash
# Development
npm run dev              # ts-node-dev with auto-restart

# Production
npm run build            # tsc → dist/
npm start                # node dist/server.js
```

---

## 16. Known Limitations & Future Work

### 16.1 Documented Limitations

| Limitation | Impact | Root Cause |
|-----------|--------|------------|
| **Imported users can't log in** | Farmers imported via CSV/JSON have fabricated `authId` values that don't correspond to real Supabase Auth sessions. The `requireAuth` middleware handles this via email linking — when the user signs up with the same email, the middleware updates the `authId`. | Supabase doesn't allow batch user creation; only the database records are created |
| **Auto-trigger cron not scheduled** | The `scheduleAutoTriggerCheck()` function exists but is never called in `server.ts`. The 6-hour monitoring cycle isn't active. | Implementation gap |
| **`(prisma as any)` type casts** | `fraud.service.ts` and `auto-trigger-worker.ts` use `as any` for `FraudAuditLog` and `AutoTriggerLog` models. Requires `prisma generate` to fix. | Schema was updated after initial generation |
| **No request ID tracking** | Debugging production issues is difficult — no unique request ID is attached to logs or responses. | Design decision to defer |
| **Billing disabled by default** | Stripe subscription features are gated behind `BILLING_ENABLED=false`. Must be explicitly enabled. | Design decision to allow single-tenant usage without Stripe |
| **Auth limiter not wired** | `authLimiter` (20 req/15min) is defined but not applied to auth routes. Only the global `apiLimiter` is active. | Implementation gap |
| **Upload limiter not wired** | `uploadLimiter` (50 req/hour) is defined but not applied to upload routes. | Implementation gap |
| **OCR is simulated** | The OCR worker updates documents with mock data (`confidence: 0.85`). No actual text extraction occurs. | MVP design; real OCR service integration is future work |
| **Jest exit timeout on Windows** | Tests may hang after completion due to open handles (Redis). May need `--forceExit` on Windows. | Known Node.js/Windows + Redis issue |
| **Redis not mocked in claims tests** | The claims integration test doesn't mock Redis, causing ECONNREFUSED log noise during test runs. | The test focuses on HTTP routes, not Redis |

### 16.2 Nice-to-Have Improvements

- **Wire `authLimiter` to auth routes** and `uploadLimiter` to document upload routes
- **Mock Redis in claims tests** to eliminate ECONNREFUSED noise
- **Add `--forceExit` to Jest config** for clean Windows test completion
- **Add test coverage reporting** via Jest's `--coverage` flag
- **Add test for import controller** (both sync and async paths)
- **Add test for billing webhook** (Stripe event handling)
- **Add more validators edge cases** (e.g., CNIC format validation, date ranges)
- **Add startup env var validation** to crash gracefully with clear error messages
- **Add request ID tracking** for production debugging
- **Expand test coverage** from 26 to 60+ tests covering all 14 service modules

### 16.3 Future Roadmap

| Feature | Description |
|---------|-------------|
| **Real OCR integration** | Replace simulated OCR with Google Vision / AWS Textract |
| **Multi-currency support** | Allow policy plans and payments in multiple currencies |
| **White-labeling** | Per-tenant custom domain, theme, and email templates |
| **Swagger/OpenAPI docs** | Auto-generate API documentation from Zod schemas |
| **CI/CD pipeline** | GitHub Actions for tests + build + deploy |
| **Staging environment** | Deploy for integration testing before production |
| **Premium payment auto-renewal** | Scheduled BullMQ job to charge premiums on policy renewal |
| **SMS notifications** | Add Twilio integration alongside Nodemailer email |
| **Batch job status tracking** | Expose BullMQ job progress via an API endpoint with WebSocket updates |
| **Swagger/OpenAPI docs** | Auto-generated API documentation from Zod schemas |
| **E2E tests** | Full flow tests with real database (Neon test branch) |

---

> **Document version:** 1.0  
> **Generated:** July 17, 2026  
> **Based on:** Actual codebase as of commit `88dab5c`  
> **Test status:** ✅ 26/26 tests passing, TypeScript 0 errors  
> **Project:** Agricultural Insurance Management System (AIMS)
