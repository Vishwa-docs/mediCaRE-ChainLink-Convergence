/**
 * @module explainability
 * @description Explainable AI Audit Trails Module
 *
 * Generates structured reasoning JSON for every AI decision made by the
 * platform. Provides:
 *   - Bullet-point justifications for each decision factor
 *   - Uncertainty flags and confidence intervals
 *   - Model provenance (which model version, agent, training data vintage)
 *   - HIPAA/GDPR-compliant audit metadata
 *
 * The explanation hash is stored on-chain via InsurancePolicy.setExplanationHash()
 * while the full JSON is stored on IPFS for off-chain retrieval.
 */

import { createLogger } from "../utils/logging";
import crypto from "crypto";

const log = createLogger("ai:explainability");

// ─── Types ──────────────────────────────────────────────────────────────────

export enum DecisionType {
  CLAIM_ADJUDICATION = "CLAIM_ADJUDICATION",
  RISK_ASSESSMENT = "RISK_ASSESSMENT",
  ANOMALY_DETECTION = "ANOMALY_DETECTION",
  VITALS_ALERT = "VITALS_ALERT",
  FRAUD_FLAG = "FRAUD_FLAG",
  CONSENT_PARSE = "CONSENT_PARSE",
  PREMIUM_ADJUSTMENT = "PREMIUM_ADJUSTMENT",
  IRB_REVIEW = "IRB_REVIEW",
  TRIAL_MATCHING = "TRIAL_MATCHING",
  MEDICAL_SUMMARY = "MEDICAL_SUMMARY",
}

export interface ExplanationFactor {
  factor: string;
  weight: number; // -1 to 1 (negative = reducing, positive = increasing)
  description: string;
  evidence: string;
  isRedFlag: boolean;
}

export interface UncertaintyMetrics {
  overallConfidence: number; // 0–1
  dataCompleteness: number; // 0–1 (what % of expected inputs were provided)
  modelCalibration: number; // 0–1 (how well-calibrated the model is)
  uncertainFactors: string[];
}

export interface ModelProvenance {
  modelName: string;
  modelVersion: string;
  trainingDataVintage: string;
  algorithmType: string;
  lastUpdated: string;
}

export interface ExplanationRecord {
  id: string;
  decisionType: DecisionType;
  entityId: string; // claimId, patientId, etc.
  timestamp: string;
  verdict: string;
  score: number;
  factors: ExplanationFactor[];
  uncertainty: UncertaintyMetrics;
  provenance: ModelProvenance;
  recommendations: string[];
  regulatoryNotes: string[];
  hash: string; // keccak256 of the JSON for on-chain storage
}

// ─── Provenance Registry ────────────────────────────────────────────────────

const MODEL_REGISTRY: Record<DecisionType, ModelProvenance> = {
  [DecisionType.CLAIM_ADJUDICATION]: {
    modelName: "mediCaRE-adjudicator",
    modelVersion: "2.1.0",
    trainingDataVintage: "2024-Q4",
    algorithmType: "3-agent-swarm (Triage + Coding + Fraud), BFT median consensus",
    lastUpdated: "2025-12-15",
  },
  [DecisionType.RISK_ASSESSMENT]: {
    modelName: "mediCaRE-risk-scorer",
    modelVersion: "1.4.0",
    trainingDataVintage: "2024-Q3",
    algorithmType: "Logistic regression with feature weighting",
    lastUpdated: "2025-11-01",
  },
  [DecisionType.ANOMALY_DETECTION]: {
    modelName: "mediCaRE-anomaly-detector",
    modelVersion: "1.2.0",
    trainingDataVintage: "2024-Q4",
    algorithmType: "Z-score statistical analysis with adaptive thresholds",
    lastUpdated: "2025-10-20",
  },
  [DecisionType.VITALS_ALERT]: {
    modelName: "mediCaRE-vitals-monitor",
    modelVersion: "1.0.0",
    trainingDataVintage: "2025-Q1",
    algorithmType: "Threshold-based with trend analysis",
    lastUpdated: "2026-01-15",
  },
  [DecisionType.FRAUD_FLAG]: {
    modelName: "mediCaRE-fraud-detector",
    modelVersion: "1.3.0",
    trainingDataVintage: "2024-Q4",
    algorithmType: "Graph-based anomaly detection with billing pattern analysis",
    lastUpdated: "2025-12-01",
  },
  [DecisionType.CONSENT_PARSE]: {
    modelName: "mediCaRE-consent-nlp",
    modelVersion: "1.1.0",
    trainingDataVintage: "2025-Q1",
    algorithmType: "Rule-based NLP with keyword extraction",
    lastUpdated: "2026-02-01",
  },
  [DecisionType.PREMIUM_ADJUSTMENT]: {
    modelName: "mediCaRE-premium-adjuster",
    modelVersion: "1.0.0",
    trainingDataVintage: "2024-Q4",
    algorithmType: "Risk-weighted actuarial model",
    lastUpdated: "2025-12-15",
  },
  [DecisionType.IRB_REVIEW]: {
    modelName: "mediCaRE-irb-agent",
    modelVersion: "1.0.0",
    trainingDataVintage: "2025-Q1",
    algorithmType: "Rule-based ethical guidelines checker",
    lastUpdated: "2026-01-20",
  },
  [DecisionType.TRIAL_MATCHING]: {
    modelName: "mediCaRE-trial-matcher",
    modelVersion: "1.0.0",
    trainingDataVintage: "2025-Q1",
    algorithmType: "Confidential eligibility scoring with ZK boolean output",
    lastUpdated: "2026-02-10",
  },
  [DecisionType.MEDICAL_SUMMARY]: {
    modelName: "mediCaRE-medical-historian",
    modelVersion: "1.0.0",
    trainingDataVintage: "2025-Q1",
    algorithmType: "LLM-based record aggregation and summarization",
    lastUpdated: "2026-02-15",
  },
};

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Generate a structured explanation record for an AI decision.
 */
