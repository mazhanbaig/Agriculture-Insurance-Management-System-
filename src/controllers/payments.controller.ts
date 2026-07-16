import { Request, Response, NextFunction } from "express";
import * as paymentService from "../services/payments.service";

export async function createPaymentIntent(req: Request, res: Response, next: NextFunction) {
  try { const { policyId } = req.body; const result = await paymentService.createPremiumPayment(policyId, req.user!.tenantId); res.json({ status: "success", data: result }); }
  catch (error) { next(error); }
}

export async function confirmPayment(req: Request, res: Response, next: NextFunction) {
  try { const { paymentIntentId } = req.body; const policy = await paymentService.confirmPremiumPayment(paymentIntentId); res.json({ status: "success", data: policy }); }
  catch (error) { next(error); }
}

export async function processPayout(req: Request, res: Response, next: NextFunction) {
  try { const { claimId, amount } = req.body; const payment = await paymentService.processPayout(claimId, req.user!.tenantId, amount); res.json({ status: "success", data: payment }); }
  catch (error) { next(error); }
}

export async function getPolicyPayments(req: Request, res: Response, next: NextFunction) {
  try { const payments = await paymentService.getPaymentsForPolicy(String(req.params.policyId), req.user!.tenantId); res.json({ status: "success", data: payments }); }
  catch (error) { next(error); }
}

export async function getClaimPayments(req: Request, res: Response, next: NextFunction) {
  try { const payments = await paymentService.getPaymentsForClaim(String(req.params.claimId), req.user!.tenantId); res.json({ status: "success", data: payments }); }
  catch (error) { next(error); }
}
