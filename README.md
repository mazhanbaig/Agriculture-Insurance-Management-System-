# AIMS — Agricultural Insurance Management System

> **Multi-tenant SaaS backend** for agricultural insurance.  
> Express + TypeScript + Prisma 7 + Supabase Auth + BullMQ + OpenRouter  
> **134 tests passing** · **84+ API endpoints** · **8 phases complete**

---

## Overview

AIMS is a digital platform connecting insurance companies (tenants) and farmers through a unified, secure, and scalable system. It manages the entire policy lifecycle — farmer registration, land parcel mapping, policy purchase, claim processing, document management, fraud detection, automated parametric payouts, and usage-based billing.

### Key Features

- **Multi-Tenant Isolation** — Complete data separation between insurance companies (3-layer enforcement)
- **Fraud Detection Engine** — Sync forensics (<100ms) + async AI analysis via OpenRouter with 3-tier pricing (FORGE/TITAN/GOAT)
- **Auto-Trigger Payouts** — Satellite vegetation monitoring (Sentinel Hub NDVI) automatically creates claims when crop loss is detected
- **Custom Roles (IAM)** — 40+ granular permissions, custom role creation, staff assignment
- **Dynamic Farmer Fields** — Tenants define custom registration fields per crop type
- **Multi-Payment Gateways** — Stripe (live) + Easypaisa/JazzCash (stubs) via adapter pattern
- **Usage-Based Billing** — Monthly invoice generation with tier base fees + per-call costs
- **Bulk Import** — CSV/JSON import for policy plans, farmers, and policies

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20 LTS |
| **Framework** | Express 5 + TypeScript 5 |
| **Database** | Neon (serverless PostgreSQL) + Prisma 7 |
| **Auth** | Supabase Auth (JWT) |
| **Queues** | BullMQ + Redis (Upstash) |
| **Storage** | Cloudinary |
| **AI/LLM** | OpenRouter (unified gateway — Gemini, GPT-4o, Claude) |
| **Email** | Nodemailer (SMTP) |
| **Payments** | Stripe, Easypaisa, JazzCash (adapter pattern) |
| **Satellite** | Sentinel Hub (NDVI) |
| **Weather** | OpenWeather |
| **Testing** | Jest + Supertest (134 tests) |

---

## Quick Start

### Prerequisites

- Node.js 20 LTS
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

# 3. Create .env file (see .env.example or the Environment Variables section)
nano .env

# 4. Generate Prisma client + sync schema
npx prisma generate
npx prisma db push

# 5. Seed the database
npm run seed

# 6. Start Redis (if local) or ensure Upstash URL is in .env
redis-server

# 7. Start the server
npm run dev
```

Server runs at `http://localhost:4000`.  
Health check: `GET /health`

---

## Environment Variables

