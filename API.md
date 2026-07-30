# API Routes Reference

All routes prefixed with `/api/v1`. Auth required unless marked `public`.

## Auth — `src/controllers/auth.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | public | Register new user |
| POST | `/auth/login` | public | Login (returns JWT) |
| GET | `/auth/me` | any | Get current user profile |
| PATCH | `/auth/profile` | any | Update profile |
| POST | `/auth/forgot-password` | public | Request password reset |
| POST | `/auth/oauth/callback` | public | OAuth provider callback |
| POST | `/auth/oauth/setup` | any | Complete OAuth setup (role/tenant) |

## Dev Auth — `src/controllers/dev-auth.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/dev/auth/login` | public | Dev bypass login (no password) |
| GET | `/dev/auth/users` | public | List all users (dev only) |

## Farmers — `src/controllers/farmers.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/farmers/profile` | FARMER | Get own profile |
| POST | `/farmers/profile` | FARMER | Create profile |
| PATCH | `/farmers/profile` | FARMER | Update profile |
| GET | `/farmers` | STAFF | List farmers (paginated) |
| GET | `/farmers/:id` | STAFF | Get farmer by ID |
| GET | `/farmers/fields/schema` | any | Get custom field schema |

## Land Parcels — `src/controllers/landParcels.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/land-parcels` | FARMER | List own parcels |
| GET | `/land-parcels/:id` | any | Get parcel |
| POST | `/land-parcels` | FARMER | Create parcel |
| PATCH | `/land-parcels/:id` | FARMER | Update parcel |
| DELETE | `/land-parcels/:id` | FARMER | Delete parcel |

## Policies — `src/controllers/policies.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/policies` | FARMER | List own policies |
| GET | `/policies/:id` | any | Get policy |
| POST | `/policies/purchase` | FARMER | Purchase policy |

## Policy Plans — `src/controllers/policyPlans.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/policy-plans` | any | List plans |
| GET | `/policy-plans/:id` | any | Get plan |
| POST | `/policy-plans` | ADMIN | Create plan |
| PATCH | `/policy-plans/:id` | ADMIN | Update plan |
| POST | `/policy-plans/quote` | any | Calculate quote |

## Claims — `src/controllers/claims.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/claims` | FARMER | List own claims |
| POST | `/claims` | FARMER | Create claim |
| GET | `/claims/:id` | any | Get claim |
| PATCH | `/claims/:id/status` | STAFF | Update claim status |
| PATCH | `/claims/:id/assign` | ADMIN | Assign claims officer |
| GET | `/claims/:id/fraud-analysis` | STAFF | Get fraud analysis |

## Documents — `src/controllers/documents.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/documents/upload` | any | Upload (multipart) |
| GET | `/documents/claim/:claimId` | any | List claim documents |
| GET | `/documents/:id` | any | Download |
| DELETE | `/documents/:id` | any | Delete |

## Notifications — `src/controllers/notifications.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/notifications` | any | List (paginated) |
| PATCH | `/notifications/read` | any | Mark specific as read |
| PATCH | `/notifications/read-all` | any | Mark all as read |
| GET | `/notifications/unread-count` | any | Get unread count |

## Admin — `src/controllers/admin.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/admin/dashboard` | STAFF | Dashboard aggregates |
| GET | `/admin/analytics/claims` | ADMIN | Claims analytics (cached) |
| GET | `/admin/staff` | ADMIN | List staff |
| GET | `/admin/staff/:id` | ADMIN | Get staff |
| POST | `/admin/staff` | ADMIN | Create staff |
| PATCH | `/admin/staff/:id/toggle-status` | ADMIN | Toggle active |

