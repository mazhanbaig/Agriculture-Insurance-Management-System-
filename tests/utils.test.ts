/**
 * Unit tests for utility functions:
 * - generators (claimNumber, policyNumber)
 * - fraud-helpers (scoreToVerdict, calculateBaseFraudScore, FRAUD_CHECK_WEIGHTS)
 * - geo (haversineDistance)
 */

import { generateClaimNumber, generatePolicyNumber } from "../src/utils/generators";
import {
  scoreToVerdict,
  calculateBaseFraudScore,
  FRAUD_CHECK_WEIGHTS,
} from "../src/utils/fraud-helpers";
import { haversineDistance } from "../src/utils/geo";

describe("Generators", () => {
  describe("generateClaimNumber", () => {
    it("should generate a claim number with CLM- prefix", () => {
      const number = generateClaimNumber();
      expect(number).toMatch(/^CLM-/);
    });

    it("should generate unique claim numbers on consecutive calls", () => {
      const num1 = generateClaimNumber();
      const num2 = generateClaimNumber();
      expect(num1).not.toBe(num2);
    });
  });

  describe("generatePolicyNumber", () => {
    it("should generate a policy number with POL- prefix", () => {
      const number = generatePolicyNumber();
      expect(number).toMatch(/^POL-/);
    });

    it("should generate unique policy numbers on consecutive calls", () => {
      const num1 = generatePolicyNumber();
      const num2 = generatePolicyNumber();
      expect(num1).not.toBe(num2);
    });
  });
});

describe("Fraud Helpers", () => {
  describe("scoreToVerdict", () => {
    it("should return LOW for score 0-20", () => {
      expect(scoreToVerdict(0)).toBe("LOW");
      expect(scoreToVerdict(10)).toBe("LOW");
      expect(scoreToVerdict(20)).toBe("LOW");
    });

    it("should return MEDIUM for score 21-50", () => {
      expect(scoreToVerdict(21)).toBe("MEDIUM");
      expect(scoreToVerdict(35)).toBe("MEDIUM");
      expect(scoreToVerdict(50)).toBe("MEDIUM");
    });

    it("should return HIGH for score 51-75", () => {
      expect(scoreToVerdict(51)).toBe("HIGH");
      expect(scoreToVerdict(60)).toBe("HIGH");
      expect(scoreToVerdict(75)).toBe("HIGH");
    });

    it("should return CRITICAL for score 76-100", () => {
      expect(scoreToVerdict(76)).toBe("CRITICAL");
      expect(scoreToVerdict(90)).toBe("CRITICAL");
      expect(scoreToVerdict(100)).toBe("CRITICAL");
    });
  });

  describe("calculateBaseFraudScore", () => {
    it("should return 0 when no checks are triggered", () => {
      const score = calculateBaseFraudScore([
        { weight: 40, triggered: false },
        { weight: 20, triggered: false },
      ]);
      expect(score).toBe(0);
    });

    it("should sum weights of triggered checks", () => {
      const score = calculateBaseFraudScore([
        { weight: FRAUD_CHECK_WEIGHTS.DUPLICATE_CLAIM, triggered: true },   // 40
        { weight: FRAUD_CHECK_WEIGHTS.FARMER_HISTORY, triggered: true },    // 15
        { weight: FRAUD_CHECK_WEIGHTS.AI_IMAGE_CHECK, triggered: false },   // 0
      ]);
      expect(score).toBe(55);
    });

    it("should cap score at 100", () => {
      const score = calculateBaseFraudScore([
        { weight: 60, triggered: true },
        { weight: 60, triggered: true },
      ]);
      expect(score).toBe(100);
    });

    it("should return 0 for empty checks array", () => {
      expect(calculateBaseFraudScore([])).toBe(0);
    });
  });

  describe("FRAUD_CHECK_WEIGHTS constants", () => {
    it("should have DUPLICATE_CLAIM weight of 40", () => {
      expect(FRAUD_CHECK_WEIGHTS.DUPLICATE_CLAIM).toBe(40);
    });

    it("should have SATELLITE_NDVI weight of 40", () => {
      expect(FRAUD_CHECK_WEIGHTS.SATELLITE_NDVI).toBe(40);
    });

    it("should have WEATHER_TRUTH weight of 30", () => {
      expect(FRAUD_CHECK_WEIGHTS.WEATHER_TRUTH).toBe(30);
    });

    it("should have all weights defined with positive values", () => {
      const weights = Object.values(FRAUD_CHECK_WEIGHTS);
      expect(weights.length).toBeGreaterThan(0);
      weights.forEach((w) => {
        expect(w).toBeGreaterThan(0);
      });
    });
  });
});

describe("Geo Utils", () => {
  describe("haversineDistance", () => {
    it("should return 0 for the same coordinates", () => {
      const distance = haversineDistance(30.0, 70.0, 30.0, 70.0);
      expect(distance).toBe(0);
    });

    it("should calculate approximate distance between Lahore and Islamabad", () => {
      // ~267 km
      const distance = haversineDistance(31.5497, 74.3436, 33.6844, 73.0479);
      expect(distance).toBeGreaterThan(200);
      expect(distance).toBeLessThan(350);
    });

    it("should calculate distance between Karachi and Lahore", () => {
      // ~1034 km
      const distance = haversineDistance(24.8607, 67.0011, 31.5497, 74.3436);
      expect(distance).toBeGreaterThan(900);
      expect(distance).toBeLessThan(1200);
    });
  });
});