| Variable | Required | Get It From |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon dashboard → Connection string |
| `SUPABASE_URL` | ✅ | Supabase dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | ✅ | Supabase dashboard → Settings → API (anon public) |
| `REDIS_URL` | ✅ | Upstash dashboard → Redis → REST API (use **Upstash Redis Wire Protocol URL** for ioredis) |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary dashboard |
| `OPENROUTER_API_KEY` | ✅ | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `STRIPE_SECRET_KEY` | ⬜ | Stripe dashboard → Developers → API keys (sk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | ⬜ | Stripe dashboard → Webhooks → signing secret |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | ⬜ | Stripe dashboard → Products → price ID |
| `SMTP_HOST` | ⬜ | Your email provider (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | ⬜ | 587 (TLS) or 465 (SSL) |
| `SMTP_USER` | ⬜ | SMTP username (full email address) |
| `SMTP_PASS` | ⬜ | SMTP password (Gmail app password) |
| `SMTP_FROM` | ⬜ | Sender address (e.g. `"AIMS" <noreply@aims.app>`) |
| `SENTINEL_HUB_API_KEY` | ⬜ | [sentinel-hub.com](https://www.sentinel-hub.com/) |
| `OPENWEATHER_API_KEY` | ⬜ | [openweathermap.org](https://openweathermap.org/api) |
| `FRONTEND_URL` | ⬜ | Frontend URL for CORS (default: http://localhost:3000) |
| `BILLING_ENABLED` | ⬜ | Set to `true` to enable Stripe billing |
| `PORT` | ⬜ | Server port (default: 4000) |

> **Note:** The server validates 8 required env vars on startup and exits with a clear error if any are missing.

---

## API Overview (84+ Endpoints)

All endpoints are prefixed with `/api/v1`.

| Domain | Endpoints | Primary Role |
|--------|-----------|-------------|
| **Auth** | GET /me, PATCH /profile, PATCH /role, GET /users | All authenticated |
| **Farmers** | GET/POST/PATCH profile, GET /fields | FARMER |
| **Land Parcels** | CRUD (5 endpoints) | FARMER |
| **Policy Plans** | List, Get, Quote, Create, Update (5) | UNDERWRITER+ |
| **Policies** | Purchase, List My, Get My (3) | FARMER |
| **Claims** | Submit, List My, List All, Get, Assign, Status (7) | Mixed |
| **Documents** | Upload, List, Get, Delete (4) | FARMER+ |
| **Payments** | Premium intent, Confirm, Payout, Policy/Claim (5) | Mixed |
| **Notifications** | List, Mark Read, Mark All Read (3) | All authenticated |
| **Admin** | Dashboard, Staff CRUD, Analytics (5) | TENANT_ADMIN |
| **Platform** | Tenant CRUD + Seed (6) | PLATFORM_ADMIN |
| **Settings** | Config, Fraud Tier, Payment Gateway (6) | TENANT_ADMIN+ |
| **Tenant Fields** | CRUD for custom farmer fields (5) | TENANT_ADMIN+ |
| **IAM** | Roles CRUD + Assignment + Permissions (8) | TENANT_ADMIN+ |
| **Billing** | Subscribe, Cancel, Status, Usage, Invoices (8) | TENANT_ADMIN+ |
| **Import** | Policy Plans, Farmers & Policies (2) | TENANT_ADMIN |
| **Webhooks** | Stripe, Easypaisa, JazzCash (3) | Public (signed) |
| **Health** | GET /health (1) | None |

Full API documentation available in `AIMS.postman_collection.json` and `REPORT.md`.

---

## Project Structure (100+ Source Files)

```
AIMS/
├── prisma/schema.prisma          # 19 models, 5 enums
├── src/
│   ├── server.ts                 # Entry point, middleware pipeline, env validation
│   ├── routes/                   # 17 route files (one per domain)
│   ├── controllers/              # 18 controllers (thin: parse → call service → respond)
│   ├── services/                 # 18 services (business logic, Prisma queries)
│   ├── validators/               # 14 Zod schema files
│   ├── middleware/               # 5 middleware files (auth, roleGuard, errorHandler, validate, rateLimiter)
│   ├── lib/                      # 9 library clients
│   ├── jobs/                     # 5 BullMQ workers
│   ├── config/                   # 4 config files (fraudTiers, permissions, paymentGateways, autoTriggerConfig)
│   └── utils/                    # 4 utility files (logger, generators, geo, fraud-helpers)
├── frontend/                     # Sample React components + API client
├── tests/                        # 8 test files, 134 tests
└── package.json
```

---

## Background Jobs (BullMQ)

| Queue | Worker | Frequency | Purpose | Retries |
|-------|--------|-----------|---------|---------|
| `ocr` | `ocrWorker.ts` | On document upload | Simulated OCR extraction | 3x exponential |
| `notification` | `notificationWorker.ts` | On trigger | Create DB notification + send email | 3x exponential |
| `import` | `importWorker.ts` | On bulk upload | Process CSV/JSON imports (>50 records) | 3x exponential |
| `fraud` | `fraud-worker.ts` | On claim submission | AI image analysis, satellite NDVI, weather check | 3x exponential |
| `auto-trigger` | `auto-trigger-worker.ts` | Every 6 hours | Monitor satellite NDVI for all active policies | 2x exponential |

### Scheduled Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| **Auto-Trigger Check** | Every 6 hours | Monitors ACTIVE policies with auto-trigger enabled |
| **Monthly Billing** | 1st of month, 02:00 AM | Aggregates usage logs, generates invoices |

---

## Fraud Detection Architecture

### Two-Phase Architecture

**Phase 1 — Sync Forensics (< 100ms, during claim submission)**

| Check | Weight | Description |
|-------|--------|-------------|
| Duplicate claim | +40 | Same policy, within 30 days |
| Claim amount mismatch | +10 | Claimed vs expected based on loss % |
| Farmer history | +15 | >3 claims in last year |

**Phase 2 — Async Deep Analysis (BullMQ worker, cost-optimized)**

| Check | Weight | Service |
|-------|--------|---------|
| AI Image Analysis | +20 | OpenRouter (tier-based model selection) |
| Satellite NDVI | +40 | Sentinel Hub (pre vs post incident) |
| Weather Verification | +30 | OpenWeather |

### Fraud Tiers

| Tier | Primary Model | Fallback | Base Fee | Cost/Image |
|------|---------------|----------|----------|------------|
| **FORGE** | Gemini 2.0 Flash | Llama 3.2 90B Vision | $0/mo | $0.001 |
| **TITAN** | GPT-4o mini | Claude 3 Haiku | $99/mo | $0.005 |
| **GOAT** | GPT-4o | Claude 3.5 Sonnet | $499/mo | $0.015 |

### Scoring

| Score | Verdict | Action |
|-------|---------|--------|
| 0–20 | LOW | Auto-approve |
| 21–50 | MEDIUM | Manual review |
| 51–75 | HIGH | Escalate to Senior Claims Officer |
| 76–100 | CRITICAL | Block payout |

---

## Running Tests

```bash
npm test                    # Full suite (134 tests, 8 files)
npm run test:watch          # Watch mode
```

### Test Coverage

| Suite | Tests | Type | What's Covered |
|-------|-------|------|----------------|
| `claims.test.ts` | 8 | Integration | State machine, duplicate detection, claim numbers |
| `tenantIsolation.test.ts` | 18 | Unit (mocked) | Tenant isolation across all 8 service modules |
| `utils.test.ts` | 19 | Unit | Generators, fraud scoring, geo distances |
| `iam.test.ts` | 14 | Unit (mocked) | Custom role CRUD, permission resolution |
| `billing.test.ts` | 14 | Unit (mocked) | Invoice CRUD, payment flow, subscription |
| `farmers.test.ts` | 8 | Unit (mocked) | Farmer CRUD, CNIC uniqueness, custom fields |
| `policyPlans.test.ts` | 14 | Unit (mocked) | Plan CRUD, quote calc, config merging |
| `smoke.test.ts` | 39 | Integration | Full system: 14 areas, all imports, security headers |
| **Total** | **134** | | |

---

## Completed Phases

| Phase | Feature | Key Deliverables |
|-------|---------|-----------------|
| 1 | Dynamic Farmer Fields | TenantField model, CRUD endpoints, customData on farmer registration |
| 2 | Tiered Fraud Detection | 3 tiers (FORGE/TITAN/GOAT), fallback chain, usage logging |
| 3 | Custom Roles (IAM) | CustomRole model, 40+ permissions, requirePermission middleware |
| 4 | Multi-Payment Gateways | Stripe/Easypaisa/JazzCash adapters, gateway factory |
| 5 | Usage-Based Billing | Invoice model, monthly cron, usage/invoice endpoints |
| 6 | Auto-Trigger Improvements | Retry with backoff, monitoring stats, fraud queue integration |
| 7 | Frontend Integration | Typed API client, 4 sample React components |
| 8 | Testing & Hardening | 134 tests, smoke tests, env validation, security headers |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for layered architecture diagrams and request lifecycle.

See [REPORT.md](./REPORT.md) for comprehensive technical documentation including full API reference, data model, and deployment guide.

---

## Deployment

The backend is designed for easy deployment on:

- **Railway** — Automatic HTTPS, Neon integration, Redis add-on
- **Render** — Web service with Redis
- **Fly.io** — Global deployment with Neon
- **Vercel** — Not recommended for Express backends (uses serverless functions, not long-running processes)

### Minimum Requirements

- Node.js 20 LTS
- Redis (Upstash recommended — free tier: 100MB)
- PostgreSQL (Neon recommended — free tier: 0.5GB)
- All 8 required env vars configured
- SMTP credentials for email notifications (optional)

---

## License

MIT
