import { Request, Response, NextFunction } from "express";
import * as paymentService from "../services/payments.service";

export async function createPaymentIntent(req: Request, res: Response, next: NextFunction) {
  try { const { policyId } = req.body; const result = await paymentService.createPremiumPayment(policyId); res.json({ status: "success", data: result }); }
  catch (error) { next(error); }
}

export async function confirmPayment(req: Request, res: Response, next: NextFunction) {
  try { const { paymentIntentId } = req.body; const policy = await paymentService.confirmPremiumPayment(paymentIntentId); res.json({ status: "success", data: policy }); }
  catch (error) { next(error); }
}

export async function processPayout(req: Request, res: Response, next: NextFunction) {
  try { const { claimId, amount } = req.body; const payment = await paymentService.processPayout(claimId, amount); res.json({ status: "success", data: payment }); }
  catch (error) { next(error); }
}

export async function getPolicyPayments(req: Request, res: Response, next: NextFunction) {
  try { const payments = await paymentService.getPaymentsForPolicy(String(req.params.policyId)); res.json({ status: "success", data: payments }); }
  catch (error) { next(error); }
}

export async function getClaimPayments(req: Request, res: Response, next: NextFunction) {
  try { const payments = await paymentService.getPaymentsForClaim(String(req.params.claimId)); res.json({ status: "success", data: payments }); }
  catch (error) { next(error); }
}
