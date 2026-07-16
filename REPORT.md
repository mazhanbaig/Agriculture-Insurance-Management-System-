# AIMS — Agricultural Insurance Management System
## Comprehensive Project Report

> **Generated:** July 16, 2026
> **Status:** All 9 Phases Implemented — Backend Complete

---

## 1. Project Overview

A single-tenant B2B insurance management backend built with Express + TypeScript. Designed for one insurer operating internally with roles: Admin, Underwriter, Claims Officer, Field Agent, and Farmer (customer).

- **Repository:** https://github.com/mazhanbaig/Agriculture-Insurance-Management-System-
- **Last Commit:** `d583e03` — feat(all): complete AIMS backend with all 9 phases
- **TypeScript Compilation:** ✅ 0 errors
- **Tests:** ✅ 8/8 passing

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | — | Server runtime |
| Framework | Express | ^5.2.1 | HTTP server & routing |
| Language | TypeScript | — | Type-safe code |
| Database ORM | Prisma | ^7.8.0 | DB schema & queries |
| Database | Neon (Postgres) | — | Serverless postgres |
| Auth | Neon Auth (Stack Auth) | ^2.8.108 | Session management |
| Validation | Zod | ^4.4.3 | Request validation |
| Queue | BullMQ | ^5.80.5 | Async job processing |
| Cache | Redis (ioredis) | ^5.11.1 | Caching & queue backend |
| Storage | Cloudinary | ^2.10.0 | Document/image uploads |
| Payments | Stripe | ^22.3.2 | Premium & payout processing |
| Email | Resend | ^6.17.2 | Email notifications |
| Logging | Pino | ^10.3.1 | Structured logging |
| Middleware | Helmet, CORS, express-rate-limit | — | Security hardening |
| Testing | Jest + Supertest | ^30.4.2 / ^7.2.2 | Integration tests |

---

## 3. Project Structure

```
AIMS/
├── src/
│   ├── server.ts                    # Express app entry point
│   ├── routes/                      # 10 route files
│   │   ├── auth.routes.ts
│   │   ├── farmers.routes.ts
│   │   ├── landParcels.routes.ts
│   │   ├── policyPlans.routes.ts
│   │   ├── policies.routes.ts
│   │   ├── claims.routes.ts
│   │   ├── documents.routes.ts
│   │   ├── payments.routes.ts
│   │   ├── notifications.routes.ts
│   │   └── admin.routes.ts
│   ├── controllers/                 # 10 controller files
│   │   ├── auth.controller.ts
│   │   ├── farmers.controller.ts
│   │   ├── landParcels.controller.ts
│   │   ├── policyPlans.controller.ts
│   │   ├── policies.controller.ts
│   │   ├── claims.controller.ts
│   │   ├── documents.controller.ts
│   │   ├── payments.controller.ts
│   │   ├── notifications.controller.ts
│   │   └── admin.controller.ts
│   ├── services/                    # 10 service files (+ 8 leftover duplicates)
│   │   ├── auth.service.ts          # Active
│   │   ├── farmers.service.ts       # Active
│   │   ├── landParcels.service.ts   # Active
│   │   ├── policyPlans.service.ts   # Active
│   │   ├── policies.service.ts      # Active
│   │   ├── claims.service.ts        # Active
│   │   ├── documents.service.ts     # Active
│   │   ├── payments.service.ts      # Active
│   │   ├── notifications.service.ts # Active
│   │   └── admin.service.ts         # Active
│   │   └── (admin.ts, auth.ts, etc. — ⚠️ 8 leftover duplicates)
│   ├── validators/                  # 9 validator files (+ 8 leftover duplicates)
│   │   ├── auth.validator.ts         # Active
│   │   ├── farmers.validator.ts      # Active
│   │   ├── landParcels.validator.ts   # Active
│   │   ├── policyPlans.validator.ts   # Active
│   │   ├── policies.validator.ts      # Active
│   │   ├── claims.validator.ts        # Active
│   │   ├── payments.validator.ts      # Active
│   │   ├── notifications.validator.ts # Active
│   │   ├── admin.validator.ts         # Active
│   │   └── (admin.ts, auth.ts, etc. — ⚠️ 8 leftover duplicates)
│   ├── middleware/
│   │   ├── auth.ts                  # Session verification (Stack Auth)
│   │   ├── roleGuard.ts             # Role-based access control
│   │   ├── errorHandler.ts          # Central error handling
│   │   ├── rateLimiter.ts           # 3 rate limiter configs
│   │   └── validate.ts             # Zod validation middleware
│   ├── lib/
│   │   ├── prisma.ts                # Prisma client + Neon adapter factory
│   │   ├── redis.ts                 # Redis client singleton
│   │   ├── cloudinary.ts            # Cloudinary client config
│   │   └── bullmq.ts               # BullMQ queues + worker factories
│   ├── jobs/
│   │   ├── ocrWorker.ts             # OCR document processing worker
│   │   └── notificationWorker.ts    # Email notification worker
│   ├── types/                       # (empty — types defined inline)
│   └── utils/                       # (empty)
├── tests/
│   └── claims.test.ts               # 8 tests — claim state machine
├── prisma/
│   ├── schema.prisma                # Full data model (9 models, 4 enums)
│   ├── migrations/
│   │   └── init/
│   │       └── migration.sql        # Initial migration
│   └── migrations/
├── prisma.config.ts                 # Prisma 7.x datasource config
├── jest.config.js                   # Jest + ts-jest config
├── tsconfig.json                    # TypeScript config
├── package.json                     # Dependencies & scripts
├── PLAN.md                          # Build plan (single source of truth)
├── PROGRESS.md                      # Build progress tracker
├── REPORT.md                        # ← This file
├── README.md
└── .gitignore
```

