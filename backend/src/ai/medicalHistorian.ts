/**
 * @module medicalHistorian
 * @description AI Medical Historian — Longitudinal Record Aggregation
 *
 * Aggregates multi-year patient records into a single comprehensive
 * one-page clinical summary. Designed to be triggered by a CRE workflow
 * that fetches records via Confidential HTTP from FHIR servers.
 *
 * Features:
 *   - Chronological event timeline construction
 *   - Medication interaction detection
 *   - Red-flag pattern identification
 *   - Patient-friendly language toggle
 *   - ICD/CPT code extraction for claim bundling
 */

import { createLogger } from "../utils/logging";

const log = createLogger("ai:medical-historian");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MedicalEvent {
  date: string;
  type: "diagnosis" | "procedure" | "lab" | "medication" | "hospitalization" | "imaging" | "vaccination";
  code?: string; // ICD-10 or CPT
  description: string;
  provider?: string;
  facility?: string;
  outcome?: string;
  values?: Record<string, number | string>;
}

export interface MedicationEntry {
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  prescriber?: string;
  isActive: boolean;
  category: string;
}

export interface HistorianInput {
  patientId: string;
  patientAge: number;
  patientGender: string;
  medicalEvents: MedicalEvent[];
  medications: MedicationEntry[];
  allergies: string[];
  familyHistory?: string[];
  socialHistory?: {
    smoking?: string;
    alcohol?: string;
    exercise?: string;
    occupation?: string;
  };
}

export interface LongitudinalSummary {
  patientId: string;
  generatedAt: string;
  clinicalNarrative: string;
  patientFriendlyNarrative: string;
  timeline: TimelineEntry[];
  activeMedications: MedicationEntry[];
  activeConditions: string[];
  allergies: string[];
  redFlags: RedFlag[];
  medicationInteractions: MedicationInteraction[];
  claimBundle: ClaimBundle;
  statistics: {
    totalEvents: number;
    yearsOfHistory: number;
    hospitalizationCount: number;
    uniqueProviders: number;
    uniqueMedications: number;
  };
}

export interface TimelineEntry {
  date: string;
  event: string;
  category: string;
  significance: "routine" | "notable" | "critical";
}

export interface RedFlag {
  flag: string;
  severity: "low" | "medium" | "high";
  evidence: string;
  recommendation: string;
}

export interface MedicationInteraction {
  drug1: string;
  drug2: string;
  interactionType: string;
  severity: "minor" | "moderate" | "major";
  description: string;
}

export interface ClaimBundle {
  icdCodes: string[];
  cptCodes: string[];
  diagnosisSummary: string;
  procedureSummary: string;
  totalClaimableEvents: number;
}

// ─── Known Medication Interaction Database (simplified) ─────────────────────

const KNOWN_INTERACTIONS: [string, string, string, string][] = [
  ["warfarin", "aspirin", "major", "Increased bleeding risk — dual anticoagulation"],
  ["metformin", "contrast dye", "major", "Risk of lactic acidosis — hold metformin 48h before contrast"],
  ["lisinopril", "potassium", "moderate", "Hyperkalemia risk — monitor potassium levels"],
  ["simvastatin", "amiodarone", "major", "Increased myopathy/rhabdomyolysis risk"],
  ["ssri", "maoi", "major", "Serotonin syndrome risk — contraindicated combination"],
  ["metoprolol", "verapamil", "major", "Severe bradycardia and heart block risk"],
  ["digoxin", "amiodarone", "moderate", "Elevated digoxin levels — reduce dose by 50%"],
  ["clopidogrel", "omeprazole", "moderate", "Reduced antiplatelet efficacy"],
];

// ─── Red Flag Patterns ─────────────────────────────────────────────────────

const RED_FLAG_PATTERNS: { pattern: RegExp; flag: string; severity: RedFlag["severity"]; recommendation: string }[] = [
  {
    pattern: /diabetes.*uncontrolled|hba1c.*(?:8|9|1[0-9])/i,
    flag: "Uncontrolled diabetes",
    severity: "high",
    recommendation: "Urgent endocrinology referral recommended",
  },
  {
    pattern: /hospitalization.*(?:3|4|5)\s*times|frequent\s*er\s*visit/i,
    flag: "Frequent hospitalizations",
    severity: "high",
    recommendation: "Care coordination assessment needed",
  },
  {
    pattern: /non-?compliance|non-?adherence|missed.*medication/i,
    flag: "Medication non-compliance",
    severity: "medium",
    recommendation: "Patient education and medication management plan",
  },
  {
    pattern: /fall|fracture.*(?:hip|femur|vertebral)/i,
    flag: "Fall/fracture history",
    severity: "medium",
    recommendation: "Fall risk assessment and bone density screening",
  },
  {
    pattern: /polypharmacy|(?:8|9|1\d+)\s*medications/i,
    flag: "Polypharmacy risk",
    severity: "medium",
    recommendation: "Medication review to reduce unnecessary prescriptions",
  },
];

