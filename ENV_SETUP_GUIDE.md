# AIMS — Environment Variables Setup Guide

> **Purpose:** This file documents every environment variable used by the AIMS backend.
> Use it as a reference when setting up a new deployment (Railway, Vercel, local).
> Last updated: July 2026

---

## 📋 Quick Start (8 Required Variables)

Copy these 8 into any new deployment — the server **will not start** without them:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
REDIS_URL=redis://localhost:6379
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
OPENROUTER_API_KEY=sk-or-v1-...
```

---

## 🔧 Complete Variable Reference

### Database (1 variable)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **YES** | — | Neon PostgreSQL connection string |

**How to get it:** Neon Dashboard → Project → Connection Details → `postgresql://...`

---

### Authentication — Supabase (2 variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | **YES** | — | Project URL from Supabase dashboard |
| `SUPABASE_ANON_KEY` | **YES** | — | Anon/public key (safe to expose) |

**How to get them:** Supabase Dashboard → Project Settings → API → Project URL & anon key

> ⚠️ `SUPABASE_URL` should be `https://your-project.supabase.co` (no `/rest/v1/` suffix — the SDK adds it)

---

### Redis / BullMQ (1 variable)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | **YES** | `redis://localhost:6379` | Redis connection for BullMQ queues |

**Options:**
- **Local:** `redis://localhost:6379` (run `redis-server`)
- **Upstash (Wire Protocol):** `rediss://default:password@host.upstash.io:6379`

> ⚠️ The codebase uses **ioredis** which needs the **Wire Protocol URL**, NOT the REST URL.
> In Upstash dashboard, go to **Details** → **Redis Connect** → **ioredis** and copy that string.

---

### Cloudinary — File Storage (3 variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLOUDINARY_CLOUD_NAME` | **YES** | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | **YES** | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | **YES** | — | Cloudinary API secret |

**How to get them:** Cloudinary Dashboard → Dashboard → Account Details

---

### OpenRouter — AI / LLM (2 variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | **YES** | — | OpenRouter API key for all AI fraud detection |
| `OPENROUTER_MODEL` | No | `google/gemini-2.0-flash-001` | Default model to use for image analysis |

**How to get them:**
- API key: https://openrouter.ai/keys → Create API key
- Models: https://openrouter.ai/models — supports all major models (Gemini, GPT-4o, Claude, Llama, etc.)

> The codebase uses OpenRouter as the **single LLM gateway** for all fraud detection (images, video, text). No separate Google/Groq modules.

---

### Stripe — Payments & Billing (3 variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | No* | — | Stripe secret key (sk_test_... or sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | No* | — | Stripe webhook signing secret (whsec_...) |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | No* | — | Price ID for monthly subscription (price_...) |

*Required only if `BILLING_ENABLED=true`

**How to get them:**
- Secret key: Stripe Dashboard → Developers → API Keys
- Webhook secret: Stripe Dashboard → Developers → Webhooks → Add endpoint
- Price ID: Stripe Dashboard → Products → Create product → Copy price ID

---

### Nodemailer — Email / SMTP (6 variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | No | `smtp.ethereal.email` | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_SECURE` | No | `false` | Use TLS (`true` for port 465) |
| `SMTP_USER` | No | `""` | SMTP username |
| `SMTP_PASS` | No | `""` | SMTP password |
| `SMTP_FROM` | No | `"AIMS" <noreply@aims.app>` | From address for sent emails |

**Options:**
- **Ethereal (testing):** Leave defaults — no real emails sent, view at https://ethereal.email
- **Gmail (production):** Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`
  - Password must be a **Gmail App Password** (16 chars) — requires 2FA on the account
  - Generate at: https://myaccount.google.com/apppasswords

---

### Sentinel Hub — Satellite NDVI (1 variable)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTINEL_HUB_API_KEY` | No | — | Sentinel Hub API key for satellite NDVI checks |

**How to get it:** https://www.sentinel-hub.com → Dashboard → Configuration → OAuth Client → Create

> The code uses OAuth client credentials. You need an Instance ID (format: `cf30249d-...`) and an API key from Sentinel Hub's OAuth client.

---

### OpenWeather — Weather Verification (1 variable)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENWEATHER_API_KEY` | No | — | OpenWeather API key for weather fraud checks |

**How to get it:** https://openweathermap.org/api → Sign up → API keys tab → Copy key

---

### Server Config (4 variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4000` | Express server port |
| `NODE_ENV` | No | `development` | Environment (`development`, `production`, `test`) |
| `FRONTEND_URL` | No | `http://localhost:3000` | Frontend URL (for CORS, redirects) |
| `APP_URL` | No | `http://localhost:4000` | App URL (sent to OpenRouter as referer) |
| `LOG_LEVEL` | No | `info` | Pino log level (`info`, `debug`, `warn`, `error`) |

---

### Feature Flags (1 variable)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BILLING_ENABLED` | No | `false` | Enable Stripe billing/subscriptions |
| `BILLING_MARKUP_PERCENTAGE` | No | `20` | Markup % on usage-based billing |

---

### Payment Gateways (Optional — Easypaisa / JazzCash)

**Easypaisa:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EASYPAISA_API_KEY` | No | — | Easypaisa API key |
| `EASYPAISA_API_SECRET` | No | — | Easypaisa API secret |
| `EASYPAISA_BASE_URL` | No | `https://api.easypaisa.com` | API base URL |
| `EASYPAISA_STORE_ID` | No | `""` | Store/merchant ID |
| `EASYPAISA_PRODUCT_CODE` | No | `""` | Product code |

