# AIMS — Technical Report

> Version 3.0 — Last updated: July 2026

---

## 1. Executive Summary

AIMS (Agricultural Insurance Management System) is a production-ready multi-tenant SaaS backend for agricultural crop insurance. The system automates the full insurance lifecycle with AI-powered fraud detection, real-time communication, and parametric auto-trigger payouts.

### Key Metrics

| Metric | Value |
|--------|-------|
| Source Files | 120 |
| API Endpoints | 97+ |
| Database Models | 24 |
| Database Enums | 8 |
| Services | 24 |
| Controllers | 22 |
| Route Files | 21 |
| Middleware | 6 |
| Validators | 17 |
| Libraries | 15 |
| BullMQ Workers | 6 |
| Test Suites | 12 |
| Total Tests | 205 (all passing) |
| Permissions | 60+ |
| Built-in Roles | 7 |

---

## 2. System Architecture

### Request Lifecycle

```
Client Request
  → x-request-id (UUID)
  → Helmet (security headers)
  → CORS
  → Stripe webhook (raw body, if applicable)
  → express.json (10mb limit)
  → express.urlencoded
  → pino-http (request logging)
  → API rate limiter (100/15min)
  → resolveTenant (subdomain/header)
  → [Route-specific middleware chain]
  → Controller
  → Service
  → Prisma (PostgreSQL)
  → Response
  → Global error handler (if error)
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|---------------|
| **Routes** | Define endpoints, HTTP methods, middleware chains |
| **Middleware** | Auth verification, RBAC checks, validation, rate limiting |
| **Controllers** | Extract params, call services, format responses |
| **Services** | Business logic, database queries, external API calls |
| **Libraries** | External service clients (Supabase, Cloudinary, OpenRouter, etc.) |
| **Validators** | Zod schema definitions for request body validation |
| **Config** | Static configuration (fraud tiers, permissions, gateways) |
| **Utils** | Pure functions (generators, fraud scoring, geo calculations) |

---

## 3. Authentication & Authorization

### Authentication Flow

1. Client sends `Authorization: Bearer <supabase_jwt>`
2. `requireAuth` middleware verifies JWT against Supabase Auth
3. Looks up local User by `authId` (Supabase UUID)
4. Fallback: lookup by email → link authId (handles admin-created users)
5. Fallback: create new User with FARMER role (auto-provisioning)
6. Verifies tenant status (PENDING_APPROVAL or SUSPENDED → 403)
7. Attaches `req.user = { id, tenantId, authId, email, role }`

### Authorization Layers

| Layer | Implementation | Scope |
|-------|---------------|-------|
| **Role Guard** | `requireRole(...roles)` | Checks `req.user.role` against allowed roles |
| **Permission Guard** | `requirePermission(...perms)` | Resolves custom + built-in permissions |
| **Tenant Guard** | `requireTenantAccess` | Verifies user belongs to resolved tenant |
| **Feature Flag** | `requireFarmerPaymentsEnabled` | Gates payment endpoints behind env var |

### Built-in Roles (7)

| Role | Access Level | Key Permissions |
|------|-------------|-----------------|
| `PLATFORM_ADMIN` | All tenants, all operations | Everything |
| `TENANT_ADMIN` | All within tenant | Staff mgmt, settings, billing, IAM |
| `UNDERWRITER` | Policy management | Plan CRUD, farmer CRUD, policy review |
| `CLAIMS_OFFICER` | Claim processing | Review, approve/reject, assign |
| `SENIOR_CLAIMS_OFFICER` | Claims + override | All claims officer + override + payout |
| `FIELD_AGENT` | Field operations | Document upload, visit completion |
| `FARMER` | Own data only | Own claims, policies, documents |

### IAM Custom Roles

- 60+ granular permissions in `resource:action:scope` format
- Tenants can create unlimited custom roles
- Custom role permissions override built-in defaults
- PLATFORM_ADMIN always has all permissions
- Permission resolution: `customRole.permissions || DEFAULT_ROLE_PERMISSIONS[role]`

---

## 4. Multi-Tenant Isolation

Three-layer enforcement:

| Layer | Implementation |
|-------|---------------|
| **Auth-level** | `requireAuth` resolves user's `tenantId` from database |
| **Route-level** | `requireTenantAccess` verifies user belongs to resolved tenant |
| **Query-level** | Every Prisma query includes `tenantId` in `where` clause |

Tenant resolution priority:
1. `x-tenant-slug` header
2. Subdomain extraction (e.g., `tenantname.aims.com`)
3. User's own tenant (from database)

PLATFORM_ADMIN bypasses tenant isolation for cross-tenant management.

---

## 5. API Routes (Complete)

### Auth (`/api/v1/auth`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/me` | Any | Current user profile |
| PATCH | `/profile` | Any | Update phone |
| PATCH | `/role` | PLATFORM_ADMIN | Update user role |
| GET | `/users` | PLATFORM_ADMIN | List all users (paginated) |

