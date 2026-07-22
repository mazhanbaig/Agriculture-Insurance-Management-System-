import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole, requireTenantAccess } from "../middleware/roleGuard";
import { requireFarmerPaymentsEnabled } from "../middleware/featureFlags";
import * as paymentController from "../controllers/payments.controller";
import { validate } from "../middleware/validate";
import { createPaymentIntentSchema, processPayoutSchema } from "../validators/payments.validator";

const router = Router();
router.use(requireAuth);
router.use(requireTenantAccess);

// Farmer-facing payment routes — feature-flagged off by default
router.post("/create-payment-intent", requireFarmerPaymentsEnabled, requireRole("FARMER"), validate(createPaymentIntentSchema), paymentController.createPaymentIntent);
router.post("/confirm", requireFarmerPaymentsEnabled, requireRole("FARMER"), paymentController.confirmPayment);
router.post("/payout", requireFarmerPaymentsEnabled, requireRole("CLAIMS_OFFICER", "SENIOR_CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), validate(processPayoutSchema), paymentController.processPayout);

// Read-only payment routes — always available
router.get("/policy/:policyId", requireRole("FARMER", "TENANT_ADMIN", "PLATFORM_ADMIN"), paymentController.getPolicyPayments);
router.get("/claim/:claimId", requireRole("FARMER", "CLAIMS_OFFICER", "TENANT_ADMIN", "PLATFORM_ADMIN"), paymentController.getClaimPayments);
export default router;
