import { z } from "zod";

const dateOrDatetime = z.string().refine(
  (val) => !Number.isNaN(Date.parse(val)),
  { message: "Invalid date or datetime string" }
);

export const createFarmerSchema = z.object({
  fullName: z.string().min(1),
  guardianName: z.string().optional(),
  cnicNumber: z.string().min(13).max(15),
  dateOfBirth: dateOrDatetime.optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  accountTitle: z.string().optional(),
  profilePhotoUrl: z.string().url().optional(),
  customData: z.record(z.string(), z.any()).optional(),
});

export const updateFarmerSchema = z.object({
  fullName: z.string().min(1).optional(),
  guardianName: z.string().optional(),
  cnicNumber: z.string().min(13).max(15).optional(),
  dateOfBirth: dateOrDatetime.optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  accountTitle: z.string().optional(),
  profilePhotoUrl: z.string().url().optional(),
  customData: z.record(z.string(), z.any()).optional(),
});