### Farmers (`/api/v1/farmers`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/fields` | Any | Dynamic field schema |
| GET | `/profile` | FARMER | Own profile |
| POST | `/profile` | FARMER | Create profile |
| PATCH | `/profile` | FARMER | Update profile |

### Land Parcels (`/api/v1/land-parcels`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | FARMER | List own parcels |
| GET | `/:id` | FARMER | Get parcel |
| POST | `/` | FARMER | Create parcel |
| PATCH | `/:id` | FARMER | Update parcel |
| DELETE | `/:id` | FARMER | Delete parcel |

### Policy Plans (`/api/v1/policy-plans`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | Public | List all plans |
| GET | `/:id` | Public | Get plan |
| POST | `/quote` | FARMER | Calculate premium quote |
| POST | `/` | UNDERWRITER+ | Create plan |
| PATCH | `/:id` | UNDERWRITER+ | Update plan |

### Policy Requests (`/api/v1/policy-requests`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | FARMER | Create purchase request |
| GET | `/` | FARMER+STAFF | List requests |
| GET | `/:id` | FARMER+STAFF | Get request |
| PATCH | `/:id/review` | UNDERWRITER+ | Approve/reject |
| POST | `/:id/convert` | UNDERWRITER+ | Convert to Policy |

### Policies (`/api/v1/policies`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/purchase` | FARMER | Direct purchase (feature-flagged) |
| GET | `/my` | FARMER | List own policies |
| GET | `/my/:id` | FARMER | Get policy |

### Claims (`/api/v1/claims`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | FARMER | File claim (triggers fraud pipeline) |
| GET | `/my` | FARMER | List own claims |
| GET | `/my/:id` | FARMER | Get claim |
| GET | `/` | STAFF | List all claims (tenant) |
| GET | `/:id` | STAFF | Get claim |
| PATCH | `/:id/assign` | STAFF | Assign claims officer |
| PATCH | `/:id/status` | STAFF | Update status |

**Claim State Machine:** `SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED`

### Documents (`/api/v1/documents`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/upload` | FARMER+STAFF | Upload with EXIF/ELA/hash analysis |
| GET | `/claim/:claimId` | FARMER+STAFF | List claim documents |
| GET | `/:id` | FARMER+STAFF | Get document |
| DELETE | `/:id` | STAFF | Delete document |

### Payments (`/api/v1/payments`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/create-payment-intent` | FARMER | Create Stripe intent |
| POST | `/confirm` | FARMER | Confirm payment |
| POST | `/payout` | STAFF | Process payout |
| GET | `/policy/:policyId` | FARMER+ADMIN | Policy payments |
| GET | `/claim/:claimId` | FARMER+STAFF | Claim payments |

### Chat (`/api/v1/chat`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/conversations` | FARMER+STAFF | List conversations |
| POST | `/conversations/:claimId` | FARMER+STAFF | Get/create conversation |
| GET | `/conversations/:conversationId/messages` | FARMER+STAFF | Get messages |
| POST | `/conversations/:conversationId/messages` | FARMER+STAFF | Send message |

### Visits (`/api/v1/visits`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | STAFF+FIELD_AGENT | List visits |
| POST | `/:claimId` | STAFF | Schedule visit |
| PATCH | `/:visitId/complete` | STAFF+FIELD_AGENT | Complete visit |
| PATCH | `/:visitId/cancel` | STAFF | Cancel visit |