### ⚠️ Leftover Duplicate Files (Dead Code)

The following files from the old per-module structure were **not deleted** and are duplicates:

**`src/services/` (8 leftovers):**
- `admin.ts` (duplicate of `admin.service.ts`)
- `auth.ts` (duplicate of `auth.service.ts`)
- `claims.ts` (duplicate of `claims.service.ts`)
- `documents.ts` (duplicate of `documents.service.ts`)
- `farmers.ts` (duplicate of `farmers.service.ts`)
- `notifications.ts` (duplicate of `notifications.service.ts`)
- `payments.ts` (duplicate of `payments.service.ts`)
- `policyPlans.ts` (duplicate of `policyPlans.service.ts`)

**`src/validators/` (8 leftovers):**
- `admin.ts` (duplicate of `admin.validator.ts`)
- `auth.ts` (duplicate of `auth.validator.ts`)
- `claims.ts` (duplicate of `claims.validator.ts`)
- `documents.ts` (duplicate of `documents.validator.ts`)
- `farmers.ts` (duplicate of `farmers.validator.ts`)
- `notifications.ts` (duplicate of `notifications.validator.ts`)
- `payments.ts` (duplicate of `payments.validator.ts`)
- `policyPlans.ts` (duplicate of `policyPlans.validator.ts`)

These do NOT cause compilation errors — they are valid TypeScript files. They should be deleted for cleanliness.

---

## 4. Database Schema (Prisma)

