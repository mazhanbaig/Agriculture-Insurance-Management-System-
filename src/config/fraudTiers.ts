/**
 * Fraud tier configuration for AIMS.
 *
 * Each tier maps to different OpenRouter models with fallback chains
 * and associated costs for usage-based billing.
 *
 * FORGE  — Budget tier. Fast, cheap models (Gemini Flash + Llama).
 * TITAN  — Balanced tier. High-quality multimodal models (GPT-4o mini, Claude Haiku).
 * GOAT   — Maximum accuracy. Best models with full fallback chain (GPT-4o, Claude Sonnet).
 */

export type FraudTier = "forge" | "titan" | "goat";

export interface FraudTierConfig {
  name: string;
  label: string;
  description: string;
  baseMonthlyFee: number;
  /** Primary model for image analysis */
  primaryModel: string;
  /** Fallback model if primary fails or times out */
  fallbackModel: string;
  /** Cost per image analysis call (USD) */
  imageCostPerCall: number;
  /** Cost per video analysis call (USD) */
  videoCostPerCall: number;
  /** Cost per satellite NDVI check (USD) — third-party API */
  satelliteCostPerCall: number;
  /** Cost per weather verification call (USD) — third-party API */
  weatherCostPerCall: number;
  /** Maximum images to analyze per claim */
  maxImagesPerClaim: number;
  /** Whether to run satellite NDVI checks */
  satelliteEnabled: boolean;
  /** Whether to run weather verification */
  weatherEnabled: boolean;
  /** Markup multiplier applied to tier costs for billing */
  markupMultiplier: number;
}

export const FRAUD_TIERS: Record<FraudTier, FraudTierConfig> = {
  forge: {
    name: "forge",
    label: "FORGE",
    description: "Budget fraud detection with fast, cheap models",
    baseMonthlyFee: 0,
    primaryModel: "google/gemini-2.0-flash-001",
    fallbackModel: "meta-llama/llama-3.2-90b-vision",
    imageCostPerCall: 0.001,
    videoCostPerCall: 0.005,
    satelliteCostPerCall: 0.02,
    weatherCostPerCall: 0.001,
    maxImagesPerClaim: 3,
    satelliteEnabled: true,
    weatherEnabled: true,
    markupMultiplier: 1.0,
  },
  titan: {
    name: "titan",
    label: "TITAN",
    description: "Balanced fraud detection with high-quality multimodal models",
    baseMonthlyFee: 99,
    primaryModel: "openai/gpt-4o-mini",
    fallbackModel: "anthropic/claude-3-haiku",
    imageCostPerCall: 0.005,
    videoCostPerCall: 0.02,
    satelliteCostPerCall: 0.02,
    weatherCostPerCall: 0.001,
    maxImagesPerClaim: 5,
    satelliteEnabled: true,
    weatherEnabled: true,
    markupMultiplier: 1.5,
  },
  goat: {
    name: "goat",
    label: "GOAT",
    description: "Maximum accuracy — best models with full fallback chain",
    baseMonthlyFee: 499,
    primaryModel: "openai/gpt-4o",
    fallbackModel: "anthropic/claude-3.5-sonnet",
    imageCostPerCall: 0.015,
    videoCostPerCall: 0.05,
    satelliteCostPerCall: 0.05,
    weatherCostPerCall: 0.002,
    maxImagesPerClaim: 10,
    satelliteEnabled: true,
    weatherEnabled: true,
    markupMultiplier: 2.0,
  },
};

/**
 * Get the default tier configuration (FORGE).
 */
export function getDefaultFraudTier(): FraudTierConfig {
  return FRAUD_TIERS.forge;
}

/**
 * Get a tier config by name, falling back to FORGE if invalid.
 */
export function getFraudTierConfig(tierName: string): FraudTierConfig {
  const key = tierName.toLowerCase() as FraudTier;
  return FRAUD_TIERS[key] || FRAUD_TIERS.forge;
}
