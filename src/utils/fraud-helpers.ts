/**
 * Fraud verdict thresholds.
 */
export const FRAUD_THRESHOLDS = {
  LOW: { min: 0, max: 20, verdict: "LOW" },
  MEDIUM: { min: 21, max: 50, verdict: "MEDIUM" },
  HIGH: { min: 51, max: 75, verdict: "HIGH" },
  CRITICAL: { min: 76, max: 100, verdict: "CRITICAL" },
} as const;

/**
 * Map a fraud score to its verdict string.
 */
export function scoreToVerdict(score: number): string {
  if (score <= 20) return "LOW";
  if (score <= 50) return "MEDIUM";
  if (score <= 75) return "HIGH";
  return "CRITICAL";
}

/**
 * Calculate the base fraud score from synchronous forensic checks.
 * Returns a score between 0 and 100.
 */
export function calculateBaseFraudScore(
  checks: Array<{ weight: number; triggered: boolean }>
): number {
  const totalWeight = checks
    .filter((c) => c.triggered)
    .reduce((sum, c) => sum + c.weight, 0);
  return Math.min(totalWeight, 100);
}

/**
 * Common fraud check weights (out of 100).
 */
export const FRAUD_CHECK_WEIGHTS = {
  DUPLICATE_CLAIM: 40,
  GPS_MISMATCH: 30,
  EXIF_MISSING: 15,
  HASH_DUPLICATE: 25,
  FILE_SPOOF: 20,
  CLAIM_AMOUNT_MISMATCH: 10,
  FARMER_HISTORY: 15,
  AI_IMAGE_CHECK: 20,
  AI_VIDEO_CHECK: 15,
  SATELLITE_NDVI: 40,
  WEATHER_TRUTH: 30,
  CNIC_MISMATCH: 25,
} as const;