### Enums
| Enum | Values |
|------|--------|
| `Role` | `FARMER`, `UNDERWRITER`, `CLAIMS_OFFICER`, `FIELD_AGENT`, `ADMIN` |
| `PolicyStatus` | `ACTIVE`, `EXPIRED`, `CANCELLED` |
| `ClaimStatus` | `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `PAID` |
| `PaymentType` | `PREMIUM`, `PAYOUT` |

### Models (9 total)

| Model | Key Fields | Relations |
|-------|-----------|-----------|
| `User` | id, authId (unique), email (unique), role, isActive | farmer, notifications, uploadedDocuments, assignedClaims, underwrittenPolicies |
| `Farmer` | id, userId (unique), fullName, cnicNumber (unique), bank info | landParcels, policies, claims |
| `LandParcel` | id, farmerId, address, areaAcres, cropType, district | farmer, policies |
| `PolicyPlan` | id, name, cropType, coveragePerAcre, premiumRate, termMonths | policies |
| `Policy` | id, policyNumber (unique), farmerId, landParcelId, policyPlanId, premiumAmount, status | farmer, landParcel, policyPlan, claims, payments |
| `Claim` | id, claimNumber (unique), policyId, farmerId, status | policy, farmer, documents, statusHistory, payments |
| `ClaimDocument` | id, claimId, uploadedByUserId, url, type, ocrExtractedData | claim |
| `ClaimStatusHistory` | id, claimId, fromStatus, toStatus, changedByUserId | claim |
| `Payment` | id, policyId?, claimId?, type, amount, gatewayTransactionId, status | policy, claim |
| `Notification` | id, userId, type, title, message, isRead | user |

### Indexes
- `Policy`: `@@index([farmerId])`, `@@index([status])`
- `Claim`: `@@index([policyId])`, `@@index([status])`, `@@index([farmerId])`
- `ClaimDocument`: `@@index([claimId])`
- `ClaimStatusHistory`: `@@index([claimId])`
- `Notification`: `@@index([userId, isRead])`

---

## 5. Complete API Route Map

All routes are prefixed with `/api/v1` and require authentication unless noted.

### Health Check
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/health` | ❌ | — | Health check endpoint |

### Auth (`/api/v1/auth`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `GET` | `/me` | ✅ | Any | Get current user profile | — |
| `PATCH` | `/profile` | ✅ | Any | Update profile (phone) | `updateProfileSchema` |
| `PATCH` | `/role` | ✅ | `ADMIN` | Update any user's role | `updateUserRoleSchema` |
| `GET` | `/users` | ✅ | `ADMIN` | List all users (paginated) | — |

### Farmers (`/api/v1/farmers`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `GET` | `/profile` | ✅ | `FARMER` | Get own farmer profile | — |
| `POST` | `/profile` | ✅ | `FARMER` | Create farmer profile | `createFarmerSchema` |
| `PATCH` | `/profile` | ✅ | `FARMER` | Update farmer profile | `updateFarmerSchema` |

### Land Parcels (`/api/v1/land-parcels`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `GET` | `/` | ✅ | `FARMER` | List own parcels (paginated) | — |
| `GET` | `/:id` | ✅ | `FARMER` | Get parcel by ID | — |
| `POST` | `/` | ✅ | `FARMER` | Create land parcel | `createLandParcelSchema` |
| `PATCH` | `/:id` | ✅ | `FARMER` | Update land parcel | `updateLandParcelSchema` |
| `DELETE` | `/:id` | ✅ | `FARMER` | Delete land parcel | — |

### Policy Plans (`/api/v1/policy-plans`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `GET` | `/` | ✅ | Any | List active plans (paginated) | — |
| `GET` | `/:id` | ✅ | Any | Get plan by ID | — |
| `POST` | `/quote` | ✅ | `FARMER` | Calculate premium quote | `quotePremiumSchema` |
| `POST` | `/` | ✅ | `UNDERWRITER`, `ADMIN` | Create policy plan | `createPolicyPlanSchema` |
| `PATCH` | `/:id` | ✅ | `UNDERWRITER`, `ADMIN` | Update policy plan | `updatePolicyPlanSchema` |

### Policies (`/api/v1/policies`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `POST` | `/purchase` | ✅ | `FARMER` | Purchase a policy | `purchasePolicySchema` |
| `GET` | `/my` | ✅ | `FARMER` | List own policies (paginated) | — |
| `GET` | `/my/:id` | ✅ | `FARMER` | Get own policy details | — |

