import { Request, Response, NextFunction } from "express";
import { getGatewayByType } from "../lib/paymentGatewayFactory";
import { prisma } from "../lib/prisma";
import pino from "pino";

const logger = pino({ name: "gateway-webhook" });

/**
 * Generic webhook handler for Easypaisa and JazzCash.
 * Routes are: POST /api/v1/webhooks/easypaisa, POST /api/v1/webhooks/jazzcash
 */
export async function handleGatewayWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    // Determine which gateway from the URL path
    const pathParts = req.baseUrl.split("/");
    const gatewayType = pathParts[pathParts.length - 1] as "easypaisa" | "jazzcash";

    if (gatewayType !== "easypaisa" && gatewayType !== "jazzcash") {
      res.status(400).json({ status: "error", message: "Unknown gateway" });
      return;
    }

    const gateway = getGatewayByType(gatewayType);
    const result = await gateway.handleWebhook(req.body, req.headers);

    logger.info({ gatewayType, webhookType: result.type }, "Gateway webhook received");

    // Handle payment completion
    if (result.type === "payment.completed") {
      const txnId = result.data?.pp_TxnRefNo || result.data?.txnRefNo || result.data?.transactionId;
      if (txnId) {
        const payment = await prisma.payment.findFirst({
          where: { gatewayTransactionId: txnId },
        });
        if (payment && payment.status !== "completed") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "completed", paidAt: new Date() },
          });
          if (payment.policyId) {
            await prisma.policy.update({
              where: { id: payment.policyId },
              data: { premiumPaid: true, paymentDate: new Date() },
            });
          }
          logger.info({ paymentId: payment.id }, "Payment confirmed via gateway webhook");
        }
      }
    }

    res.json({ status: "ok", received: true });
  } catch (error) {
    logger.error({ error }, "Gateway webhook processing failed");
    next(error);
  }
}
