import { z } from "zod";

export const createFarmerSchema = z.object({
  fullName: z.string().min(1),
  guardianName: z.string().optional(),
  cnicNumber: z.string().min(13).max(15),
  dateOfBirth: z.string().datetime().optional(),
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
  dateOfBirth: z.string().datetime().optional(),
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
