AIMS — Optimized Backend Plan
Module-by-Module Development Roadmap
Status: ✅ Backend Complete (85%) — Adding Enterprise Features
Goal: Build production-ready, scalable, multi-tenant agricultural insurance SaaS
Method: Modular development with continuous testing

📋 Table of Contents
Executive Summary

Current State Assessment

Phase 0: Zero-Day Fixes (Critical)

Phase 1: Dynamic Farmer Fields

Phase 2: Tiered Fraud Detection

Phase 3: Flexible IAM (Custom Roles)

Phase 4: Multi-Payment Gateways

Phase 5: Usage-Based Billing

Phase 6: Auto-Trigger Improvements

Phase 7: Frontend Integration

Phase 8: Testing & Hardening

Phase 9: Deployment & Monitoring

Timeline & Milestones

File Structure Updates

Executive Summary
AIMS is an 85% complete backend for agricultural insurance management. This plan adds enterprise features while maintaining cost-effectiveness:

Feature	Why It Matters
Dynamic Farmer Fields	Each insurance company collects exactly the data they need
Tiered Fraud Detection	5 layers × 3 tiers (FORGE/TITAN/GOAT) with configurable LLMs
Flexible IAM	Tenants create custom roles like AWS IAM
Multi-Payment Gateways	Stripe, Easypaisa, JazzCash support
Usage-Based Billing	Pay-as-you-go with 20% markup → revenue generation
Auto-Trigger Improvements	Satellite + weather monitoring every 6 hours
Current State Assessment
✅ What Works
Component	Status	Details
Express Server	✅ Complete	Helmet, CORS, rate limiting, Pino logging
Multi-Tenant Isolation	✅ Complete	3-layer enforcement (middleware/service/db)
Auth Middleware	✅ Complete	Supabase JWT verification
Role Guard	✅ Complete	requireRole() factory pattern
Error Handling	✅ Complete	Central errorHandler with AppError/ZodError
Zod Validation	✅ Complete	14 validator files
All Services	✅ Complete	14 service modules (auth, farmers, claims, etc.)
All Routes	✅ Complete	58+ endpoints across 14 route files
BullMQ Queues	✅ Complete	OCR, notification, import, fraud, auto-trigger
Fraud Detection	✅ Complete	Sync + async (OpenRouter, Sentinel, OpenWeather)
Stripe Integration	✅ Complete	Payments + webhooks
Cloudinary	✅ Complete	File uploads with auto-compression
Nodemailer	✅ Complete	SMTP email notifications
⚠️ Known Gaps (From Report)
Gap	Severity	Fix
(prisma as any) casts	MEDIUM	Run prisma generate
Auto-trigger cron not scheduled	HIGH	Call scheduleAutoTriggerCheck() in server.ts
Missing env var validation	HIGH	Add startup validation
Redis connectivity not checked	MEDIUM	Add health check
No request ID tracking	LOW	Add to logger
Auth/upload limiters not wired	LOW	Wire to routes
OCR is simulated	LOW	Replace with real service
Phase 0: Zero-Day Fixes (Critical)
Estimated Time: 1 day
Priority: 🔴 HIGH

Task 0.1: Fix Prisma Type Casts
bash
npx prisma generate
Remove all as any casts in:

src/services/fraud.service.ts

src/jobs/auto-trigger-worker.ts

Task 0.2: Schedule Auto-Trigger Cron
typescript
// src/server.ts
import { scheduleAutoTriggerCheck } from './jobs/auto-trigger-worker';

// After server starts
if (process.env.NODE_ENV === 'production') {
  scheduleAutoTriggerCheck().catch(err => {
    logger.error({ err }, 'Failed to schedule auto-trigger check');
  });
}
Task 0.3: Add Startup Validation
typescript
// src/utils/envValidator.ts
const requiredEnvVars = [
  'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'REDIS_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET', 'OPENROUTER_API_KEY',
  'STRIPE_SECRET_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'
];

export function validateEnv() {
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length) {
    console.error(`❌ Missing: ${missing.join(', ')}`);
    process.exit(1);
  }
}
Task 0.4: Verify Redis Connectivity
typescript
// src/lib/redis.ts
export const redis = new Redis(process.env.REDIS_URL!);

