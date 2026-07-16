# MULTI_TENANT_PROGRESS.md — Multi-Tenant Expansion Progress

## Phase 1: Database Schema
- [x] Updated `prisma/schema.prisma` with `Tenant` model
- [x] Added `tenantId` to all tenant-owned models (User, Farmer, LandParcel, PolicyPlan, Policy, Claim, Payment)
- [x] Updated `Role` enum: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `UNDERWRITER`, `CLAIMS_OFFICER`, `FIELD_AGENT`, `FARMER`
- [x] Added indexes on `tenantId` for all tenant-owned models
- [x] Scoped uniqueness (email + tenant, authId + tenant, cnicNumber + tenant, name + tenant)
- [x] Created migration SQL in `prisma/migrations/multi_tenant/migration.sql`
- [x] Created data migration script: `src/scripts/migrateTenant.ts`
- [x] Added `migrate-data` script to `package.json`
- Notes: Migration kept separate from init migration to avoid overwriting existing schema.

## Phase 2: Auth & Tenant Middleware
- [x] Updated `auth.ts` — `requireAuth` resolves tenant from `x-tenant-id` header, defaults to "default" tenant
- [x] Added `resolveTenant` middleware — extracts tenant slug from subdomain or `x-tenant-slug` header
- [x] Added `requireTenantAccess` guard in `roleGuard.ts` — verifies user belongs to resolved tenant
- [x] Updated `roleGuard.ts` — supports new role names (`PLATFORM_ADMIN`, `TENANT_ADMIN`)
- [x] Updated Express `Request` type: added `tenantId` to `user`, added `tenant` object
- Notes: `resolveTenant` wired in `server.ts` before all routes.

## Phase 3: Platform Admin — Tenant Management
- [x] Created `src/routes/platform.routes.ts`
- [x] Created `src/controllers/platform.controller.ts`
- [x] Created `src/services/platform.service.ts`
- [x] Created `src/validators/platform.validator.ts`
- [x] Wired routes in `server.ts` at `/api/v1/platform`
- Endpoints: POST/GET/PATCH/DELETE tenants, GET tenant/:id, POST tenant/:id/seed

## Phase 4: Refactor All Services
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

## Phase 5: Tenant Settings & Config
- [x] Created `src/routes/tenantSettings.routes.ts`
- [x] Created `src/controllers/tenantSettings.controller.ts`
- [x] Created `src/services/tenantSettings.service.ts`
- [x] Created `src/validators/tenantSettings.validator.ts`
- [x] GET /api/v1/settings — any authenticated user
- [x] PATCH /api/v1/settings — TENANT_ADMIN/PLATFORM_ADMIN, config merging
- Notes: Config is merged with existing (not overwritten) on PATCH.

## Phase 6: Bulk Import (Policy Plans)
- [x] Added `importQueue` to `src/lib/bullmq.ts`
- [x] Created `src/jobs/importWorker.ts` — processes both policy-plan and farmers-policies jobs
- [x] Created `src/services/import.service.ts` — CSV/JSON parsing with csv-parse, column mapping, validation
- [x] Created `src/controllers/import.controller.ts` — sync for <= 50 records, async queue for larger
- [x] Created `src/routes/import.routes.ts`
- [x] Wired in `server.ts` at `/api/v1/import`
- Endpoints: POST /api/v1/import/policy-plans, POST /api/v1/import/farmers-policies

## Phase 7: Bulk Import (Farmers & Policies)
- [x] CSV/JSON parsing with column mapping
- [x] Validation and creation for farmers, land parcels, and policies
- [x] User auto-creation with fabricated authId (documented limitation)
- [x] Import endpoint with threshold-based queuing (>50 records queues BullMQ job)
- [x] Improved JSON.parse error handling with user-friendly message
- Notes: Imported users can't log in via Stack Auth until they complete sign-up.

## Phase 8: Stripe Billing
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
- Notes: Billing requires `STRIPE_SUBSCRIPTION_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` env vars. Feature-flagged via `BILLING_ENABLED=false` by default.

## Phase 9: Subdomain Routing
- [x] `resolveTenant` middleware created in `auth.ts`
- [x] Wired in `server.ts` via `app.use(resolveTenant)`
- [x] `requireTenantAccess` guard applied to all 12 tenant-scoped route files
- [x] Platform routes bypass subdomain check via PLATFORM_ADMIN role (guard skips them)
- Notes: All tenant routes now have double protection — service-level tenantId filters + middleware-level tenant access check.

## Phase 10: Testing
- [x] Created `tests/tenantIsolation.test.ts` — 18 tests covering all service modules
- [x] Tests verify: farmer CNIC uniqueness per tenant, land parcel tenant scope, policy plan tenant isolation, policy tenant scope, claim tenant scope, payment tenant scope, admin dashboard/ staff/ toggle by tenant, role guard PLATFORM_ADMIN bypass and FARMER block
- [x] Full test suite: 26/26 tests passing (8 original + 18 isolation tests)
- [x] TypeScript: 0 errors
- Notes: Jest setup file tested (setup.js/setup.ts) but ultimately not needed — mock defined inside jest.mock factory with `var` avoids TDZ issues.

## Deviations from MULTI_TENANT_PLAN.md
- Migration kept as separate `prisma/migrations/multi_tenant/` directory instead of overwriting init migration.
- `resolveTenant` and `requireTenantAccess` implemented as middleware within existing auth/roleGuard files rather than dedicated files. Keeps the project structure clean.
- Platform admin routes use `PLATFORM_ADMIN` role guard only (no subdomain bypass needed since they never pass through tenant-scoped routes).
- Remaining phases (5-10) plus fixing leftover duplicate files documented as known issues.