## Platform — `src/controllers/platform.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/platform/tenants` | PLATFORM_ADMIN | List tenants |
| GET | `/platform/tenants/:id` | PLATFORM_ADMIN | Get tenant |
| POST | `/platform/tenants` | PLATFORM_ADMIN | Create tenant |
| PATCH | `/platform/tenants/:id` | PLATFORM_ADMIN | Update tenant |
| POST | `/platform/tenants/:id/seed` | PLATFORM_ADMIN | Seed demo data |
| POST | `/platform/tenants/:id/approve` | PLATFORM_ADMIN | Approve |
| POST | `/platform/tenants/:id/suspend` | PLATFORM_ADMIN | Suspend |

## IAM — `src/controllers/iam.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/iam/roles` | ADMIN | List roles |
| GET | `/iam/roles/:id` | ADMIN | Get role |
| POST | `/iam/roles` | ADMIN | Create role |
| PATCH | `/iam/roles/:id` | ADMIN | Update role |
| DELETE | `/iam/roles/:id` | ADMIN | Delete role |
| POST | `/iam/roles/assign` | ADMIN | Assign role to user |
| GET | `/iam/permissions` | ADMIN | List all permissions |
| GET | `/iam/permissions/mine` | any | Get own permissions |

## Settings — `src/controllers/tenantSettings.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/settings` | ADMIN | Get settings |
| PATCH | `/settings` | ADMIN | Update settings |
| GET | `/settings/fraud-tier` | ADMIN | Get fraud tier config |
| PATCH | `/settings/fraud-tier` | ADMIN | Update fraud tier |

## Tenant Fields — `src/controllers/tenantFields.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/settings/fields` | ADMIN | List custom fields |
| GET | `/settings/fields/:id` | ADMIN | Get field |
| POST | `/settings/fields` | ADMIN | Create field |
| PATCH | `/settings/fields/:id` | ADMIN | Update field |
| DELETE | `/settings/fields/:id` | ADMIN | Delete field |

## Policy Requests — `src/controllers/policyRequests.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/policy-requests` | FARMER | List own requests |
| POST | `/policy-requests` | FARMER | Submit request |
| GET | `/policy-requests/:id` | any | Get request |
| PATCH | `/policy-requests/:id/status` | ADMIN | Review/approve/reject |

## Billing — `src/controllers/billing.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/billing/subscribe` | ADMIN | Subscribe to tier |
| POST | `/billing/cancel` | ADMIN | Cancel subscription |
| GET | `/billing/status` | ADMIN | Get subscription status |
| GET | `/billing/invoices` | ADMIN | List invoices |
| GET | `/billing/invoices/:id` | ADMIN | Get invoice |
| POST | `/billing/invoices/:id/pay` | ADMIN | Pay invoice |

## Chat — `src/controllers/chat.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/chat/conversations` | any | Get or create conversation |
| GET | `/chat/conversations` | any | List conversations |
| POST | `/chat/conversations/:id/messages` | any | Send message |
| GET | `/chat/conversations/:id/messages` | any | Get messages |

## Visits — `src/controllers/visits.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/visits` | STAFF | Schedule visit |
| PATCH | `/visits/:id/complete` | STAFF | Complete visit |
| PATCH | `/visits/:id/cancel` | STAFF | Cancel visit |
| GET | `/visits` | any | List visits |

## Damage — `src/controllers/damage.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/damage/assessment` | STAFF | Submit damage assessment |
| GET | `/damage/assessment/:claimId` | STAFF | Get assessment + fraud data |

## Payments — `src/controllers/payments.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/payments/premium` | FARMER | Create premium payment |
| POST | `/payments/confirm` | FARMER | Confirm payment |
| POST | `/payments/payout` | ADMIN | Process claim payout |
| GET | `/payments/policy/:policyId` | any | List policy payments |
| GET | `/payments/claim/:claimId` | any | List claim payments |

## Import — `src/controllers/import.controller.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/import/farmers` | ADMIN | Bulk import farmers |
| POST | `/import/policies` | ADMIN | Bulk import policies |

## Health — `src/server.ts`
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/health` | public | Health check |