redis.ping().then(() => {
  console.log('✅ Redis connected');
}).catch((err) => {
  console.error('❌ Redis connection failed:', err);
  process.exit(1);
});
Task 0.5: Wire Rate Limiters
typescript
// src/routes/auth.routes.ts
import { authLimiter } from '../middleware/rateLimiter';

router.use(authLimiter); // 20 req/15min
typescript
// src/routes/documents.routes.ts
import { uploadLimiter } from '../middleware/rateLimiter';

router.post('/upload', uploadLimiter, ...); // 50 req/hour
Phase 1: Dynamic Farmer Fields
Estimated Time: 2 days
Priority: 🟡 HIGH

What We're Building
Tenants define custom fields for farmer registration. Frontend renders forms dynamically from API response.

1.1 Database Models
prisma
// prisma/schema.prisma

model TenantField {
  id          String   @id @default(uuid())
  tenantId    String
  fieldKey    String   // e.g., "farm_size"
  label       String   // e.g., "Farm Size (Acres)"
  fieldType   String   // text, number, date, dropdown, file, checkbox
  options     Json?    // for dropdown: ["Small", "Medium", "Large"]
  required    Boolean  @default(false)
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  @@unique([tenantId, fieldKey])
  @@index([tenantId])
}

model FarmerFieldValue {
  id          String   @id @default(uuid())
  farmerId    String
  fieldKey    String
  value       Json     // flexible: string, number, array, etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  farmer      Farmer   @relation(fields: [farmerId], references: [id])
  
  @@unique([farmerId, fieldKey])
  @@index([farmerId])
}
1.2 API Endpoints
Method	Path	Role	Description
GET	/api/v1/farmers/fields	TENANT_ADMIN	Get tenant's field schema
POST	/api/v1/farmers/fields	TENANT_ADMIN	Create custom field
PATCH	/api/v1/farmers/fields/:fieldKey	TENANT_ADMIN	Update field
DELETE	/api/v1/farmers/fields/:fieldKey	TENANT_ADMIN	Delete field
1.3 Updated Farmer Registration Flow
typescript
// POST /api/v1/farmers
// Body now accepts dynamic fields
{
  fullName: "John Doe",
  cnicNumber: "12345-6789012-3",
  // ... standard fields
  customData: {
    farm_size: "10",
    crop_type: ["Wheat", "Corn"],
    irrigation: "Drip"
  }
}
1.4 File Structure Additions
text
src/
├── services/
│   └── tenantFields.service.ts     # NEW
├── controllers/
│   └── tenantFields.controller.ts  # NEW
├── routes/
│   └── tenantFields.routes.ts      # NEW
├── validators/
│   └── tenantFields.validator.ts   # NEW
Phase 2: Tiered Fraud Detection
Estimated Time: 3 days
Priority: 🔴 HIGHEST

What We're Building
3 tiers with different LLM models:

FORGE (Entry) → Gemini Flash + Mistral

TITAN (Mid) → Gemini Pro + Claude Haiku

GOAT (Premium) → GPT-4o + Claude 3.5 Sonnet

2.1 Fraud Tier Configuration
typescript
// src/config/fraudTiers.ts

export const FRAUD_TIERS = {
  FORGE: {
    id: 'forge',
    label: 'FORGE',
    description: 'Entry-level AI fraud detection',
    models: {
      image: 'openrouter/google/gemini-1.5-flash',
      vision: 'openrouter/mistralai/mistral-large-2407',
      ocr: 'openrouter/meta-llama/llama-3.1-70b-instruct',
      fallback: 'openrouter/mistralai/mistral-7b-instruct'
    },
    price: {
      baseFee: 49,
      perImage: 0.005,
      perSatelliteCheck: 0.02
    }
  },
  TITAN: {
    id: 'titan',
    label: 'TITAN',
    description: 'Advanced AI fraud detection',
    models: {
      image: 'openrouter/google/gemini-1.5-pro',
      vision: 'openrouter/anthropic/claude-3-haiku',
      ocr: 'openrouter/google/gemini-1.5-flash',
      fallback: 'openrouter/google/gemini-1.5-pro'
    },
    price: {
      baseFee: 99,
      perImage: 0.01,
      perSatelliteCheck: 0.05
    }
  },
  GOAT: {
    id: 'goat',
    label: 'GOAT (Greatest Of All Time)',
    description: 'Premium AI fraud detection',
    models: {
      image: 'openrouter/openai/gpt-4o',
      vision: 'openrouter/anthropic/claude-3.5-sonnet',
      ocr: 'openrouter/google/gemini-1.5-pro',
      fallback: 'openrouter/openai/gpt-4-turbo'
    },
    price: {
      baseFee: 199,
      perImage: 0.02,
      perSatelliteCheck: 0.10
    }
  }
};
2.2 Updated Fraud Service
typescript
// src/services/fraud.service.ts

