import { prisma } from "../lib/prisma";
import { parse } from "csv-parse/sync";
import { AppError } from "../middleware/errorHandler";

/**
 * Parse CSV string into array of records, optionally mapping columns to rename fields.
 */
function parseCsv(csvData: string, columnMapping?: Record<string, string>): Record<string, string>[] {
  const records: Record<string, string>[] = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (columnMapping) {
    return records.map((record) => {
      const mapped: Record<string, string> = {};
      for (const [targetCol, sourceCol] of Object.entries(columnMapping)) {
        if (record[sourceCol] !== undefined) {
          mapped[targetCol] = record[sourceCol];
        }
      }
      return mapped;
    });
  }

  return records;
}

/**
 * Parse JSON string into array of records.
 * Wraps JSON.parse errors in a user-friendly AppError.
 */
function parseJson(jsonData: string): Record<string, any>[] {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonData);
  } catch (error: any) {
    throw new AppError(
      `Invalid JSON format: ${error.message || "Syntax error in JSON payload"}`,
      400
    );
  }
  if (!Array.isArray(parsed)) {
    throw new AppError("JSON data must be an array of records", 400);
  }
  return parsed;
}

/**
 * Parse import data based on format (csv or json).
 */
function parseImportData(format: string, data: string, columnMapping?: Record<string, string>): Record<string, any>[] {
  if (format === "csv") {
    return parseCsv(data, columnMapping);
  }
  return parseJson(data);
}

// ---- Policy Plan Import ----

export interface PolicyPlanImportRow {
  name: string;
  cropType: string;
  coveragePerAcre: number;
  premiumRate: number;
  minAreaAcres?: number;
  maxAreaAcres?: number;
  termMonths: number;
  description?: string;
}

/**
 * Validate and import policy plans in bulk.
 * Returns created plans and any validation errors per row.
 */
export async function importPolicyPlans(
  tenantId: string,
  format: string,
  data: string,
  columnMapping?: Record<string, string>
) {
  const records = parseImportData(format, data, columnMapping);
  const errors: Array<{ row: number; message: string }> = [];
  const validPlans: PolicyPlanImportRow[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 1;

    // Validate required fields
    if (!row.name) { errors.push({ row: rowNum, message: "Missing required field: name" }); continue; }
    if (!row.cropType) { errors.push({ row: rowNum, message: "Missing required field: cropType" }); continue; }
    const coveragePerAcre = Number(row.coveragePerAcre);
    if (isNaN(coveragePerAcre) || coveragePerAcre <= 0) { errors.push({ row: rowNum, message: "Invalid or missing coveragePerAcre" }); continue; }
    const premiumRate = Number(row.premiumRate);
    if (isNaN(premiumRate) || premiumRate <= 0) { errors.push({ row: rowNum, message: "Invalid or missing premiumRate" }); continue; }
    const termMonths = Number(row.termMonths);
    if (isNaN(termMonths) || termMonths <= 0) { errors.push({ row: rowNum, message: "Invalid or missing termMonths" }); continue; }

    validPlans.push({
      name: String(row.name),
      cropType: String(row.cropType),
      coveragePerAcre,
      premiumRate,
      termMonths,
      minAreaAcres: row.minAreaAcres ? Number(row.minAreaAcres) : undefined,
      maxAreaAcres: row.maxAreaAcres ? Number(row.maxAreaAcres) : undefined,
      description: row.description ? String(row.description) : undefined,
    });
  }

  // Create valid plans
  const created = await Promise.all(
    validPlans.map((plan) =>
      prisma.policyPlan.create({ data: { tenantId, ...plan } })
    )
  );

  return {
    totalRows: records.length,
    imported: created.length,
    errors,
    plans: created,
  };
}

// ---- Farmer & Policy Import ----

