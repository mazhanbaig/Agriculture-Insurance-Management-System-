import { z } from "zod";

export const createLandParcelSchema = z.object({
  landTitleNumber: z.string().optional(),
  address: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  areaAcres: z.number().positive(),
  soilType: z.string().optional(),
  cropType: z.string().min(1),
  irrigationType: z.string().optional(),
  ownershipType: z.string().optional(),
  district: z.string().optional(),
});

export const updateLandParcelSchema = z.object({
  landTitleNumber: z.string().optional(),
  address: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  areaAcres: z.number().positive().optional(),
  soilType: z.string().optional(),
  cropType: z.string().min(1).optional(),
  irrigationType: z.string().optional(),
  ownershipType: z.string().optional(),
  district: z.string().optional(),
});