export async function runAsyncFraudAnalysis(
  claimId: string,
  tenantId: string
): Promise<FraudResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true }
  });

  const tier = tenant.config?.fraudTier || 'forge';
  const tierConfig = FRAUD_TIERS[tier];

  if (!tierConfig) {
    throw new AppError(400, 'Invalid fraud tier configuration');
  }

  const results = { score: 0, flags: [], details: {} };

  // Layer 2: AI Vision
  if (tierConfig.layers.aiVision) {
    const result = await analyzeWithFallback({
      model: tierConfig.models.image,
      fallback: tierConfig.models.fallback,
      prompt: 'Is this a farm with visible crop damage?',
      imageUrls: getClaimImages(claimId)
    });
    // ... process result
    await logUsage(tenantId, 'openrouter', {
      model: tierConfig.models.image,
      quantity: 1,
      cost: result.cost
    });
  }

  // Layer 3: OCR
  if (tierConfig.layers.ocr) {
    const result = await analyzeWithFallback({
      model: tierConfig.models.ocr,
      fallback: tierConfig.models.fallback,
      prompt: 'Extract CNIC and Name. Does CNIC match farmer?',
      imageUrls: getClaimDocuments(claimId)
    });
    // ... process result
    await logUsage(tenantId, 'openrouter', {
      model: tierConfig.models.ocr,
      quantity: 1,
      cost: result.cost
    });
  }

  // Layers 4-5: Free (Satellite + Weather)
  // ... existing code

  // Determine verdict
  const verdict = getVerdict(results.score);
  
  // Write to FraudAuditLog
  await prisma.fraudAuditLog.create({
    data: {
      claimId,
      score: results.score,
      verdict,
      flags: results.flags,
      ruleResults: results.details,
      rawMetadata: JSON.stringify(results)
    }
  });

  return results;
}
2.3 Fallback with Rate Limiting
typescript
// src/lib/openrouter.ts

export async function analyzeWithFallback(config: ModelConfig): Promise<any> {
  const attempts = [
    { model: config.model, isPrimary: true },
    { model: config.fallback, isPrimary: false }
  ];

  for (const attempt of attempts) {
    try {
      const result = await callOpenRouterWithRetry({
        model: attempt.model,
        prompt: config.prompt,
        images: config.imageUrls,
        maxRetries: 3,
        backoffMs: 1000
      });
      
      return {
        ...result,
        modelUsed: attempt.model,
        fallbackUsed: !attempt.isPrimary
      };
    } catch (error) {
      console.warn(`Model ${attempt.model} failed:`, error);
      if (!attempt.isPrimary) {
        throw new AppError(503, 'All AI models unavailable');
      }
    }
  }
}

async function callOpenRouterWithRetry(params: any): Promise<any> {
  for (let i = 0; i < params.maxRetries; i++) {
    try {
      return await callOpenRouter(params);
    } catch (error) {
      if (i === params.maxRetries - 1) throw error;
      await sleep(params.backoffMs * Math.pow(2, i));
    }
  }
}
2.4 API Endpoints
Method	Path	Role	Description
GET	/api/v1/settings/fraud-tiers	TENANT_ADMIN	List available tiers
GET	/api/v1/settings/fraud-tier	TENANT_ADMIN	Get current tier
PATCH	/api/v1/settings/fraud-tier	TENANT_ADMIN	Set fraud tier
Phase 3: Flexible IAM (Custom Roles)
Estimated Time: 2 days
Priority: 🟡 HIGH

What We're Building
Tenants create custom roles with granular permissions like AWS IAM.

3.1 Database Models
prisma
// prisma/schema.prisma

model CustomRole {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  permissions Json     // array of permission strings
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  users       User[]
  
  @@unique([tenantId, name])
  @@index([tenantId])
}