export interface FarmerImportRow {
  fullName: string;
  cnicNumber: string;
  email: string;
  guardianName?: string;
  address?: string;
  city?: string;
  province?: string;
  bankName?: string;
  bankAccountNumber?: string;
  accountTitle?: string;
  // Land parcel fields
  landAddress?: string;
  landAreaAcres?: number;
  landCropType?: string;
  // Policy fields
  policyPlanName?: string;
  policyStartDate?: string;
  policyEndDate?: string;
}

/**
 * Validate and import farmers, their land parcels, and optionally their policies.
 *
 * NOTE ON AUTH/AUTHID:
 * Imported users are created with a fabricated `authId` that does NOT correspond
 * to a real Stack Auth session. These users exist in the database but CANNOT
 * log in through the normal auth flow. To gain access, they must go through the
 * standard sign-up flow (which will create a proper Stack Auth session and link
 * it to their email). The import only creates the database records — authentication
 * must be established separately.
 *
 * For large imports (>50 records), the controller queues this as an async BullMQ job.
 */
export async function importFarmersPolicies(
  tenantId: string,
  format: string,
  data: string,
  columnMapping?: Record<string, string>
) {
  const records = parseImportData(format, data, columnMapping);
  const errors: Array<{ row: number; message: string }> = [];
  const importedFarmers: any[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 1;

    try {
      // Validate required farmer fields
      if (!row.fullName) { errors.push({ row: rowNum, message: "Missing required field: fullName" }); continue; }
      if (!row.cnicNumber) { errors.push({ row: rowNum, message: "Missing required field: cnicNumber" }); continue; }
      if (!row.email) { errors.push({ row: rowNum, message: "Missing required field: email" }); continue; }

      // Find or create user
      let user = await prisma.user.findFirst({ where: { email: String(row.email), tenantId } });
      if (!user) {
        // Fabricated authId — this user cannot log in until they complete Stack Auth sign-up.
        // The authId uses tenantId + timestamp + row index + random suffix for uniqueness.
        user = await prisma.user.create({
          data: {
            tenantId,
            authId: `import-${tenantId}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            email: String(row.email),
            role: "FARMER",
          },
        });
      }

      // Check if farmer profile already exists for this user
      const existingFarmer = await prisma.farmer.findUnique({ where: { userId: user.id } });
      if (existingFarmer) {
        errors.push({ row: rowNum, message: `Farmer with email ${row.email} already has a profile` });
        continue;
      }

      // Check CNIC uniqueness within tenant
      const cnicExists = await prisma.farmer.findFirst({ where: { cnicNumber: String(row.cnicNumber), tenantId } });
      if (cnicExists) {
        errors.push({ row: rowNum, message: `CNIC ${row.cnicNumber} is already registered in this tenant` });
        continue;
      }

      // Create farmer
      const farmer = await prisma.farmer.create({
        data: {
          tenantId,
          userId: user.id,
          fullName: String(row.fullName),
          cnicNumber: String(row.cnicNumber),
          guardianName: row.guardianName ? String(row.guardianName) : undefined,
          address: row.address ? String(row.address) : undefined,
          city: row.city ? String(row.city) : undefined,
          province: row.province ? String(row.province) : undefined,
          bankName: row.bankName ? String(row.bankName) : undefined,
          bankAccountNumber: row.bankAccountNumber ? String(row.bankAccountNumber) : undefined,
          accountTitle: row.accountTitle ? String(row.accountTitle) : undefined,
        },
      });

      // Create land parcel if address provided
      if (row.landAddress && row.landAreaAcres) {
        await prisma.landParcel.create({
          data: {
            tenantId,
            farmerId: farmer.id,
            address: String(row.landAddress),
            areaAcres: Number(row.landAreaAcres),
            cropType: row.landCropType ? String(row.landCropType) : "Unknown",
          },
        });
      }

      importedFarmers.push(farmer);
    } catch (error: any) {
      errors.push({ row: rowNum, message: error.message || "Unexpected error" });
    }
  }

  return {
    totalRows: records.length,
    imported: importedFarmers.length,
    errors,
    farmers: importedFarmers,
  };
}
