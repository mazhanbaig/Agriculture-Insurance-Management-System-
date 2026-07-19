<!-- ============================================================== -->
<!-- 🗂️ FILE PURPOSE: Build progress tracker                         -->
<!--    Tracks all completed phases, remaining issues, and           -->
<!--    deviations from the original plan. Update this file after    -->
<!--    completing each module/phase.                                -->
<!-- ============================================================== -->

# PROGRESS.md — Build progress tracker

## Setup
- [x] Folder structure scaffolded per PLAN.md (flat routes/controllers/services/validators)
- [x] `prisma/schema.prisma` written, migration SQL generated
- [x] All dependencies installed (Express, Prisma 7, Zod, BullMQ, Cloudinary, Stripe, etc.)
- Notes: Prisma 7.x uses `prisma.config.ts` instead of `url` in schema.prisma.

## Phase 1: Auth + User sync
- [x] Auth middleware (session verification via Stack Auth)
- [x] User sync on first login
- [x] Role guard middleware
- [x] Auth routes (me, profile, role management)

## Phase 2: Farmers + Land Parcels
- [x] Farmer profile CRUD
- [x] LandParcel CRUD
- Notes: Farmer and LandParcel split into separate service/controller/route files per flat structure.

## Phase 3: Policy Plans + Policies
- [x] PolicyPlan CRUD
- [x] Premium quote calculation
- [x] Policy purchase flow

## Phase 4: Claims core
- [x] Claim submission with duplicate check
- [x] ClaimStatusHistory on every status change
- [x] Claims Officer review endpoints (assign, approve, reject)

## Phase 5: Documents
- [x] Cloudinary signed upload with compression
- [x] ClaimDocument creation
- [x] OCR job queued (BullMQ)

## Phase 6: Payments
- [x] Stripe premium collection
- [x] Payout trigger on claim approval

## Phase 7: Notifications
- [x] Notification rows + email on status changes (async via BullMQ)

## Phase 8: Admin/Analytics
- [x] Staff account management
- [x] Dashboard aggregates with Redis caching

## Phase 9: Hardening
- [x] Rate limiting, helmet, cors
- [x] Jest + Supertest on claim state machine

## Deviations from PLAN.md
- Prisma 7.x: `url` removed from schema datasource. Created `prisma.config.ts` instead.
- Top-level await: Removed from prisma.ts. Moved Neon adapter to `getNeonPrisma()` factory.
- Zod 4: Used `z.ZodType` instead of `ZodSchema` import.
- ModuleResolution: Set to `node` with `ignoreDeprecations: "6.0"` for TypeScript compatibility.
- Stripe: Changed to lazy `getStripe()` initialization to avoid import-time failure when env vars are missing.
- Neon adapter: Dynamic import with variable path to avoid TypeScript static resolution of non-existent submodule.
- Express 5 types: `req.params.id` and `req.query.*` wrapped with `String()` to handle `string | string[]` union type.

## Git
- [x] git init, initial commit made (hash: d583e03)
- [x] Multi-tenant expansion pushed (commit: 88dab5c to origin/main)
- [x] Full repository: https://github.com/mazhanbaig/Agriculture-Insurance-Management-System-

## Tests
- [x] 8/8 tests passing (claim state machine)
- [x] 26/26 tests passing after multi-tenant expansion
- [ ] Redis ECONNREFUSED in test output — mock Redis to clean this up
- [ ] Prisma mock incomplete — should add `user` methods for auth middleware


---

# Multi-Tenant Expansion Progress

## Phase MT-1: Database Schema
- [x] Updated `prisma/schema.prisma` with `Tenant` model
- [x] Added `tenantId` to all tenant-owned models (User, Farmer, LandParcel, PolicyPlan, Policy, Claim, Payment)
- [x] Updated `Role` enum: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `UNDERWRITER`, `CLAIMS_OFFICER`, `FIELD_AGENT`, `FARMER`
- [x] Added indexes on `tenantId` for all tenant-owned models
- [x] Scoped uniqueness (email + tenant, authId + tenant, cnicNumber + tenant, name + tenant)
- [x] Created migration SQL in `prisma/migrations/multi_tenant/migration.sql`
- [x] Created data migration script: `src/scripts/migrateTenant.ts`
- [x] Added `migrate-data` script to `package.json`

## Phase MT-2: Auth & Tenant Middleware
- [x] Updated `auth.ts` — `requireAuth` resolves tenant from `x-tenant-id` header, defaults to "default" tenant
- [x] Added `resolveTenant` middleware — extracts tenant slug from subdomain or `x-tenant-slug` header
- [x] Added `requireTenantAccess` guard in `roleGuard.ts` — verifies user belongs to resolved tenant
- [x] Updated `roleGuard.ts` — supports new role names (`PLATFORM_ADMIN`, `TENANT_ADMIN`)
- [x] Updated Express `Request` type: added `tenantId` to `user`, added `tenant` object