// Add to User model
model User {
  // ... existing fields
  customRoleId  String?
  customRole    CustomRole? @relation(fields: [customRoleId], references: [id])
}
3.2 Permission Definitions
typescript
// src/config/permissions.ts

export const PERMISSIONS = {
  // Claims
  'claim:view:own': 'View own claims',
  'claim:view:all': 'View all claims',
  'claim:create': 'Submit claims',
  'claim:approve': 'Approve claims',
  'claim:reject': 'Reject claims',
  'claim:assign': 'Assign claims to officers',
  'claim:override': 'Override claim decisions',
  
  // Farmers
  'farmer:view': 'View farmer profiles',
  'farmer:create': 'Create farmer profiles',
  'farmer:update': 'Update farmer profiles',
  'farmer:delete': 'Delete farmer profiles',
  
  // Policies
  'policy:view': 'View policies',
  'policy:create': 'Create policy plans',
  'policy:update': 'Update policy plans',
  'policy:delete': 'Delete policy plans',
  'policy:purchase': 'Purchase policies',
  
  // Payments
  'payment:view': 'View payment history',
  'payment:create': 'Create payment intents',
  'payment:payout': 'Process payouts',
  
  // Settings
  'settings:view': 'View tenant settings',
  'settings:update': 'Update tenant settings',
  'settings:staff': 'Manage staff',
  'settings:roles': 'Manage custom roles',
  
  // Fraud
  'fraud:view': 'View fraud scores',
  'fraud:override': 'Override fraud verdicts',
};
3.3 Permission Middleware
typescript
// src/middleware/permissionGuard.ts

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    // Platform admins have all permissions
    if (user.role === 'PLATFORM_ADMIN') return next();

    // Farmers only have farmer permissions
    if (user.role === 'FARMER') {
      const allowed = ['claim:view:own', 'claim:create', 'policy:purchase', 'farmer:view'];
      if (allowed.includes(permission)) return next();
      return res.status(403).json({ status: 'error', message: 'Permission denied' });
    }

    // Check custom role permissions
    if (user.customRoleId) {
      const role = await prisma.customRole.findUnique({
        where: { id: user.customRoleId },
        select: { permissions: true }
      });
      if (role && role.permissions.includes(permission)) {
        return next();
      }
    }

    return res.status(403).json({ status: 'error', message: 'Permission denied' });
  };
}
3.4 API Endpoints
Method	Path	Role	Description
GET	/api/v1/iam/permissions	TENANT_ADMIN	List all permissions
GET	/api/v1/iam/roles	TENANT_ADMIN	List custom roles
POST	/api/v1/iam/roles	TENANT_ADMIN	Create custom role
PATCH	/api/v1/iam/roles/:id	TENANT_ADMIN	Update role
DELETE	/api/v1/iam/roles/:id	TENANT_ADMIN	Delete role
PATCH	/api/v1/users/:id/role	TENANT_ADMIN	Assign role to user
Phase 4: Multi-Payment Gateways
Estimated Time: 2 days
Priority: 🟡 HIGH

What We're Building
Support for Stripe, Easypaisa, JazzCash with a unified adapter pattern.

4.1 Gateway Adapter Pattern
typescript
// src/lib/payments/gateway.interface.ts

export interface PaymentGateway {
  // Premium collection
  createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    customerId?: string;
  }): Promise<{
    id: string;
    clientSecret: string;
    status: string;
  }>;
  
  confirmPayment(paymentId: string): Promise<{
    id: string;
    status: 'succeeded' | 'pending' | 'failed';
    gatewayTransactionId: string;
  }>;
  
  // Payouts
  createPayout(params: {
    amount: number;
    currency: string;
    recipientAccount: string;
    metadata: Record<string, string>;
  }): Promise<{
    id: string;
    status: 'pending' | 'completed' | 'failed';
    gatewayTransactionId: string;
  }>;
  
  // Webhook handling
  handleWebhook(payload: any, signature: string): Promise<any>;
}
4.2 Gateway Implementations
typescript
// src/lib/payments/stripe.gateway.ts
export class StripeGateway implements PaymentGateway {
  private stripe: Stripe;
  
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia'
    });
  }
  
  async createPaymentIntent(params) {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency,
      metadata: params.metadata,
      customer: params.customerId
    });
    return {
      id: intent.id,
      clientSecret: intent.client_secret!,
      status: intent.status
    };
  }
  // ... implement other methods
}