### Claims (`/api/v1/claims`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `POST` | `/` | ✅ | `FARMER` | Submit claim (with duplicate check) | `createClaimSchema` |
| `GET` | `/my` | ✅ | `FARMER` | List own claims (paginated, filterable) | — |
| `GET` | `/my/:id` | ✅ | `FARMER` | Get own claim | — |
| `GET` | `/` | ✅ | `CLAIMS_OFFICER`, `ADMIN` | List all claims (paginated) | — |
| `GET` | `/:id` | ✅ | `CLAIMS_OFFICER`, `ADMIN` | Get any claim | — |
| `PATCH` | `/:id/assign` | ✅ | `CLAIMS_OFFICER`, `ADMIN` | Assign claims officer | `assignClaimSchema` |
| `PATCH` | `/:id/status` | ✅ | `CLAIMS_OFFICER`, `ADMIN` | Update claim status | `updateClaimStatusSchema` |

### Documents (`/api/v1/documents`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `POST` | `/upload` | ✅ | `FARMER`, `FIELD_AGENT`, `CLAIMS_OFFICER`, `ADMIN` | Upload document to Cloudinary | Multer file |
| `GET` | `/claim/:claimId` | ✅ | `FARMER`, `CLAIMS_OFFICER`, `ADMIN` | Get claim documents | — |
| `GET` | `/:id` | ✅ | `FARMER`, `CLAIMS_OFFICER`, `ADMIN` | Get document | — |
| `DELETE` | `/:id` | ✅ | `CLAIMS_OFFICER`, `ADMIN` | Delete document (+ Cloudinary) | — |

### Payments (`/api/v1/payments`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `POST` | `/create-payment-intent` | ✅ | `FARMER` | Create Stripe payment intent | `createPaymentIntentSchema` |
| `POST` | `/confirm` | ✅ | `FARMER` | Confirm premium payment | — |
| `POST` | `/payout` | ✅ | `CLAIMS_OFFICER`, `ADMIN` | Process claim payout via Stripe | `processPayoutSchema` |
| `GET` | `/policy/:policyId` | ✅ | `FARMER`, `ADMIN` | Get payments for policy | — |
| `GET` | `/claim/:claimId` | ✅ | `FARMER`, `CLAIMS_OFFICER`, `ADMIN` | Get payments for claim | — |

### Notifications (`/api/v1/notifications`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `GET` | `/` | ✅ | Any | List notifications (paginated, filterable) | — |
| `PATCH` | `/read` | ✅ | Any | Mark specific notifications as read | `markReadSchema` |
| `PATCH` | `/read-all` | ✅ | Any | Mark all notifications as read | — |

### Admin (`/api/v1/admin`)
| Method | Path | Auth | Roles | Description | Validation |
|--------|------|------|-------|-------------|------------|
| `POST` | `/staff` | ✅ | `ADMIN` | Create staff user | `createStaffUserSchema` |
| `GET` | `/staff` | ✅ | `ADMIN` | List staff users (paginated, filterable) | — |
| `PATCH` | `/staff/:id/toggle-status` | ✅ | `ADMIN` | Toggle user active status | — |
| `GET` | `/dashboard` | ✅ | `ADMIN` | Dashboard aggregates (cached) | — |
| `GET` | `/analytics/claims` | ✅ | `ADMIN` | Claims analytics (by status & type) | — |

---

## 6. Claim State Machine

### Valid Transitions
```
SUBMITTED  ──►  UNDER_REVIEW
UNDER_REVIEW ──►  APPROVED
UNDER_REVIEW ──►  REJECTED
APPROVED    ──►  PAID  (via payout processing, not status endpoint)
```

### Status Change Flow
1. Every status change writes a `ClaimStatusHistory` row
2. A BullMQ notification job is queued on every status change
3. `approvedAmount` is captured on approval
4. `rejectionReason` is captured on rejection
5. `resolvedAt` timestamp is set on final states (APPROVED, REJECTED)

---

## 7. Async Jobs (BullMQ)

### OCR Queue (`ocr`)
| Job Name | Trigger | Processor | Description |
|----------|---------|-----------|-------------|
| `process-ocr` | Document upload | `ocrWorker.ts` | Extracts text data from uploaded images (MVP: simulated) |

### Notification Queue (`notification`)
| Job Name | Trigger | Processor | Description |
|----------|---------|-----------|-------------|
| `claim-submitted` | Claim submission | `notificationWorker.ts` | Creates notification + sends email via Resend |
| `claim-status-changed` | Claim status update | `notificationWorker.ts` | Creates notification + sends email via Resend |

