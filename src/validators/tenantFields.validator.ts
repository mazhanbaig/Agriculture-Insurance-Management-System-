import { z } from "zod";

const VALID_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "dropdown",
  "file",
  "checkbox",
] as const;

export const createFieldSchema = z.object({
  fieldKey: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z_][a-z0-9_]*$/, "fieldKey must be snake_case starting with a letter"),
  label: z.string().min(1).max(100),
  fieldType: z.enum(VALID_FIELD_TYPES),
  options: z.array(z.union([z.string(), z.object({ label: z.string(), value: z.string() })])).optional(),
  required: z.boolean().optional().default(false),
  order: z.number().int().min(0).optional().default(0),
});

export const updateFieldSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  fieldType: z.enum(VALID_FIELD_TYPES).optional(),
  options: z
    .array(z.union([z.string(), z.object({ label: z.string(), value: z.string() })]))

    .optional(),
  required: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