// src/lib/payments/easypaisa.gateway.ts
export class EasypaisaGateway implements PaymentGateway {
  // ... implementation using Easypaisa API
}

// src/lib/payments/jazzcash.gateway.ts
export class JazzCashGateway implements PaymentGateway {
  // ... implementation using JazzCash API
}
4.3 Gateway Factory
typescript
// src/lib/payments/gateway.factory.ts

export function getPaymentGateway(tenantId: string): PaymentGateway {
  // Get tenant's configured gateway
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true }
  });
  
  const gateway = tenant.config?.paymentGateway || 'stripe';
  
  switch (gateway) {
    case 'stripe':
      return new StripeGateway();
    case 'easypaisa':
      return new EasypaisaGateway();
    case 'jazzcash':
      return new JazzCashGateway();
    default:
      return new StripeGateway();
  }
}
4.4 Updated Payment Service
typescript
// src/services/payments.service.ts

export async function createPremiumPayment(policyId: string, tenantId: string) {
  const policy = await prisma.policy.findFirst({
    where: { id: policyId, tenantId },
    include: { farmer: true }
  });
  
  const gateway = getPaymentGateway(tenantId);
  
  const result = await gateway.createPaymentIntent({
    amount: policy.premiumAmount,
    currency: 'usd',
    metadata: { policyId, tenantId, type: 'premium' },
    customerId: policy.farmer?.stripeCustomerId
  });
  
  // Create payment record
  await prisma.payment.create({
    data: {
      tenantId,
      policyId: policy.id,
      type: 'PREMIUM',
      amount: policy.premiumAmount,
      gatewayTransactionId: result.id,
      status: 'pending'
    }
  });
  
  return { clientSecret: result.clientSecret };
}
4.5 API Endpoints
Method	Path	Role	Description
GET	/api/v1/settings/payment-gateways	TENANT_ADMIN	List available gateways
PATCH	/api/v1/settings/payment-gateway	TENANT_ADMIN	Set payment gateway
POST	/api/v1/webhooks/:gateway	Public	Gateway webhook receiver
Phase 5: Usage-Based Billing
Estimated Time: 3 days
Priority: 🔴 HIGHEST

What We're Building
Track tenant usage (AI calls, satellite checks, etc.) and generate monthly invoices with markup.

5.1 Database Models
prisma
// prisma/schema.prisma

model UsageLog {
  id          String   @id @default(uuid())
  tenantId    String
  service     String   // 'openrouter', 'sentinel', 'openweather'
  tier        String   // 'forge', 'titan', 'goat'
  model       String?  // actual model used
  quantity    Float
  cost        Float    // raw cost before markup
  markup      Float    // applied markup percentage
  totalCost   Float    // cost + markup
  metadata    Json?
  createdAt   DateTime @default(now())
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId])
  @@index([createdAt])
}

model UsageSummary {
  id          String   @id @default(uuid())
  tenantId    String
  periodStart DateTime
  periodEnd   DateTime
  totalCost   Float
  markup      Float
  totalBill   Float
  currency    String
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  @@unique([tenantId, periodStart])
  @@index([tenantId])
}

model Invoice {
  id          String   @id @default(uuid())
  tenantId    String
  invoiceNumber String @unique
  periodStart DateTime
  periodEnd   DateTime
  totalAmount Float
  currency    String
  status      String   // 'draft', 'sent', 'paid', 'overdue'
  invoiceUrl  String?
  paidAt      DateTime?
  dueDate     DateTime
  createdAt   DateTime @default(now())
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  lineItems   InvoiceLineItem[]
  
  @@index([tenantId])
  @@index([status])
}

model InvoiceLineItem {
  id          String   @id @default(uuid())
  invoiceId   String
  description String
  amount      Float
  quantity    Float?
  unitPrice   Float?
  
  invoice     Invoice  @relation(fields: [invoiceId], references: [id])
}
5.2 Usage Logging
typescript
// src/services/usage.service.ts

export async function logUsage(
  tenantId: string,
  service: string,
  data: { model?: string; quantity: number; cost: number }
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true }
  });
  
  const markup = tenant.config?.billing?.markupPercentage || 20;
  const totalCost = data.cost * (1 + markup / 100);
  
  await prisma.usageLog.create({
    data: {
      tenantId,
      service,
      tier: tenant.config?.fraudTier || 'forge',
      model: data.model,
      quantity: data.quantity,
      cost: data.cost,
      markup,
      totalCost
    }
  });
}
5.3 Invoice Generation (Monthly Cron)
typescript
// src/jobs/billingWorker.ts

