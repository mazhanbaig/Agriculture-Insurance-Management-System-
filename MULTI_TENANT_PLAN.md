PROMPT: Expand AIMS to a Multi‑Tenant Platform
Goal: Convert the existing single‑tenant Agricultural Insurance Management System (AIMS) into a multi‑tenant SaaS where multiple insurance companies (tenants) operate independently. Each tenant gets its own subdomain, staff, farmers, policy plans, and claims. Billing (Stripe subscriptions) is built but disabled via a feature flag. Farmers are scoped to one tenant.

1. New Requirements & Clarifications
Tenant Isolation: All data is logically separated by tenantId. Every API endpoint for tenant data must filter by the authenticated user’s tenantId.

Subdomains: Each tenant accesses the system via a dedicated subdomain (e.g., tenantname.aims.com). The middleware will extract the tenant from the hostname.

Billing: We will implement Stripe subscription logic (charging tenants monthly) but keep it off by default using a global BILLING_ENABLED environment variable or a tenant‑level isBillingActive flag. All code is present; just not executed until toggled.

Farmers: Farmers belong to exactly one tenant. They log in via that tenant’s subdomain and can only see their own policies/claims.

Data Import/Export: Tenants must be able to import their existing policy plans, farmers, and policies (from spreadsheets) during onboarding. Provide a CSV/JSON import API with background processing via BullMQ.

2. Tech Stack Additions
Subdomain handling: Use express‑subdomain or custom middleware that reads req.hostname.

CSV parsing: Use csv‑parse or papaparse for import.

Stripe Billing: Use Stripe Checkout or Subscription APIs for tenant subscriptions. Add a Tenant.stripeSubscriptionId field.

3. Data Model Changes (Prisma)
Add the Tenant model:

prisma
model Tenant {
  id                  String   @id @default(uuid())
  name                String   @unique
  slug                String   @unique   // used in subdomain
  logoUrl             String?
  isActive            Boolean  @default(true)
  config              Json?             // custom fields, rates, branding, etc.
  stripeCustomerId    String?   @unique // for billing
  stripeSubscriptionId String?  @unique
  billingEnabled      Boolean  @default(false) // per‑tenant toggle
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  users               User[]
  policyPlans         PolicyPlan[]
  // other relations
}
Add tenantId to all tenant‑owned models (User, Farmer, PolicyPlan, Policy, Claim, Payment, Notification, etc.) and index them.

Role enum update:

prisma
enum Role {
  PLATFORM_ADMIN   // global super‑admin
  TENANT_ADMIN     // admin of a tenant
  UNDERWRITER
  CLAIMS_OFFICER
  FIELD_AGENT
  FARMER
}
4. Database Migration from Single‑Tenant
Create a default tenant (e.g., name = "Default Insurance", slug = "default").

Add tenantId columns as nullable, populate with the default tenant’s ID for all existing rows.

Make the columns NOT NULL and add foreign keys.

Update all Prisma queries to filter by tenantId (retrieved from req.user.tenantId).

5. Onboarding Flow for a New Insurance Company
Step‑by‑Step (Platform Admin)
Create Tenant: Platform admin calls POST /api/v1/platform/tenants with name, slug, admin email, admin password.

Subdomain: The system automatically reserves the subdomain (e.g., slug.aims.com).

Tenant Admin Account: The system creates a TENANT_ADMIN user and sends a welcome email with login instructions.

Optional Seeding: Platform admin can pre‑seed the tenant with a starter set of policy plans.

Tenant Admin Actions (after first login)
Configure Settings: Upload logo, set custom fields (via UI that updates Tenant.config), adjust premium rate multipliers.

Import Policy Plans: Upload a CSV with columns: name, cropType, coveragePerAcre, premiumRate, minAreaAcres, maxAreaAcres, termMonths, description. The system validates and creates plans in bulk.

