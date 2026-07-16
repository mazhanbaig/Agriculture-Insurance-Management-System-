import { z } from "zod";

export const createFarmerSchema = z.object({
  fullName: z.string().min(1), guardianName: z.string().optional(), cnicNumber: z.string().min(13).max(15),
  dateOfBirth: z.string().datetime().optional(), gender: z.string().optional(), address: z.string().optional(),
  city: z.string().optional(), province: z.string().optional(), bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(), accountTitle: z.string().optional(), profilePhotoUrl: z.string().url().optional(),
});

export const updateFarmerSchema = z.object({
  fullName: z.string().min(1).optional(), guardianName: z.string().optional(), cnicNumber: z.string().min(13).max(15).optional(),
  dateOfBirth: z.string().datetime().optional(), gender: z.string().optional(), address: z.string().optional(),
  city: z.string().optional(), province: z.string().optional(), bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(), accountTitle: z.string().optional(), profilePhotoUrl: z.string().url().optional(),
});

export const createLandParcelSchema = z.object({
  landTitleNumber: z.string().optional(), address: z.string().min(1), latitude: z.number().optional(),
  longitude: z.number().optional(), areaAcres: z.number().positive(), soilType: z.string().optional(),
  cropType: z.string().min(1), irrigationType: z.string().optional(), ownershipType: z.string().optional(), district: z.string().optional(),
});

export const updateLandParcelSchema = z.object({
  landTitleNumber: z.string().optional(), address: z.string().min(1).optional(), latitude: z.number().optional(),
  longitude: z.number().optional(), areaAcres: z.number().positive().optional(), soilType: z.string().optional(),
  cropType: z.string().min(1).optional(), irrigationType: z.string().optional(), ownershipType: z.string().optional(), district: z.string().optional(),
});
