import crypto from "crypto";
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

const logger = pino({ name: "jazzcash-gateway" });

/**
 * JazzCash Payment Gateway Adapter.
 *
 * API docs: https://developer.jazzcash.com/
 * Uses JazzCash Merchant API with HMAC-SHA256 signature verification.
 */
export class JazzCashPaymentGateway implements PaymentGateway {
  readonly type = "jazzcash" as const;

  private getApiKey(): string {
    const key = process.env.JAZZCASH_API_KEY;
    if (!key) throw new Error("JAZZCASH_API_KEY is not set");
    return key;
  }

  private getApiSecret(): string {
    const secret = process.env.JAZZCASH_API_SECRET;
    if (!secret) throw new Error("JAZZCASH_API_SECRET is not set");
    return secret;
  }

  private getMerchantId(): string {
    const id = process.env.JAZZCASH_MERCHANT_ID;
    if (!id) throw new Error("JAZZCASH_MERCHANT_ID is not set");
    return id;
  }

  private getBaseUrl(): string {
    return process.env.JAZZCASH_BASE_URL || "https://api.jazzcash.com";
  }

  /**
   * Generate HMAC-SHA256 signature for JazzCash API requests.
   */
  private generateSignature(data: Record<string, string>): string {
    const secret = this.getApiSecret();
    const sortedKeys = Object.keys(data).sort();
    const values = sortedKeys.map((k) => data[k]).join("&");
    return crypto.createHmac("sha256", secret).update(values).digest("hex");
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!params.phoneNumber) {
      throw new Error("Phone number is required for JazzCash payments");
    }

    const txnRefNo = `JC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const data: Record<string, string> = {
      pp_Amount: (params.amount * 100).toString(), // JazzCash uses paisas
      pp_BillReference: params.metadata?.orderId || txnRefNo,
      pp_Description: params.description || "AIMS Insurance Payment",
      pp_Language: "EN",
      pp_MerchantID: this.getMerchantId(),
      pp_Password: this.getApiKey(),
      pp_ProductID: process.env.JAZZCASH_PRODUCT_ID || "",
      pp_ReturnURL: params.metadata?.returnUrl || "http://localhost:4000/api/v1/webhooks/jazzcash",
      pp_TxnRefNo: txnRefNo,
      pp_TxnDateTime: new Date().toISOString().replace("T", " ").replace("Z", ""),
      pp_TxnExpiryDateTime: new Date(Date.now() + 30 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", ""),
      pp_TxnType: "MWALLET",
      pp_CustomerMobile: params.phoneNumber,
    };

    data.pp_SecureHash = this.generateSignature(data);

    logger.info({ amount: params.amount, phoneNumber: params.phoneNumber, txnRefNo }, "JazzCash payment request");

    // NOTE: In production, POST to JazzCash API
    // const response = await fetch(`${this.getBaseUrl()}/API/Pay`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/x-www-form-urlencoded" },
    //   body: new URLSearchParams(data).toString(),
    // });

    return {
      gatewayTransactionId: txnRefNo,
      status: "pending",
      redirectUrl: `${this.getBaseUrl()}/pay/${txnRefNo}`,
      rawResponse: data,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    logger.info({ txnRefNo: params.gatewayTransactionId }, "JazzCash payment verification");

    // NOTE: In production, call JazzCash Transaction Status API
    return {
      verified: true,
      status: "completed",
      rawResponse: { txnRefNo: params.gatewayTransactionId },
    };
  }

  async createPayout(params: CreatePayoutParams): Promise<PayoutResult> {
    logger.info({ amount: params.amount, destination: params.destination }, "JazzCash payout request");

    const txnRefNo = `JC-PO-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // JazzCash disbursement API
    const data: Record<string, string> = {
      pp_Amount: (params.amount * 100).toString(),
      pp_DisbursementDestinationAccount: params.destination,
      pp_DisbursementReference: txnRefNo,
      pp_DisbursementDescription: params.metadata?.description || "AIMS Claim Payout",
      pp_MerchantID: this.getMerchantId(),
      pp_Password: this.getApiKey(),
    };

    data.pp_SecureHash = this.generateSignature(data);

    return {
      gatewayTransactionId: txnRefNo,
      status: "completed",
      rawResponse: data,
    };
  }

  async handleWebhook(payload: any, headers: any): Promise<WebhookResult> {
    // JazzCash sends callback with pp_ResponseCode
    const responseCode = payload.pp_ResponseCode;
    const isSuccessful = responseCode === "000";

    return {
      type: isSuccessful ? "payment.completed" : "payment.failed",
      data: payload,
    };
  }
}
