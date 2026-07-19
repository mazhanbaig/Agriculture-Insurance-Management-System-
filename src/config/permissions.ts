/**
 * Permission definitions for the AIMS IAM system.
 *
 * Format: "resource:action" or "resource:action:scope"
 *
 * Scopes:
 *   - "own"     = only own records
 *   - "tenant"  = all records within the tenant
 *   - "all"     = all tenants (PLATFORM_ADMIN only)
 */

export const PERMISSIONS = {
  // ─── Claims ────────────────────────────────────────────────────
  CLAIM_VIEW_OWN: "claim:view:own",
  CLAIM_VIEW_TENANT: "claim:view:tenant",
  CLAIM_CREATE: "claim:create",
  CLAIM_APPROVE: "claim:approve",
  CLAIM_REJECT: "claim:reject",
  CLAIM_ASSIGN: "claim:assign",
  CLAIM_REVIEW: "claim:review",
  CLAIM_REQUEST_EVIDENCE: "claim:request_evidence",
  CLAIM_OVERRIDE: "claim:override", // SENIOR_CLAIMS_OFFICER only

  // ─── Farmers ───────────────────────────────────────────────────
  FARMER_VIEW_OWN: "farmer:view:own",
  FARMER_VIEW_TENANT: "farmer:view:tenant",
  FARMER_CREATE: "farmer:create",
  FARMER_UPDATE_OWN: "farmer:update:own",
  FARMER_UPDATE_TENANT: "farmer:update:tenant",

  // ─── Land Parcels ──────────────────────────────────────────────
  LAND_VIEW_OWN: "land:view:own",
  LAND_VIEW_TENANT: "land:view:tenant",
  LAND_CREATE: "land:create",
  LAND_UPDATE_OWN: "land:update:own",
  LAND_UPDATE_TENANT: "land:update:tenant",
  LAND_DELETE_OWN: "land:delete:own",
  LAND_DELETE_TENANT: "land:delete:tenant",

  // ─── Policy Plans ──────────────────────────────────────────────
  PLAN_VIEW: "plan:view",
  PLAN_CREATE: "plan:create",
  PLAN_UPDATE: "plan:update",
  PLAN_DELETE: "plan:delete",

  // ─── Policies ──────────────────────────────────────────────────
  POLICY_VIEW_OWN: "policy:view:own",
  POLICY_VIEW_TENANT: "policy:view:tenant",
  POLICY_PURCHASE: "policy:purchase",
  POLICY_MANAGE: "policy:manage",

  // ─── Payments ──────────────────────────────────────────────────
  PAYMENT_VIEW_OWN: "payment:view:own",
  PAYMENT_VIEW_TENANT: "payment:view:tenant",
  PAYMENT_CREATE: "payment:create",
  PAYMENT_PAYOUT: "payment:payout",

  // ─── Documents ─────────────────────────────────────────────────
  DOCUMENT_UPLOAD: "document:upload",
  DOCUMENT_VIEW_TENANT: "document:view:tenant",

  // ─── Notifications ─────────────────────────────────────────────
  NOTIFICATION_VIEW_OWN: "notification:view:own",
  NOTIFICATION_MARK_READ: "notification:mark_read",

  // ─── Admin ─────────────────────────────────────────────────────
  ADMIN_DASHBOARD: "admin:dashboard",
  ADMIN_STAFF: "admin:staff",
  ADMIN_ANALYTICS: "admin:analytics",
  ADMIN_SETTINGS: "admin:settings",

  // ─── Billing ───────────────────────────────────────────────────
  BILLING_SUBSCRIBE: "billing:subscribe",
  BILLING_CANCEL: "billing:cancel",
  BILLING_VIEW: "billing:view",

  // ─── Import ────────────────────────────────────────────────────
  IMPORT_PLAN: "import:plan",
  IMPORT_FARMER: "import:farmer",

  // ─── IAM (Custom Roles) ────────────────────────────────────────
  IAM_VIEW: "iam:view",
  IAM_MANAGE: "iam:manage",

  // ─── Platform (PLATFORM_ADMIN only) ────────────────────────────
  PLATFORM_TENANTS: "platform:tenants",
  PLATFORM_ANALYTICS: "platform:analytics",

  // ─── Settings ──────────────────────────────────────────────────
  SETTINGS_VIEW: "settings:view",
  SETTINGS_UPDATE: "settings:update",

  // ─── Fraud Tiers ──────────────────────────────────────────────
  FRAUD_TIER_VIEW: "fraud_tier:view",
  FRAUD_TIER_UPDATE: "fraud_tier:update",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default permissions for each built-in role.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  PLATFORM_ADMIN: Object.values(PERMISSIONS), // All permissions

  TENANT_ADMIN: [
    PERMISSIONS.CLAIM_VIEW_TENANT,
    PERMISSIONS.CLAIM_APPROVE,
    PERMISSIONS.CLAIM_REJECT,
    PERMISSIONS.CLAIM_ASSIGN,
    PERMISSIONS.CLAIM_OVERRIDE,
    PERMISSIONS.FARMER_VIEW_TENANT,
    PERMISSIONS.FARMER_CREATE,
    PERMISSIONS.FARMER_UPDATE_TENANT,
    PERMISSIONS.LAND_VIEW_TENANT,
    PERMISSIONS.LAND_CREATE,
    PERMISSIONS.LAND_UPDATE_TENANT,
    PERMISSIONS.LAND_DELETE_TENANT,
    PERMISSIONS.PLAN_VIEW,
    PERMISSIONS.PLAN_CREATE,
    PERMISSIONS.PLAN_UPDATE,
    PERMISSIONS.PLAN_DELETE,
    PERMISSIONS.POLICY_VIEW_TENANT,
    PERMISSIONS.POLICY_MANAGE,
    PERMISSIONS.PAYMENT_VIEW_TENANT,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_PAYOUT,
    PERMISSIONS.DOCUMENT_VIEW_TENANT,
    PERMISSIONS.ADMIN_DASHBOARD,
    PERMISSIONS.ADMIN_STAFF,
    PERMISSIONS.ADMIN_ANALYTICS,
    PERMISSIONS.ADMIN_SETTINGS,
    PERMISSIONS.BILLING_SUBSCRIBE,
    PERMISSIONS.BILLING_CANCEL,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.IMPORT_PLAN,
    PERMISSIONS.IMPORT_FARMER,
    PERMISSIONS.IAM_VIEW,
    PERMISSIONS.IAM_MANAGE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.FRAUD_TIER_VIEW,
    PERMISSIONS.FRAUD_TIER_UPDATE,
  ],

  UNDERWRITER: [
    PERMISSIONS.CLAIM_VIEW_TENANT,
    PERMISSIONS.FARMER_VIEW_TENANT,
    PERMISSIONS.FARMER_CREATE,
    PERMISSIONS.LAND_VIEW_TENANT,
    PERMISSIONS.LAND_CREATE,
    PERMISSIONS.PLAN_VIEW,
    PERMISSIONS.PLAN_CREATE,
    PERMISSIONS.PLAN_UPDATE,
    PERMISSIONS.POLICY_VIEW_TENANT,
    PERMISSIONS.POLICY_MANAGE,
    PERMISSIONS.DOCUMENT_VIEW_TENANT,
    PERMISSIONS.DOCUMENT_UPLOAD,
  ],

  CLAIMS_OFFICER: [
    PERMISSIONS.CLAIM_VIEW_TENANT,
    PERMISSIONS.CLAIM_REVIEW,
    PERMISSIONS.CLAIM_APPROVE,
    PERMISSIONS.CLAIM_REJECT,
    PERMISSIONS.CLAIM_ASSIGN,
    PERMISSIONS.CLAIM_REQUEST_EVIDENCE,
    PERMISSIONS.FARMER_VIEW_TENANT,
    PERMISSIONS.POLICY_VIEW_TENANT,
    PERMISSIONS.PAYMENT_VIEW_TENANT,
    PERMISSIONS.DOCUMENT_VIEW_TENANT,
    PERMISSIONS.DOCUMENT_UPLOAD,
  ],

  SENIOR_CLAIMS_OFFICER: [
    PERMISSIONS.CLAIM_VIEW_TENANT,
    PERMISSIONS.CLAIM_REVIEW,
    PERMISSIONS.CLAIM_APPROVE,
    PERMISSIONS.CLAIM_REJECT,
    PERMISSIONS.CLAIM_ASSIGN,
    PERMISSIONS.CLAIM_OVERRIDE,
    PERMISSIONS.CLAIM_REQUEST_EVIDENCE,
    PERMISSIONS.FARMER_VIEW_TENANT,
    PERMISSIONS.POLICY_VIEW_TENANT,
    PERMISSIONS.PAYMENT_VIEW_TENANT,
    PERMISSIONS.PAYMENT_PAYOUT,
    PERMISSIONS.DOCUMENT_VIEW_TENANT,
    PERMISSIONS.DOCUMENT_UPLOAD,
  ],

  FIELD_AGENT: [
    PERMISSIONS.CLAIM_VIEW_TENANT,
    PERMISSIONS.CLAIM_REVIEW,
    PERMISSIONS.CLAIM_REQUEST_EVIDENCE,
    PERMISSIONS.FARMER_VIEW_TENANT,
    PERMISSIONS.LAND_VIEW_TENANT,
    PERMISSIONS.DOCUMENT_VIEW_TENANT,
    PERMISSIONS.DOCUMENT_UPLOAD,
  ],

  FARMER: [
    PERMISSIONS.CLAIM_VIEW_OWN,
    PERMISSIONS.CLAIM_CREATE,
    PERMISSIONS.FARMER_VIEW_OWN,
    PERMISSIONS.FARMER_UPDATE_OWN,
    PERMISSIONS.LAND_VIEW_OWN,
    PERMISSIONS.LAND_CREATE,
    PERMISSIONS.LAND_UPDATE_OWN,
    PERMISSIONS.LAND_DELETE_OWN,
    PERMISSIONS.PLAN_VIEW,
    PERMISSIONS.POLICY_VIEW_OWN,
    PERMISSIONS.POLICY_PURCHASE,
    PERMISSIONS.PAYMENT_VIEW_OWN,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.NOTIFICATION_VIEW_OWN,
    PERMISSIONS.NOTIFICATION_MARK_READ,
    PERMISSIONS.SETTINGS_VIEW,
  ],
};

/**
 * Get the default permissions for a built-in role.
 * Returns empty array for unknown roles.
 */
export function getDefaultPermissionsForRole(role: string): Permission[] {
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}
