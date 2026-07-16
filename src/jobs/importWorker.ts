import { Job } from "bullmq";
import { importPolicyPlans, importFarmersPolicies } from "../services/import.service";
import pino from "pino";

const logger = pino({ name: "import-worker" });

interface PolicyPlanImportJob {
  type: "policy-plans";
  tenantId: string;
  format: string;
  data: string;
  columnMapping?: Record<string, string>;
  userId: string;
}

interface FarmersPoliciesImportJob {
  type: "farmers-policies";
  tenantId: string;
  format: string;
  data: string;
  columnMapping?: Record<string, string>;
  userId: string;
}

type ImportJobData = PolicyPlanImportJob | FarmersPoliciesImportJob;

/**
 * Process a bulk import job.
 * Handles both policy plan imports and farmer/policy imports.
 */
export async function processImportJob(job: Job<ImportJobData>): Promise<void> {
  const { type, tenantId, format, data, columnMapping } = job.data;

  logger.info({ jobId: job.id, type, tenantId }, "Processing import job");

  try {
    if (type === "policy-plans") {
      const result = await importPolicyPlans(tenantId, format, data, columnMapping);
      logger.info(
        { jobId: job.id, imported: result.imported, errors: result.errors.length },
        "Policy plan import completed"
      );
      await job.updateProgress(100);
    } else if (type === "farmers-policies") {
      const result = await importFarmersPolicies(tenantId, format, data, columnMapping);
      logger.info(
        { jobId: job.id, imported: result.imported, errors: result.errors.length },
        "Farmers/policies import completed"
      );
      await job.updateProgress(100);
    }
  } catch (error) {
    logger.error({ error, jobId: job.id, type }, "Import job failed");
    throw error;
  }
}