**JazzCash:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JAZZCASH_API_KEY` | No | — | JazzCash API key |
| `JAZZCASH_API_SECRET` | No | — | JazzCash API secret |
| `JAZZCASH_MERCHANT_ID` | No | — | Merchant ID |
| `JAZZCASH_BASE_URL` | No | `https://api.jazzcash.com` | API base URL |
| `JAZZCASH_PRODUCT_ID` | No | `""` | Product ID |

---

### Seed Script (2 variables)

Used only by `npx ts-node src/scripts/seed.ts`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SEED_ADMIN_EMAIL` | No | `admin@aims.app` | Email for the seeded platform admin |
| `SEED_ADMIN_AUTH_ID` | No | `seed-admin-placeholder` | Supabase auth ID for the admin |

---

## 🧪 Your Current .env — Issues Found (July 2026)

Based on the .env you shared, here are the 5 issues:

### ❌ Issue 1: SMTP Mismatch — Emails won't send

```env
# Current (broken):
SMTP_HOST=smtp.ethereal.email     # ← Ethereal test server
SMTP_USER=mazhanbaig44@gmail.com  # ← Gmail address
SMTP_PASS=786an                   # ← Regular password (won't work)
```

**Problem:** Ethereal host + Gmail credentials don't match. Also, `786an` is a regular Gmail password — Gmail requires a 16-character **App Password**.

**Fix:** Either use Gmail properly:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mazhanbaig44@gmail.com
SMTP_PASS=your-16-char-app-password   # Get from https://myaccount.google.com/apppasswords
SMTP_FROM="AIMS" <noreply@aims.app>
```

Or use Ethereal (test only — emails don't actually send):
```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-user@ethereal.email  # Create at https://ethereal.email
SMTP_PASS=your-ethereal-password
```

### ❌ Issue 2: `UPSTASH_REDIS_REST_URL` is not used

This variable is **never read by any code**. The codebase uses `REDIS_URL` only (which you have correctly set at the bottom). Remove it to avoid confusion.

### ❌ Issue 3: Dead variables at bottom

```env
Client_ID=cf30249d-31-4b5c-a-36bc98fb9d31   ← Not referenced in code
Client_Secret=TKPMs3lw1LubRjyQw3VbRZlE2     ← Not referenced in code
```

These look like Sentinel Hub OAuth credentials but the code uses `SENTINEL_HUB_API_KEY`. Remove them.

### ❌ Issue 4: Duplicate `OPENROUTER_MODEL`

Appears twice in your file with slightly different values. Keep only one:
```env
OPENROUTER_MODEL=google/gemini-2.0-flash-001
```

### ❌ Issue 5: Stripe keys are empty

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUBSCRIPTION_PRICE_ID=
```

Fine as long as `BILLING_ENABLED=false`. When you're ready for billing, get these from your Stripe Dashboard.

---

## ✅ Clean Template

```env
# ═══════════════════════════════════════════════════════════
# AIMS — Environment Variables
# ═══════════════════════════════════════════════════════════

# ─── Database (REQUIRED) ──────────────────────────────────
DATABASE_URL=postgresql://neondb_owner:npg_FCogkE4cvjM0@ep-summerzabg8nux-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# ─── Supabase Auth (REQUIRED) ──────────────────────────────
SUPABASE_URL=https://fbcvcnkuatxkiyhmlwda.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiXBhYmFzZSIsInJlZiI6ImZiY3Zjbmt1YXR4a2l5aG1sd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNDAxMzYsImV4cCI6MjA5OTkxNjEzNn0.ya-fLFCiJjts1BpGO4SpubS4HkChv13QE_hPJP4kLrY

# ─── Redis / BullMQ (REQUIRED) ─────────────────────────────
REDIS_URL=rediss://default:gQAAAAAAArIgcDEwMDQ2YzhiwMDY0ZjU1OTRmY2ExOTVmZWRjMmE4Yg@gentle-honeybee-178686.upstash.io:6379

# ─── Cloudinary (REQUIRED) ─────────────────────────────────
CLOUDINARY_CLOUD_NAME=yoi1c4bvx
CLOUDINARY_API_KEY=699811366114
CLOUDINARY_API_SECRET=TcLslJURyuwuV5d5fV3V3Ez0

# ─── OpenRouter AI (REQUIRED) ──────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-b7760e8d3f273f83b3b94a301cd6ff932d96dc2cfdea67a73f5f5b7b80f
OPENROUTER_MODEL=google/gemini-2.0-flash-001

# ─── Nodemailer / SMTP ─────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mazhanbaig44@gmail.com
# Replace with your 16-char Gmail App Password (requires 2FA)
SMTP_PASS=your-gmail-app-password-here
SMTP_FROM="AIMS" <noreply@aims.app>

# ─── Satellite & Weather (Optional) ────────────────────────
SENTINEL_HUB_API_KEY=cf30249d-3120-a536-36bc98fb9d31
OPENWEATHER_API_KEY=3b258a91fd16b95d478ffd86b8809

# ─── Stripe Billing (Optional — disabled by default) ──────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUBSCRIPTION_PRICE_ID=
BILLING_ENABLED=false
BILLING_MARKUP_PERCENTAGE=20

# ─── Server Config ─────────────────────────────────────────
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## 🚀 Railway Deployment

When deploying to Railway, set all 8 REQUIRED variables in the dashboard:

1. Go to Railway dashboard → Project → Variables tab
2. Add each variable (use **Raw Editor** to paste the entire block)
3. Railway auto-injects them into the environment at runtime

> The build command in `railway.toml` runs `npx prisma generate && npm run build` — this requires `DATABASE_URL` to be set at build time for Prisma generation.

---

## ☁️ Vercel Deployment (API-only)

Same 8 required variables in Vercel Dashboard → Project Settings → Environment Variables.

> ⚠️ Background workers (fraud, auto-trigger, billing, notifications) do NOT run on Vercel. Use Railway for full functionality.
