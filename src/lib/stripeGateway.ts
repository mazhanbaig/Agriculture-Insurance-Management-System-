import Stripe from "stripe";
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

const logger = pino({ name: "stripe-gateway" });

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  stripeInstance = new Stripe(key);
  return stripeInstance;
}

export class StripePaymentGateway implements PaymentGateway {
  readonly type = "stripe" as const;

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const stripe = getStripe();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: params.currency.toLowerCase(),
      description: params.description,
      metadata: params.metadata || {},
      receipt_email: params.email,
    });

    logger.info(
      { paymentIntentId: paymentIntent.id, amount: params.amount },
      "Stripe payment intent created"
    );

    return {
      gatewayTransactionId: paymentIntent.id,
      status: paymentIntent.status === "succeeded" ? "completed" : "pending",
      clientSecret: paymentIntent.client_secret || undefined,
      rawResponse: paymentIntent,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const stripe = getStripe();

    const paymentIntent = await stripe.paymentIntents.retrieve(
      params.gatewayTransactionId
    );

    return {
      verified: paymentIntent.status === "succeeded",
      status:
        paymentIntent.status === "succeeded"
          ? "completed"
          : paymentIntent.status === "requires_payment_method"
          ? "failed"
          : "pending",
      amount: paymentIntent.amount / 100,
      rawResponse: paymentIntent,
    };
  }

  async createPayout(params: CreatePayoutParams): Promise<PayoutResult> {
    const stripe = getStripe();

    const transfer = await stripe.transfers.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency.toLowerCase(),
      destination: params.destination,
      metadata: params.metadata || {},
    });

    logger.info(
      { transferId: transfer.id, amount: params.amount, destination: params.destination },
      "Stripe payout created"
    );

    return {
      gatewayTransactionId: transfer.id,
      status: "completed",
      rawResponse: transfer,
    };
  }

  async handleWebhook(payload: any, headers: any): Promise<WebhookResult> {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const event = stripe.webhooks.constructEvent(
      payload,
      headers["stripe-signature"],
      webhookSecret
    );

    return {
      type: event.type,
      data: event.data.object,
    };
  }
}
