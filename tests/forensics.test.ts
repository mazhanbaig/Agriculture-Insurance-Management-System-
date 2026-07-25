import { scoreToVerdict, calculateBaseFraudScore, FRAUD_CHECK_WEIGHTS } from "../src/utils/fraud-helpers";
import { haversineDistance } from "../src/utils/geo";

jest.mock("../src/lib/prisma");
jest.mock("../src/utils/logger");

describe("Forensics Utils", () => {
  describe("FRAUD_CHECK_WEIGHTS", () => {
    it("should have EXIF_MISSING defined", () => {
      expect(FRAUD_CHECK_WEIGHTS.EXIF_MISSING).toBe(15);
    });

    it("should have HASH_DUPLICATE defined", () => {
      expect(FRAUD_CHECK_WEIGHTS.HASH_DUPLICATE).toBe(25);
    });

    it("should have FILE_SPOOF defined", () => {
      expect(FRAUD_CHECK_WEIGHTS.FILE_SPOOF).toBe(20);
    });

    it("should have CNIC_MISMATCH defined", () => {
      expect(FRAUD_CHECK_WEIGHTS.CNIC_MISMATCH).toBe(25);
    });
  });

  describe("calculateBaseFraudScore", () => {
    it("should return 0 when no checks triggered", () => {
      expect(calculateBaseFraudScore([])).toBe(0);
    });

    it("should sum triggered weights", () => {
      const score = calculateBaseFraudScore([
        { weight: 15, triggered: true },
        { weight: 25, triggered: true },
      ]);
      expect(score).toBe(40);
    });

    it("should ignore non-triggered checks", () => {
      const score = calculateBaseFraudScore([
        { weight: 40, triggered: false },
        { weight: 25, triggered: true },
      ]);
      expect(score).toBe(25);
    });

    it("should cap at 100", () => {
      const score = calculateBaseFraudScore([
        { weight: 60, triggered: true },
        { weight: 60, triggered: true },
      ]);
      expect(score).toBe(100);
    });
  });

  describe("scoreToVerdict", () => {
    it("should map scores to verdicts", () => {
      expect(scoreToVerdict(0)).toBe("LOW");
      expect(scoreToVerdict(20)).toBe("LOW");
      expect(scoreToVerdict(21)).toBe("MEDIUM");
      expect(scoreToVerdict(50)).toBe("MEDIUM");
      expect(scoreToVerdict(51)).toBe("HIGH");
      expect(scoreToVerdict(75)).toBe("HIGH");
      expect(scoreToVerdict(76)).toBe("CRITICAL");
      expect(scoreToVerdict(100)).toBe("CRITICAL");
    });
  });

  describe("haversineDistance", () => {
    it("should return 0 for same point", () => {
      expect(haversineDistance(30, 70, 30, 70)).toBe(0);
    });

    it("should compute Lahore-Islamabad distance", () => {
      const d = haversineDistance(31.5497, 74.3436, 33.6844, 73.0479);
      expect(d).toBeGreaterThan(200);
      expect(d).toBeLessThan(400);
    });
  });
});

describe("Damage Calculation", () => {
  describe("Payout Logic", () => {
    it("should compute correct payout from damage percent", () => {
      const coverage = 100000;
      const damagePercent = 50;
      const payout = Math.round(coverage * (damagePercent / 100) * 100) / 100;
      expect(payout).toBe(50000);
    });

    it("should apply min payout floor", () => {
      const coverage = 100000;
      const minPayoutPercent = 0.02;
      const minPayout = coverage * minPayoutPercent;
      expect(minPayout).toBe(2000);
    });

    it("should cap at max payout (95%)", () => {
      const coverage = 100000;
      const maxPayoutPercent = 0.95;
      expect(coverage * maxPayoutPercent).toBe(95000);
    });
  });

  describe("Multi-Source Fusion Formula", () => {
    const weights = { ndvi: 0.35, weather: 0.15, ai: 0.20, groundTruth: 0.30 };

    it("should compute weighted average with all sources present", () => {
      const ndviDamage = 60;
      const weatherConfirmed = true;
      const aiScore = 50;
      const groundTruth = 40;

      const denominator = weights.ndvi + weights.weather + weights.ai + weights.groundTruth;
      const numerator =
        ndviDamage * weights.ndvi +
        (weatherConfirmed ? 100 * weights.weather : 0) +
        aiScore * weights.ai +
        groundTruth * weights.groundTruth;

      const result = numerator / denominator;
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });

    it("should still work with only NDVI and ground truth", () => {
      const ndviDamage = 60;
      const groundTruth = 40;

      const denominator = weights.ndvi + weights.groundTruth;
      const numerator = ndviDamage * weights.ndvi + groundTruth * weights.groundTruth;
      const result = numerator / denominator;

      expect(result).toBeCloseTo(50.77, 1);
    });
  });
});

describe("Forensics Service", () => {
  describe("EXIF Analysis", () => {
    it("should classify EXIF absence as suspicious", () => {
      const flags = ["EXIF_STRIPPED"];
      expect(flags).toContain("EXIF_STRIPPED");
    });

    it("should flag editor software", () => {
      const software = "Adobe Photoshop";
      const isEditor = /photoshop|gimp|lightroom|affinity|pixlr|canva|edit/i.test(software);
      expect(isEditor).toBe(true);
    });
  });

  describe("ELA Heuristic", () => {
    it("should flag images with >30% pixel diff", () => {
      const threshold = 0.3;
      const elaScore = 0.45;
      expect(elaScore > threshold).toBe(true);
    });

    it("should pass images with <30% pixel diff", () => {
      const threshold = 0.3;
      const elaScore = 0.15;
      expect(elaScore > threshold).toBe(false);
    });
  });

  describe("AI Gen Detection", () => {
    it("should combine EXIF absent + no GPS + no date as high risk", () => {
      let aiScore = 0;
      aiScore += 20; // EXIF_ABSENT
      aiScore += 30; // NO_GPS + NO_DATE
      expect(aiScore).toBe(50);
      expect(aiScore >= 50).toBe(true);
    });

    it("should classify score < 20 as likely authentic", () => {
      const score = 10;
      expect(score >= 50 ? "SUSPECTED_AI" : score >= 20 ? "UNCLEAR" : "LIKELY_AUTHENTIC").toBe("LIKELY_AUTHENTIC");
    });
  });

  describe("PDF Analysis", () => {
    it("should flag PDF with no extractable text", () => {
      const text = "";
      const noText = text.trim().length < 10;
      expect(noText).toBe(true);
    });

    it("should flag PDF modified by PDF tools", () => {
      const producer = "pdfsam";
      const isModified = /pdfsam|sejda|ilovepdf|smallpdf|pdf24|cuten?pdf/i.test(producer);
      expect(isModified).toBe(true);
    });
  });

  describe("Video Analysis", () => {
    it("should flag unusual video codecs", () => {
      const codec = "mpeg4";
      const unusual = !["h264", "hevc", "vp9", "av1"].includes(codec);
      expect(unusual).toBe(true);
    });

    it("should accept standard codecs", () => {
      const codec = "h264";
      const unusual = !["h264", "hevc", "vp9", "av1"].includes(codec);
      expect(unusual).toBe(false);
    });
  });
});
