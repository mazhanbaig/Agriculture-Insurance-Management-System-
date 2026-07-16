# PROGRESS.md — Build progress tracker

## Setup
- [x] Folder structure scaffolded per PLAN.md (flat routes/controllers/services/validators)
- [x] `prisma/schema.prisma` written, migration SQL generated
- [x] All dependencies installed (Express, Prisma 7, Zod, BullMQ, Cloudinary, Stripe, etc.)
- Notes: Prisma 7.x uses `prisma.config.ts` instead of `url` in schema.prisma.

## Phase 1: Auth + User sync
- [x] Auth middleware (session verification via Stack Auth)
- [x] User sync on first login
- [x] Role guard middleware
- [x] Auth routes (me, profile, role management)

## Phase 2: Farmers + Land Parcels
- [x] Farmer profile CRUD
- [x] LandParcel CRUD
- Notes: Farmer and LandParcel split into separate service/controller/route files per flat structure.

## Phase 3: Policy Plans + Policies
- [x] PolicyPlan CRUD
- [x] Premium quote calculation
- [x] Policy purchase flow

## Phase 4: Claims core
- [x] Claim submission with duplicate check
- [x] ClaimStatusHistory on every status change
- [x] Claims Officer review endpoints (assign, approve, reject)

## Phase 5: Documents
- [x] Cloudinary signed upload with compression
- [x] ClaimDocument creation
- [x] OCR job queued (BullMQ)

## Phase 6: Payments
- [x] Stripe premium collection
- [x] Payout trigger on claim approval

## Phase 7: Notifications
- [x] Notification rows + email on status changes (async via BullMQ)

## Phase 8: Admin/Analytics
- [x] Staff account management
- [x] Dashboard aggregates with Redis caching

## Phase 9: Hardening
- [x] Rate limiting, helmet, cors
- [x] Jest + Supertest on claim state machine

## Deviations from PLAN.md
- Prisma 7.x: `url` removed from schema datasource. Created `prisma.config.ts` instead.
- Top-level await: Removed from prisma.ts. Moved Neon adapter to `getNeonPrisma()` factory.
- Zod 4: Used `z.ZodType` instead of `ZodSchema` import.
- ModuleResolution: Set to `node16` instead of `node` for TypeScript 5.x compatibility.
