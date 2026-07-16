# PLAN.md — Agricultural Insurance Management System (Backend)

This file is the single source of truth for building this backend. Follow it module by module, in order. Do not skip ahead. After finishing each module, update `PROGRESS.md` and re-read the "Standards" section below before starting the next module.

## System type
Single-tenant B2B insurance management software. One insurer operates this system internally. Admin/Underwriter/Claims Officer/Field Agent are the insurer's own staff, not external companies. No multi-tenant logic, no external insurer integration.

## Tech stack
- Frontend: Next.js + TypeScript (built separately, not in this plan)
- Backend: Express + TypeScript
- Database: Neon (serverless Postgres) + Prisma ORM
- Auth: Neon Auth (Stack Auth under the hood), same Neon project as the DB
- Storage: Cloudinary (photos, ID docs, land records)
- Queue/async: BullMQ + Redis
- Validation: Zod
- Payments: Stripe (sandbox)
- Notifications: Resend/Nodemailer (email), Twilio (SMS, optional)
- Logging: Pino
- Testing: Jest + Supertest

## Roles
1. Farmer — customer, manages own land/policies/claims only
2. Underwriter — manages PolicyPlan catalog, reviews/approves policy issuance
3. Claims Officer / Adjuster — reviews and resolves claims
4. Field Agent — uploads on-ground inspection evidence for claims
5. Admin / Super Admin — manages staff accounts, full analytics, no direct claim/policy handling

MVP note: build Farmer, Claims Officer, Admin as fully separate dashboards/permissions first. Underwriter and Field Agent exist as real role enum values and real schema fields from day one, but their permissions can be covered by Admin in the UI until there's time to build their dedicated views. Never fake this in the schema, only in what UI is wired up.

## Data model (Prisma schema, write this first)