export async function generateMonthlyInvoices() {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true }
  });
  
  for (const tenant of tenants) {
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 1);
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
    
    const periodEnd = new Date();
    periodEnd.setDate(1);
    periodEnd.setHours(0, 0, 0, 0);
    periodEnd.setMilliseconds(-1);
    
    // Aggregate usage
    const usage = await prisma.usageLog.aggregate({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: periodStart, lte: periodEnd }
      },
      _sum: { totalCost: true }
    });
    
    // Get tier base fee
    const tierConfig = FRAUD_TIERS[tenant.config?.fraudTier || 'forge'];
    const baseFee = tierConfig?.price?.baseFee || 49;
    
    const totalAmount = baseFee + (usage._sum.totalCost || 0);
    
    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        invoiceNumber: `INV-${Date.now()}-${tenant.id.slice(0, 6)}`,
        periodStart,
        periodEnd,
        totalAmount,
        currency: 'USD',
        status: 'draft',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lineItems: {
          create: [
            {
              description: `${tierConfig.label} Tier - Monthly Fee`,
              amount: baseFee,
              quantity: 1,
              unitPrice: baseFee
            },
            {
              description: 'AI Usage (OpenRouter, Satellite, Weather)',
              amount: usage._sum.totalCost || 0
            }
          ]
        }
      }
    });
    
    // Send invoice email
    await sendInvoiceEmail(tenant.id, invoice.id);
  }
}
5.4 API Endpoints
Method	Path	Role	Description
GET	/api/v1/billing/usage	TENANT_ADMIN	Get current month usage
GET	/api/v1/billing/invoices	TENANT_ADMIN	List invoices
GET	/api/v1/billing/invoices/:id	TENANT_ADMIN	Get invoice details
POST	/api/v1/billing/invoices/:id/pay	TENANT_ADMIN	Pay invoice
GET	/api/v1/billing/invoices/:id/pdf	TENANT_ADMIN	Download invoice PDF
Phase 6: Auto-Trigger Improvements
Estimated Time: 1 day
Priority: 🟡 MEDIUM

What We're Building
Enhanced auto-trigger with better monitoring and error handling.

6.1 Improved Auto-Trigger Worker
typescript
// src/jobs/auto-trigger-worker.ts

export const autoTriggerWorker = new Worker(
  'auto-trigger',
  async (job) => {
    const { tenantId, policyIds } = job.data;
    
    const policies = await prisma.policy.findMany({
      where: {
        status: 'ACTIVE',
        ...(tenantId && { tenantId }),
        ...(policyIds && { id: { in: policyIds } }),
        policyPlan: {
          config: { path: ['autoTrigger', 'enabled'], equals: true }
        }
      },
      include: {
        policyPlan: true,
        landParcel: true,
        farmer: true
      }
    });
    
    logger.info({ count: policies.length }, 'Running auto-trigger check');
    
    for (const policy of policies) {
      try {
        const config = policy.policyPlan.config?.autoTrigger;
        if (!config) continue;
        
        // 1. Fetch NDVI
        const ndviData = await fetchNdvi(policy.landParcel);
        
        // 2. Check NDVI drop
        if (ndviData.drop < config.ndviThreshold) {
          continue;
        }
        
        // 3. Verify weather
        if (config.weatherCheck) {
          const weather = await verifyWeather(
            policy.landParcel.latitude,
            policy.landParcel.longitude,
            new Date()
          );
          if (!weather.matches) {
            continue;
          }
        }
        
        // 4. Auto-create claim
        const claim = await createAutoClaim(policy);
        
        // 5. Run fraud detection
        const fraudResult = await runSyncForensics(claim.id, policy.tenantId);
        
        // 6. Auto-approve if low risk
        if (fraudResult.score < 30) {
          await autoApproveClaim(claim.id);
        }
        
        // 7. Log
        await prisma.autoTriggerLog.create({
          data: {
            tenantId: policy.tenantId,
            policyId: policy.id,
            landParcelId: policy.landParcelId,
            ndviPre: ndviData.pre,
            ndviPost: ndviData.post,
            ndviDrop: ndviData.drop,
            weatherEvent: weather?.event,
            weatherData: weather?.raw,
            triggerMatched: true,
            claimId: claim.id
          }
        });
        
      } catch (error) {
        logger.error({ policyId: policy.id, error }, 'Auto-trigger check failed');
      }
    }
  },
  { connection: redis, concurrency: 3 }
);
Phase 7: Frontend Integration
Estimated Time: 3 days
Priority: 🟡 MEDIUM

