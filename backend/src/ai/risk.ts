import { RiskInput, RiskResult, RiskLevel, RiskFactor } from "../types";
import { createLogger } from "../utils/logging";

const log = createLogger("ai:risk");

/**
 * Feature weights for the logistic-regression risk model.
 * Each weight represents the coefficient learned from historical claims data.
 * Positive → increases risk; negative → decreases risk.
 */
const WEIGHTS: Record<string, number> = {
  age: 0.2,
  bmi: 0.35,
  chronicConditions: 0.8,
  medicationCount: 0.35,
  priorClaims: 0.6,
  smokingStatus: 0.8,
  exerciseFactor: -0.3,
  systolicBP: 0.08,
  fastingGlucose: 0.06,
  cholesterol: 0.04,
};

/** Intercept / bias term for the logistic model. */
const BIAS = -2.2;

/** Normal-range midpoints used to centre features before scoring. */
const CENTRES: Record<string, number> = {
  age: 40,
  bmi: 24,
  chronicConditions: 0,
  medicationCount: 2,
  priorClaims: 0,
  systolicBP: 120,
  fastingGlucose: 90,
  cholesterol: 180,
};

/**
 * Compute a risk score (0–100) for an insurance claim / patient profile.
 *
 * The model applies a logistic (sigmoid) function over a weighted combination
 * of normalised health metrics. The output is mapped to a 0-100 scale and
 * classified into four risk tiers.
 *
 * @param input Patient health metrics.
 * @returns Risk score, level, and factor breakdown.
 */
export function computeRiskScore(input: RiskInput): RiskResult {
  log.info("Computing risk score", { age: input.age, bmi: input.bmi });

  const features = normalise(input);
  const factors: RiskFactor[] = [];

  let z = BIAS;

  for (const [name, weight] of Object.entries(WEIGHTS)) {
    const featureValue = features[name] ?? 0;
    const contribution = weight * featureValue;
    z += contribution;

    factors.push({
      name,
      weight,
      contribution: round(contribution, 4),
      description: describeContribution(name, contribution),
    });
  }

  const probability = sigmoid(z);
  const score = Math.round(probability * 100);
  const level = classifyRisk(score);

  // Sort factors by absolute contribution (largest first)
  factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const result: RiskResult = {
    score,
    level,
    factors,
    computedAt: new Date().toISOString(),
  };

  log.info("Risk score computed", { score, level });
  return result;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Normalise raw inputs to centred, scaled features. */
function normalise(input: RiskInput): Record<string, number> {
  return {
    age: (input.age - CENTRES.age) / 20,
    bmi: (input.bmi - CENTRES.bmi) / 6,
    chronicConditions: input.chronicConditions / 3,
    medicationCount: (input.medicationCount - CENTRES.medicationCount) / 4,
    priorClaims: input.priorClaims / 3,
    smokingStatus: input.smokingStatus ? 1 : 0,
    exerciseFactor: Math.min(input.exerciseHoursPerWeek, 20) / 10,
    systolicBP: (input.systolicBP - CENTRES.systolicBP) / 20,
    fastingGlucose: (input.fastingGlucose - CENTRES.fastingGlucose) / 30,
    cholesterol: (input.cholesterol - CENTRES.cholesterol) / 40,
  };
}

/** Standard logistic sigmoid. */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Map a 0-100 score to a risk band. */
function classifyRisk(score: number): RiskLevel {
  if (score <= 25) return RiskLevel.LOW;
  if (score <= 50) return RiskLevel.MEDIUM;
  if (score <= 75) return RiskLevel.HIGH;
  return RiskLevel.CRITICAL;
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function describeContribution(name: string, contribution: number): string {
  const direction = contribution > 0 ? "increases" : "decreases";
  const magnitude = Math.abs(contribution);
  const strength =
    magnitude > 0.3 ? "strongly" : magnitude > 0.1 ? "moderately" : "slightly";

  const labels: Record<string, string> = {
    age: "Patient age",
    bmi: "Body Mass Index",
    chronicConditions: "Number of chronic conditions",
    medicationCount: "Number of medications",
    priorClaims: "Prior insurance claims",
    smokingStatus: "Smoking status",
    exerciseFactor: "Exercise frequency",
    systolicBP: "Systolic blood pressure",
    fastingGlucose: "Fasting blood glucose",
    cholesterol: "Total cholesterol",
  };

  return `${labels[name] ?? name} ${strength} ${direction} risk`;
}