### Damage (`/api/v1/damage`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/calculate/:claimId` | STAFF | Calculate damage & payout |
| GET | `/:claimId` | FARMER+STAFF | Get assessment |

### Notifications (`/api/v1/notifications`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | Any | List notifications |
| PATCH | `/read` | Any | Mark as read |
| PATCH | `/read-all` | Any | Mark all as read |

### Admin (`/api/v1/admin`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/staff` | ADMIN | Create staff user |
| GET | `/staff` | ADMIN | List staff |
| PATCH | `/staff/:id/toggle-status` | ADMIN | Toggle user status |
| GET | `/dashboard` | ADMIN | Dashboard aggregates |
| GET | `/analytics/claims` | ADMIN | Claims analytics |

### Platform (`/api/v1/platform`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/tenants/signup` | Public | Tenant self-registration |
| POST | `/tenants` | PLATFORM_ADMIN | Create tenant |
| GET | `/tenants` | PLATFORM_ADMIN | List tenants |
| GET | `/tenants/:id` | PLATFORM_ADMIN | Get tenant |
| PATCH | `/tenants/:id` | PLATFORM_ADMIN | Update tenant |
| DELETE | `/tenants/:id` | PLATFORM_ADMIN | Deactivate |
| PATCH | `/tenants/:id/approve` | PLATFORM_ADMIN | Approve |
| PATCH | `/:id/suspend` | PLATFORM_ADMIN | Suspend |
| POST | `/tenants/:id/seed` | PLATFORM_ADMIN | Seed policy plans |

### Settings (`/api/v1/settings`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | Any | Get settings |
| PATCH | `/` | ADMIN | Update settings |
| GET | `/fraud-tier` | Any | Get fraud tier |
| PATCH | `/fraud-tier` | ADMIN | Update fraud tier |
| GET | `/payment-gateway` | ADMIN | Get gateway config |
| PATCH | `/payment-gateway` | ADMIN | Update gateway |

### Tenant Fields (`/api/v1/settings/fields`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | ADMIN | List fields |
| GET | `/:id` | ADMIN | Get field |
| POST | `/` | ADMIN | Create field |
| PATCH | `/:id` | ADMIN | Update field |
| DELETE | `/:id` | ADMIN | Delete field |

### Import/Export (`/api/v1/import`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/policy-plans` | ADMIN | Import plans (CSV/JSON) |
| POST | `/farmers-policies` | ADMIN | Import farmers+policies |
| GET | `/export/farmers` | ADMIN | Export farmers CSV |
| GET | `/export/claims` | ADMIN | Export claims CSV |

### Billing (`/api/v1/billing`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/subscribe` | ADMIN | Stripe Checkout session |
| POST | `/cancel` | ADMIN | Cancel subscription |
| GET | `/status` | Any | Subscription status |
| GET | `/usage` | Any | Usage summary |
| GET | `/invoices` | Any | List invoices |
| GET | `/invoices/:id` | Any | Get invoice |
| POST | `/invoices/:id/pay` | ADMIN | Pay invoice |
| POST | `/invoices/generate` | ADMIN | Generate invoice |

### IAM (`/api/v1/iam`)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/roles` | ADMIN | List roles |
| GET | `/roles/:id` | ADMIN | Get role |
| POST | `/roles` | ADMIN | Create role |
| PATCH | `/roles/:id` | ADMIN | Update role |
| DELETE | `/roles/:id` | ADMIN | Delete role |
| POST | `/roles/assign` | ADMIN | Assign role to user |
| GET | `/permissions` | ADMIN | List all permissions |
| GET | `/permissions/mine` | Any | Current user permissions |