What We're Building
Next.js frontend with dynamic forms, role management, and billing dashboard.

7.1 Dynamic Form Components
tsx
// src/components/forms/DynamicForm.tsx

import { useQuery } from '@tanstack/react-query';

export function DynamicFarmerForm({ tenantId }: { tenantId: string }) {
  const { data: fields } = useQuery({
    queryKey: ['tenantFields', tenantId],
    queryFn: () => api.get('/farmers/fields').then(res => res.data)
  });

  return (
    <Form>
      {/* Standard fields */}
      <Input name="fullName" label="Full Name" required />
      <Input name="cnicNumber" label="CNIC Number" required />
      
      {/* Dynamic fields */}
      {fields?.map((field: TenantField) => (
        <div key={field.fieldKey}>
          {field.fieldType === 'text' && (
            <Input name={`customData.${field.fieldKey}`} label={field.label} required={field.required} />
          )}
          {field.fieldType === 'dropdown' && (
            <Select name={`customData.${field.fieldKey}`} label={field.label} options={field.options} required={field.required} />
          )}
          {field.fieldType === 'file' && (
            <FileUpload name={`customData.${field.fieldKey}`} label={field.label} required={field.required} />
          )}
        </div>
      ))}
    </Form>
  );
}
7.2 Role Management UI
tsx
// src/app/admin/roles/page.tsx