Import Farmers & Existing Policies: (Optional) Upload a CSV with farmer details (fullName, cnicNumber, address, etc.), land parcels, and existing policies. The system will create farmers, parcels, and policies (status = ACTIVE or EXPIRED) all linked to the tenant.

Add Staff: Invite underwriters, claims officers, field agents by email (they receive sign‑up links).

Go Live: The tenant is now fully operational.

6. Billing Module (Stripe Subscriptions)
Design: Tenants are charged a monthly subscription fee. Use Stripe Checkout to let tenants subscribe.

Feature Flag: A global BILLING_ENABLED (default false) and a per‑tenant billingEnabled field. When false, subscription logic is skipped.

Implementation: When a tenant is created, if billing is enabled, create a Stripe customer and a subscription. Store stripeCustomerId and stripeSubscriptionId on Tenant.

Webhooks: Handle subscription updates, cancellations, and payment failures. If a subscription expires, deactivate the tenant (or send reminders).

7. Subdomain Middleware
Write a middleware that extracts the subdomain from req.hostname.

If the subdomain is not www or api (or your platform domain), look up the tenant by slug.

Attach tenant to req and ensure the authenticated user belongs to that tenant.

Platform‑level endpoints (e.g., /api/v1/platform/*) should ignore subdomain and require PLATFORM_ADMIN role.

8. API Changes & New Endpoints
Platform‑level (prefix /api/v1/platform):

Method	Path	Description
POST	/tenants	Create tenant (with admin email/password)
GET	/tenants	List all tenants (paginated)
PATCH	/tenants/:id	Update tenant (name, slug, config, billing)
DELETE	/tenants/:id	Deactivate tenant
POST	/tenants/:id/seed	Seed tenant with default plans
Tenant‑scoped (prefix /api/v1/...) – all existing endpoints now filter by tenantId automatically.

Additional tenant admin endpoints:

Method	Path	Description
POST	/import/policy-plans	Bulk upload CSV/JSON for policy plans (async job)
POST	/import/farmers-policies	Bulk import farmers + existing policies
GET	/settings	Get tenant config
PATCH	/settings	Update tenant config
POST	/billing/subscribe	Initiate Stripe Checkout for subscription (if enabled)
POST	/billing/cancel	Cancel subscription
9. Build Order (Modules)
Follow this order, testing after each:

Database Schema: Add Tenant and tenantId; write migration and data migration script.

Auth & Tenant Middleware: Update requireAuth to attach tenantId; add subdomain extraction; implement requireTenantAccess guard.

Platform Admin – Tenant Management: CRUD endpoints for tenants.

Refactor All Services: Add tenantId filter to every Prisma query; ensure all endpoints respect tenant.

Tenant Settings & Config: Endpoints to read/update Tenant.config and branding.

Bulk Import (Policy Plans): CSV/JSON upload with BullMQ job; validation and creation.

Bulk Import (Farmers & Policies): Same as above.

Stripe Billing (Disabled by default): Integrate Stripe subscriptions, webhooks, toggle flag.

Subdomain Routing: Middleware to route based on subdomain.

Testing: Write tests that verify tenant isolation (user A can’t see user B’s data) and import process.

10. Standards (Same as Original PLAN.md)
Every foreign key has @@index.

List endpoints paginated.

No N+1 queries.

External API calls (OCR, email, import) in BullMQ jobs.

Redis caches tenant config and dashboard aggregates.

All validation with Zod.

Role guards on every route.

Central error handler.

11. Deliverables
Updated Prisma schema with multi‑tenant models.

Migration scripts to transform existing data.

New platform admin endpoints.

Import/export services with CSV/JSON support.

Stripe subscription code (feature‑flagged).

Subdomain middleware.

Updated tests (at least 80% coverage for tenant isolation).

12. Quick Start (After Setup)
bash
# Apply multi‑tenant migration
npx prisma migrate dev --name multi_tenant
# Run the data migration script (populate tenantId)
npm run migrate-data
# Start server
npm run dev
# Test subdomain locally by modifying /etc/hosts or using a tool like `localtunnel`
