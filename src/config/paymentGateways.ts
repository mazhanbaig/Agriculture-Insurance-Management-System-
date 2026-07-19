/**
 * Payment Gateway abstraction for AIMS.
 *
 * Provides a unified interface across multiple payment providers:
 * - Stripe (international)
 * - Easypaisa (Pakistan mobile wallet)
 * - JazzCash (Pakistan mobile wallet)
 *
 * Each gateway implements the same interface, and the factory
 * selects the appropriate one based on Tenant.config.paymentGateway.
 */

// ─── Types ───────────────────────────────────────────────────────

export type GatewayType = "stripe" | "easypaisa" | "jazzcash";

export interface CreatePaymentParams {
  amount: number; // in base currency units (e.g., PKR or USD)
  currency: string; // "usd", "pkr"
  description?: string;
  metadata?: Record<string, string>;
  /** Farmer's phone number (required for mobile wallets) */
  phoneNumber?: string;
  /** Farmer's email (for Stripe receipts) */
  email?: string;
}

export interface PaymentResult {
  gatewayTransactionId: string;
  status: "pending" | "completed" | "failed";
  clientSecret?: string; // For Stripe PaymentIntent
  redirectUrl?: string;  // For mobile wallet redirects
  rawResponse?: any;
}

export interface CreatePayoutParams {
  amount: number;
  currency: string;
  /** Destination account (Stripe Connect account, mobile wallet number, etc.) */
  destination: string;
  metadata?: Record<string, string>;
}

export interface PayoutResult {
  gatewayTransactionId: string;
  status: "completed" | "failed";
  rawResponse?: any;
}

export interface VerifyPaymentParams {
  gatewayTransactionId: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  status: "completed" | "failed" | "pending";
  amount?: number;
  rawResponse?: any;
}

/**
 * The gateway adapter interface that all providers must implement.
 */
export interface PaymentGateway {
  readonly type: GatewayType;

  /** Create a payment intent / request */
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;

  /** Verify / confirm a payment */
  verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;

  /** Create a payout transfer */
  createPayout(params: CreatePayoutParams): Promise<PayoutResult>;

  /** Handle a webhook event from this gateway */
  handleWebhook(payload: any, headers: any): Promise<WebhookResult>;
}

export interface WebhookResult {
  type: string;
  data: any;
}

// ─── Gateway Configuration ───────────────────────────────────────

export interface GatewayConfig {
  /** Which gateway to use */
  type: GatewayType;
  /** Whether this gateway is enabled */
  enabled: boolean;
  /** Currency this gateway operates in */
  currency: string;
}

/**
 * Get the payment gateway configuration for a tenant.
 * Falls back to Stripe if not configured.
 */
export function getGatewayConfig(tenantConfig: Record<string, any> | null): GatewayConfig {
  const gw = (tenantConfig as any)?.paymentGateway;
  return {
    type: gw?.type || "stripe",
    enabled: gw?.enabled ?? true,
    currency: gw?.currency || "usd",
  };
}
