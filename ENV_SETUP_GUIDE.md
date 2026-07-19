<!-- ============================================================== -->
<!-- 🗂️ FILE PURPOSE: Environment variables setup guide              -->
<!--    Where to find/create each API key: Neon, Supabase Auth,      -->
<!--    Redis, Cloudinary, Stripe, Nodemailer SMTP, OpenRouter,      -->
<!--    Sentinel Hub, OpenWeather                                    -->
<!-- ============================================================== -->

# AIMS — Environment Variables Setup Guide

This guide shows you exactly where to find or generate each API key needed for the AIMS backend.

---

## 1. `DATABASE_URL` — Neon (PostgreSQL)

| Field | Value |
|-------|-------|
| **Service** | [Neon](https://neon.tech/) |
| **Free tier** | Yes — 0.5 GB storage |
| **Steps** | 1. Sign up at [neon.tech](https://neon.tech/) <br> 2. Create a project <br> 3. Go to **Dashboard → Connection Details** <br> 4. Copy the `DATABASE_URL` (use pooled connection for serverless) |
| **Example** | `postgresql://user:pass@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require` |

---

## 2. Supabase Auth — `SUPABASE_URL` & `SUPABASE_ANON_KEY`

| Field | Value |
|-------|-------|
| **Service** | [Supabase](https://supabase.com/) |
| **Free tier** | Yes — 50K users, 2 GB database, Row Level Security |
| **Steps** | 1. Sign up at [supabase.com](https://supabase.com/) <br> 2. Create a new project <br> 3. Wait for the database to provision (1-2 mins) <br> 4. Go to **Project Settings → API** <br> 5. Copy the **Project URL** (this is `SUPABASE_URL`) <br> 6. Copy the **anon public key** (this is `SUPABASE_ANON_KEY`) |
| **Example** | `https://your-project.supabase.co` / `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### How Auth Works
- Users sign up/login via Supabase Auth (frontend SDK or direct API)
- Backend verifies JWTs using `supabase.auth.getUser(token)` in middleware
- The `authId` field on the local `User` table stores the Supabase user UUID
- Admin-created users (seed, import) get a placeholder `authId`; on first API call, the middleware links them by email

---

## 3. `REDIS_URL` — Redis (Self-Hosted)

| Field | Value |
|-------|-------|
| **Service** | Redis (self-hosted, local) |
| **Free tier** | Yes — always free |
| **Steps** | 1. Install Redis locally: `sudo apt install redis-server` (Linux) or `brew install redis` (macOS) <br> 2. Start Redis: `redis-server` <br> 3. The default URL is `redis://localhost:6379` <br> 4. Set `REDIS_URL=redis://localhost:6379` in your `.env` |
| **Note** | No Upstash or cloud Redis. BullMQ uses this `REDIS_URL` for job queues (fraud analysis, imports, notifications). |
| **Example** | `redis://localhost:6379` |

---

## 4. Cloudinary — `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

| Field | Value |
|-------|-------|
| **Service** | [Cloudinary](https://cloudinary.com/) |
| **Free tier** | Yes — 25 GB storage, 25 GB bandwidth |
| **Steps** | 1. Sign up at [cloudinary.com](https://cloudinary.com/) <br> 2. Go to **Settings (gear icon) → Account → API Keys** <br> 3. Copy **Cloud Name**, **API Key**, and **API Secret** |
| **Example** | `dv123abc` / `123456789012345` / `abc123def456` |

---

## 5. Stripe — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTION_PRICE_ID`

| Field | Value |
|-------|-------|
| **Service** | [Stripe](https://stripe.com/) |
| **Free tier** | Yes — pay per transaction |
| **Steps** | 1. Sign up at [stripe.com](https://stripe.com/) <br> 2. Go to **Dashboard → Developers → API Keys** for `STRIPE_SECRET_KEY` <br> 3. Go to **Developers → Webhooks → Add endpoint** to create a webhook; copy the **Signing Secret** for `STRIPE_WEBHOOK_SECRET` <br> 4. Go to **Products → Create Product** → set a price; copy the **Price ID** (`price_...`) for `STRIPE_SUBSCRIPTION_PRICE_ID` |
| **Webhook URL** | Point Stripe webhooks to: `https://your-domain.com/api/v1/webhooks/stripe` |
| **Example** | `sk_test_your_stripe_test_key_here` / `whsec_abc123...` / `price_1Q...` |

---

## 6. Nodemailer — SMTP Credentials

Nodemailer replaces Resend for sending emails. You need SMTP credentials from any email provider.

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server host (e.g., `smtp.gmail.com`, `smtp.sendgrid.net`) |
| `SMTP_PORT` | SMTP port (`587` for TLS, `465` for SSL) |
| `SMTP_SECURE` | `"true"` for port 465, `"false"` for port 587 |
| `SMTP_USER` | SMTP username (usually your email address) |
| `SMTP_PASS` | SMTP password or app-specific password |
| `SMTP_FROM` | Sender address like `'"AIMS" <noreply@aims.app>'` |

| Provider | Free tier | How to get SMTP credentials |
|----------|----------|-----------------------------|
| **Gmail** | Yes — 500 emails/day | Use [App Passwords](https://myaccount.google.com/apppasswords) (requires 2FA enabled) |
| **SendGrid** | Yes — 100 emails/day | Sign up at [sendgrid.com](https://sendgrid.com/) → **Settings → API Keys → Create API Key** (use SMTP relay) |
| **Etalemail (Ethereal)** | Yes — fake SMTP for dev | Go to [ethereal.email](https://ethereal.email/) to create a disposable test account |
| **Mailtrap** | Yes — 500 emails/month | Sign up at [mailtrap.io](https://mailtrap.io/) for testing |

**Quick dev setup (no real email):** Use [Ethereal](https://ethereal.email/) — it creates a fake SMTP server. Emails are captured in a web dashboard instead of being delivered. Perfect for development.

---

## 7. `OPENROUTER_API_KEY` — OpenRouter (AI/LLM)

OpenRouter replaces Google Gemini for AI image analysis and document OCR. It gives you access to **multiple models** (Gemini, GPT-4o, Claude, Llama) through a single API.

| Field | Value |
|-------|-------|
| **Service** | [OpenRouter](https://openrouter.ai/) |
| **Free tier** | Yes — some free models available |
| **Steps** | 1. Sign up at [openrouter.ai](https://openrouter.ai/) <br> 2. Go to **Dashboard → Keys** <br> 3. Click **Create Key** → copy the key <br> 4. (Optional) Add a small credit balance for paid models |
| **Default model** | `google/gemini-2.0-flash-001` (free tier) |
| **Example** | `sk-or-v1-abc123...` |

OpenRouter automatically routes to the cheapest available model. You can change the model in `src/lib/openrouter.ts`. Free models include:
- `google/gemini-2.0-flash-001`
- `meta-llama/llama-3.2-3b-instruct`
- `mistralai/mistral-7b-instruct`

---

---

## 9. `SENTINEL_HUB_API_KEY` — Sentinel Hub (Satellite)

| Field | Value |
|-------|-------|
| **Service** | [Sentinel Hub](https://www.sentinel-hub.com/) |
| **Free tier** | Yes — 30K requests/month |
| **Steps** | 1. Sign up at [sentinel-hub.com](https://www.sentinel-hub.com/) <br> 2. Go to **Dashboard → OAuth Clients** <br> 3. Create a new OAuth client to get your **Client ID** and **Client Secret** <br> 4. Use these to obtain an access token via OAuth flow |
| **Note** | The API key is the OAuth **Client ID** used for authentication |

---

## 10. `OPENWEATHER_API_KEY` — OpenWeather

| Field | Value |
|-------|-------|
| **Service** | [OpenWeather](https://openweathermap.org/) |
| **Free tier** | Yes — 60 calls/min, 1M/month |
| **Steps** | 1. Sign up at [openweathermap.org](https://openweathermap.org/) <br> 2. After email confirmation, go to **My API Keys** tab on your dashboard <br> 3. Your API key will be active shortly after signup |
| **Example** | `a1b2c3d4e5f6...` |

---

## 11. Other Variables

| Variable | What to set |
|----------|-------------|
| `BILLING_ENABLED` | `"false"` (default) or `"true"` to enable Stripe subscriptions |
| `FRONTEND_URL` | `"http://localhost:3000"` for local dev, or your deployed frontend URL |
| `PORT` | `"4000"` (default) — the port your Express server listens on |
| `NODE_ENV` | `"development"` for local, `"production"` for deployment, `"test"` for running tests |

---

## Quick Start

1. Copy `.env.example` (or create `.env`) with all variables above
2. Run `npx prisma migrate dev --name add_fraud_auto_trigger`
3. Run `npx ts-node src/scripts/seed.ts` to create the default tenant + PLATFORM_ADMIN
4. Run `npm run dev` to start the server

> **Tip:** Use a `.env` file in the project root. Never commit `.env` to version control.
