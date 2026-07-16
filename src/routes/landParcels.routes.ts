import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleGuard";
import * as landParcelController from "../controllers/landParcels.controller";
import { validate } from "../middleware/validate";
import { createLandParcelSchema, updateLandParcelSchema } from "../validators/landParcels.validator";

const router = Router();
router.use(requireAuth);
router.use(requireRole("FARMER"));
router.get("/", landParcelController.getParcels);
router.get("/:id", landParcelController.getParcel);
router.post("/", validate(createLandParcelSchema), landParcelController.createParcel);
router.patch("/:id", validate(updateLandParcelSchema), landParcelController.updateParcel);
router.delete("/:id", landParcelController.deleteParcel);
export default router;