### Webhooks (`/api/v1/webhooks`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/stripe` | Stripe webhook (raw body) |
| POST | `/easypaisa` | Easypaisa webhook |
| POST | `/jazzcash` | JazzCash webhook |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{"status":"ok","timestamp":"..."}` |

---

## 6. Fraud Detection System

### Phase 1: Sync Forensics (claim submission, <100ms)

Runs free checks with no external API calls:

| Check | Weight | Logic |
|-------|--------|-------|
| `DUPLICATE_CLAIM` | 40 | Same policy, same claim within 30 days |
| `CLAIM_AMOUNT_MISMATCH` | 10 | Claimed amount > 150% of expected |
| `FARMER_HISTORY` | 15 | >3 claims in last 12 months |
| `EXIF_MISSING` | 15 | Image EXIF stripped or extraction failed |
| `EXIF_SUSPICIOUS` | 7.5 | Suspicious EXIF flags present |
| `FILE_SPOOF` | 20 | ELA analysis detects manipulation |
| `AI_IMAGE_CHECK` | 20 | EXIF heuristics suggest AI-generated |
| `VIDEO_SUSPICIOUS` | 10 | Unusual codec or duration |
| `PDF_NO_TEXT_CONTENT` | 6 | PDF has no extractable text |
| `HASH_DUPLICATE` | 25 | File hash matches document in another claim |

Score = `sum(triggered weights)`, capped at 100.

### Phase 2: Async 3-Tier Pipeline (BullMQ background)

**Tier 1 — Satellite NDVI (Sentinel Hub)**
- Compares NDVI before and after incident date
- If drop < threshold → +40 fraud score
- Logged as `SATELLITE_NDVI` in audit log

**Tier 2 — Weather Verification (OpenWeather)**
- Checks historical weather at incident location/date
- If no severe weather confirmed → +30 fraud score
- Logged as `WEATHER_TRUTH` in audit log

**Tier 3 — LLM Confirmation (OpenRouter)**
- Image damage analysis with Tier 1+2 context in prompt
- CNIC cross-check (OCR extracted CNIC vs registered CNIC)
- If image doesn't show damage → +20 score
- If CNIC mismatch → +25 score
- Logged as `AI_IMAGE_CHECK` / `CNIC_MISMATCH` in audit log

### Fraud Verdicts

| Score | Verdict | Recommended Action |
|-------|---------|-------------------|
| 0-20 | LOW | Auto-approve (if auto-trigger) |
| 21-50 | MEDIUM | Manual review |
| 51-75 | HIGH | Escalate to Senior Claims Officer |
| 76-100 | CRITICAL | Block payout, investigate |

### Fraud Tiers (Tenant Configurable)

| Tier | Primary Model | Fallback | Base Fee | Image Cost | Markup |
|------|---------------|----------|----------|------------|--------|
| FORGE | Gemini 2.0 Flash | Llama 3.2 90B Vision | $0/mo | $0.001 | 1.0x |
| TITAN | GPT-4o mini | Claude 3 Haiku | $99/mo | $0.005 | 1.5x |
| GOAT | GPT-4o | Claude 3.5 Sonnet | $499/mo | $0.015 | 2.0x |

---

## 7. Document Forensics

Runs at **document upload time** via `documents.service`:

### EXIF Extraction (`forensics.service.extractExif`)
- Uses `exifr` library
- Extracts: make, model, GPS, date, software, orientation, dimensions
- Flags: `EXIF_STRIPPED`, `NO_GPS_DATA`, `NO_DATE_ORIGINAL`, `EDITOR_SOFTWARE_DETECTED`, `IMAGE_ROTATED`

### ELA Analysis (`forensics.service.computeEla`)
- Uses `sharp` to recompress at quality 75
- Compares pixel differences with original
- If diff > 30% → `modified: true`

### AI-Generated Detection (`forensics.service.detectAiGenerated`)
- Combines EXIF signals for scoring
- Checks unusual aspect ratios
- Verdict: `LIKELY_AUTHENTIC`, `UNCLEAR`, `SUSPECTED_AI`

### Video Analysis (`forensics.service.analyzeVideo`)
- Uses `fluent-ffmpeg` ffprobe
- Flags: `NO_DURATION`, `UNUSUAL_CODEC`

### PDF Analysis (`forensics.service.analyzePdf`)
- Uses `pdf-lib` + `pdf-parse`
- Flags: `PDF_MODIFIED` (known editors), `PDF_NO_TEXT_CONTENT`

### Hash Dedup
- SHA-256 computed at upload
- Same-hash detection within claim → rejection
- Cross-claim hash match → fraud re-analysis triggered

---

## 8. Damage Calculation

Weighted multi-signal assessment:

| Signal | Weight | Source |
|--------|--------|--------|
| NDVI damage % | 35% | Sentinel Hub |
| Weather confirmed | 15% | OpenWeather |
| AI damage score | 20% | LLM image analysis |
| Ground truth | 30% | Claims officer field assessment |

```
finalDamage = (ndvi×0.35 + weather×0.15 + ai×0.20 + groundTruth×0.30) / activeWeights
payout = coverageAmount × min(finalDamage/100, 0.95)
```

Min payout: 2% of coverage. Max payout: 95% of coverage.

---

## 9. Payment System

### Three Gateways

| Gateway | Currency | Implementation |
|---------|----------|---------------|
| Stripe | USD | Full: PaymentIntent, Checkout, Payout, Webhook |
| JazzCash | PKR | Redirect flow, webhook verification |
| Easypaisa | PKR | Mobile wallet, QR code |

### Gateway Selection
- Stored in `Tenant.config.paymentGateway`
- Factory pattern: `getPaymentGateway(tenantConfig)` returns correct adapter
- All gateways implement the same `PaymentGateway` interface

### Feature Flag
`FARMER_ONLINE_PAYMENTS_ENABLED` — When false, farmers submit policy requests for staff review instead of direct purchase.

---

## 10. Real-Time Communication

### Socket.IO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `fraud:score-updated` | Server → Client | `{ claimId, score, verdict }` |
| `claim:status-changed` | Server → Client | `{ claimId, status }` |
| `message:new` | Server → Client | `{ conversationId, message }` |

### Room Structure
- Each claim has a room: `claim:{claimId}`
- Users join the room when viewing a claim
- Updates broadcast to all room members

---

## 11. Background Jobs

### BullMQ Queues

| Queue | Worker | Purpose | Retries |
|-------|--------|---------|---------|
| `fraud` | `fraud-worker.ts` | 3-tier async fraud analysis | 3x exponential |
| `ocr` | `ocrWorker.ts` | Tesseract.js OCR extraction | 3x exponential |
| `auto-trigger` | `auto-trigger-worker.ts` | NDVI monitoring + auto-claims | 3x exponential |
| `notification` | `notificationWorker.ts` | Push notification dispatch | 3x exponential |
| `billing` | `billingWorker.ts` | Invoice generation | 3x exponential |

### Cron Schedules

| Job | Schedule | Description |
|-----|----------|-------------|
| Auto-trigger | Every 6 hours | NDVI check across all active policies |
| Billing | 1st of month, 02:00 AM | Generate invoices for all tenants |

### Auto-Trigger Flow

1. Cron fires every 6 hours
2. Scans all ACTIVE policies with auto-trigger enabled
3. For each: fetch NDVI before/after from Sentinel Hub
4. If NDVI drop exceeds threshold: check weather confirmation
5. If weather confirms disaster: auto-create claim
6. If fraud score < `autoApproveMaxScore` (default 30): auto-approve
7. Send notification to farmer

---

## 12. External Integrations

| Service | Purpose | Library |
|---------|---------|---------|
| Supabase Auth | JWT verification, user management | `@supabase/supabase-js` |
| Cloudinary | Document upload, image processing | `cloudinary` |
| OpenRouter | LLM calls (GPT-4o, Claude, Gemini, Llama) | Custom HTTP client |
| Sentinel Hub | NDVI satellite analysis | Custom OAuth client |
| OpenWeather | Historical weather verification | Custom HTTP client |
| Stripe | Payment processing, subscriptions | `stripe` |
| JazzCash | Pakistan mobile wallet | Custom HTTP client |
| Easypaisa | Pakistan mobile wallet | Custom HTTP client |
| Redis | BullMQ queue backend, caching | `ioredis` |
| BullMQ | Background job processing | `bullmq` |
| Socket.IO | Real-time WebSocket communication | `socket.io` |

---

## 13. Security

| Layer | Implementation |
|-------|---------------|
| **HTTPS** | Enforced via Helmet HSTS |
| **CORS** | Configured via `cors()` |
| **Rate Limiting** | 100/15min general, 20/15min auth, 50/hr uploads |
| **Auth** | Supabase JWT Bearer tokens |
| **Tenant Isolation** | Every query filtered by `tenantId` |
| **RBAC** | Role-based + permission-based access control |
| **Input Validation** | Zod schemas on all mutation endpoints |
| **File Validation** | Magic byte detection (not just extension), MIME whitelist |
| **Hash Dedup** | SHA-256 file hashing prevents duplicate uploads |
| **EXIF Forensics** | Detects stripped metadata, editor software, AI-generated |
| **ELA Analysis** | Detects image manipulation at upload time |
| **Error Handling** | Global error handler, no stack traces in production |
| **Request Tracing** | UUID `x-request-id` on every request |
| **Webhook Security** | Stripe signature verification, raw body preservation |
| **Feature Flags** | Payment endpoints gated behind env flag |
| **Tenant Status** | PENDING_APPROVAL/SUSPENDED tenants blocked at auth level |

---

## 14. Testing

### Test Results

```
Test Suites: 12 passed, 12 total
Tests:       205 passed, 205 total
Time:        ~28s
```

### Per-Suite Breakdown

| Suite | Tests | What's Covered |
|-------|-------|----------------|
| `smoke.test.ts` | 39 | Health, CORS, rate limiting, auth, RBAC, chat, visits, damage, export |
| `forensics.test.ts` | 26 | EXIF extraction, ELA analysis, AI-gen detection, PDF/video, damage calc |
| `v2.test.ts` | 26 | Satellite NDVI, weather API, sequential 3-tier pipeline, auto-trigger |
| `utils.test.ts` | 19 | Generators, fraud scoring, geo distances |
| `tenantIsolation.test.ts` | 18 | Cross-tenant data leaks, policy isolation |
| `iam.test.ts` | 14 | Custom role CRUD, permission matrix |
| `billing.test.ts` | 14 | Invoice CRUD, subscription, payment flow |
| `policyPlans.test.ts` | 14 | Plan CRUD, premium calculation, quote flow |
| `chat-visits-damage.test.ts` | 12 | Auth guards on chat, visit, damage endpoints |
| `claims.test.ts` | 8 | Claim state machine, duplicate detection |
| `farmers.test.ts` | 8 | CRUD, CNIC uniqueness, custom fields |
| `billing-markup.test.ts` | 7 | Billing markup calculation |

---

## 15. Deployment

### Railway Configuration

`railway.toml` defines 4 services:

| Service | Command | Purpose |
|---------|---------|---------|
| `web` | `npm start` | Express API server (port 4000) |
| `worker` | `node dist/worker.js` | Standalone BullMQ worker |
| `auto-trigger-cron` | `node dist/cron/autoTrigger.cron.js` | NDVI check every 6 hours |
| `billing-cron` | `node dist/cron/billing.cron.js` | Monthly invoice generation |

### Build Process

```bash
npx prisma generate && tsc
```

### Start Process

```bash
npx prisma migrate deploy && node dist/server.js
```

---

## 16. File Inventory

### Source Files (120)

| Directory | Count | Purpose |
|-----------|-------|---------|
| `src/config/` | 4 | Static configuration |
| `src/controllers/` | 22 | Request handlers |
| `src/services/` | 24 | Business logic |
| `src/routes/` | 21 | Route definitions |
| `src/middleware/` | 6 | Auth, RBAC, validation, errors |
| `src/validators/` | 17 | Zod schemas |
| `src/lib/` | 15 | External service clients |
| `src/utils/` | 4 | Pure utility functions |
| `src/jobs/` | 6 | BullMQ workers |
| `src/cron/` | 2 | Scheduled tasks |
| `src/scripts/` | 2 | Seed, migration |
| Root | 2 | server.ts, worker.ts |

### Test Files (12)
10 test suites + 1 setup file = 205 tests total.

### Database (Prisma)
- 24 models
- 8 enums
- 2 migration files

---

*Report generated from AIMS v3.0 codebase. See ARCHITECTURE.md for detailed implementation docs.*