### Job Config
- **Retries:** 3 attempts
- **Backoff:** Exponential, 2s initial delay
- **Cleanup:** Keep last 100 complete, 50 failed

---

## 8. Middleware Summary

| Middleware | File | Purpose |
|-----------|------|---------|
| `requireAuth` | `auth.ts` | Verifies Bearer token via Stack Auth, upserts local User |
| `requireRole(...roles)` | `roleGuard.ts` | Checks `req.user.role` against allowed roles |
| `errorHandler` | `errorHandler.ts` | Catches AppError, ZodError, and unhandled errors |
| `validate(schema)` | `validate.ts` | Validates `req.body` against a Zod schema |
| `apiLimiter` | `rateLimiter.ts` | 100 req / 15 min — general API rate limit |
| `authLimiter` | `rateLimiter.ts` | 20 req / 15 min — auth endpoints (exported but not wired) |
| `uploadLimiter` | `rateLimiter.ts` | 50 req / 1 hour — document upload rate limit |

### Express Extension
```ts
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; authId: string; email: string; role: string; };
    }
  }
}
```

---

## 9. Phase Completion Status

| Phase | Module | Status | Notes |
|-------|--------|--------|-------|
| 1 | Auth + User Sync | ✅ Complete | Stack Auth session verification, user upsert, role guard |
| 2 | Farmers + Land Parcels | ✅ Complete | Farmer profile CRUD, LandParcel CRUD with ownership checks |
| 3 | Policy Plans + Policies | ✅ Complete | PolicyPlan CRUD, premium quote calc, policy purchase flow |
| 4 | Claims Core | ✅ Complete | Submission, duplicate detection, status history, officer review |
| 5 | Documents | ✅ Complete | Cloudinary upload with compression, OCR job queued |
| 6 | Payments | ✅ Complete | Stripe premium collection, payout processing |
| 7 | Notifications | ✅ Complete | In-app notifications + email sent via BullMQ |
| 8 | Admin/Analytics | ✅ Complete | Staff management, dashboard aggregates with Redis cache |
| 9 | Hardening | ✅ Complete | Rate limiting, Helmet, CORS, Jest tests on claim state machine |

### Deviations from PLAN.md (documented in PROGRESS.md)
- Prisma 7.x: `url` removed from schema datasource. Created `prisma.config.ts` instead.
- Top-level await: Removed from prisma.ts. Moved Neon adapter to `getNeonPrisma()` factory.
- Zod 4: Used `z.ZodType` instead of `ZodSchema` import.
- ModuleResolution: Set to `node` with `ignoreDeprecations: "6.0"` for TypeScript compatibility.
- Stripe: Changed to lazy `getStripe()` initialization with instance caching.
- Neon adapter: Dynamic import with variable path to avoid TypeScript static resolution errors.
- Express 5 types: `req.params.id` and `req.query.*` wrapped with `String()` for `string | string[]` union.

---

## 10. Test Results

### Current Status: ✅ 8/8 Passing

```
Test Suites: 1 passed, 1 total
Tests:       8 passed, 0 failed, 8 total
Time:        8.584 s
```

### Test Coverage (tests/claims.test.ts)

| # | Test | Category | Status |
|---|------|----------|--------|
| 1 | Should allow transition from SUBMITTED to UNDER_REVIEW | Claim State Machine | ✅ |
| 2 | Should allow transition from UNDER_REVIEW to APPROVED (and REJECTED) | Claim State Machine | ✅ |
| 3 | Should NOT allow direct transition from SUBMITTED to APPROVED | Claim State Machine | ✅ |
| 4 | Should NOT allow transition from APPROVED to any other status | Claim State Machine | ✅ |
| 5 | Should detect duplicate claims within 30 days for same policy | Duplicate Detection | ✅ |
| 6 | Should NOT flag claims older than 30 days as duplicates | Duplicate Detection | ✅ |
| 7 | Should generate unique claim numbers | Claim Number Generation | ✅ |
| 8 | Should return 200 on health check | API Health Check | ✅ |