## Phase MT-3: Platform Admin — Tenant Management
- [x] Created `src/routes/platform.routes.ts`
- [x] Created `src/controllers/platform.controller.ts`
- [x] Created `src/services/platform.service.ts`
- [x] Created `src/validators/platform.validator.ts`
- [x] Wired routes in `server.ts` at `/api/v1/platform`
- Endpoints: POST/GET/PATCH/DELETE tenants, GET tenant/:id, POST tenant/:id/seed

## Phase MT-4: Refactor All Services
- [x] Auth service — `PLATFORM_ADMIN` role check, optional `tenantId` filter in listUsers
- [x] Farmer service — accepts `tenantId` for create, scoped CNIC uniqueness check
- [x] LandParcel service — `tenantId` in all creates/queries
- [x] PolicyPlan service — `tenantId` filter in all functions
- [x] Policy service — `tenantId` in creates, `findFirst` for tenant-scoped lookups
- [x] Claim service — `tenantId` in creates, all queries scoped by tenant
- [x] Document service — tenant-scoped claim lookup on upload
- [x] Payment service — `tenantId` in creates, all queries scoped by tenant
- [x] Notification service — already scoped by userId (no change needed)
- [x] Admin service — all operations scoped by `tenantId`, cache key now includes tenantId
- [x] All controllers updated to pass `req.user.tenantId` to services
- Notes: All role references updated from `"ADMIN"` to `"TENANT_ADMIN"` or `"PLATFORM_ADMIN"`.

## Phase MT-5: Tenant Settings & Config
- [x] Created `src/routes/tenantSettings.routes.ts`
- [x] Created `src/controllers/tenantSettings.controller.ts`
- [x] Created `src/services/tenantSettings.service.ts`
- [x] Created `src/validators/tenantSettings.validator.ts`
- [x] GET /api/v1/settings — any authenticated user
- [x] PATCH /api/v1/settings — TENANT_ADMIN/PLATFORM_ADMIN, config merging

## Phase MT-6: Bulk Import (Policy Plans)
- [x] Added `importQueue` to `src/lib/bullmq.ts`
- [x] Created `src/jobs/importWorker.ts` — processes both policy-plan and farmers-policies jobs
- [x] Created `src/services/import.service.ts` — CSV/JSON parsing with csv-parse, column mapping, validation
- [x] Created `src/controllers/import.controller.ts` — sync for ≤ 50 records, async queue for larger
- [x] Created `src/routes/import.routes.ts`
- [x] Wired in `server.ts` at `/api/v1/import`
- Endpoints: POST /api/v1/import/policy-plans, POST /api/v1/import/farmers-policies

## Phase MT-7: Bulk Import (Farmers & Policies)
- [x] CSV/JSON parsing with column mapping
- [x] Validation and creation for farmers, land parcels, and policies
- [x] User auto-creation with fabricated authId (documented limitation)
- [x] Import endpoint with threshold-based queuing (>50 records queues BullMQ job)
- [x] Improved JSON.parse error handling with user-friendly message

