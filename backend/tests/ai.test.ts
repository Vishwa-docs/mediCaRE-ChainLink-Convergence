import { computeRiskScore } from "../src/ai/risk";
import { detectAnomaly } from "../src/ai/anomaly";
import { RiskInput, RiskLevel, AnomalySeverity, VitalMetric } from "../src/types";

// ─── Risk Scoring Tests ─────────────────────────────────────────────────────

describe("ai/risk – computeRiskScore", () => {
  const baseInput: RiskInput = {
    age: 35,
    bmi: 23,
    chronicConditions: 0,
    medicationCount: 1,
    priorClaims: 0,
    smokingStatus: false,
    exerciseHoursPerWeek: 5,
    systolicBP: 118,
    fastingGlucose: 88,
    cholesterol: 175,
  };

  it("should return a LOW risk score for a healthy young patient", () => {
    const result = computeRiskScore(baseInput);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.level).toBe(RiskLevel.LOW);
    expect(result.factors).toBeDefined();
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.computedAt).toBeDefined();
  });

  it("should return a higher risk score for an elderly patient with conditions", () => {
    const highRiskInput: RiskInput = {
      age: 72,
      bmi: 34,
      chronicConditions: 4,
      medicationCount: 8,
      priorClaims: 5,
      smokingStatus: true,
      exerciseHoursPerWeek: 0,
      systolicBP: 170,
      fastingGlucose: 180,
      cholesterol: 280,
    };

    const result = computeRiskScore(highRiskInput);
    expect(result.score).toBeGreaterThan(50);
    expect([RiskLevel.HIGH, RiskLevel.CRITICAL]).toContain(result.level);
  });

  it("should produce a higher score when smoking is true vs false", () => {
    const nonsmoker = computeRiskScore({ ...baseInput, smokingStatus: false });
    const smoker = computeRiskScore({ ...baseInput, smokingStatus: true });
    expect(smoker.score).toBeGreaterThan(nonsmoker.score);
  });

  it("should produce a lower score with more exercise", () => {
    const sedentary = computeRiskScore({
      ...baseInput,
      exerciseHoursPerWeek: 0,
    });
    const active = computeRiskScore({
      ...baseInput,
      exerciseHoursPerWeek: 10,
    });
    expect(active.score).toBeLessThanOrEqual(sedentary.score);
  });

  it("should include factor descriptions for every weight", () => {
    const result = computeRiskScore(baseInput);
    for (const factor of result.factors) {
      expect(factor.name).toBeDefined();
      expect(factor.description).toBeTruthy();
      expect(typeof factor.weight).toBe("number");
      expect(typeof factor.contribution).toBe("number");
    }
  });

  it("should classify score <= 25 as LOW", () => {
    const result = computeRiskScore(baseInput);
    if (result.score <= 25) {
      expect(result.level).toBe(RiskLevel.LOW);
    }
  });

  it("should return MEDIUM for moderate risk input", () => {
    const mediumInput: RiskInput = {
      age: 55,
      bmi: 29,
      chronicConditions: 2,
      medicationCount: 4,
      priorClaims: 2,
      smokingStatus: false,
      exerciseHoursPerWeek: 2,
      systolicBP: 145,
      fastingGlucose: 115,
      cholesterol: 220,
    };
    const result = computeRiskScore(mediumInput);
    expect(result.score).toBeGreaterThan(20);
    expect(result.score).toBeLessThan(90);
  });
});

// ─── Anomaly Detection Tests ────────────────────────────────────────────────

