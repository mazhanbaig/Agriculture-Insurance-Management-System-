# AIMS — Complete System Architecture

> Agricultural Insurance Management System — Multi-tenant backend with AI fraud detection, parametric insurance, and real-time communication.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Environment Variables](#4-environment-variables)
5. [Server Bootstrap (`server.ts`)](#5-server-bootstrap)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Multi-Tenant Isolation](#7-multi-tenant-isolation)
8. [Role-Based Access Control (RBAC)](#8-role-based-access-control-rbac)
9. [IAM — Custom Roles & Permissions](#9-iam--custom-roles--permissions)
10. [API Routes — Complete Map](#10-api-routes--complete-map)
11. [Controllers — Request Handlers](#11-controllers--request-handlers)
12. [Services — Business Logic](#12-services--business-logic)
13. [Fraud Detection Pipeline](#13-fraud-detection-pipeline)
14. [Document Forensics](#14-document-forensics)
15. [Auto-Trigger (Parametric Insurance)](#15-auto-trigger-parametric-insurance)
16. [Damage Calculation Engine](#16-damage-calculation-engine)
17. [Payment System](#17-payment-system)
18. [Billing & Usage Tracking](#18-billing--usage-tracking)
19. [Real-Time Communication (WebSocket)](#19-real-time-communication-websocket)
20. [Background Jobs (BullMQ)](#20-background-jobs-bullmq)
21. [External Integrations](#21-external-integrations)
22. [Middleware Pipeline](#22-middleware-pipeline)
23. [Validators (Zod)](#23-validators-zod)
24. [Libraries (`lib/`)](#24-libraries)
25. [Utils](#25-utils)
26. [Configuration Files](#26-configuration-files)
27. [Database Schema (Prisma)](#27-database-schema)
28. [Deployment (Railway)](#28-deployment)
29. [Testing](#29-testing)
30. [Security Summary](#30-security-summary)

---

## 1. System Overview

AIMS is a **multi-tenant SaaS platform** for agricultural crop insurance. It automates the entire insurance lifecycle: farmer onboarding, policy management, claim filing, AI-powered fraud detection, damage assessment, and payout processing.

### Core Flows

```
Farmer registers → Creates land parcel → Submits policy request
→ Staff reviews → Policy created → Claim filed with documents
→ Sync fraud check runs instantly → Async 3-tier fraud pipeline
→ Satellite NDVI → Weather verification → LLM confirmation
→ Damage calculated → Payout processed → Real-time status updates
```

### Key Differentiators

- **3-Tier Sequential Fraud Pipeline**: Satellite (Sentinel Hub NDVI) → Weather (OpenWeather) → LLM (OpenRouter) — each tier grounds the next
- **Upload-Time Forensics**: EXIF extraction, ELA analysis, AI-gen detection, hash dedup — runs at document upload, not claim time
- **Parametric Auto-Trigger**: Monitors satellite data and auto-files claims when NDVI drops below thresholds
- **3 Payment Gateways**: Stripe (international), JazzCash, Easypaisa (Pakistan)
- **Custom Role IAM**: Tenants can create roles with granular `resource:action:scope` permissions

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 + TypeScript |
| Framework | Express 5 |
| ORM | Prisma 7 |
| Database | PostgreSQL (Neon) |
| Cache/Queue | Redis (ioredis) + BullMQ |
| Auth | Supabase Auth (JWT Bearer) |
| File Storage | Cloudinary |
| AI/LLM | OpenRouter (GPT-4o, Claude, Gemini, Llama) |
| Satellite | Sentinel Hub (NDVI analysis) |
| Weather | OpenWeatherMap |
| Real-Time | Socket.IO |
| Payments | Stripe + JazzCash + Easypaisa |
| Validation | Zod 4 |
| Logging | Pino + pino-http |
| Security | Helmet + CORS + express-rate-limit |
| OCR | Tesseract.js (BullMQ worker) |
| Image Processing | Sharp (ELA analysis) |
| PDF | pdf-lib + pdf-parse |
| EXIF | exifr |
| Testing | Jest 30 + ts-jest |

---

## 3. Project Structure

```
AIMS/
├── src/
│   ├── server.ts                  # Express app, middleware, route mounting, startup
│   ├── worker.ts                  # Standalone BullMQ worker entry point
│   ├── config/
│   │   ├── autoTriggerConfig.ts   # Auto-trigger defaults, retry logic, config merging
│   │   ├── fraudTiers.ts          # FORGE/TITAN/GOAT tier definitions with model configs
│   │   ├── paymentGateways.ts     # Gateway interface, types, factory helpers
│   │   └── permissions.ts         # 60+ permissions, default role→permission mappings
│   ├── controllers/               # 22 controllers — thin request→service delegates
│   ├── services/                  # 24 services — all business logic
│   ├── routes/                    # 21 route files — Express Router definitions
│   ├── middleware/                 # 6 middleware — auth, RBAC, validation, rate limiting, errors
│   ├── validators/                # 17 Zod schemas — request body validation
│   ├── lib/                       # 15 libraries — external service clients
│   ├── utils/                     # 4 utilities — generators, fraud scoring, geo, logger
│   ├── jobs/                      # 6 BullMQ workers — fraud, OCR, auto-trigger, billing, notifications
│   ├── cron/                      # 2 cron files — auto-trigger (6h), billing (monthly)
│   └── scripts/                   # 2 scripts — seed, tenant migration
├── tests/                         # 10 test files — 205 tests
├── prisma/
│   ├── schema.prisma              # 24 models, 8 enums
│   └── migrations/                # 2 migration files
├── testsprite/                    # MCP server for TestSprite agent
├── api/index.ts                   # Vercel serverless entry point
├── postman/                       # Postman collection
├── package.json
├── tsconfig.json
├── jest.config.js
├── prisma.config.ts
└── railway.toml                   # 4 Railway services: web, worker, 2 crons
```

---

## 4. Environment Variables

**Required** (server exits if missing in production):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous API key |
| `REDIS_URL` | Redis connection string for BullMQ |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM calls |

**Optional:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 4000 | Server port |
| `NODE_ENV` | development | test/development/production |
| `USE_NEON_ADAPTER` | false | Enable Neon HTTP adapter for serverless |
| `FARMER_ONLINE_PAYMENTS_ENABLED` | false | Enable farmer-facing payment endpoints |
| `LOG_LEVEL` | info | Pino log level |
| `SENTINEL_HUB_CLIENT_ID` | — | Sentinel Hub for NDVI |
| `SENTINEL_HUB_CLIENT_SECRET` | — | Sentinel Hub for NDVI |
| `OPENWEATHER_API_KEY` | — | Weather verification |

---

## 5. Server Bootstrap (`server.ts`)

```
Request → x-request-id middleware → Helmet → CORS
→ Stripe webhook (raw body) → Webhook routes (raw body)
→ express.json (10mb) → express.urlencoded → pino-http
→ API rate limiter (100/15min) → resolveTenant
→ [Route handlers]
→ Global error handler
→ [Non-test mode: BullMQ workers + Socket.IO + Cron schedules]
```

**Startup sequence:**
1. Validate required env vars (exits if missing)
2. Register global middleware stack
3. Mount 21 route groups under `/api/v1/*`
4. Initialize 4 BullMQ workers (fraud, auto-trigger, notifications, billing, OCR)
5. Verify Redis connectivity (exits in production if failed)
6. Create HTTP server + Socket.IO
7. Schedule auto-trigger cron (every 6 hours) and billing cron (1st of month)

---

## 6. Authentication & Authorization

### Auth Flow (`middleware/auth.ts`)

1. Extract `Bearer <token>` from `Authorization` header
2. Verify JWT against Supabase Auth (`supabase.auth.getUser(token)`)
3. Lookup local User by `authId` (Supabase UUID)
4. **Fallback**: If not found by authId, lookup by email → link authId
5. **Fallback**: If not found at all, create new User with FARMER role
6. Verify tenant status (PENDING_APPROVAL or SUSPENDED → 403)
7. Attach `req.user = { id, tenantId, authId, email, role }`

### Tenant Resolution (`resolveTenant` middleware)

- Priority 1: `x-tenant-slug` header
- Priority 2: Subdomain extraction (e.g., `tenantname.aims.com`)
- Attaches `req.tenant = { id, name, slug, config }`

---

## 7. Multi-Tenant Isolation

Every query includes `tenantId` in the `where` clause. The system enforces:

1. **Auth-level**: `requireAuth` resolves the user's `tenantId`
2. **Route-level**: `requireTenantAccess` verifies user belongs to the resolved tenant (PLATFORM_ADMIN bypasses)
3. **Service-level**: All Prisma queries filter by `tenantId`
4. **Cross-tenant leak prevention**: Tests verify User A cannot read User B's data

---

## 8. Role-Based Access Control (RBAC)

### Built-in Roles (7)

| Role | Access Level |
|------|-------------|
| `PLATFORM_ADMIN` | All tenants, all operations |
| `TENANT_ADMIN` | All within their tenant |
| `UNDERWRITER` | Policy plan management, farmer CRUD |
| `CLAIMS_OFFICER` | Claim review, approve/reject, assign |
| `SENIOR_CLAIMS_OFFICER` | All claims officer + override + payout |
| `FIELD_AGENT` | Document upload, visit completion |
| `FARMER` | Own claims, policies, documents, profile |

### Middleware Chain

```
requireAuth → requireTenantAccess → requireRole("FARMER") → Controller
```

---

## 9. IAM — Custom Roles & Permissions

**60+ granular permissions** in `resource:action:scope` format:

- `claim:view:own`, `claim:view:tenant`, `claim:create`, `claim:approve`
- `farmer:view:own`, `farmer:create`, `farmer:update:own`
- `policy:view:own`, `policy:purchase`, `policy:manage`
- `payment:view:own`, `payment:create`, `payment:payout`
- `admin:dashboard`, `admin:staff`, `admin:analytics`
- `billing:subscribe`, `billing:cancel`, `billing:view`
- `iam:view`, `iam:manage`, `platform:tenants`

**Permission resolution**: Custom role permissions override built-in defaults. PLATFORM_ADMIN always has all permissions.

**API:**
- `GET /api/v1/iam/roles` — List roles (with user counts)
- `POST /api/v1/iam/roles` — Create custom role
- `PATCH /api/v1/iam/roles/:id` — Update role
- `DELETE /api/v1/iam/roles/:id` — Delete (soft, if not assigned)
- `POST /api/v1/iam/roles/assign` — Assign role to user
- `GET /api/v1/iam/permissions` — List all available permissions
- `GET /api/v1/iam/permissions/mine` — Get current user's resolved permissions

---

## 10. API Routes — Complete Map

### Auth (`/api/v1/auth`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/me` | Yes | Any | Current user profile |
| PATCH | `/profile` | Yes | Any | Update phone |
| PATCH | `/role` | Yes | PLATFORM_ADMIN | Update user role |
| GET | `/users` | Yes | PLATFORM_ADMIN | List all users (paginated) |

### Farmers (`/api/v1/farmers`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/fields` | Yes | Any | Dynamic field schema |
| GET | `/profile` | Yes | FARMER | Own profile |
| POST | `/profile` | Yes | FARMER | Create profile |
| PATCH | `/profile` | Yes | FARMER | Update profile |

### Land Parcels (`/api/v1/land-parcels`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | Yes | FARMER | List own parcels |
| GET | `/:id` | Yes | FARMER | Get parcel |
| POST | `/` | Yes | FARMER | Create parcel |
| PATCH | `/:id` | Yes | FARMER | Update parcel |
| DELETE | `/:id` | Yes | FARMER | Delete parcel |

### Policy Plans (`/api/v1/policy-plans`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | No | — | List all plans (public) |
| GET | `/:id` | No | — | Get plan (public) |
| POST | `/quote` | Yes | FARMER | Calculate premium quote |
| POST | `/` | Yes | UNDERWRITER+ | Create plan |
| PATCH | `/:id` | Yes | UNDERWRITER+ | Update plan |

### Policy Requests (`/api/v1/policy-requests`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/` | Yes | FARMER | Create purchase request |
| GET | `/` | Yes | FARMER+STAFF | List requests |
| GET | `/:id` | Yes | FARMER+STAFF | Get request |
| PATCH | `/:id/review` | Yes | UNDERWRITER+ | Approve/reject |
| POST | `/:id/convert` | Yes | UNDERWRITER+ | Convert to Policy |

### Policies (`/api/v1/policies`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/purchase` | Yes | FARMER | Direct purchase (feature-flagged) |
| GET | `/my` | Yes | FARMER | List own policies |
| GET | `/my/:id` | Yes | FARMER | Get policy |

### Claims (`/api/v1/claims`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/` | Yes | FARMER | File claim (triggers fraud pipeline) |
| GET | `/my` | Yes | FARMER | List own claims |
| GET | `/my/:id` | Yes | FARMER | Get claim |
| GET | `/` | Yes | STAFF | List all claims (tenant) |
| GET | `/:id` | Yes | STAFF | Get claim |
| PATCH | `/:id/assign` | Yes | STAFF | Assign claims officer |
| PATCH | `/:id/status` | Yes | STAFF | Update status (state machine) |

**Claim State Machine:**
```
SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED
```

### Documents (`/api/v1/documents`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/upload` | Yes | FARMER+STAFF | Upload with EXIF/ELA/hash (feature-flagged) |
| GET | `/claim/:claimId` | Yes | FARMER+STAFF | List claim documents |
| GET | `/:id` | Yes | FARMER+STAFF | Get document |
| DELETE | `/:id` | Yes | STAFF | Delete document |

### Payments (`/api/v1/payments`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/create-payment-intent` | Yes | FARMER | Create Stripe intent |
| POST | `/confirm` | Yes | FARMER | Confirm payment |
| POST | `/payout` | Yes | STAFF | Process payout |
| GET | `/policy/:policyId` | Yes | FARMER+ADMIN | Policy payments |
| GET | `/claim/:claimId` | Yes | FARMER+STAFF | Claim payments |

### Chat (`/api/v1/chat`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/conversations` | Yes | FARMER+STAFF | List conversations |
| POST | `/conversations/:claimId` | Yes | FARMER+STAFF | Get/create conversation |
| GET | `/conversations/:conversationId/messages` | Yes | FARMER+STAFF | Get messages |
| POST | `/conversations/:conversationId/messages` | Yes | FARMER+STAFF | Send message |

### Visits (`/api/v1/visits`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | Yes | STAFF+FIELD_AGENT | List visits |
| POST | `/:claimId` | Yes | STAFF | Schedule visit |
| PATCH | `/:visitId/complete` | Yes | STAFF+FIELD_AGENT | Complete visit |
| PATCH | `/:visitId/cancel` | Yes | STAFF | Cancel visit |

### Damage (`/api/v1/damage`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/calculate/:claimId` | Yes | STAFF | Calculate damage & payout |
| GET | `/:claimId` | Yes | FARMER+STAFF | Get assessment |

### Notifications (`/api/v1/notifications`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | Yes | Any | List notifications |
| PATCH | `/read` | Yes | Any | Mark as read |
| PATCH | `/read-all` | Yes | Any | Mark all as read |

### Admin (`/api/v1/admin`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/staff` | Yes | ADMIN | Create staff user |
| GET | `/staff` | Yes | ADMIN | List staff |
| PATCH | `/staff/:id/toggle-status` | Yes | ADMIN | Toggle user status |
| GET | `/dashboard` | Yes | ADMIN | Dashboard aggregates |
| GET | `/analytics/claims` | Yes | ADMIN | Claims analytics |

### Platform (`/api/v1/platform`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/tenants/signup` | No | — | Public tenant signup |
| POST | `/tenants` | Yes | PLATFORM_ADMIN | Create tenant |
| GET | `/tenants` | Yes | PLATFORM_ADMIN | List tenants |
| GET | `/tenants/:id` | Yes | PLATFORM_ADMIN | Get tenant |
| PATCH | `/tenants/:id` | Yes | PLATFORM_ADMIN | Update tenant |
| DELETE | `/tenants/:id` | Yes | PLATFORM_ADMIN | Deactivate |
| PATCH | `/tenants/:id/approve` | Yes | PLATFORM_ADMIN | Approve |
| PATCH | `/:id/suspend` | Yes | PLATFORM_ADMIN | Suspend |
| POST | `/tenants/:id/seed` | Yes | PLATFORM_ADMIN | Seed policy plans |

### Settings (`/api/v1/settings`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | Yes | Any | Get settings |
| PATCH | `/` | Yes | ADMIN | Update settings |
| GET | `/fraud-tier` | Yes | Any | Get fraud tier |
| PATCH | `/fraud-tier` | Yes | ADMIN | Update fraud tier |
| GET | `/payment-gateway` | Yes | ADMIN | Get gateway config |
| PATCH | `/payment-gateway` | Yes | ADMIN | Update gateway |

### Tenant Fields (`/api/v1/settings/fields`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | Yes | ADMIN | List fields |
| GET | `/:id` | Yes | ADMIN | Get field |
| POST | `/` | Yes | ADMIN | Create field |
| PATCH | `/:id` | Yes | ADMIN | Update field |
| DELETE | `/:id` | Yes | ADMIN | Delete field |

### Import/Export (`/api/v1/import`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/policy-plans` | Yes | ADMIN | Import plans (CSV/JSON) |
| POST | `/farmers-policies` | Yes | ADMIN | Import farmers+ policies |
| GET | `/export/farmers` | Yes | ADMIN | Export farmers CSV |
| GET | `/export/claims` | Yes | ADMIN | Export claims CSV |

### Billing (`/api/v1/billing`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/subscribe` | Yes | ADMIN | Stripe Checkout session |
| POST | `/cancel` | Yes | ADMIN | Cancel subscription |
| GET | `/status` | Yes | Any | Subscription status |
| GET | `/usage` | Yes | Any | Usage summary |
| GET | `/invoices` | Yes | Any | List invoices |
| GET | `/invoices/:id` | Yes | Any | Get invoice |
| POST | `/invoices/:id/pay` | Yes | ADMIN | Pay invoice |
| POST | `/invoices/generate` | Yes | ADMIN | Generate invoice |

### IAM (`/api/v1/iam`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/roles` | Yes | ADMIN | List roles |
| GET | `/roles/:id` | Yes | ADMIN | Get role |
| POST | `/roles` | Yes | ADMIN | Create role |
| PATCH | `/roles/:id` | Yes | ADMIN | Update role |
| DELETE | `/roles/:id` | Yes | ADMIN | Delete role |
| POST | `/roles/assign` | Yes | ADMIN | Assign role to user |
| GET | `/permissions` | Yes | ADMIN | List all permissions |
| GET | `/permissions/mine` | Yes | Any | Current user permissions |

### Webhooks (`/api/v1/webhooks`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/stripe` | Raw body | Stripe webhook |
| POST | `/easypaisa` | Raw body | Easypaisa webhook |
| POST | `/jazzcash` | Raw body | JazzCash webhook |

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | `{ status: "ok", timestamp }` |

---

## 11. Controllers — Request Handlers

All 22 controllers follow the same pattern:

```typescript
export async function handler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await someService.doSomething(req.user!.tenantId, req.body);
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}
```

Controllers are **thin delegates** — they extract params, call a service, format the response, and forward errors to the global error handler. No business logic lives in controllers.

---

## 12. Services — Business Logic

### Service Dependency Graph

```
claims.service → fraud.service → sentinel, weather, openrouter, usage
              → notificationQueue (BullMQ)
documents.service → forensics.service (EXIF, ELA)
                 → cloudinary, ocrQueue, fraudQueue
policyRequests.service → policies.service → billing
damage.service → prisma (DamageAssessment CRUD)
chat.service → prisma + notificationQueue
visit.service → prisma + notificationQueue
billing.service → stripe, usage.service
import.service → csv-parse, prisma bulk operations
iam.service → prisma (CustomRole CRUD, permission resolution)
platform.service → prisma (Tenant CRUD, seed plans)
admin.service → prisma (User management, dashboard aggregates)
```

---

## 13. Fraud Detection Pipeline

### Layer 1: Sync Forensics (runs during claim submission, <100ms)

Runs **free checks** with no external API calls:

| Check | Weight | Description |
|-------|--------|-------------|
| `DUPLICATE_CLAIM` | 40 | Same policy, same claim within 30 days |
| `CLAIM_AMOUNT_MISMATCH` | 10 | Claimed amount > 150% of expected (loss% × coverage) |
| `FARMER_HISTORY` | 15 | >3 claims in last 12 months |
| `EXIF_MISSING` | 15 | Image has no EXIF or EXIF was stripped |
| `EXIF_SUSPICIOUS` | 7.5 | Image has suspicious EXIF flags |
| `FILE_SPOOF` | 20 | ELA analysis detects manipulation |
| `AI_IMAGE_CHECK` | 20 | EXIF heuristics suggest AI-generated image |
| `VIDEO_SUSPICIOUS` | 10 | Video has suspicious codec/duration |
| `PDF_NO_TEXT_CONTENT` | 6 | PDF has no extractable text |
| `HASH_DUPLICATE` | 25 | File hash matches document in another claim |

Score formula: `sum(triggered weights)`, capped at 100.

### Layer 2: Async 3-Tier Pipeline (runs via BullMQ, background)

Each tier **awaits the previous** and injects results as grounding context:

**Tier 1 — Satellite NDVI (Sentinel Hub)**
- Compares NDVI before and after incident date
- If NDVI drop < threshold → +40 score ("NDVI_NO_SIGNIFICANT_DROP")

**Tier 2 — Weather Verification (OpenWeather)**
- Checks historical weather at incident location/date
- If no severe weather confirmed → +30 score ("WEATHER_NO_SEVERE_EVENT")

**Tier 3 — LLM Confirmation (OpenRouter)**
- Image damage analysis with Tier 1+2 context in prompt
- CNIC cross-check (OCR extracted CNIC vs farmer's registered CNIC)
- If image doesn't show damage → +20 score
- If CNIC mismatch → +25 score

### Fraud Verdicts

| Score Range | Verdict |
|-------------|---------|
| 0-20 | LOW |
| 21-50 | MEDIUM |
| 51-75 | HIGH |
| 76-100 | CRITICAL |

### Fraud Tiers (Tenant Configurable)

| Tier | Models | Cost | Images/Claim |
|------|--------|------|-------------|
| FORGE | Gemini Flash, Llama 3.2 | $0/mo base | 3 |
| TITAN | GPT-4o mini, Claude Haiku | $99/mo | 5 |
| GOAT | GPT-4o, Claude 3.5 Sonnet | $499/mo | 10 |

---

## 14. Document Forensics

Runs at **document upload time** (not claim time) via `documents.service`:

### EXIF Extraction (`forensics.service.extractExif`)
- Uses `exifr` library to parse all EXIF metadata
- Flags: `EXIF_STRIPPED`, `NO_GPS_DATA`, `NO_DATE_ORIGINAL`, `EDITOR_SOFTWARE_DETECTED`, `IMAGE_ROTATED`

### ELA Analysis (`forensics.service.computeEla`)
- Uses `sharp` to recompress image at quality 75
- Compares pixel differences with original
- If diff > 30% → `modified: true`

### AI-Generated Detection (`forensics.service.detectAiGenerated`)
- Combines EXIF signals: no GPS + no date + editor software + stripped EXIF
- Checks image dimensions for unusual aspect ratios
- Returns `aiScore` and verdict: `LIKELY_AUTHENTIC`, `UNCLEAR`, `SUSPECTED_AI`

### Video Analysis (`forensics.service.analyzeVideo`)
- Uses `fluent-ffmpeg` ffprobe for metadata
- Flags: `NO_DURATION`, `UNUSUAL_CODEC`

### PDF Analysis (`forensics.service.analyzePdf`)
- Uses `pdf-lib` and `pdf-parse`
- Flags: `PDF_MODIFIED` (known PDF editors), `PDF_NO_TEXT_CONTENT`

### Hash Dedup
- SHA-256 hash computed at upload
- Cross-claim duplicate detection: same hash in different claims triggers fraud re-analysis

---

## 15. Auto-Trigger (Parametric Insurance)

**Location**: `jobs/auto-trigger-worker.ts`

Monitors active policies with auto-trigger enabled:

1. Every 6 hours (cron), scans all active policies
2. For each: check if auto-trigger is enabled in policy plan config
3. If yes: fetch NDVI before/after from Sentinel Hub
4. If NDVI drop exceeds threshold: check weather confirmation
5. If weather confirms disaster: auto-create claim
6. If fraud score < `autoApproveMaxScore`: auto-approve claim
7. Send notification to farmer

**Config** (per policy plan):
```typescript
{
  enabled: boolean,
  ndviThreshold: number,        // 0.0-1.0, default 0.3
  weatherCheck: boolean,         // default true
  minDaysBetweenChecks: number,  // default 1
  claimPercentage: number,       // 0.0-1.0, default 0.5
  autoApprove: boolean,          // default true
  autoApproveMaxScore: number,   // default 30
}
```

---

## 16. Damage Calculation Engine

**Location**: `services/damage.service.ts`

Weighted multi-signal damage assessment:

| Signal | Weight | Source |
|--------|--------|--------|
| NDVI damage % | 35% | Sentinel Hub satellite |
| Weather confirmed | 15% | OpenWeather |
| AI damage score | 20% | LLM image analysis |
| Ground truth | 30% | Claims officer field assessment |

**Formula:**
```
finalDamage = (ndvi×0.35 + weather×0.15 + ai×0.20 + groundTruth×0.30) / activeWeights
payout = coverageAmount × min(finalDamage/100, 0.95)
```

Min payout: 2% of coverage. Max payout: 95% of coverage.

---

## 17. Payment System

### Gateway Abstraction (`lib/paymentGatewayFactory.ts`)

Three gateways implement the same `PaymentGateway` interface:

| Gateway | Currency | Methods |
|---------|----------|---------|
| Stripe (`stripeGateway.ts`) | USD | PaymentIntent, Checkout, Payout |
| JazzCash (`jazzcashGateway.ts`) | PKR | Redirect flow, webhook verification |
| Easypaisa (`easypaisaGateway.ts`) | PKR | Mobile wallet, QR code |

Tenant selects gateway via `Tenant.config.paymentGateway`. Factory resolves the correct one.

### Payment Flow

1. Farmer creates payment intent for policy
2. Gateway-specific flow (Stripe: client secret redirect; JazzCash/Easypaisa: redirect URL)
3. Webhook confirms payment → Policy activated
4. Claims officer can process payouts via the gateway

### Feature Flag

`FARMER_ONLINE_PAYMENTS_ENABLED=false` by default. When disabled, farmers must submit a policy request for staff review instead.

---

## 18. Billing & Usage Tracking

### Usage Tracking (`services/usage.service.ts`)

Every external API call logs usage:
- `sentinel` — NDVI checks
- `openweather` — Weather verification
- `openrouter` — LLM calls (per model)

### Billing (`services/billing.service.ts`)

- Stripe Checkout for subscription management
- Monthly invoice generation (1st of month cron)
- Usage-based billing: base fee + per-call × markup multiplier
- Invoice CRUD with line items

### Fraud Tier Markup

| Tier | Markup | Base Fee |
|------|--------|----------|
| FORGE | 1.0x | $0 |
| TITAN | 1.5x | $99 |
| GOAT | 2.0x | $499 |

---

## 19. Real-Time Communication (WebSocket)

**Location**: `lib/socket.ts`

Socket.IO initialized on the HTTP server:

- **Authentication**: JWT token verification on connection
- **Room**: `claim:{claimId}` for claim-specific updates
- **Events emitted**:
  - `fraud:score-updated` — When fraud score changes
  - `claim:status-changed` — When claim status changes
  - `message:new` — New chat message

**Exported functions:**
- `initSocket(server)` — Initialize Socket.IO
- `getIO()` — Get Socket.IO instance
- `notifyFraudUpdate(claimId, ...)` — Emit fraud update to claim room
- `notifyClaimStatus(claimId, ...)` — Emit status change

---

## 20. Background Jobs (BullMQ)

### Queues

| Queue | Worker | Purpose |
|-------|--------|---------|
| `fraud` | `fraud-worker.ts` | Runs async 3-tier fraud analysis |
| `ocr` | `ocrWorker.ts` | Tesseract.js OCR text extraction |
| `auto-trigger` | `auto-trigger-worker.ts` | NDVI monitoring + auto-claims |
| `notification` | `notificationWorker.ts` | Push notification dispatch |
| `billing` | `billingWorker.ts` | Invoice generation + monthly cron |

### Job Patterns

All workers use:
- Exponential backoff (2s base, 3 retries)
- `removeOnComplete: 100` / `removeOnFail: 50`
- Redis connection from `lib/redis.ts`

### Cron Schedules

| Job | Schedule | Description |
|-----|----------|-------------|
| Auto-trigger | Every 6 hours | NDVI check across all active policies |
| Billing | 1st of month, 02:00 AM | Generate invoices for all tenants |

---

## 21. External Integrations

### Supabase Auth
- JWT verification via `supabase.auth.getUser(token)`
- User creation/linking on first login

### Cloudinary
- Document upload with auto-format and 1200px max dimension
- Folder structure: `aims/claims/{claimId}/`

### OpenRouter (LLM)
- Model routing with fallback chains per fraud tier
- Supports vision models (GPT-4o, Claude, Gemini, Llama)
- `analyzeWithFallback(imageUrl, prompt, primaryModel, fallbackModel)`

### Sentinel Hub (Satellite)
- NDVI (Normalized Difference Vegetation Index) comparison
- Pre/post incident date vegetation analysis
- `compareNDVI(lat, lon, incidentDate, threshold)`

### OpenWeather
- Historical weather data at claim location
- Severe weather event detection
- `checkWeatherForClaim(lat, lon, incidentDate)`

### Stripe
- Checkout sessions for subscriptions
- PaymentIntent for farmer payments
- Webhook for payment confirmation

### JazzCash / Easypaisa
- Mobile wallet payment flows
- Redirect-based authentication
- Webhook verification

---

## 22. Middleware Pipeline

### `auth.ts` — Authentication
- `requireAuth`: JWT verification → local user resolution → tenant check
- `resolveTenant`: Subdomain/header tenant resolution

### `roleGuard.ts` — Authorization
- `requireRole(...roles)`: Checks `req.user.role` against allowed roles
- `requirePermission(...permissions)`: Resolves user permissions (custom + built-in)
- `requireTenantAccess`: Verifies user belongs to resolved tenant

### `validate.ts` — Request Validation
- `validate(schema)`: Zod schema parsing on `req.body`

### `rateLimiter.ts` — Rate Limiting
- `apiLimiter`: 100 requests / 15 minutes (general)
- `authLimiter`: 20 requests / 15 minutes (auth endpoints)
- `uploadLimiter`: 50 requests / 1 hour (document uploads)

### `errorHandler.ts` — Global Error Handler
- `AppError`: Operational errors with status codes
- `ZodError`: Validation errors with details
- Unknown errors → 500 with generic message

### `featureFlags.ts` — Feature Flags
- `requireFarmerPaymentsEnabled`: Blocks payment routes when flag is off

---

## 23. Validators (Zod)

All 17 validator files define Zod schemas for request body validation:

- `admin.validator.ts` — Create staff user (email, role, phone)
- `auth.validator.ts` — Update profile, update role
- `billing.validator.ts` — Subscribe, cancel, invoices, generate
- `claims.validator.ts` — Create claim, assign, update status
- `documents.validator.ts` — Create document
- `farmers.validator.ts` — Create/update farmer (CNIC 13-15 chars)
- `iam.validator.ts` — Create/update/assign custom roles
- `import.validator.ts` — Import plans/farmers (CSV/JSON)
- `landParcels.validator.ts` — Create/update land parcel
- `notifications.validator.ts` — Mark as read
- `payments.validator.ts` — Create intent, process payout
- `platform.validator.ts` — Tenant CRUD, seed plans
- `policies.validator.ts` — Purchase policy
- `policyPlans.validator.ts` — Create/update plans, quote
- `policyRequests.validator.ts` — Create/review requests
- `tenantFields.validator.ts` — Dynamic field schema (text/number/date/dropdown/file/checkbox)
- `tenantSettings.validator.ts` — Update settings, fraud tier, gateway

---

## 24. Libraries

### `lib/prisma.ts`
PrismaClient singleton with Neon HTTP adapter support. Global caching for dev hot-reload.

### `lib/redis.ts`
ioredis singleton. `checkRedisConnection()` verifies connectivity on boot.

### `lib/supabase.ts`
Supabase client using `SUPABASE_URL` + `SUPABASE_ANON_KEY`.

### `lib/cloudinary.ts`
Cloudinary v2 instance using env vars.

### `lib/stripe.ts`
Stripe instance using `STRIPE_SECRET_KEY`.

### `lib/bullmq.ts`
BullMQ queue factory with Redis connection. Exports named queues: `fraudQueue`, `ocrQueue`, `notificationQueue`, `autoTriggerQueue`.

### `lib/socket.ts`
Socket.IO wrapper. `initSocket(server)`, `getIO()`, `notifyFraudUpdate()`, `notifyClaimStatus()`.

### `lib/openrouter.ts`
OpenRouter API client. `analyzeWithFallback()` sends vision prompts with model fallback. Logs usage per call.

### `lib/sentinel.ts`
Sentinel Hub NDVI client. `compareNDVI()`, `healthCheck()`. Handles token refresh and rate limiting.

### `lib/weather.ts`
OpenWeatherMap client. `checkWeatherForClaim()`, `checkWeatherNow()`. Supports historical and current weather data.

### `lib/multer.ts`
Multer configuration for file uploads to `/tmp/uploads/`.

### `lib/paymentGatewayFactory.ts`
Factory that selects the correct payment gateway based on tenant config.

### `lib/stripeGateway.ts`
Stripe payment gateway adapter.

### `lib/jazzcashGateway.ts`
JazzCash mobile wallet gateway adapter.

### `lib/easypaisaGateway.ts`
Easypaisa mobile wallet gateway adapter.

---

## 25. Utils

### `utils/generators.ts`
- `generateClaimNumber()` — Format: `CLM-{base36timestamp}-{random4}`
- `generatePolicyNumber()` — Format: `POL-{base36timestamp}-{random4}`

### `utils/fraud-helpers.ts`
- `calculateBaseFraudScore(checks)` — Sum of triggered weights, capped at 100
- `scoreToVerdict(score)` — Maps score to LOW/MEDIUM/HIGH/CRITICAL
- `FRAUD_CHECK_WEIGHTS` — Weight constants for all fraud checks

### `utils/geo.ts`
- `haversineDistance(lat1, lng1, lat2, lng2)` — GPS distance in km

### `utils/logger.ts`
Pino logger with configurable `LOG_LEVEL`.

---

## 26. Configuration Files

### `config/autoTriggerConfig.ts`
Auto-trigger defaults, config merging, retry logic with exponential backoff.

### `config/fraudTiers.ts`
FORGE/TITAN/GOAT tier definitions with model configs, costs, and markup multipliers.

### `config/paymentGateways.ts`
Gateway interface/types, gateway config resolution from tenant config.

### `config/permissions.ts`
60+ permissions in `resource:action:scope` format. Default role→permission mappings for all 7 built-in roles.

---

## 27. Database Schema

### 24 Models

| Model | Purpose |
|-------|---------|
| `Tenant` | Multi-tenant root. Has config (JSON) for fraud tier, payment gateway |
| `User` | Auth users. Linked to Tenant via `tenantId`. Has role |
| `Farmer` | Farmer profile. CNIC, bank details, custom fields |
| `LandParcel` | Farm land with GPS, crop type, soil, area |
| `PolicyPlan` | Insurance plan template. Coverage, premium rate, auto-trigger config |
| `PolicyRequest` | Farmer's purchase request (pending staff review) |
| `Policy` | Active insurance policy. Links farmer, plan, land parcel |
| `Claim` | Insurance claim. Fraud score, verdict, status machine |
| `ClaimDocument` | Uploaded evidence. URL, hash, EXIF data, OCR text |
| `ClaimStatusHistory` | Audit trail for claim status changes |
| `Payment` | Payment records. Gateway, amount, status |
| `FraudAuditLog` | Complete fraud analysis results per claim |
| `AutoTriggerLog` | NDVI check results for auto-trigger monitoring |
| `TenantField` | Dynamic field definitions (text/dropdown/file/etc.) |
| `FarmerFieldValue` | Dynamic field values per farmer |
| `UsageLog` | API usage tracking per tenant |
| `CustomRole` | Tenant-created roles with custom permissions |
| `Invoice` | Monthly billing invoices |
| `InvoiceLineItem` | Invoice line items (usage-based) |
| `Notification` | User notifications |
| `Conversation` | Chat conversations per claim |
| `Message` | Chat messages |
| `Visit` | Field visit scheduling and tracking |
| `DamageAssessment` | Multi-signal damage calculation results |

### 8 Enums

`TenantStatus`, `Role`, `PolicyRequestStatus`, `PolicyStatus`, `ClaimStatus`, `PaymentType`, `InvoiceStatus`, `VisitStatus`

---

## 28. Deployment

### Railway (Production)

`railway.toml` defines 4 services:

| Service | Command | Schedule |
|---------|---------|----------|
| `web` | `npm start` | Always running |
| `worker` | `node dist/worker.js` | Always running |
| `auto-trigger-cron` | `node dist/cron/autoTrigger.cron.js` | Every 6 hours |
| `billing-cron` | `node dist/cron/billing.cron.js` | 1st of month, 02:00 AM |

### Build

```bash
npx prisma generate && tsc
```

### Start

```bash
npx prisma migrate deploy && node dist/server.js
```

---

## 29. Testing

### Test Suites (10 files, 205 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `smoke.test.ts` | 39 | Full system: health, CORS, rate limiting, auth, RBAC, chat, visits, damage, export |
| `forensics.test.ts` | 26 | EXIF, ELA, AI-gen, PDF, video, damage calculation |
| `v2.test.ts` | 26 | Satellite NDVI, weather API, sequential 3-tier pipeline |
| `tenantIsolation.test.ts` | 18 | Cross-tenant data leaks, policy isolation |
| `utils.test.ts` | 19 | Generators, fraud scoring, geo calculations |
| `iam.test.ts` | 14 | Custom roles, permission matrix |
| `billing.test.ts` | 14 | Invoice CRUD, admin override |
| `policyPlans.test.ts` | 14 | Plans, premium calculation, quote flow |
| `chat-visits-damage.test.ts` | 12 | Auth guards on new endpoints |
| `claims.test.ts` | 8 | Claim state machine |
| `farmers.test.ts` | 8 | CRUD, CNIC uniqueness |
| `billing-markup.test.ts` | 7 | Billing markup logic |

### Running Tests

```bash
npm test              # Run all 205 tests
npm test -- --watch   # Watch mode
```

---

## 30. Security Summary

| Layer | Implementation |
|-------|---------------|
| **HTTPS** | Enforced via Helmet HSTS |
| **CORS** | Configured via `cors()` |
| **Rate Limiting** | 100/15min general, 20/15min auth, 50/hr uploads |
| **Auth** | Supabase JWT Bearer tokens |
| **Tenant Isolation** | Every query filtered by `tenantId` |
| **RBAC** | Role-based + permission-based access control |
| **Input Validation** | Zod schemas on all mutation endpoints |
| **File Validation** | Magic byte detection (not just extension), MIME type whitelist |
| **Hash Dedup** | SHA-256 file hashing prevents duplicate uploads |
| **EXIF Forensics** | Detects stripped metadata, editor software, AI-generated |
| **ELA Analysis** | Detects image manipulation at upload time |
| **Error Handling** | Global error handler, no stack traces in production |
| **Request Tracing** | UUID `x-request-id` on every request |
| **Webhook Security** | Stripe signature verification, raw body preservation |
| **Feature Flags** | Payment endpoints gated behind env flag |
| **Tenant Status** | PENDING_APPROVAL/SUSPENDED tenants blocked at auth level |
