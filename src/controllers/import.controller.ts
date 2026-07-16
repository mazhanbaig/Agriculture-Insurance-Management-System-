import { Request, Response, NextFunction } from "express";
import * as importService from "../services/import.service";
import { importQueue } from "../lib/bullmq";

/**
 * Estimate record count from import data string.
 * For CSV, counts lines minus header. For JSON, estimates from line count.
 * This is a rough heuristic for deciding sync vs async processing.
 */
function estimateRecordCount(data: string, format: string): number {
  if (format === "csv") {
    const lines = data.split("\n").filter((l) => l.trim().length > 0);
    return Math.max(0, lines.length - 1); // subtract header row
  }
  // For JSON, count "{" or "{" occurrences as rough record estimate
  const matches = data.match(/{/g);
  return matches ? Math.ceil(matches.length / 3) : 0;
}

/**
 * Upload and process a policy plan import.
 * For small payloads (< 50 records), processes synchronously.
 * For larger payloads, queues a BullMQ job.
 */
export async function importPolicyPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const { format, data, columnMapping } = req.body;
    const tenantId = req.user!.tenantId;
    const records = estimateRecordCount(data, format);

    if (records <= 50) {
      // Process synchronously for small imports
      const result = await importService.importPolicyPlans(tenantId, format, data, columnMapping);
      res.json({ status: "success", data: result });
    } else {
      // Queue async job for large imports
      const job = await importQueue.add("import-policy-plans", {
        type: "policy-plans" as const,
        tenantId,
        format,
        data,
        columnMapping,
        userId: req.user!.id,
      });
      res.json({
        status: "success",
        message: "Import queued for processing",
        data: { jobId: job.id },
      });
    }
  } catch (error) { next(error); }
}

/**
 * Upload and process a farmers & policies import.
 * For small payloads (< 50 records), processes synchronously.
 * For larger payloads, queues a BullMQ job.
 */
export async function importFarmersPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const { format, data, columnMapping } = req.body;
    const tenantId = req.user!.tenantId;
    const records = estimateRecordCount(data, format);

    if (records <= 50) {
      // Process synchronously for small imports
      const result = await importService.importFarmersPolicies(tenantId, format, data, columnMapping);
      res.json({ status: "success", data: result });
    } else {
      // Queue async job for large imports
      const job = await importQueue.add("import-farmers-policies", {
        type: "farmers-policies" as const,
        tenantId,
        format,
        data,
        columnMapping,
        userId: req.user!.id,
      });
      res.json({
        status: "success",
        message: "Import queued for processing",
        data: { jobId: job.id },
      });
    }
  } catch (error) { next(error); }
}