## Phase MT-8: Stripe Billing
- [x] Created `src/services/billing.service.ts` — subscription management with feature flag
- [x] `isBillingEnabled()` global check + `assertBillingEnabled()` per-tenant check
- [x] `createStripeCustomer()` — auto-creates on tenant creation if billing enabled
- [x] `createSubscriptionSession()` — Stripe Checkout session for subscribing
- [x] `cancelSubscription()` — cancels Stripe subscription
- [x] `getSubscriptionStatus()` — returns active status, plan, period end
- [x] Webhook handler — `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [x] Raw body parser for webhook in `server.ts`
- [x] `src/routes/billing.routes.ts` — subscribe, cancel, status (TENANT_ADMIN/PLATFORM_ADMIN)
- [x] `src/controllers/billingWebhook.controller.ts`
- [x] `platform.service.ts` auto-creates Stripe customer on tenant creation

## Phase MT-9: Subdomain Routing
- [x] `resolveTenant` middleware created in `auth.ts`
- [x] Wired in `server.ts` via `app.use(resolveTenant)`
- [x] `requireTenantAccess` guard applied to all 12 tenant-scoped route files
- [x] Platform routes bypass subdomain check via PLATFORM_ADMIN role (guard skips them)

## Phase MT-10: Testing
- [x] Created `tests/tenantIsolation.test.ts` — 18 tests covering all service modules
- [x] Tests verify: farmer CNIC uniqueness per tenant, land parcel tenant scope, policy plan tenant isolation, policy tenant scope, claim tenant scope, payment tenant scope, admin dashboard/staff/toggle by tenant, role guard PLATFORM_ADMIN bypass and FARMER block
- [x] Full test suite: 26/26 tests passing (8 original + 18 isolation tests)
- [x] TypeScript: 0 errors

## Multi-Tenant Deviations from Plan
- Migration kept as separate `prisma/migrations/multi_tenant/` directory instead of overwriting init migration.
- `resolveTenant` and `requireTenantAccess` implemented as middleware within existing auth/roleGuard files rather than dedicated files.
- Platform admin routes use `PLATFORM_ADMIN` role guard only.
- Remaining phases (5-10) plus fixing leftover duplicate files documented as known issues.

---

# Post-Expansion Phases (July 2026)

## Phase X-1: Fraud Detection Engine
- [x] Created `src/services/fraud.service.ts` — `runSyncForensics()` + `runAsyncFraudAnalysis()` (OpenRouter AI, Sentinel NDVI, OpenWeather)
- [x] Created `src/jobs/fraud-worker.ts` — BullMQ worker with concurrency 5, rate limited 10 req/s
- [x] Created `src/lib/openrouter.ts` — Single unified LLM gateway (replaces separate Gemini/Groq modules)
- [x] Created `src/lib/sentinel.ts` — Sentinel Hub NDVI comparison (pre vs post incident)
- [x] Created `src/lib/stripe.ts` — Lazy-initialized Stripe client singleton
- [x] Created `src/utils/fraud-helpers.ts` — Fraud score thresholds, weight constants, verdict mapping
- [x] Created `src/utils/generators.ts` — Claim number and policy number generation
- [x] Created `src/utils/geo.ts` — Haversine distance calculator
- [x] Added `FraudAuditLog` model + `Claim.fraudScore` + `Claim.fraudVerdict` to schema

## Phase X-2: Auto-Trigger Monitoring (X-Factor)
- [x] Created `src/jobs/auto-trigger-worker.ts` — Satellite NDVI + weather monitoring (every 6 hours)
- [x] Added `AutoTriggerLog` model + `PolicyPlan.config` field to schema

## Phase X-3: Infrastructure Swaps
- [x] Replaced **Stack Auth → Supabase Auth** (`@supabase/supabase-js`)
- [x] Created `src/lib/supabase.ts` — Supabase anon client for JWT verification
- [x] Rewrote `middleware/auth.ts` — 3-strategy user lookup (authId → email → create)
- [x] Replaced **Resend → Nodemailer** (SMTP)
- [x] Replaced **Gemini/Groq → OpenRouter** (single unified LLM gateway)
- [x] Removed `src/types/express.d.ts` — merged into `middleware/auth.ts`
- [x] Added `SENIOR_CLAIMS_OFFICER` role to schema + all route guards

## Phase X-4: Documentation & Tooling
- [x] Created `ENV_SETUP_GUIDE.md` — Complete env var setup guide
- [x] Created `AIMS_FINAL_REPORT.md` — Brutal CEO-style assessment report
- [x] Created `AIMS.postman_collection.json` — Full Postman Collection (15 folders, 58 endpoints)
- [x] Updated `REPORT.md` — Reflected all new changes (Supabase, Nodemailer, OpenRouter, fraud engine, auto-trigger)
- [x] Updated `PROJECT_PLAN.md` — Backend complete status, updated tech stack

## Phase X-5: Operational Hardening (July 18, 2026)
- [x] Removed all `(prisma as any)` casts — `fraud.service.ts` (2), `auto-trigger-worker.ts` (5)
- [x] Wired auto-trigger cron — `scheduleAutoTriggerCheck()` called after server starts
- [x] Added env var validation — 8 required vars checked on startup, gated for test mode
- [x] Added Redis connectivity check — `checkRedisConnection()` pings Redis on boot
- [x] Added request ID tracking — UUID middleware + `x-request-id` header + pinoHttp custom props
- [x] Wired `authLimiter` — 20 req/15min applied to all auth routes
- [x] Deleted `AIMS_FINAL_REPORT.md` — duplicate report
- [x] Deleted `PLAN.md` — outdated single-tenant build plan
- [x] Updated `ARCHITECTURE.md` — Stack Auth→Supabase Auth, Resend→Nodemailer, new services/jobs
- [x] Updated `PROGRESS.md` — added Phase X-5
- [x] Wrote proper `README.md` — setup guide, env vars, quick start

## Known Remaining Issues
- [ ] Redis ECONNREFUSED in test output — mock Redis to clean this up
- [ ] Prisma mock incomplete — should add `user` methods for auth middleware
- [ ] Test coverage only 26/60+ — 12 of 14 services untested
