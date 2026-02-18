import {
  AnomalyInput,
  AnomalyResult,
  AnomalySeverity,
  VitalMetric,
} from "../types";
import { createLogger } from "../utils/logging";

const log = createLogger("ai:anomaly");

/**
 * Normal physiological ranges used for contextual evaluation.
 * Each entry: [min, max, unit].
 */
const NORMAL_RANGES: Record<VitalMetric, { min: number; max: number; unit: string }> = {
  [VitalMetric.HEART_RATE]: { min: 60, max: 100, unit: "bpm" },
  [VitalMetric.SYSTOLIC_BP]: { min: 90, max: 140, unit: "mmHg" },
  [VitalMetric.DIASTOLIC_BP]: { min: 60, max: 90, unit: "mmHg" },
  [VitalMetric.BLOOD_GLUCOSE]: { min: 70, max: 140, unit: "mg/dL" },
  [VitalMetric.TEMPERATURE]: { min: 36.1, max: 37.5, unit: "°C" },
  [VitalMetric.OXYGEN_SATURATION]: { min: 95, max: 100, unit: "%" },
};

/** Z-score thresholds mapping to severity levels. */
const SEVERITY_THRESHOLDS: Array<{ minZ: number; severity: AnomalySeverity }> = [
  { minZ: 4.0, severity: AnomalySeverity.CRITICAL },
  { minZ: 3.0, severity: AnomalySeverity.ALERT },
  { minZ: 2.0, severity: AnomalySeverity.WARNING },
];

/**
 * Perform Z-score-based anomaly detection on a time-series of vital-sign readings.
 *
 * Algorithm:
 * 1. Compute rolling mean and standard deviation (entire window).
 * 2. Calculate Z-score of the **latest** reading.
 * 3. Classify severity and generate contextual recommendations.
 *
 * @param input - Metric type, values, and corresponding timestamps.
 * @returns Anomaly detection result with severity, Z-score, and recommendations.
 */
export function detectAnomaly(input: AnomalyInput): AnomalyResult {
  const { metric, values, timestamps } = input;

  if (values.length !== timestamps.length) {
    throw Object.assign(
      new Error("values and timestamps arrays must have equal length"),
      { statusCode: 400 },
    );
  }

  if (values.length < 5) {
    throw Object.assign(
      new Error("At least 5 data points are required for anomaly detection"),
      { statusCode: 400 },
    );
  }

  log.info("Running anomaly detection", {
    metric,
    dataPoints: values.length,
  });

  const latestValue = values[values.length - 1];
  const { mean, stdDev } = computeStats(values);

  // Guard against zero std dev (constant readings)
  const effectiveStdDev = stdDev === 0 ? 1e-6 : stdDev;
  const zScore = Math.abs((latestValue - mean) / effectiveStdDev);

  const severity = classifySeverity(zScore);
  const isAnomaly = severity !== AnomalySeverity.NORMAL;

  const recommendations = generateRecommendations(
    metric as VitalMetric,
    latestValue,
    zScore,
    severity,
  );

  const result: AnomalyResult = {
    metric: metric as VitalMetric,
    isAnomaly,
    severity,
    zScore: round(zScore, 3),
    latestValue,
    mean: round(mean, 2),
    stdDev: round(stdDev, 3),
    recommendations,
    analyzedAt: new Date().toISOString(),
  };

  log.info("Anomaly detection complete", {
    metric,
    isAnomaly,
    severity,
    zScore: result.zScore,
  });

  return result;
}

/**
 * Run anomaly detection on multiple metric streams at once.
 */
export function detectAnomaliesBatch(inputs: AnomalyInput[]): AnomalyResult[] {
  return inputs.map(detectAnomaly);
}

// ─── Statistical helpers ────────────────────────────────────────────────────

function computeStats(values: number[]): { mean: number; stdDev: number } {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance =
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1);
  return { mean, stdDev: Math.sqrt(variance) };
}

function classifySeverity(zScore: number): AnomalySeverity {
  for (const threshold of SEVERITY_THRESHOLDS) {
    if (zScore >= threshold.minZ) return threshold.severity;
  }
  return AnomalySeverity.NORMAL;
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

// ─── Recommendation engine ─────────────────────────────────────────────────

function generateRecommendations(
  metric: VitalMetric,
  value: number,
  _zScore: number,
  severity: AnomalySeverity,
): string[] {
  const range = NORMAL_RANGES[metric];
  if (!range) return [];

  const recommendations: string[] = [];

  if (severity === AnomalySeverity.NORMAL) {
    recommendations.push(
      `${formatMetric(metric)} is within normal parameters (${range.min}–${range.max} ${range.unit}).`,
    );
    return recommendations;
  }

  const direction = value > range.max ? "elevated" : "low";
  recommendations.push(
    `${formatMetric(metric)} reading of ${value} ${range.unit} is ${direction} (normal: ${range.min}–${range.max} ${range.unit}).`,
  );

  switch (severity) {
    case AnomalySeverity.WARNING:
      recommendations.push(
        "Schedule a follow-up with your healthcare provider within the next few days.",
        "Continue monitoring and log additional readings.",
      );
      break;
    case AnomalySeverity.ALERT:
      recommendations.push(
        "Contact your healthcare provider today for evaluation.",
        "Avoid strenuous activity until cleared by a clinician.",
      );
      break;
    case AnomalySeverity.CRITICAL:
      recommendations.push(
        "URGENT: Seek immediate medical attention.",
        "Contact emergency services if accompanied by symptoms such as chest pain, confusion, or difficulty breathing.",
        "Do not ignore this reading — immediate clinical review is required.",
      );
      break;
  }

  // Metric-specific advice
  switch (metric) {
    case VitalMetric.HEART_RATE:
      if (value > range.max) {
        recommendations.push("Avoid caffeine and stimulants. Stay hydrated.");
      } else {
        recommendations.push(
          "If not an athlete, a persistently low heart rate may indicate bradycardia.",
        );
      }
      break;
    case VitalMetric.BLOOD_GLUCOSE:
      if (value > range.max) {
        recommendations.push(
          "Review recent carbohydrate intake and insulin dosing with your care team.",
        );
      } else {
        recommendations.push(
          "Consume a fast-acting carbohydrate source (juice, glucose tablets).",
        );
      }
      break;
    case VitalMetric.TEMPERATURE:
      if (value > range.max) {
        recommendations.push(
          "Monitor for signs of infection. Consider antipyretic medication as directed.",
        );
      } else {
        recommendations.push(
          "Ensure the patient is warm and monitor for hypothermia symptoms.",
        );
      }
      break;
    case VitalMetric.OXYGEN_SATURATION:
      if (value < range.min) {
        recommendations.push(
          "Administer supplemental oxygen if available. Position patient upright.",
        );
      }
      break;
  }

  return recommendations;
}

function formatMetric(metric: VitalMetric): string {
  const labels: Record<VitalMetric, string> = {
    [VitalMetric.HEART_RATE]: "Heart rate",
    [VitalMetric.SYSTOLIC_BP]: "Systolic blood pressure",
    [VitalMetric.DIASTOLIC_BP]: "Diastolic blood pressure",
    [VitalMetric.BLOOD_GLUCOSE]: "Blood glucose",
    [VitalMetric.TEMPERATURE]: "Body temperature",
    [VitalMetric.OXYGEN_SATURATION]: "Oxygen saturation",
  };
  return labels[metric] ?? metric;
}