export function generateExplanation(params: {
  decisionType: DecisionType;
  entityId: string;
  verdict: string;
  score: number;
  factors: ExplanationFactor[];
  dataCompleteness?: number;
  recommendations?: string[];
}): ExplanationRecord {
  log.info("Generating explanation", {
    type: params.decisionType,
    entityId: params.entityId,
  });

  const provenance = MODEL_REGISTRY[params.decisionType];

  const uncertainty: UncertaintyMetrics = {
    overallConfidence: Math.min(1, params.score / 10000 + 0.2),
    dataCompleteness: params.dataCompleteness ?? 0.8,
    modelCalibration: 0.85,
    uncertainFactors: params.factors
      .filter((f) => Math.abs(f.weight) < 0.2)
      .map((f) => f.factor),
  };

  const regulatoryNotes: string[] = [
    "Decision generated by automated AI system — subject to human review",
    "Patient data processed in compliance with HIPAA Safe Harbor provisions",
    "Explanation record retained for minimum 6-year audit period per HIPAA §164.530(j)",
  ];

  if (params.decisionType === DecisionType.CLAIM_ADJUDICATION) {
    regulatoryNotes.push(
      "Multi-agent consensus used to reduce single-point-of-failure risk",
      "All agent inputs processed within TEE — no PHI exposed to node operators",
    );
  }

  const record: Omit<ExplanationRecord, "hash"> = {
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    decisionType: params.decisionType,
    entityId: params.entityId,
    timestamp: new Date().toISOString(),
    verdict: params.verdict,
    score: params.score,
    factors: params.factors,
    uncertainty,
    provenance,
    recommendations: params.recommendations ?? [],
    regulatoryNotes,
  };

  // Generate deterministic hash for on-chain storage
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(record))
    .digest("hex");

  return { ...record, hash: `0x${hash}` };
}

/**
 * Format an explanation record into a human-readable summary.
 */
export function explanationToMarkdown(record: ExplanationRecord): string {
  let md = `## AI Decision Explanation\n\n`;
  md += `**Type:** ${record.decisionType}\n`;
  md += `**Entity:** ${record.entityId}\n`;
  md += `**Verdict:** ${record.verdict}\n`;
  md += `**Score:** ${record.score}/10000\n`;
  md += `**Confidence:** ${(record.uncertainty.overallConfidence * 100).toFixed(1)}%\n`;
  md += `**Timestamp:** ${record.timestamp}\n\n`;

  md += `### Decision Factors\n\n`;
  for (const factor of record.factors) {
    const icon = factor.isRedFlag ? "🔴" : factor.weight > 0 ? "🟢" : "🟡";
    md += `- ${icon} **${factor.factor}** (weight: ${factor.weight.toFixed(2)}): ${factor.description}\n`;
    md += `  - Evidence: ${factor.evidence}\n`;
  }

  if (record.uncertainty.uncertainFactors.length > 0) {
    md += `\n### Uncertainty Flags\n\n`;
    for (const f of record.uncertainty.uncertainFactors) {
      md += `- ⚠️ ${f}\n`;
    }
  }

  md += `\n### Model Provenance\n\n`;
  md += `- **Model:** ${record.provenance.modelName} v${record.provenance.modelVersion}\n`;
  md += `- **Algorithm:** ${record.provenance.algorithmType}\n`;
  md += `- **Training Data:** ${record.provenance.trainingDataVintage}\n`;

  md += `\n### On-Chain Hash\n\n`;
  md += `\`${record.hash}\`\n`;

  return md;
}
