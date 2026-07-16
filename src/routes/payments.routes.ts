import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import * as paymentController from "../controllers/payments.controller";
import { validate } from "../middleware/validate";
import { createPaymentIntentSchema, processPayoutSchema } from "../validators/payments.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

router.post("/create-payment-intent", requireRole("FARMER"), validate(createPaymentIntentSchema), paymentController.createPaymentIntent);
router.post("/confirm", requireRole("FARMER"), paymentController.confirmPayment);
router.post("/payout", requireRole("CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), validate(processPayoutSchema), paymentController.processPayout);
router.get("/policy/:policyId", requireRole("FARMER", "TENANT_ADMIN", "PLATFORM_ADMIN"), paymentController.getPolicyPayments);
router.get("/claim/:claimId", requireRole("FARMER", "CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), paymentController.getClaimPayments);
export default router;