// ─── Core Functions ─────────────────────────────────────────────────────────

function buildTimeline(events: MedicalEvent[]): TimelineEntry[] {
  return events
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((e) => ({
      date: e.date,
      event: `${e.description}${e.code ? ` [${e.code}]` : ""}${e.outcome ? ` — ${e.outcome}` : ""}`,
      category: e.type,
      significance: e.type === "hospitalization" || e.type === "procedure"
        ? "critical"
        : e.type === "diagnosis"
          ? "notable"
          : "routine",
    }));
}

function detectInteractions(medications: MedicationEntry[]): MedicationInteraction[] {
  const interactions: MedicationInteraction[] = [];
  const activeNames = medications
    .filter((m) => m.isActive)
    .map((m) => (m.genericName ?? m.name).toLowerCase());

  for (const [drug1, drug2, severity, description] of KNOWN_INTERACTIONS) {
    const has1 = activeNames.some((n) => n.includes(drug1));
    const has2 = activeNames.some((n) => n.includes(drug2));
    if (has1 && has2) {
      interactions.push({
        drug1,
        drug2,
        interactionType: "pharmacological",
        severity: severity as MedicationInteraction["severity"],
        description,
      });
    }
  }
  return interactions;
}

function detectRedFlags(input: HistorianInput): RedFlag[] {
  const flags: RedFlag[] = [];
  const allText = input.medicalEvents.map((e) => e.description).join(" ");

  for (const pattern of RED_FLAG_PATTERNS) {
    if (pattern.pattern.test(allText)) {
      flags.push({
        flag: pattern.flag,
        severity: pattern.severity,
        evidence: "Detected in medical history records",
        recommendation: pattern.recommendation,
      });
    }
  }

  // Check polypharmacy
  const activeMeds = input.medications.filter((m) => m.isActive);
  if (activeMeds.length >= 8) {
    flags.push({
      flag: "Polypharmacy risk",
      severity: activeMeds.length >= 12 ? "high" : "medium",
      evidence: `${activeMeds.length} active medications`,
      recommendation: "Comprehensive medication review recommended",
    });
  }

  // Check age-related risks
  if (input.patientAge > 75) {
    flags.push({
      flag: "Advanced age — increased fall and cognitive risk",
      severity: "medium",
      evidence: `Patient age: ${input.patientAge}`,
      recommendation: "Annual cognitive screening and fall risk assessment",
    });
  }

  return flags;
}

function buildClaimBundle(events: MedicalEvent[]): ClaimBundle {
  const icdCodes = [...new Set(
    events.filter((e) => e.code && e.type === "diagnosis").map((e) => e.code!)
  )];
  const cptCodes = [...new Set(
    events.filter((e) => e.code && e.type === "procedure").map((e) => e.code!)
  )];

  return {
    icdCodes,
    cptCodes,
    diagnosisSummary: icdCodes.length > 0
      ? `${icdCodes.length} unique diagnoses documented`
      : "No ICD-10 codes in records",
    procedureSummary: cptCodes.length > 0
      ? `${cptCodes.length} procedures documented`
      : "No CPT codes in records",
    totalClaimableEvents: events.filter((e) =>
      ["procedure", "hospitalization", "lab", "imaging"].includes(e.type)
    ).length,
  };
}

