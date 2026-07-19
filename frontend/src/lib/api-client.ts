/**
 * AIMS Backend — Typed API Client
 *
 * This client provides type-safe access to every backend endpoint.
 * It is designed to work with any frontend framework (React, Vue, etc.)
 * or even Node.js scripts.
 *
 * Usage:
 *   import { api } from "./lib/api-client";
 *   const plans = await api.policyPlans.list();
 *   const quote = await api.policyPlans.quote({ policyPlanId: "...", areaAcres: 10 });
 */

// ─── Base Configuration ───────────────────────────────────────────────

export interface ApiConfig {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  tenantSlug?: string;
}

let config: ApiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1",
  getToken: async () => null,
};

export function configureApi(c: Partial<ApiConfig>): void {
  config = { ...config, ...c };
}

export function getConfig(): ApiConfig {
  return config;
}

// ─── HTTP Helpers ─────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: any,
  options?: { formData?: boolean }
): Promise<T> {
  const token = await config.getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (config.tenantSlug) headers["x-tenant-slug"] = config.tenantSlug;
  if (body && !options?.formData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: options?.formData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, errBody.error || errBody.message || "Request failed", errBody);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Type Definitions (mirrors backend Zod schemas) ───────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  status: "success";
  data: T;
}

// Auth
export interface User {
  id: string;
  authId: string;
  email: string;
  phone?: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
}

// Farmer
export interface Farmer {
  id: string;
  tenantId: string;
  userId: string;
  fullName: string;
  cnicNumber: string;
  // ... other fields
  customData?: Record<string, any>;
}

// Tenant Field
export interface TenantField {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: "text" | "number" | "date" | "dropdown" | "file" | "checkbox";
  options?: { label: string; value: string }[];
  required: boolean;
  order: number;
  isActive: boolean;
}

// Policy Plan
export interface PolicyPlan {
  id: string;
  tenantId: string;
  name: string;
  cropType: string;
  coveragePerAcre: number;
  premiumRate: number;
  minAreaAcres?: number;
  maxAreaAcres?: number;
  termMonths: number;
  description?: string;
  isActive: boolean;
  config?: {
    autoTrigger?: AutoTriggerConfig;
  };
}

export interface AutoTriggerConfig {
  enabled: boolean;
  ndviThreshold: number;
  weatherCheck: boolean;
  claimPercentage: number;
  autoApprove: boolean;
  autoApproveMaxScore: number;
}

export interface QuoteResult {
  policyPlanId: string;
  planName: string;
  areaAcres: number;
  coveragePerAcre: number;
  coverageAmount: number;
  premiumRate: number;
  premiumAmount: number;
  termMonths: number;
}

// Policy
export interface Policy {
  id: string;
  policyNumber: string;
  farmerId: string;
  policyPlanId: string;
  landParcelId: string;
  coverageAmount: number;
  premiumAmount: number;
  premiumPaid: boolean;
  startDate: string;
  endDate: string;
  status: string;
}

// Claim
export interface Claim {
  id: string;
  claimNumber: string;
  policyId: string;
  incidentType: string;
  incidentDate: string;
  description: string;
  claimedAmount: number;
  approvedAmount?: number;
  fraudScore?: number;
  fraudVerdict?: string;
  status: string;
}

// Custom Role (IAM)
export interface CustomRole {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
}

// Invoice
export interface Invoice {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  currency: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE";
  dueDate: string;
  lineItems: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
}

// Usage Summary
export interface UsageSummary {
  totalCalls: number;
  totalCost: number;
  byService: Record<string, { calls: number; cost: number }>;
  byDate: Record<string, { calls: number; cost: number }>;
}

// Tenant Settings
export interface TenantSettings {
  logoUrl?: string;
  name?: string;
  config: Record<string, any>;
}

// Notification
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ─── API Client ───────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

async function post<T>(path: string, body?: any): Promise<T> {
  return request<T>("POST", path, body);
}

async function patch<T>(path: string, body?: any): Promise<T> {
  return request<T>("PATCH", path, body);
}

async function del<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  return request<T>("POST", path, formData, { formData: true });
}

// ─── API Method Groups ────────────────────────────────────────────────