```prisma
enum Role {
  FARMER
  UNDERWRITER
  CLAIMS_OFFICER
  FIELD_AGENT
  ADMIN
}

enum PolicyStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}

enum ClaimStatus {
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  PAID
}

enum PaymentType {
  PREMIUM
  PAYOUT
}

model User {
  id            String   @id @default(uuid())
  authId        String   @unique   // Neon Auth user id
  email         String   @unique
  phone         String?
  role          Role
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastLoginAt   DateTime?

  farmer        Farmer?
  notifications Notification[]
  claimStatusChanges ClaimStatusHistory[]
  uploadedDocuments  ClaimDocument[]
  assignedClaims     Claim[] @relation("AssignedOfficer")
  underwrittenPolicies Policy[] @relation("Underwriter")
}

model Farmer {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  fullName        String
  guardianName    String?
  cnicNumber      String   @unique
  dateOfBirth     DateTime?
  gender          String?
  address         String?
  city            String?
  province        String?
  bankName        String?
  bankAccountNumber String?
  accountTitle    String?
  profilePhotoUrl String?
  createdAt       DateTime @default(now())

  landParcels     LandParcel[]
  policies        Policy[]
  claims          Claim[]
}

model LandParcel {
  id              String   @id @default(uuid())
  farmerId        String
  farmer          Farmer   @relation(fields: [farmerId], references: [id])
  landTitleNumber String?
  address         String
  latitude        Float?
  longitude       Float?
  areaAcres       Float
  soilType        String?
  cropType        String
  irrigationType  String?
  ownershipType   String?
  district         String?
  createdAt       DateTime @default(now())

  policies        Policy[]
}

model PolicyPlan {
  id               String   @id @default(uuid())
  name             String
  cropType         String
  coveragePerAcre  Float
  premiumRate      Float
  minAreaAcres     Float?
  maxAreaAcres     Float?
  termMonths       Int
  description      String?
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())

  policies         Policy[]
}

model Policy {
  id             String       @id @default(uuid())
  policyNumber   String       @unique
  farmerId       String
  farmer         Farmer       @relation(fields: [farmerId], references: [id])
  landParcelId   String
  landParcel     LandParcel   @relation(fields: [landParcelId], references: [id])
  policyPlanId   String
  policyPlan     PolicyPlan   @relation(fields: [policyPlanId], references: [id])
  underwriterId  String?
  underwriter    User?        @relation("Underwriter", fields: [underwriterId], references: [id])
  coverageAmount Float
  premiumAmount  Float
  premiumPaid    Boolean      @default(false)
  paymentDate    DateTime?
  startDate      DateTime
  endDate        DateTime
  status         PolicyStatus @default(ACTIVE)
  certificateUrl String?
  createdAt      DateTime     @default(now())

  claims         Claim[]
  payments       Payment[]

  @@index([farmerId])
  @@index([status])
}

model Claim {
  id                      String      @id @default(uuid())
  claimNumber             String      @unique
  policyId                String
  policy                  Policy      @relation(fields: [policyId], references: [id])
  farmerId                String
  farmer                  Farmer      @relation(fields: [farmerId], references: [id])
  assignedClaimsOfficerId String?
  assignedClaimsOfficer   User?       @relation("AssignedOfficer", fields: [assignedClaimsOfficerId], references: [id])
  incidentType            String
  incidentDate            DateTime
  incidentLocation        String?
  description             String
  estimatedLossPercentage Float?
  claimedAmount           Float
  approvedAmount          Float?
  status                  ClaimStatus @default(SUBMITTED)
  rejectionReason         String?
  submittedAt             DateTime    @default(now())
  resolvedAt              DateTime?

  documents               ClaimDocument[]
  statusHistory           ClaimStatusHistory[]
  payments                Payment[]

  @@index([policyId])
  @@index([status])
  @@index([farmerId])
}

model ClaimDocument {
  id               String   @id @default(uuid())
  claimId          String
  claim            Claim    @relation(fields: [claimId], references: [id])
  uploadedByUserId String
  uploadedBy       User     @relation(fields: [uploadedByUserId], references: [id])
  url              String
  type             String
  fileSize         Int?
  mimeType         String?
  ocrExtractedData Json?
  uploadedAt       DateTime @default(now())

  @@index([claimId])
}

model ClaimStatusHistory {
  id            String   @id @default(uuid())
  claimId       String
  claim         Claim    @relation(fields: [claimId], references: [id])
  fromStatus    String
  toStatus      String
  changedByUserId String
  changedBy     User     @relation(fields: [changedByUserId], references: [id])
  note          String?
  changedAt     DateTime @default(now())

  @@index([claimId])
}

model Payment {
  id                    String      @id @default(uuid())
  policyId              String?
  policy                Policy?     @relation(fields: [policyId], references: [id])
  claimId               String?
  claim                 Claim?      @relation(fields: [claimId], references: [id])
  type                  PaymentType
  amount                Float
  gatewayTransactionId  String?
  status                String
  paidAt                DateTime?
  createdAt             DateTime    @default(now())
}

model Notification {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  type              String
  title             String
  message           String
  isRead            Boolean  @default(false)
  relatedEntityType String?
  relatedEntityId   String?
  createdAt         DateTime @default(now())

  @@index([userId, isRead])
}
```

## Folder structure (traditional Express layout, not modular)

```
/src
  /routes
    auth.routes.ts
    farmers.routes.ts
    landParcels.routes.ts
    policyPlans.routes.ts
    policies.routes.ts
    claims.routes.ts
    documents.routes.ts
    payments.routes.ts
    notifications.routes.ts
    admin.routes.ts
  /controllers
    auth.controller.ts
    farmers.controller.ts
    landParcels.controller.ts
    policyPlans.controller.ts
    policies.controller.ts
    claims.controller.ts
    documents.controller.ts
    payments.controller.ts
    notifications.controller.ts
    admin.controller.ts
  /services            (business logic, one file per domain area, same names as controllers)
  /validators           (Zod schemas, one file per domain area, same names as controllers)
  /middleware           (authGuard.ts, roleGuard.ts, errorHandler.ts, rateLimiter.ts)
  /lib                  (prisma.ts, cloudinary.ts, redis.ts, queues.ts — client singletons)
  /jobs                 (ocrWorker.ts, notificationWorker.ts)
  /utils
  /types
  server.ts
/prisma
  schema.prisma
/tests
```

