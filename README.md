# AIMS — Agricultural Insurance Management System

> **Multi-tenant SaaS backend** for agricultural insurance.
> Express 5 + TypeScript + Prisma 7 + Supabase Auth + BullMQ + OpenRouter
> **205 tests passing** · **97+ API endpoints** · **24 database models** · **24 services**
> **Live:** [agriculture-insurance-management-system.up.railway.app](https://agriculture-insurance-management-system.up.railway.app/health)

---

## Overview

AIMS is a digital platform connecting insurance companies (tenants) and farmers through a unified, secure, and scalable system. It manages the entire policy lifecycle — farmer registration, land parcel mapping, policy purchase, claim processing, document management, AI-powered fraud detection, automated parametric payouts, real-time chat, field visits, and usage-based billing.

### Key Features

- **Multi-Tenant Isolation** — Complete data separation between insurance companies (3-layer enforcement)
- **3-Tier Fraud Pipeline** — Satellite NDVI → Weather verification → LLM confirmation, each tier grounding the next
- **Upload-Time Forensics** — EXIF extraction, ELA analysis, AI-gen detection, hash dedup at document upload
- **Auto-Trigger Payouts** — Satellite vegetation monitoring automatically creates claims when crop loss is detected
- **Custom Roles (IAM)** — 60+ granular permissions, custom role creation, staff assignment
- **Dynamic Farmer Fields** — Tenants define custom registration fields per crop type
- **Multi-Payment Gateways** — Stripe + Easypaisa + JazzCash via adapter pattern
- **Real-Time Chat** — Socket.IO-powered claim discussions with notifications
- **Field Visit Scheduling** — Schedule, complete, and cancel field visits for claims
- **Damage Calculation** — Multi-signal weighted assessment (NDVI + Weather + AI + Ground Truth)
- **Usage-Based Billing** — Monthly invoice generation with tier base fees + per-call costs
- **Bulk Import/Export** — CSV/JSON import for policy plans, farmers, and policies; CSV export

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 22 + TypeScript |
| **Framework** | Express 5 |
| **Database** | PostgreSQL (Neon) + Prisma 7 |
| **Cache/Queue** | Redis (ioredis) + BullMQ |
| **Auth** | Supabase Auth (JWT Bearer) |
| **Storage** | Cloudinary |
| **AI/LLM** | OpenRouter (GPT-4o, Claude, Gemini, Llama) |
| **Satellite** | Sentinel Hub (NDVI analysis) |
| **Weather** | OpenWeatherMap |
| **Real-Time** | Socket.IO |
| **Payments** | Stripe + JazzCash + Easypaisa |
| **Validation** | Zod 4 |
| **Logging** | Pino + pino-http |
| **Security** | Helmet + CORS + express-rate-limit |
| **OCR** | Tesseract.js (BullMQ worker) |
| **Image Processing** | Sharp (ELA analysis) |
| **PDF** | pdf-lib + pdf-parse |
| **EXIF** | exifr |
| **Testing** | Jest 30 + ts-jest |

---

## Live Deployment

The backend is live at:
**https://agriculture-insurance-management-system.up.railway.app**
Health check: `GET /health` → `{"status":"ok"}`

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 22+
- Redis ([Upstash](https://console.upstash.com/) or `redis://localhost:6379`)
- PostgreSQL via [Neon](https://neon.tech/)
- A Supabase project ([console.supabase.com](https://console.supabase.com/))
- API keys: OpenRouter, Cloudinary, Sentinel Hub, OpenWeather

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/mazhanbaig/Agriculture-Insurance-Management-System-
cd AIMS

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env with your credentials

# 4. Generate Prisma client
npx prisma generate

# 5. Run migrations
npx prisma migrate deploy

# 6. Seed the database
npx ts-node src/scripts/seed.ts

# 7. Start the server
npm run dev
```

Server runs at `http://localhost:4000`.

---

## Environment Variables

### Required (server exits if missing)

| Variable | Get It From |
|----------|-------------|
| `DATABASE_URL` | Neon dashboard → Connection string |
| `SUPABASE_URL` | Supabase dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API (anon public) |
| `REDIS_URL` | Upstash dashboard → Redis → REST API |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard |
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 4000 | Server port |
| `NODE_ENV` | development | test/development/production |
| `USE_NEON_ADAPTER` | false | Enable Neon HTTP adapter for serverless |
| `FARMER_ONLINE_PAYMENTS_ENABLED` | false | Enable farmer payment endpoints |
| `LOG_LEVEL` | info | Pino log level |
| `SENTINEL_HUB_CLIENT_ID` | — | Sentinel Hub for NDVI satellite analysis |
| `SENTINEL_HUB_CLIENT_SECRET` | — | Sentinel Hub for NDVI satellite analysis |
| `OPENWEATHER_API_KEY` | — | Weather verification for fraud detection |
| `STRIPE_SECRET_KEY` | — | Stripe payment processing |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook verification |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | — | Stripe subscription billing |

---

## API Overview (97+ Endpoints)

All endpoints are prefixed with `/api/v1`.

| Domain | Endpoints | Primary Role |
|--------|-----------|-------------|
| **Auth** | GET /me, PATCH /profile, PATCH /role, GET /users (4) | All authenticated |
| **Farmers** | GET /fields, GET/POST/PATCH profile (4) | FARMER |
| **Land Parcels** | CRUD (5) | FARMER |
| **Policy Plans** | List, Get, Quote, Create, Update (5) | Public (GET), UNDERWRITER+ (POST/PATCH) |
| **Policy Requests** | Create, List, Get, Review, Convert (5) | FARMER+STAFF |
| **Policies** | Purchase, List My, Get My (3) | FARMER |
| **Claims** | Submit, List My, List All, Get, Assign, Status (7) | Mixed |
| **Documents** | Upload, List, Get, Delete (4) | FARMER+STAFF |
| **Payments** | Intent, Confirm, Payout, Policy/Claim payments (5) | Mixed |
| **Chat** | Conversations, Messages (4) | FARMER+STAFF |
| **Visits** | List, Schedule, Complete, Cancel (4) | STAFF+FIELD_AGENT |
| **Damage** | Calculate, Get Assessment (2) | STAFF+FARMER |
| **Notifications** | List, Mark Read, Mark All Read (3) | All authenticated |
| **Admin** | Staff CRUD, Dashboard, Analytics (5) | TENANT_ADMIN |
| **Platform** | Tenant CRUD, Approve, Suspend, Seed (8) | PLATFORM_ADMIN |
| **Settings** | Config, Fraud Tier, Payment Gateway (6) | TENANT_ADMIN+ |
| **Tenant Fields** | CRUD for custom farmer fields (5) | TENANT_ADMIN+ |
| **IAM** | Roles CRUD, Assign, Permissions (8) | TENANT_ADMIN+ |
| **Billing** | Subscribe, Cancel, Status, Usage, Invoices (8) | TENANT_ADMIN+ |
| **Import/Export** | Policy Plans, Farmers, Export CSV (4) | TENANT_ADMIN |
| **Webhooks** | Stripe, Easypaisa, JazzCash (3) | Public (signed) |
| **Health** | GET /health (1) | None |

Full API documentation: `postman/AIMS.postman_collection.json` and `ARCHITECTURE.md`.

---

## Project Structure

```
AIMS/
├── src/
│   ├── server.ts                  # Express app, middleware, route mounting, startup
│   ├── worker.ts                  # Standalone BullMQ worker entry point
│   ├── config/                    # 4 config files (fraud tiers, permissions, gateways, auto-trigger)
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
├── tests/                         # 12 test files — 205 tests
├── prisma/
│   ├── schema.prisma              # 24 models, 8 enums
│   └── migrations/                # 2 migration files
├── testsprite/                    # MCP server for TestSprite agent
├── postman/                       # Postman collection (69KB)
├── api/index.ts                   # Vercel serverless entry point
├── package.json
├── tsconfig.json
├── jest.config.js
├── prisma.config.ts
├── railway.toml                   # 4 Railway services
├── ARCHITECTURE.md                # Complete system architecture
└── README.md                      # This file
```

---

## Database Schema (24 Models)

| Model | Purpose |
|-------|---------|
| `Tenant` | Multi-tenant root. Config for fraud tier, payment gateway |
| `User` | Auth users linked to Tenant via tenantId |
| `Farmer` | Farmer profile with CNIC, bank details, custom fields |
| `LandParcel` | Farm land with GPS, crop type, soil, area |
| `PolicyPlan` | Insurance plan template with auto-trigger config |
| `PolicyRequest` | Farmer's purchase request (pending staff review) |
| `Policy` | Active insurance policy linking farmer, plan, land |
| `Claim` | Insurance claim with fraud score, verdict, status |
| `ClaimDocument` | Uploaded evidence with URL, hash, EXIF data, OCR text |
| `ClaimStatusHistory` | Audit trail for claim status changes |
| `Payment` | Payment records with gateway, amount, status |
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

---

## Fraud Detection Architecture

### Layer 1: Sync Forensics (<100ms, during claim submission)

| Check | Weight | Description |
|-------|--------|-------------|
| Duplicate claim | +40 | Same policy, within 30 days |
| Claim amount mismatch | +10 | Claimed vs expected based on loss % |
| Farmer history | +15 | >3 claims in last year |
| EXIF missing | +15 | Image has no EXIF or stripped |
| EXIF suspicious | +7.5 | Suspicious EXIF flags |
| File spoof (ELA) | +20 | ELA detects image manipulation |
| AI-generated image | +20 | EXIF heuristics suggest AI |
| Video suspicious | +10 | Unusual codec/duration |
| PDF no text | +6 | PDF has no extractable text |
| Hash duplicate | +25 | File hash matches another claim |

### Layer 2: Async 3-Tier Pipeline (BullMQ background)

| Tier | Service | What It Checks |
|------|---------|----------------|
| 1 | Sentinel Hub | NDVI pre/post comparison — vegetation loss |
| 2 | OpenWeather | Historical weather — severe event confirmation |
| 3 | OpenRouter LLM | Image damage analysis + CNIC cross-check |

Each tier **awaits the previous** and injects results as grounding context for the next.

### Fraud Tiers

| Tier | Models | Base Fee | Markup |
|------|--------|----------|--------|
| **FORGE** | Gemini Flash, Llama 3.2 | $0/mo | 1.0x |
| **TITAN** | GPT-4o mini, Claude Haiku | $99/mo | 1.5x |
| **GOAT** | GPT-4o, Claude 3.5 Sonnet | $499/mo | 2.0x |

---

## Background Jobs

| Queue | Worker | Purpose |
|-------|--------|---------|
| `fraud` | `fraud-worker.ts` | Async 3-tier fraud analysis |
| `ocr` | `ocrWorker.ts` | Tesseract.js OCR text extraction |
| `auto-trigger` | `auto-trigger-worker.ts` | NDVI monitoring + auto-claims |
| `notification` | `notificationWorker.ts` | Push notification dispatch |
| `billing` | `billingWorker.ts` | Invoice generation + monthly cron |

### Cron Schedules

| Job | Schedule | Description |
|-----|----------|-------------|
| Auto-trigger | Every 6 hours | NDVI check across all active policies |
| Billing | 1st of month, 02:00 AM | Generate invoices for all tenants |

---

## Running Tests

```bash
npm test                    # Full suite (205 tests, 12 files)
npm run test:watch          # Watch mode
```

### Test Suites

| Suite | Tests | Coverage |
|-------|-------|----------|
| `smoke.test.ts` | 39 | Full system: health, CORS, auth, RBAC, chat, visits, damage, export |
| `forensics.test.ts` | 26 | EXIF, ELA, AI-gen, PDF, video, damage calculation |
| `v2.test.ts` | 26 | Satellite NDVI, weather API, sequential 3-tier pipeline |
| `utils.test.ts` | 19 | Generators, fraud scoring, geo calculations |
| `tenantIsolation.test.ts` | 18 | Cross-tenant data leaks, policy isolation |
| `iam.test.ts` | 14 | Custom roles, permission matrix |
| `billing.test.ts` | 14 | Invoice CRUD, admin override |
| `policyPlans.test.ts` | 14 | Plans, premium calculation, quote flow |
| `chat-visits-damage.test.ts` | 12 | Auth guards on new endpoints |
| `claims.test.ts` | 8 | Claim state machine |
| `farmers.test.ts` | 8 | CRUD, CNIC uniqueness |
| `billing-markup.test.ts` | 7 | Billing markup logic |

---

## Deployment

### Railway (Production)

`railway.toml` defines 4 services:

| Service | Command | Schedule |
|---------|---------|----------|
| `web` | `npm start` | Always running |
| `worker` | `node dist/worker.js` | Always running |
| `auto-trigger-cron` | `node dist/cron/autoTrigger.cron.js` | Every 6 hours |
| `billing-cron` | `node dist/cron/billing.cron.js` | 1st of month |

### Build & Start

```bash
npx prisma generate && tsc         # Build
npx prisma migrate deploy && node dist/server.js  # Start
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Complete system architecture — every route, service, middleware, library, config, database model, security layer |
| [README.md](./README.md) | This file — overview, quick start, API summary |

---

## License

MIT