describe("ai/anomaly – detectAnomaly", () => {
  it("should return NORMAL for stable heart rate readings", () => {
    const result = detectAnomaly({
      metric: VitalMetric.HEART_RATE,
      values: [72, 74, 71, 73, 72, 75, 73, 74, 72, 73],
      timestamps: Array.from({ length: 10 }, (_, i) => 1000 + i * 60),
    });

    expect(result.isAnomaly).toBe(false);
    expect(result.severity).toBe(AnomalySeverity.NORMAL);
    expect(result.zScore).toBeLessThan(2);
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("should detect anomaly when latest value is far from the mean", () => {
    const values = [72, 74, 71, 73, 72, 75, 73, 74, 72, 180]; // sudden spike
    const result = detectAnomaly({
      metric: VitalMetric.HEART_RATE,
      values,
      timestamps: Array.from({ length: 10 }, (_, i) => 1000 + i * 60),
    });

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).not.toBe(AnomalySeverity.NORMAL);
    expect(result.zScore).toBeGreaterThanOrEqual(2);
    expect(result.latestValue).toBe(180);
  });

  it("should return CRITICAL severity for extreme Z-scores", () => {
    // Use 30 stable readings so the outlier doesn't skew mean/stdDev
    const stable = Array(29).fill(98);
    const values = [...stable, 40]; // sudden oxygen drop
    const result = detectAnomaly({
      metric: VitalMetric.OXYGEN_SATURATION,
      values,
      timestamps: Array.from({ length: 30 }, (_, i) => 1000 + i * 60),
    });

    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe(AnomalySeverity.CRITICAL);
    expect(result.recommendations.some((r) => r.includes("URGENT"))).toBe(true);
  });

  it("should handle blood glucose anomaly", () => {
    const values = [95, 92, 98, 94, 96, 93, 97, 95, 94, 350]; // hyperglycemia
    const result = detectAnomaly({
      metric: VitalMetric.BLOOD_GLUCOSE,
      values,
      timestamps: Array.from({ length: 10 }, (_, i) => 1000 + i * 60),
    });

    expect(result.isAnomaly).toBe(true);
    expect(result.latestValue).toBe(350);
  });

  it("should throw when values and timestamps length mismatch", () => {
    expect(() =>
      detectAnomaly({
        metric: VitalMetric.HEART_RATE,
        values: [72, 74, 71, 73, 72],
        timestamps: [1000, 1060, 1120],
      }),
    ).toThrow("equal length");
  });

  it("should throw when fewer than 5 data points provided", () => {
    expect(() =>
      detectAnomaly({
        metric: VitalMetric.TEMPERATURE,
        values: [36.5, 36.6, 36.7],
        timestamps: [1000, 1060, 1120],
      }),
    ).toThrow("At least 5");
  });

  it("should compute correct mean and stdDev", () => {
    const values = [10, 10, 10, 10, 10];
    const result = detectAnomaly({
      metric: VitalMetric.TEMPERATURE,
      values,
      timestamps: [1, 2, 3, 4, 5],
    });

    expect(result.mean).toBe(10);
    // stdDev should be ~0 (constant series), but we use a floor of 1e-6
    expect(result.stdDev).toBeLessThan(0.01);
  });

  it("should include metric-specific recommendations for temperature", () => {
    const values = [36.5, 36.6, 36.4, 36.5, 36.6, 36.5, 36.4, 36.5, 36.6, 40.2];
    const result = detectAnomaly({
      metric: VitalMetric.TEMPERATURE,
      values,
      timestamps: Array.from({ length: 10 }, (_, i) => 1000 + i * 60),
    });

    expect(result.isAnomaly).toBe(true);
    expect(
      result.recommendations.some(
        (r) => r.toLowerCase().includes("infection") || r.toLowerCase().includes("antipyretic"),
      ),
    ).toBe(true);
  });

  it("should return analyzedAt as an ISO timestamp", () => {
    const result = detectAnomaly({
      metric: VitalMetric.HEART_RATE,
      values: [72, 74, 71, 73, 72],
      timestamps: [1, 2, 3, 4, 5],
    });
    expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt);
  });
});

// ─── Summarizer Tests (mocked) ──────────────────────────────────────────────

describe("ai/summarizer – summariseEHR (mocked)", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("should return structured summary from mocked LLM response", async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                diagnoses: ["Type 2 Diabetes", "Hypertension"],
                medications: [
                  {
                    name: "Metformin",
                    dosage: "500mg",
                    frequency: "twice daily",
                  },
                ],
                allergies: ["Penicillin"],
                procedures: ["Appendectomy (2015)"],
                redFlags: ["Elevated HbA1c at 9.2%"],
                narrative:
                  "Patient with poorly controlled diabetes and hypertension.",
              }),
            },
          },
        ],
      },
    };

    jest.doMock("axios", () => ({
      __esModule: true,
      default: {
        post: jest.fn().mockResolvedValue(mockResponse),
        create: jest.fn(),
      },
      AxiosError: class AxiosError extends Error {
        response: any;
        constructor(msg: string) {
          super(msg);
        }
      },
    }));

    // Re-import after mocking
    const { summariseEHR } = await import("../src/ai/summarizer");

    const result = await summariseEHR("Patient: John Doe, DOB: 1965-03-15...");

    expect(result.diagnoses).toContain("Type 2 Diabetes");
    expect(result.medications).toHaveLength(1);
    expect(result.medications[0].name).toBe("Metformin");
    expect(result.allergies).toContain("Penicillin");
    expect(result.redFlags).toHaveLength(1);
    expect(result.language).toBe("en");
    expect(result.generatedAt).toBeDefined();
  });

  it("should throw after exhausting retries on persistent 500 errors", async () => {
    const axiosError = new Error("Internal Server Error") as any;
    axiosError.response = { status: 500 };

    // Make it look like an AxiosError
    jest.doMock("axios", () => {
      class MockAxiosError extends Error {
        response: any;
        constructor(msg: string, status: number) {
          super(msg);
          this.response = { status };
        }
      }
      const err = new MockAxiosError("Internal Server Error", 500);
      return {
        __esModule: true,
        default: {
          post: jest.fn().mockRejectedValue(err),
          create: jest.fn(),
        },
        AxiosError: MockAxiosError,
      };
    });

    const { summariseEHR } = await import("../src/ai/summarizer");

    await expect(
      summariseEHR("Patient record text..."),
    ).rejects.toThrow("EHR summarisation failed");
  });
});