export const api = {
  // ─── Auth ───────────────────────────────────────────────────────
  auth: {
    me: () => get<ApiResponse<User>>("/auth/me"),
    updateProfile: (data: { phone?: string }) => patch<ApiResponse<User>>("/auth/profile", data),
    listUsers: (page = 1, limit = 20) =>
      get<PaginatedResponse<User>>(`/auth/users?page=${page}&limit=${limit}`),
    updateUserRole: (userId: string, role: string) =>
      patch<ApiResponse<User>>("/auth/role", { userId, role }),
  },

  // ─── Farmers ────────────────────────────────────────────────────
  farmers: {
    getFields: () => get<TenantField[]>("/farmers/fields"),
    getProfile: () => get<ApiResponse<Farmer>>("/farmers/profile"),
    createProfile: (data: any) => post<ApiResponse<Farmer>>("/farmers/profile", data),
    updateProfile: (data: any) => patch<ApiResponse<Farmer>>("/farmers/profile", data),
  },

  // ─── Land Parcels ───────────────────────────────────────────────
  landParcels: {
    list: (page = 1, limit = 20) =>
      get<PaginatedResponse<any>>(`/land-parcels?page=${page}&limit=${limit}`),
    get: (id: string) => get<ApiResponse<any>>(`/land-parcels/${id}`),
    create: (data: any) => post<ApiResponse<any>>("/land-parcels", data),
    update: (id: string, data: any) => patch<ApiResponse<any>>(`/land-parcels/${id}`, data),
    delete: (id: string) => del<ApiResponse<void>>(`/land-parcels/${id}`),
  },

  // ─── Policy Plans ───────────────────────────────────────────────
  policyPlans: {
    list: (page = 1, limit = 20) =>
      get<PaginatedResponse<PolicyPlan>>(`/policy-plans?page=${page}&limit=${limit}`),
    get: (id: string) => get<ApiResponse<PolicyPlan>>(`/policy-plans/${id}`),
    create: (data: any) => post<ApiResponse<PolicyPlan>>("/policy-plans", data),
    update: (id: string, data: any) => patch<ApiResponse<PolicyPlan>>(`/policy-plans/${id}`, data),
    quote: (data: { policyPlanId: string; areaAcres: number; termMonths?: number }) =>
      post<ApiResponse<QuoteResult>>("/policy-plans/quote", data),
  },

  // ─── Policies ───────────────────────────────────────────────────
  policies: {
    purchase: (data: { policyPlanId: string; landParcelId: string; startDate: string }) =>
      post<ApiResponse<Policy>>("/policies/purchase", data),
    listMy: () => get<ApiResponse<Policy[]>>("/policies/my"),
    getMy: (id: string) => get<ApiResponse<Policy>>(`/policies/my/${id}`),
  },

  // ─── Claims ─────────────────────────────────────────────────────
  claims: {
    create: (data: {
      policyId: string;
      incidentType: string;
      incidentDate: string;
      incidentLocation?: string;
      description: string;
      estimatedLossPercentage?: number;
      claimedAmount: number;
    }) => post<ApiResponse<Claim>>("/claims", data),
    listMy: () => get<ApiResponse<Claim[]>>("/claims/my"),
    getMy: (id: string) => get<ApiResponse<Claim>>(`/claims/my/${id}`),
    listAll: (page = 1, limit = 20) =>
      get<PaginatedResponse<Claim>>(`/claims?page=${page}&limit=${limit}`),
    get: (id: string) => get<ApiResponse<Claim>>(`/claims/${id}`),
    assign: (id: string, data: { claimsOfficerId: string }) =>
      patch<ApiResponse<Claim>>(`/claims/${id}/assign`, data),
    updateStatus: (id: string, data: { status: string; note?: string; approvedAmount?: number; rejectionReason?: string }) =>
      patch<ApiResponse<Claim>>(`/claims/${id}/status`, data),
  },

  // ─── Documents ──────────────────────────────────────────────────
  documents: {
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return upload<ApiResponse<any>>("/documents/upload", fd);
    },
    getClaimDocuments: (claimId: string) =>
      get<ApiResponse<any[]>>(`/documents/claim/${claimId}`),
    get: (id: string) => get<ApiResponse<any>>(`/documents/${id}`),
    delete: (id: string) => del<ApiResponse<void>>(`/documents/${id}`),
  },

  // ─── Payments ───────────────────────────────────────────────────
  payments: {
    createPaymentIntent: (data: { policyId: string }) =>
      post<ApiResponse<any>>("/payments/create-payment-intent", data),
    confirmPayment: () => post<ApiResponse<any>>("/payments/confirm"),
    processPayout: (claimId: string) =>
      post<ApiResponse<any>>(`/payments/payout/${claimId}`),
    getForPolicy: (policyId: string) =>
      get<ApiResponse<any[]>>(`/payments/policy/${policyId}`),
    getForClaim: (claimId: string) =>
      get<ApiResponse<any[]>>(`/payments/claim/${claimId}`),
  },

  // ─── Notifications ──────────────────────────────────────────────
  notifications: {
    list: (page = 1, limit = 20) =>
      get<PaginatedResponse<Notification>>(`/notifications?page=${page}&limit=${limit}`),
    markRead: (ids: string[]) =>
      patch<ApiResponse<void>>("/notifications/read", { ids }),
    markAllRead: () => patch<ApiResponse<void>>("/notifications/read-all"),
  },

  // ─── Admin ──────────────────────────────────────────────────────
  admin: {
    createStaff: (data: { email: string; role: string; name?: string }) =>
      post<ApiResponse<User>>("/admin/staff", data),
    listStaff: (page = 1, limit = 20) =>
      get<PaginatedResponse<User>>(`/admin/staff?page=${page}&limit=${limit}`),
    toggleStatus: (userId: string) =>
      patch<ApiResponse<User>>(`/admin/staff/${userId}/toggle-status`),
    dashboard: () => get<ApiResponse<any>>("/admin/dashboard"),
    claimsAnalytics: () => get<ApiResponse<any>>("/admin/analytics/claims"),
  },

  // ─── Platform (PLATFORM_ADMIN only) ─────────────────────────────
  platform: {
    createTenant: (data: { name: string; slug: string; adminEmail: string }) =>
      post<ApiResponse<any>>("/platform/tenants", data),
    listTenants: (page = 1, limit = 20) =>
      get<PaginatedResponse<any>>(`/platform/tenants?page=${page}&limit=${limit}`),
    getTenant: (id: string) => get<ApiResponse<any>>(`/platform/tenants/${id}`),
    updateTenant: (id: string, data: any) =>
      patch<ApiResponse<any>>(`/platform/tenants/${id}`, data),
    deactivateTenant: (id: string) =>
      del<ApiResponse<any>>(`/platform/tenants/${id}`),
    seedPlans: (id: string, data: any) =>
      post<ApiResponse<any>>(`/platform/tenants/${id}/seed`, data),
  },

  // ─── Settings ───────────────────────────────────────────────────
  settings: {
    get: () => get<ApiResponse<TenantSettings>>("/settings"),
    update: (data: any) => patch<ApiResponse<TenantSettings>>("/settings", data),
    getFraudTier: () => get<ApiResponse<any>>("/settings/fraud-tier"),
    updateFraudTier: (tier: "forge" | "titan" | "goat") =>
      patch<ApiResponse<any>>("/settings/fraud-tier", { tier }),
    getPaymentGateway: () => get<ApiResponse<any>>("/settings/payment-gateway"),
    updatePaymentGateway: (data: { gateway: string; currency?: string }) =>
      patch<ApiResponse<any>>("/settings/payment-gateway", data),
  },

  // ─── IAM (Custom Roles) ─────────────────────────────────────────
  iam: {
    listRoles: () => get<ApiResponse<CustomRole[]>>("/iam/roles"),
    getRole: (id: string) => get<ApiResponse<CustomRole>>(`/iam/roles/${id}`),
    createRole: (data: { name: string; description?: string; permissions: string[] }) =>
      post<ApiResponse<CustomRole>>("/iam/roles", data),
    updateRole: (id: string, data: any) =>
      patch<ApiResponse<CustomRole>>(`/iam/roles/${id}`, data),
    deleteRole: (id: string) => del<ApiResponse<void>>(`/iam/roles/${id}`),
    assignRole: (userId: string, customRoleId: string | null) =>
      post<ApiResponse<any>>("/iam/roles/assign", { userId, customRoleId }),
    listPermissions: () => get<ApiResponse<any>>("/iam/permissions"),
    myPermissions: () => get<ApiResponse<string[]>>("/iam/permissions/mine"),
  },

  // ─── Billing ────────────────────────────────────────────────────
  billing: {
    subscribe: () => post<ApiResponse<{ url: string; sessionId: string }>>("/billing/subscribe"),
    cancel: () => post<ApiResponse<void>>("/billing/cancel"),
    status: () => get<ApiResponse<any>>("/billing/status"),
    usage: (startDate?: string, endDate?: string) =>
      get<ApiResponse<UsageSummary>>(`/billing/usage?startDate=${startDate || ""}&endDate=${endDate || ""}`),
    listInvoices: (page = 1, limit = 20) =>
      get<PaginatedResponse<Invoice>>(`/billing/invoices?page=${page}&limit=${limit}`),
    getInvoice: (id: string) => get<ApiResponse<Invoice>>(`/billing/invoices/${id}`),
    payInvoice: (id: string) => post<ApiResponse<Invoice>>(`/billing/invoices/${id}/pay`),
    generateInvoice: () => post<ApiResponse<any>>("/billing/invoices/generate"),
  },

  // ─── Tenant Fields (Dynamic Farmer Fields) ──────────────────────
  tenantFields: {
    list: () => get<ApiResponse<TenantField[]>>("/settings/fields"),
    get: (id: string) => get<ApiResponse<TenantField>>(`/settings/fields/${id}`),
    create: (data: Omit<TenantField, "id" | "createdAt" | "updatedAt" | "tenantId">) =>
      post<ApiResponse<TenantField>>("/settings/fields", data),
    update: (id: string, data: any) =>
      patch<ApiResponse<TenantField>>(`/settings/fields/${id}`, data),
    delete: (id: string) => del<ApiResponse<void>>(`/settings/fields/${id}`),
  },

  // ─── Import ─────────────────────────────────────────────────────
  import: {
    policyPlans: (data: { records: any[]; format?: "csv" | "json" }) =>
      post<ApiResponse<any>>("/import/policy-plans", data),
    farmersPolicies: (data: { records: any[]; format?: "csv" | "json" }) =>
      post<ApiResponse<any>>("/import/farmers-policies", data),
  },

  // ─── Health ─────────────────────────────────────────────────────
  health: () => get<{ status: string; timestamp: string }>("/health"),
};
