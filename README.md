# AIMS — Agricultural Insurance Management System

> **Multi-tenant SaaS backend** for agricultural insurance.  
> Express + TypeScript + Prisma 7 + Supabase Auth + BullMQ + OpenRouter

---

## Overview

AIMS is a digital platform connecting insurance companies (tenants) and farmers through a unified, secure, and scalable system. It manages the entire policy lifecycle — farmer registration, land parcel mapping, policy purchase, claim processing, document management, fraud detection, and automated parametric payouts.

### Key Features

- **Multi-Tenant Isolation** — Complete data separation between insurance companies
- **Fraud Detection Engine** — Sync forensics (<100ms) + async AI analysis via OpenRouter + satellite NDVI comparison
- **Auto-Trigger Payouts** — Satellite vegetation monitoring automatically creates claims when crop loss is detected
- **Role-Based Access** — 7 roles: PLATFORM_ADMIN, TENANT_ADMIN, UNDERWRITER, CLAIMS_OFFICER, SENIOR_CLAIMS_OFFICER, FIELD_AGENT, FARMER
- **Bulk Import** — CSV/JSON import for policy plans, farmers, and policies
- **Stripe Integration** — Premium collection and subscription billing (feature-flagged)

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
| **AI/LLM** | OpenRouter (unified gateway) |
| **Email** | Nodemailer (SMTP) |
| **Payments** | Stripe |
| **Satellite** | Sentinel Hub (NDVI) |
| **Weather** | OpenWeather |
| **Testing** | Jest + Supertest |

---

## Quick Start

### Prerequisites

