import { prisma } from "./prisma";
import {
  type PaymentGateway,
  type GatewayType,
  getGatewayConfig,
} from "../config/paymentGateways";

export type { GatewayType } from "../config/paymentGateways";
import { StripePaymentGateway } from "./stripeGateway";
import { EasypaisaPaymentGateway } from "./easypaisaGateway";
import { JazzCashPaymentGateway } from "./jazzcashGateway";
import { AppError } from "../middleware/errorHandler";
import pino from "pino";

const logger = pino({ name: "payment-gateway-factory" });

// Singleton instances
const instances: Partial<Record<GatewayType, PaymentGateway>> = {};

/**
 * Get the payment gateway adapter for a tenant.
 *
 * Reads Tenant.config.paymentGateway to determine which provider to use.
 * Defaults to Stripe if not configured.
 */
export async function getPaymentGateway(tenantId: string): Promise<PaymentGateway> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  if (!tenant) throw new AppError("Tenant not found", 404);

  const gwConfig = getGatewayConfig(tenant.config as Record<string, any>);

  if (!gwConfig.enabled) {
    throw new AppError("Payment gateway is disabled for this tenant", 403);
  }

  return getGatewayByType(gwConfig.type);
}

/**
 * Get a gateway adapter by type (with singleton caching).
 */
export function getGatewayByType(type: GatewayType): PaymentGateway {
  if (instances[type]) return instances[type]!;

  let gateway: PaymentGateway;

  switch (type) {
    case "stripe":
      gateway = new StripePaymentGateway();
      break;
    case "easypaisa":
      gateway = new EasypaisaPaymentGateway();
      break;
    case "jazzcash":
      gateway = new JazzCashPaymentGateway();
      break;
    default:
      throw new AppError(`Unknown payment gateway type: ${type}`, 400);
  }

  instances[type] = gateway;
  logger.info({ type }, "Payment gateway initialized");
  return gateway;
}

/**
 * List all available payment gateways with their status for a tenant.
 */
export async function listAvailableGateways(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  if (!tenant) throw new AppError("Tenant not found", 404);

  const gwConfig = getGatewayConfig(tenant.config as Record<string, any>);

  return {
    currentGateway: gwConfig.type,
    gateways: [
      {
        type: "stripe",
        label: "Stripe",
        enabled: gwConfig.type === "stripe" && gwConfig.enabled,
        available: !!process.env.STRIPE_SECRET_KEY,
        currencies: ["usd", "eur", "gbp"],
      },
      {
        type: "easypaisa",
        label: "Easypaisa",
        enabled: gwConfig.type === "easypaisa" && gwConfig.enabled,
        available: !!process.env.EASYPAISA_API_KEY,
        currencies: ["pkr"],
      },
      {
        type: "jazzcash",
        label: "JazzCash",
        enabled: gwConfig.type === "jazzcash" && gwConfig.enabled,
        available: !!process.env.JAZZCASH_API_KEY,
        currencies: ["pkr"],
      },
    ],
  };
}

/**
 * Update the payment gateway for a tenant.
 */
export async function updatePaymentGateway(
  tenantId: string,
  gatewayType: GatewayType,
  currency?: string
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true },
  });
  if (!tenant) throw new AppError("Tenant not found", 404);

  const existingConfig = (tenant.config as Record<string, any>) || {};

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      config: {
        ...existingConfig,
        paymentGateway: {
          type: gatewayType,
          enabled: true,
          currency: currency || (gatewayType === "stripe" ? "usd" : "pkr"),
        },
      },
    },
  });

  logger.info({ tenantId, gatewayType }, "Payment gateway updated");

  return getGatewayByType(gatewayType).type;
}
