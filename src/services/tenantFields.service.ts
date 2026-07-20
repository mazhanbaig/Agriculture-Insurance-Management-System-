import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import logger from "../utils/logger";

/**
 * List all active custom fields for a tenant.
 * Used by TENANT_ADMIN for management and by farmer registration to render form.
 */
export async function listTenantFields(tenantId: string) {
  return prisma.tenantField.findMany({
    where: { tenantId, isActive: true },
    orderBy: { order: "asc" },
  });
}

/**
 * Get a single tenant field by ID.
 */
export async function getTenantField(tenantId: string, fieldId: string) {
  const field = await prisma.tenantField.findFirst({
    where: { id: fieldId, tenantId },
  });
  if (!field) throw new AppError("Field not found", 404);
  return field;
}

/**
 * Create a new custom field for a tenant.
 */
export async function createTenantField(
  tenantId: string,
  data: {
    fieldKey: string;
    label: string;
    fieldType: string;
    options?: any;
    required?: boolean;
    order?: number;
  }
) {
  // Check for duplicate fieldKey within tenant
  const existing = await prisma.tenantField.findUnique({
    where: { tenantId_fieldKey: { tenantId, fieldKey: data.fieldKey } },
  });
  if (existing) throw new AppError("A field with this key already exists", 409);

  return prisma.tenantField.create({
    data: {
      tenantId,
      ...data,
      options: data.options || undefined,
    },
  });
}

/**
 * Update an existing custom field.
 */
export async function updateTenantField(
  tenantId: string,
  fieldId: string,
  data: {
    label?: string;
    fieldType?: string;
    options?: any;
    required?: boolean;
    order?: number;
    isActive?: boolean;
  }
) {
  const field = await prisma.tenantField.findFirst({
    where: { id: fieldId, tenantId },
  });
  if (!field) throw new AppError("Field not found", 404);

  return prisma.tenantField.update({
    where: { id: fieldId },
    data,
  });
}

/**
 * Delete (soft-deactivate) a custom field.
 */
export async function deleteTenantField(tenantId: string, fieldId: string) {
  const field = await prisma.tenantField.findFirst({
    where: { id: fieldId, tenantId },
  });
  if (!field) throw new AppError("Field not found", 404);

  // Soft-delete by deactivating — preserves existing farmer data
  return prisma.tenantField.update({
    where: { id: fieldId },
    data: { isActive: false },
  });
}

/**
 * Check that all required custom fields are satisfied.
 * Throws AppError if any required field is missing and not provided.
 */
export async function assertRequiredCustomFields(
  tenantId: string,
  customData: Record<string, any> | undefined
): Promise<void> {
  const fields = await prisma.tenantField.findMany({
    where: { tenantId, isActive: true, required: true },
  });

  if (fields.length === 0) return;

  const errors: string[] = [];
  for (const field of fields) {
    const value = customData?.[field.fieldKey];
    if (value === undefined || value === null || value === "") {
      errors.push(`"${field.label}" (${field.fieldKey}) is required`);
    }
  }

  if (errors.length > 0) {
    throw new AppError(`Validation failed: ${errors.join("; ")}`, 400);
  }
}

/**
 * Validate customData against the tenant's field schema.
 * Returns the validated data ready for storage.
 * Throws AppError if validation fails.
 */
export async function validateCustomData(
  tenantId: string,
  customData: Record<string, any> | undefined
): Promise<Record<string, any> | undefined> {
  if (!customData || Object.keys(customData).length === 0) {
    return undefined;
  }

  const fields = await prisma.tenantField.findMany({
    where: { tenantId, isActive: true },
  });

  if (fields.length === 0) {
    throw new AppError("No custom fields configured for this tenant", 400);
  }

  const fieldMap = new Map(fields.map((f: any) => [f.fieldKey, f]));
  const validated: Record<string, any> = {};
  const errors: string[] = [];

  for (const field of fields) {
    const value = customData[field.fieldKey];

    if (field.required && (value === undefined || value === null || value === "")) {
      errors.push(`"${field.label}" (${field.fieldKey}) is required`);
      continue;
    }

    if (value === undefined || value === null || value === "") {
      continue; // Skip optional empty fields
    }

    // Validate type
    switch (field.fieldType) {
      case "number": {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`"${field.label}" must be a number`);
        } else {
          validated[field.fieldKey] = num;
        }
        break;
      }
      case "date": {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push(`"${field.label}" must be a valid date`);
        } else {
          validated[field.fieldKey] = date.toISOString();
        }
        break;
      }
      case "dropdown": {
        if (field.options && Array.isArray(field.options)) {
          const validOptions = field.options.map((o: any) =>
            typeof o === "string" ? o : o.value
          );
          if (!validOptions.includes(value)) {
            errors.push(
              `"${field.label}" must be one of: ${validOptions.join(", ")}`
            );
          } else {
            validated[field.fieldKey] = value;
          }
        } else {
          validated[field.fieldKey] = value;
        }
        break;
      }
      case "checkbox": {
        validated[field.fieldKey] = Boolean(value);
        break;
      }
      case "text":
      default: {
        validated[field.fieldKey] = String(value);
        break;
      }
    }
  }

  // Check for unknown fields
  for (const key of Object.keys(customData)) {
    if (!fieldMap.has(key)) {
      errors.push(`Unknown field: "${key}"`);
    }
  }

  if (errors.length > 0) {
    throw new AppError(`Validation failed: ${errors.join("; ")}`, 400);
  }

  return validated;
}

/**
 * Save custom field values for a farmer.
 * Replaces all existing values atomically.
 */
export async function saveFarmerFieldValues(
  farmerId: string,
  customData: Record<string, any> | undefined
): Promise<void> {
  if (!customData || Object.keys(customData).length === 0) return;

  // Atomically replace all existing values
  const [{ count }] = await prisma.$transaction([
    prisma.farmerFieldValue.deleteMany({ where: { farmerId } }),
    ...(Object.entries(customData).length > 0
      ? [
          prisma.farmerFieldValue.createMany({
            data: Object.entries(customData).map(([fieldKey, value]) => ({
              farmerId,
              fieldKey,
              value,
            })),
          }),
        ]
      : []),
  ]);

  if (count > 0) {
    logger.debug({ farmerId, deletedCount: count }, "Cleared existing custom field values before save");
  }
}

/**
 * Get the field values for a farmer as a flat key-value map.
 */
export async function getFarmerFieldValues(farmerId: string) {
  const values = await prisma.farmerFieldValue.findMany({
    where: { farmerId },
  });

  const result: Record<string, any> = {};
  for (const v of values) {
    result[v.fieldKey] = v.value;
  }
  return result;
}