export default function RolesPage() {
  const { data: roles } = useQuery({
    queryKey: ['customRoles'],
    queryFn: () => api.get('/iam/roles').then(res => res.data)
  });

  return (
    <div>
      <h1>Custom Roles</h1>
      <Button onClick={() => setShowCreateModal(true)}>Create Role</Button>
      
      <div className="grid gap-4">
        {roles?.map((role: CustomRole) => (
          <Card key={role.id}>
            <CardHeader>{role.name}</CardHeader>
            <CardBody>
              <p>{role.description}</p>
              <div className="flex flex-wrap gap-2">
                {role.permissions.map((perm: string) => (
                  <Badge key={perm}>{perm}</Badge>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
7.3 Billing Dashboard
tsx
// src/app/billing/page.tsx

export default function BillingPage() {
  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices').then(res => res.data)
  });

  const { data: usage } = useQuery({
    queryKey: ['usage'],
    queryFn: () => api.get('/billing/usage').then(res => res.data)
  });

  return (
    <div>
      <h1>Billing</h1>
      
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Current Usage" value={`$${usage?.totalCost || 0}`} />
        <StatCard label="This Month" value={`$${usage?.totalBill || 0}`} />
        <StatCard label="Outstanding" value={`$${invoices?.filter(i => i.status === 'draft').reduce((sum, i) => sum + i.totalAmount, 0) || 0}`} />
      </div>
      
      <Table>
        <TableHeader>
          <tr><th>Invoice #</th><th>Period</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
        </TableHeader>
        <TableBody>
          {invoices?.map((invoice: Invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.invoiceNumber}</td>
              <td>{invoice.periodStart} - {invoice.periodEnd}</td>
              <td>${invoice.totalAmount}</td>
              <td><Badge variant={invoice.status}>{invoice.status}</Badge></td>
              <td>
                <Button variant="outline" onClick={() => window.open(`/billing/invoices/${invoice.id}/pdf`)}>
                  Download PDF
                </Button>
                {invoice.status === 'draft' && (
                  <Button onClick={() => payInvoice(invoice.id)}>Pay Now</Button>
                )}
              </td>
            </tr>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
Phase 8: Testing & Hardening
Estimated Time: 2 days
Priority: 🔴 HIGH

8.1 Test Coverage Goals
Module	Target Coverage	Current
Auth Middleware	100%	~70%
All Services	>80%	~60%
Claim State Machine	100%	100%
Fraud Engine	>90%	~80%
Tenant Isolation	100%	100%
IAM (Custom Roles)	>80%	0% (new)
Billing Service	>80%	0% (new)
8.2 New Test Files
text
tests/
├── fraudTiers.test.ts        # Tiered fraud detection
├── tenantFields.test.ts      # Dynamic farmer fields
├── iam.test.ts               # Custom roles & permissions
├── billing.test.ts           # Usage logging & invoicing
├── paymentGateways.test.ts   # Multi-gateway support
├── autoTrigger.test.ts       # Enhanced auto-trigger
└── setup.ts                  # Updated test setup
8.3 Performance Testing
typescript
// tests/performance/fraud.test.ts

describe('Fraud Detection Performance', () => {
  it('should process sync forensics in < 100ms', async () => {
    const start = Date.now();
    await runSyncForensics(claimId, tenantId);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should process async fraud in < 30s', async () => {
    const start = Date.now();
    await runAsyncFraudAnalysis(claimId, tenantId);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(30000);
  });
});
Phase 9: Deployment & Monitoring
Estimated Time: 1 day
Priority: 🟡 MEDIUM

9.1 Deployment Checklist
Environment variables validated

Redis connection verified

Database migrations applied

Auto-trigger cron scheduled

Stripe webhooks configured

Email SMTP tested

Cloudinary configured

OpenRouter API key set

Sentry/Datadog monitoring configured

Health check endpoint accessible

9.2 Monitoring Alerts
Alert	Condition	Severity
Redis Down	Cannot connect to Redis	CRITICAL
Queue Lag	> 1000 jobs pending	HIGH
Fraud API Fail	> 10% failure rate	HIGH
Auto-Trigger Missed	No run in 7 hours	MEDIUM
Invoice Generation	Not run in 24 hours	HIGH
Timeline & Milestones
Phase	Task	Days	Status
0	Zero-Day Fixes	1	🔴 PENDING
1	Dynamic Farmer Fields	2	🔴 PENDING
2	Tiered Fraud Detection	3	🔴 PENDING
3	Flexible IAM	2	🔴 PENDING
4	Multi-Payment Gateways	2	🔴 PENDING
5	Usage-Based Billing	3	🔴 PENDING
6	Auto-Trigger Improvements	1	🔴 PENDING
7	Frontend Integration	3	🔴 PENDING
8	Testing & Hardening	2	🔴 PENDING
9	Deployment & Monitoring	1	🔴 PENDING
Total		20 days	
File Structure Updates
text
AIMS/
├── src/
│   ├── config/
│   │   ├── fraudTiers.ts           # NEW
│   │   └── permissions.ts          # NEW
│   ├── lib/
│   │   └── payments/
│   │       ├── gateway.interface.ts # NEW
│   │       ├── stripe.gateway.ts    # NEW
│   │       ├── easypaisa.gateway.ts # NEW
│   │       ├── jazzcash.gateway.ts  # NEW
│   │       └── gateway.factory.ts   # NEW
│   ├── services/
│   │   ├── tenantFields.service.ts  # NEW
│   │   ├── iam.service.ts           # NEW
│   │   ├── usage.service.ts         # NEW
│   │   └── billing.service.ts       # NEW
│   ├── controllers/
│   │   ├── tenantFields.controller.ts # NEW
│   │   ├── iam.controller.ts        # NEW
│   │   └── billing.controller.ts    # NEW
│   ├── routes/
│   │   ├── tenantFields.routes.ts   # NEW
│   │   ├── iam.routes.ts            # NEW
│   │   └── billing.routes.ts        # NEW
│   ├── validators/
│   │   ├── tenantFields.validator.ts # NEW
│   │   ├── iam.validator.ts         # NEW
│   │   └── billing.validator.ts     # NEW
│   ├── middleware/
│   │   └── permissionGuard.ts       # NEW
│   └── jobs/
│       └── billingWorker.ts         # NEW
├── tests/
│   ├── fraudTiers.test.ts           # NEW
│   ├── tenantFields.test.ts         # NEW
│   ├── iam.test.ts                  # NEW
│   ├── billing.test.ts              # NEW
│   ├── paymentGateways.test.ts      # NEW
│   └── autoTrigger.test.ts          # NEW
└── OPTIMIZED_BACKEND_PLAN.md        # ← This file
