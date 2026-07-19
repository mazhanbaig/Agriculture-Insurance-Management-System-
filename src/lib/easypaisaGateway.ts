import pino from "pino";
import {
  type PaymentGateway,
  type CreatePaymentParams,
  type PaymentResult,
  type CreatePayoutParams,
  type PayoutResult,
  type VerifyPaymentParams,
  type VerifyPaymentResult,
  type WebhookResult,
} from "../config/paymentGateways";

const logger = pino({ name: "easypaisa-gateway" });

/**
 * Easypaisa Payment Gateway Adapter.
 *
 * API docs: https://developers.easypaisa.com/
 * Uses the Easypaisa Merchant API for payments and payouts.
 */
export class EasypaisaPaymentGateway implements PaymentGateway {
  readonly type = "easypaisa" as const;

  private getApiKey(): string {
    const key = process.env.EASYPAISA_API_KEY;
    if (!key) throw new Error("EASYPAISA_API_KEY is not set");
    return key;
  }

  private getApiSecret(): string {
    const secret = process.env.EASYPAISA_API_SECRET;
    if (!secret) throw new Error("EASYPAISA_API_SECRET is not set");
    return secret;
  }

  private getBaseUrl(): string {
    return process.env.EASYPAISA_BASE_URL || "https://api.easypaisa.com";
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!params.phoneNumber) {
      throw new Error("Phone number is required for Easypaisa payments");
    }

    // Easypaisa API call structure
    const payload = {
      amount: params.amount.toString(),
      mobileNo: params.phoneNumber,
      storeId: process.env.EASYPAISA_STORE_ID || "",
      orderId: params.metadata?.orderId || `EP-${Date.now()}`,
      txnDate: new Date().toISOString().split("T")[0],
      productCode: process.env.EASYPAISA_PRODUCT_CODE || "",
    };

    logger.info({ amount: params.amount, phoneNumber: params.phoneNumber }, "Easypaisa payment request");

    // NOTE: In production, make the actual HTTP call to Easypaisa API
    // const response = await fetch(`${this.getBaseUrl()}/api/v1/payment`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Authorization": `Bearer ${this.getApiKey()}`,
    //   },
    //   body: JSON.stringify(payload),
    // });

    // For now, return a simulated result
    const txnId = `EP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    return {
      gatewayTransactionId: txnId,
      status: "pending",
      redirectUrl: `${this.getBaseUrl()}/pay/${txnId}`,
      rawResponse: payload,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    logger.info({ txnId: params.gatewayTransactionId }, "Easypaisa payment verification");

    // NOTE: In production, call Easypaisa API to check transaction status
    // const response = await fetch(`${this.getBaseUrl()}/api/v1/status/${params.gatewayTransactionId}`, {
    //   headers: { "Authorization": `Bearer ${this.getApiKey()}` },
    // });

    return {
      verified: true,
      status: "completed",
      rawResponse: { txnId: params.gatewayTransactionId },
    };
  }

  async createPayout(params: CreatePayoutParams): Promise<PayoutResult> {
    logger.info({ amount: params.amount, destination: params.destination }, "Easypaisa payout request");

    // Easypaisa disbursement API
    const payload = {
      amount: params.amount.toString(),
      mobileNo: params.destination,
      orderId: params.metadata?.orderId || `EP-PO-${Date.now()}`,
    };

    // NOTE: In production, call Easypaisa disbursement API
    const txnId = `EP-PO-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    return {
      gatewayTransactionId: txnId,
      status: "completed",
      rawResponse: payload,
    };
  }

  async handleWebhook(payload: any, _headers: any): Promise<WebhookResult> {
    // Easypaisa sends webhook callbacks for transaction status
    return {
      type: payload.eventType || "payment.completed",
      data: payload,
    };
  }
}