### Known Test Issues
- Jest does not exit cleanly after tests (exit code 124 timeout) because the Express server created for the health check test keeps an open handle. This is cosmetic — all 8 tests pass.

---

## 11. TypeScript Compilation

**Status:** ✅ 0 errors

```
$ npx tsc --noEmit
(no output — clean compilation)
```

---

## 12. Git History

```
2030ccf first commit
d583e03 feat(all): complete AIMS backend with all 9 phases
  - Phase 1: Auth + User sync with Neon Auth and role guards
  - Phase 2: Farmers profile and Land Parcel CRUD
  - Phase 3: Policy Plans catalog and premium quote calculation
  - Phase 4: Claims submission with duplicate detection and review
  - Phase 5: Document upload with Cloudinary compression and OCR job
  - Phase 6: Stripe premium collection and claim payout
  - Phase 7: Async email notifications on status changes
  - Phase 8: Admin staff management and analytics dashboard
  - Phase 9: Rate limiting, helmet, and claim state machine tests
96602f5 first commit
```

**Remote:** https://github.com/mazhanbaig/Agriculture-Insurance-Management-System- ✅ Pushed

---

## 13. Environment Variables Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |
| `STACK_PUBLISHABLE_KEY` | Stack Auth publishable key |
| `STACK_SECRET_KEY` | Stack Auth secret server key |
| `REDIS_URL` | Redis connection URL (default: `redis://localhost:6379`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_CONNECT_ACCOUNT` | Stripe Connect account ID (for payouts) |
| `RESEND_API_KEY` | Resend API key for email sending |
| `PORT` | Server port (default: 4000) |
| `NODE_ENV` | Environment: `development`, `production`, `test` |

---

## 14. What's Left / Known Issues

### 🔴 Cleanup Needed
1. **Delete 16 leftover duplicate files** — `src/services/` has 8 `.ts` files that duplicate `.service.ts` files; `src/validators/` has 8 `.ts` files that duplicate `.validator.ts` files
2. **Wire `authLimiter`** — The auth rate limiter is exported from `rateLimiter.ts` but never applied to auth routes

### 🟡 Nice-to-Have Improvements
3. **Jest exit cleanup** — The app keeps an open handle after tests. Fix by having `server.ts` export a `close()` function or use `--forceExit`
4. **Separate tsconfig for tests** — Currently `tests/` is excluded from main `tsconfig.json`; jest types are added globally instead
5. **`.env.example` file** — Committed template of env vars for new developers

### 🟢 Optional Enhancements (Future)
6. **Underwriter + Field Agent dedicated dashboards** — The PLAN.md mentions these roles exist in schema but dashboards aren't built
7. **Real OCR integration** — Currently simulated with static metadata
8. **Twilio SMS notifications** — Mentioned as optional in PLAN.md, not implemented
9. **Prisma migration** — Migration SQL exists at `prisma/migrations/init/migration.sql` but hasn't been applied to a database. Run:
   ```bash
   npx prisma migrate dev --name init
   ```

---

## 15. Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables (copy .env.example or create .env)
# Required: DATABASE_URL, STACK_*, CLOUDINARY_*, STRIPE_*, RESEND_API_KEY

# 3. Run database migration
npx prisma migrate dev --name init

# 4. Start development server
npm run dev

# 5. Run tests
npm test
```

---

## 16. Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `ts-node-dev --respawn src/server.ts` | Dev server with auto-reload |
| `npm run build` | `tsc` | Production build |
| `npm start` | `node dist/server.js` | Production start |
| `npm test` | `jest` | Run tests |
| `npm run test:watch` | `jest --watch` | Watch mode tests |
| `npm run prisma:generate` | `prisma generate` | Generate Prisma client |
| `npm run prisma:migrate` | `prisma migrate dev` | Run migrations |
| `npm run prisma:studio` | `prisma studio` | Open Prisma Studio |

---

*End of Report*