One file per domain area per layer (route, controller, service, validator), named consistently (`claims.routes.ts` → `claims.controller.ts` → `claims.service.ts` → `claims.validator.ts`). `server.ts` wires up all routers with `app.use('/api/claims', claimsRouter)` etc. No per-feature folders, no barrel files, no nested subfolders inside `/routes`, `/controllers`, `/services`, or `/validators`.

## Build order (do not reorder)

**Phase 1: Auth + User sync**
- Neon Auth session verification middleware
- On first login, create/sync local `User` row (authId, email, role)
- Role guard middleware (`requireRole(...roles)`)

**Phase 2: Farmers + Land Parcels**
- Farmer profile CRUD (self-service, farmer role only)
- LandParcel CRUD (tied to farmer)

**Phase 3: Policy Plans + Policies**
- PolicyPlan CRUD (Underwriter/Admin only)
- Premium quote calculation endpoint
- Policy purchase flow (creates Policy, status ACTIVE, generates policyNumber)

**Phase 4: Claims core**
- Claim submission (Farmer)
- Duplicate check on submission (same policyId + overlapping incidentDate window)
- ClaimStatusHistory write on every status change
- Claims Officer review endpoints (assign, request more evidence, approve, reject)

**Phase 5: Documents**
- Cloudinary signed upload endpoint
- ClaimDocument creation on upload
- OCR job queued (BullMQ) on document upload, writes back to `ocrExtractedData`

**Phase 6: Payments**
- Stripe sandbox integration: premium collection on policy purchase
- Payout trigger on claim approval

**Phase 7: Notifications**
- Notification row created + email sent on every Claim/Policy status change (async job)

**Phase 8: Admin/Analytics**
- Staff account management (create Underwriter/Claims Officer/Field Agent/Admin users)
- Dashboard aggregates: claims by crop/region/month, approval rate, avg settlement time

**Phase 9: Hardening**
- Rate limiting, helmet, cors lockdown
- Jest + Supertest on the claim state machine specifically (this is the module most worth testing)

## Standards (apply to every module, no exceptions)

**Performance (non-negotiable, do not simplify these away):**
- Every foreign key column that's queried on has a Prisma `@@index`
- List endpoints are paginated (cursor or offset+limit), never return unbounded arrays
- No N+1 queries: use Prisma `include`/`select` deliberately, never loop-and-query
- OCR, email, SMS, and any external API call happen in a BullMQ job, never inline in the request/response cycle
- Redis caches PolicyPlan catalog and admin dashboard aggregates (short TTL, a few minutes)
- Connection pooling handled by Neon's serverless driver, not raw pg connections

**Code readability (beginner-friendly, this is about clarity, not performance):**
- Every service function does one thing, named for what it does (`createClaim`, not `handleClaim`)
- No cleverness: prefer a few extra lines that are obvious over a dense one-liner
- Comments explain *why*, not *what* (the code should already say what)
- Consistent error handling: every module throws typed errors caught by one central error-handling middleware, never scattered try/catch with different response shapes

**Validation & security:**
- Every route validates its body/query with Zod before touching Prisma
- Every route has an explicit role guard, even ones that feel "obviously fine"
- Never trust a farmerId/claimId from the request body if it can be derived from the authenticated session instead

**No unnecessary files:** don't create a file unless a module in this plan calls for it. No placeholder files, no "future" empty folders.

## After every module

1. Run the full test suite, not just the new module's tests
2. Update `PROGRESS.md`: mark the module done, note any deviation from this plan and why
3. Re-read the Standards section above before starting the next module
4. If a change in one module affects an already-built module's contract (a field renamed, an endpoint shape changed), fix the earlier module now, not later, and note it in `PROGRESS.md`