function generateNarrative(input: HistorianInput, redFlags: RedFlag[]): string {
  const age = input.patientAge;
  const gender = input.patientGender;
  const conditions = input.medicalEvents
    .filter((e) => e.type === "diagnosis")
    .map((e) => e.description);
  const activeMeds = input.medications.filter((m) => m.isActive);
  const hospitalizations = input.medicalEvents.filter((e) => e.type === "hospitalization");

  let narrative = `## Clinical Summary\n\n`;
  narrative += `**Patient:** ${age}-year-old ${gender}\n\n`;

  if (input.allergies.length > 0) {
    narrative += `**Allergies:** ${input.allergies.join(", ")}\n\n`;
  }

  if (conditions.length > 0) {
    narrative += `### Active Conditions\n${conditions.map((c) => `- ${c}`).join("\n")}\n\n`;
  }

  if (activeMeds.length > 0) {
    narrative += `### Current Medications\n`;
    narrative += activeMeds.map((m) => `- **${m.name}** ${m.dosage} ${m.frequency}`).join("\n");
    narrative += "\n\n";
  }

  if (hospitalizations.length > 0) {
    narrative += `### Hospitalization History\n`;
    narrative += hospitalizations.map((h) => `- ${h.date}: ${h.description}`).join("\n");
    narrative += "\n\n";
  }

  if (redFlags.length > 0) {
    narrative += `### Clinical Alerts\n`;
    narrative += redFlags.map((f) => `- ⚠️ **${f.flag}** (${f.severity}): ${f.recommendation}`).join("\n");
    narrative += "\n\n";
  }

  if (input.socialHistory) {
    narrative += `### Social History\n`;
    if (input.socialHistory.smoking) narrative += `- Smoking: ${input.socialHistory.smoking}\n`;
    if (input.socialHistory.alcohol) narrative += `- Alcohol: ${input.socialHistory.alcohol}\n`;
    if (input.socialHistory.exercise) narrative += `- Exercise: ${input.socialHistory.exercise}\n`;
    narrative += "\n";
  }

  return narrative;
}

function generatePatientFriendlyNarrative(input: HistorianInput): string {
  const activeMeds = input.medications.filter((m) => m.isActive);

  let narrative = `# Your Health Summary\n\n`;
  narrative += `Here's a simple overview of your health records:\n\n`;

  if (input.allergies.length > 0) {
    narrative += `**⚠️ Allergies:** ${input.allergies.join(", ")}\n\n`;
  }

  const conditions = input.medicalEvents.filter((e) => e.type === "diagnosis");
  if (conditions.length > 0) {
    narrative += `**Health Conditions:**\n`;
    narrative += conditions.map((c) => `- ${c.description}`).join("\n");
    narrative += "\n\n";
  }

  if (activeMeds.length > 0) {
    narrative += `**Your Current Medications:**\n`;
    narrative += activeMeds.map((m) => `- ${m.name}: Take ${m.dosage}, ${m.frequency}`).join("\n");
    narrative += "\n\n";
  }

  narrative += `*This summary was generated automatically. Always consult your doctor for medical advice.*\n`;
  return narrative;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a comprehensive longitudinal clinical summary from patient records.
 *
 * @param input Patient medical history data.
 * @returns Complete longitudinal summary with timeline, red flags, and claim bundle.
 */
export function generateLongitudinalSummary(input: HistorianInput): LongitudinalSummary {
  log.info("Generating longitudinal summary", { patientId: input.patientId });

  const timeline = buildTimeline(input.medicalEvents);
  const redFlags = detectRedFlags(input);
  const interactions = detectInteractions(input.medications);
  const claimBundle = buildClaimBundle(input.medicalEvents);
  const clinicalNarrative = generateNarrative(input, redFlags);
  const patientFriendlyNarrative = generatePatientFriendlyNarrative(input);

  const activeMedications = input.medications.filter((m) => m.isActive);
  const activeConditions = input.medicalEvents
    .filter((e) => e.type === "diagnosis")
    .map((e) => e.description);

  const dates = input.medicalEvents
    .map((e) => new Date(e.date).getTime())
    .filter((t) => !isNaN(t));
  const yearsOfHistory = dates.length > 1
    ? Math.round((Math.max(...dates) - Math.min(...dates)) / (365.25 * 86400000))
    : 0;

  const uniqueProviders = new Set(
    input.medicalEvents.filter((e) => e.provider).map((e) => e.provider)
  ).size;

  const result: LongitudinalSummary = {
    patientId: input.patientId,
    generatedAt: new Date().toISOString(),
    clinicalNarrative,
    patientFriendlyNarrative,
    timeline,
    activeMedications,
    activeConditions,
    allergies: input.allergies,
    redFlags,
    medicationInteractions: interactions,
    claimBundle,
    statistics: {
      totalEvents: input.medicalEvents.length,
      yearsOfHistory,
      hospitalizationCount: input.medicalEvents.filter((e) => e.type === "hospitalization").length,
      uniqueProviders,
      uniqueMedications: new Set(input.medications.map((m) => m.name)).size,
    },
  };

  log.info("Longitudinal summary generated", {
    patientId: input.patientId,
    events: result.statistics.totalEvents,
    redFlags: result.redFlags.length,
    interactions: result.medicationInteractions.length,
  });

  return result;
}