- Node.js 20 LTS
- Redis (local `redis://localhost:6379` or [Upstash](https://console.upstash.com/))
- PostgreSQL via [Neon](https://neon.tech/)
- A Supabase project ([console.supabase.com](https://console.supabase.com/))

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/mazhanbaig/Agriculture-Insurance-Management-System-
cd AIMS

# 2. Install dependencies
npm install

# 3. Create .env file and fill in your credentials
# Copy the template below and fill in your API keys
# (see Environment Variables section for details)
nano .env

# 4. Generate Prisma client + apply migrations
npx prisma generate
npx prisma db push

# 5. Seed the database (creates default tenant + PLATFORM_ADMIN)
npm run seed

# 6. Start Redis (if local)
redis-server

# 7. Start the server
npm run dev
```

Server runs at `http://localhost:4000`.  
Health check: `GET /health`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon public key |
| `REDIS_URL` | ✅ | Redis connection string (`rediss://...` for Upstash) |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key for AI analysis |
| `STRIPE_SECRET_KEY` | ⬜ | Stripe secret key (test mode) |
| `STRIPE_WEBHOOK_SECRET` | ⬜ | Stripe webhook signing secret |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | ⬜ | Stripe subscription price ID |
| `SMTP_HOST` | ⬜ | SMTP server host |
| `SMTP_PORT` | ⬜ | SMTP server port |
| `SMTP_USER` | ⬜ | SMTP username |
| `SMTP_PASS` | ⬜ | SMTP password |
| `SMTP_FROM` | ⬜ | Sender email address |
| `SENTINEL_HUB_API_KEY` | ⬜ | Sentinel Hub client ID |
| `OPENWEATHER_API_KEY` | ⬜ | OpenWeather API key |
| `FRONTEND_URL` | ⬜ | Frontend URL for CORS |
| `BILLING_ENABLED` | ⬜ | Set to `true` to enable Stripe billing |
| `PORT` | ⬜ | Server port (default: 4000) |

> **Note:** The server validates 8 required env vars on startup and exits with a clear error if any are missing.

---

## API Overview (58+ Endpoints)

All endpoints are prefixed with `/api/v1`.

| Domain | Endpoints | Auth Required |
|--------|-----------|---------------|
| **Auth** | GET /me, PATCH /profile, PATCH /role, GET /users | ✅ |
| **Farmers** | GET/POST/PATCH profile | ✅ FARMER |
| **Land Parcels** | CRUD (5 endpoints) | ✅ FARMER |
| **Policy Plans** | List, Get, Quote, Create, Update (5) | ✅ |
| **Policies** | Purchase, List My, Get My (3) | ✅ FARMER |
| **Claims** | Submit, List, Get, Assign, Status (7) | ✅ |
| **Documents** | Upload, List, Get, Delete (4) | ✅ |
| **Payments** | Premium intent, Confirm, Payout (5) | ✅ |
| **Notifications** | List, Mark Read, Mark All Read (3) | ✅ |
| **Admin** | Dashboard, Staff CRUD, Analytics (5) | ✅ TENANT_ADMIN |
| **Platform** | Tenant CRUD + Seed (6) | ✅ PLATFORM_ADMIN |
| **Settings** | GET/PATCH tenant config (2) | ✅ TENANT_ADMIN |
| **Import** | Policy Plans, Farmers & Policies (2) | ✅ TENANT_ADMIN |
| **Billing** | Subscribe, Cancel, Status (3) | ✅ TENANT_ADMIN |

Full API documentation available in `AIMS.postman_collection.json`.

---

## Project Structure

```
src/
├── server.ts                 # Entry point, middleware pipeline, startup validation
├── routes/                   # 14 route files (one per domain)
├── controllers/              # 15 controllers (thin: parse → call service → respond)
├── services/                 # 15 services (business logic, Prisma queries)
├── validators/               # 14 Zod schema files
├── middleware/                # 5 middleware files (auth, roleGuard, errorHandler, validate, rateLimiter)
├── lib/                      # 8 library clients (prisma, redis, bullmq, supabase, stripe, cloudinary, openrouter, sentinel)
├── jobs/                     # 5 BullMQ workers (ocr, notification, import, fraud, auto-trigger)
├── utils/                    # 4 utility files (logger, generators, geo, fraud-helpers)
└── scripts/                  # 2 scripts (seed, migrateTenant)
```

---

## Background Jobs (BullMQ)

| Queue | Worker | Frequency | Purpose |
|-------|--------|-----------|---------|
| `ocr` | `ocrWorker.ts` | On document upload | Simulated OCR extraction |
| `notification` | `notificationWorker.ts` | On trigger | Create DB notification + send email |
| `import` | `importWorker.ts` | On bulk upload | Process CSV/JSON imports (>50 records) |
| `fraud` | `fraud-worker.ts` | On claim submission | AI image analysis, satellite NDVI, weather check |
| `auto-trigger` | `auto-trigger-worker.ts` | Every 6 hours | Monitor satellite NDVI for all active policies |

---

## Fraud Detection Architecture

### Sync Forensics (< 100ms, during claim submission)
- Duplicate claim detection (30-day window)
- Claim amount vs loss percentage mismatch
- Farmer claim history analysis

### Async Deep Analysis (BullMQ worker)
- **OpenRouter AI** — Image analysis (is it a farm? visible damage?)
- **Sentinel Hub NDVI** — Satellite vegetation comparison (pre vs post incident)
- **OpenWeather** — Weather event verification

### Scoring Thresholds
| Score | Verdict | Action |
|-------|---------|--------|
| 0-20 | LOW | Auto-approve |
| 21-50 | MEDIUM | Manual review |
| 51-75 | HIGH | Escalate to Senior Claims Officer |
| 76-100 | CRITICAL | Block payout |

---

## Running Tests

```bash
npm test                    # Full suite (26 tests)
npm run test:watch          # Watch mode
```

### Test Coverage

| Suite | Tests | Type |
|-------|-------|------|
| `claims.test.ts` | 8 | Integration (Supertest) |
| `tenantIsolation.test.ts` | 18 | Unit (mocked Prisma) |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for:
- Layered architecture diagram
- Request lifecycle
- Multi-tenant isolation model
- Data model (15 tables)
- API route map (58+ endpoints)
- Security layers

---

## Deployment

The backend is designed for easy deployment on:

- **Railway** — Automatic HTTPS, Neon integration, Redis add-on
- **Render** — Web service with Redis
- **Fly.io** — Global deployment with Neon

Minimum requirements:
- Node.js 20 LTS
- Redis (Upstash or self-hosted)
- PostgreSQL (Neon recommended)

---

## License

MIT
