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

## Phase 1: Dynamic Farmer Fields (July 2026)
- [x] Added `TenantField` + `FarmerFieldValue` Prisma models
- [x] Created `config/tenantFields.ts` — field type constants
- [x] Created `routes/tenantFields.routes.ts`, `controllers/tenantFields.controller.ts`, `services/tenantFields.service.ts`
- [x] Created `validators/tenantFields.validator.ts` — Zod schemas for field CRUD
- [x] Extended farmer registration to accept `customData` validated against tenant's field schema
- [x] Added `GET /api/v1/farmers/fields` endpoint for frontend to query field schema
- [x] Atomic field value storage with Prisma transactions
- Endpoints: CRUD (5) + GET farmer fields (1)

## Phase 2: Tiered Fraud Detection (July 2026)
- [x] Created `src/config/fraudTiers.ts` — FORGE (Gemini Flash), TITAN (GPT-4o mini), GOAT (GPT-4o)
- [x] Extended `Tenant.config` to store `fraudTier` (default: `forge`)
- [x] Refactored `fraud.service.ts` — `runAsyncFraudAnalysis()` uses tier config for model selection
- [x] Implemented `analyzeWithFallback()` in `openrouter.ts` — primary model → fallback chain with retry
- [x] Added usage logging for each external call (OpenRouter, Sentinel, OpenWeather)
- [x] Created API endpoints: GET /settings/fraud-tiers, GET /settings/fraud-tier, PATCH /settings/fraud-tier
- [x] Created `UsageLog` Prisma model for billing tracking

## Phase 3: Custom Roles / IAM (July 2026)
- [x] Added `CustomRole` Prisma model (tenantId, name, permissions JSON, isActive)
- [x] Added `customRoleId` to User model
- [x] Created `config/permissions.ts` — 40+ granular permission definitions
- [x] Implemented `requirePermission` middleware — checks user's role permissions
- [x] Created `iam.service.ts`, `iam.controller.ts`, `iam.routes.ts`, `iam.validator.ts`
- [x] CRUD endpoints: GET/POST/PATCH/DELETE /api/v1/iam/roles
- [x] Assignment endpoint: PATCH /api/v1/users/:id/role
- [x] Permission resolution: PLATFORM_ADMIN bypass, FARMER limited scope

## Phase 4: Multi-Payment Gateways (July 2026)
- [x] Defined `PaymentGateway` interface — createPaymentIntent, confirmPayment, createPayout, handleWebhook
- [x] Implemented `StripeGateway` (live), `EasypaisaGateway` (stub), `JazzCashGateway` (stub)
- [x] Created `config/paymentGateways.ts` — gateway factory `getPaymentGateway(tenantId)`
- [x] Refactored `payments.service.ts` — uses gateway adapter instead of direct Stripe calls
- [x] Added API endpoints: GET /settings/payment-gateways, PATCH /settings/payment-gateway
- [x] Added webhook routes: /api/v1/webhooks/stripe, /easypaisa, /jazzcash

## Phase 5: Usage-Based Billing (July 2026)
- [x] Added `UsageLog`, `Invoice`, `InvoiceLineItem` Prisma models
- [x] Created `services/usage.service.ts` — `logUsage()` records each external call with cost
- [x] Created `jobs/billingWorker.ts` — monthly cron aggregates usage → generates invoices
- [x] API endpoints: GET /billing/usage, GET /billing/invoices, GET /billing/invoices/:id
- [x] Invoice PDF generation — line items with tier base fee + per-call costs
- [x] Email notification on invoice generation (via Nodemailer)

## Phase 6: Auto-Trigger Improvements (July 2026)
- [x] Refactored `auto-trigger-worker.ts` — retries with exponential backoff, monitoring stats
- [x] Created `config/autoTriggerConfig.ts` — NDVI thresholds, weather check config
- [x] Improved NDVI + weather checking with configurable thresholds
- [x] Auto-creates claim + runs fraud detection when trigger matched
- [x] Auto-approves claim if `fraudScore < 30`
- [x] Logs every check in `AutoTriggerLog`

## Phase X-6: Layer 1 Forensics (July 2026)
- [x] **Weather history fix** — Changed OpenWeather from current-weather to historical One Call 3.0 timemachine endpoint
  - `src/lib/weather.ts` — shared weather utility: `checkWeatherForClaim()` (historical with fallback) + `checkWeatherNow()` (current weather for auto-trigger)
  - Fraud detection now checks weather at the **incident date**, not today
  - Expanded severe event keywords from 4 to 16
- [x] **Document forensics** — SHA-256 hash dedup + magic byte MIME validation
  - Added `fileHash String?` + `@@index([fileHash])` to `ClaimDocument` model
  - Single file read: buffer reused for both hash and magic bytes
  - 11 MIME types validated from magic bytes (JPEG, PNG, WebP, HEIC, TIFF, MP4, MOV, WebM, AVI, PDF)
  - RIFF header correctly differentiates WebP from AVI (bytes 0-3 vs 8-11)
  - Duplicate file → 409 with `DUPLICATE_FILE` error
- [x] **CNIC cross-check** — Extracts CNIC from uploaded documents and cross-verifies with farmer record
  - OpenRouter OCR called via `analyzeWithFallback` with retry
  - Regex `/\b\d{5}-?\d{7}-?\d{1}\b/` finds 13-digit CNIC pattern (not phone numbers)
  - Mismatch → +25 fraud score, `CNIC_MISMATCH` flag in audit trail
  - Added to `checksPerformed` array in fraud audit log

## Phase 7: Frontend Integration (July 2026)
- [x] Created `frontend/src/lib/api-client.ts` — Typed API client for all 84+ endpoints
- [x] Sample React components for: Dynamic Farmer Form, Custom Role Manager, Billing Dashboard, Fraud Tier Selector
- [x] Swagger/OpenAPI specs (aggregated from Zod schemas)

## Phase 8: Testing & Hardening (July 2026)
- [x] Expanded test suite from 26 to 134 tests (8 test files)
- [x] Added: `utils.test.ts` (19) — generators, fraud scoring, geo distances
- [x] Added: `iam.test.ts` (14) — custom role CRUD, permission resolution
- [x] Added: `billing.test.ts` (14) — invoice CRUD, payment flow, subscription
- [x] Added: `farmers.test.ts` (8) — farmer CRUD, CNIC uniqueness, custom fields
- [x] Added: `policyPlans.test.ts` (14) — plan CRUD, quote calc, config merging
- [x] Added: `smoke.test.ts` (39) — full system: 14 areas, all imports, security headers
- [x] Rate limiters wired to all routes (authLimiter, uploadLimiter)
- [x] Env var validation on startup (8 required vars)
- [x] Request ID tracking (UUID + x-request-id header)
- [x] Redis connectivity check on boot
- [x] Security headers via helmet

## Deployment (July 2026)
- [x] Railway deployment live: https://agriculture-insurance-management-system.up.railway.app
- [x] Railway config: `railway.toml` with Railpack builder + ON_FAILURE restart policy
- [x] Prisma 7 Neon adapter fallback (getNeonPrisma factory)
- [x] Database seeding script (`seed.ts`) — creates default tenant + PLATFORM_ADMIN
- [x] Seed run against Railway Neon database — `default` tenant + `admin@aims.app` user active

## Known Remaining Issues
- [ ] Redis ECONNREFUSED in test output — mock Redis to clean this up
- [ ] Prisma mock incomplete — should add `user` methods for auth middleware
- [ ] Some HEIC/HEIF files may fail magic byte detection due to variable ISOBMFF box length (can add more `ftyp` variants)
