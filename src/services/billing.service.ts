import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import Stripe from "stripe";
import pino from "pino";

const logger = pino({ name: "billing" });

let stripeInstance: Stripe | null = null;

/**
 * Get the singleton Stripe client.
 */
function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new AppError("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.", 500);
  }
  stripeInstance = new Stripe(key);
  return stripeInstance;
}

/**
 * Check if the billing system is globally enabled.
 * Controlled by the BILLING_ENABLED environment variable (default: "false").
 */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

/**
 * Assert that billing is enabled globally and for the given tenant.
 * Throws AppError if billing is disabled.
 */
function assertBillingEnabled(tenant?: { billingEnabled: boolean }): void {
  if (!isBillingEnabled()) {
    throw new AppError("Billing is not enabled on this platform", 403);
  }
  if (tenant && !tenant.billingEnabled) {
    throw new AppError("Billing is not enabled for this tenant", 403);
  }
}

/**
 * Get the Stripe price ID for tenant subscriptions.
 * Configured via STRIPE_SUBSCRIPTION_PRICE_ID env variable.
 */
function getSubscriptionPriceId(): string {
  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  if (!priceId) {
    throw new AppError(
      "Stripe subscription price not configured. Set STRIPE_SUBSCRIPTION_PRICE_ID.",
      500
    );
  }
  return priceId;
}

/**
 * Create a Stripe customer for a tenant and store the customer ID.
 * Called automatically when a tenant is created (if billing is enabled).
 */
export async function createStripeCustomer(tenantId: string): Promise<{ customerId: string }> {
  if (!isBillingEnabled()) {
    logger.info("Billing disabled — skipping Stripe customer creation");
    return { customerId: "" };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);
  if (tenant.stripeCustomerId) {
    return { customerId: tenant.stripeCustomerId };
  }

  const customer = await getStripe().customers.create({
    name: tenant.name,
    metadata: { tenantId: tenant.id },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeCustomerId: customer.id },
  });

  logger.info({ tenantId, customerId: customer.id }, "Stripe customer created");
  return { customerId: customer.id };
}

/**
 * Create a Stripe Checkout session for subscribing a tenant.
 * Returns the Checkout URL for redirect.
 */
export async function createSubscriptionSession(tenantId: string): Promise<{ url: string; sessionId: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);
  assertBillingEnabled(tenant);

  // Ensure customer exists
  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const result = await createStripeCustomer(tenantId);
    customerId = result.customerId;
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: getSubscriptionPriceId(), quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/settings/billing?success=true`,
    cancel_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/settings/billing?canceled=true`,
    metadata: { tenantId },
  });

  logger.info({ tenantId, sessionId: session.id }, "Subscription Checkout session created");
  return { url: session.url!, sessionId: session.id };
}

/**
 * Cancel the tenant's Stripe subscription.
 */
export async function cancelSubscription(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);
  assertBillingEnabled(tenant);

  if (!tenant.stripeSubscriptionId) {
    throw new AppError("No active subscription to cancel", 400);
  }

  await getStripe().subscriptions.cancel(tenant.stripeSubscriptionId);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeSubscriptionId: null, billingEnabled: false },
  });

  logger.info({ tenantId, subscriptionId: tenant.stripeSubscriptionId }, "Subscription cancelled");
}

/**
 * Get the tenant's subscription status from Stripe.
 */
export async function getSubscriptionStatus(tenantId: string): Promise<{
  active: boolean;
  plan: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError("Tenant not found", 404);

  if (!isBillingEnabled() || !tenant.billingEnabled) {
    return { active: false, plan: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }

  if (!tenant.stripeSubscriptionId) {
    return { active: false, plan: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }    try {
      const subscription = (await getStripe().subscriptions.retrieve(
        tenant.stripeSubscriptionId
      )) as any;
      return {
        active: subscription.status === "active" || subscription.status === "trialing",
        plan: subscription.items?.data?.[0]?.price?.nickname || null,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
  } catch (error) {
    logger.error({ error, tenantId }, "Failed to retrieve subscription status");
    return { active: false, plan: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }
}

// ---- Webhook Handling ----

/**
 * Process a Stripe webhook event.
 * Verifies the signature and handles relevant events:
 * - checkout.session.completed: Store subscription ID
 * - customer.subscription.updated: Handle status changes
 * - customer.subscription.deleted: Deactivate tenant billing
 * - invoice.payment_failed: Log warning
 */
export async function handleWebhookEvent(
  rawBody: string,
  signature: string
): Promise<{ received: boolean }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AppError("Stripe webhook secret not configured", 500);
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error: any) {
    throw new AppError(`Webhook signature verification failed: ${error.message}`, 400);
  }

  logger.info({ type: event.type, id: event.id }, "Processing Stripe webhook");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscriptionId = session.subscription as string;
        const tenantId = session.metadata?.tenantId;

        if (tenantId) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              stripeSubscriptionId: subscriptionId,
              billingEnabled: true,
            },
          });
          logger.info({ tenantId, subscriptionId }, "Subscription activated after checkout");
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenantId || (await findTenantBySubscription(subscription.id));

      if (tenantId) {
        const isActive = subscription.status === "active" || subscription.status === "trialing";
        if (!isActive) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: { billingEnabled: false },
          });
          logger.info({ tenantId, status: subscription.status }, "Tenant billing deactivated due to subscription status");
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenantId || (await findTenantBySubscription(subscription.id));

      if (tenantId) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { stripeSubscriptionId: null, billingEnabled: false },
        });
        logger.info({ tenantId }, "Tenant billing deactivated after subscription deletion");
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = invoice.metadata?.tenantId;

      if (tenantId) {
        logger.warn({ tenantId, invoiceId: invoice.id }, "Invoice payment failed for tenant");
      }
      break;
    }

    default:
      logger.info({ type: event.type }, "Unhandled webhook event type");
  }

  return { received: true };
}

/**
 * Find a tenant by their Stripe subscription ID.
 */
async function findTenantBySubscription(subscriptionId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true },
  });
  return tenant?.id || null;
}
