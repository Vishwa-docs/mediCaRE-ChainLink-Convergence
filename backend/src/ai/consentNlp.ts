/**
 * @module consentNlp
 * @description AI-Generated Smart Consent — NLP Module
 *
 * Parses plain-English consent statements into structured on-chain consent
 * parameters. Patients can type natural language like:
 *   "Only let Dr. Smith see my cardiology records for 2 weeks"
 *
 * The NLP engine extracts:
 *   - Provider identification
 *   - Data categories
 *   - Purpose limitations
 *   - Duration / expiry
 *   - Access scope
 */

import { createLogger } from "../utils/logging";

const log = createLogger("ai:consent-nlp");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConsentNlpInput {
  text: string;
  patientAddress: string;
}

export interface StructuredConsent {
  grantee: string | null;
  granteeType: "specific_provider" | "role" | "organization" | "any";
  dataCategories: string[];
  purposes: string[];
  durationDays: number | null; // null = indefinite
  scope: "read" | "read_write" | "full";
  restrictions: string[];
  confidence: number;
  parsedFrom: string;
  warnings: string[];
}

// ─── Knowledge Base ─────────────────────────────────────────────────────────

const DATA_CATEGORY_KEYWORDS: Record<string, string[]> = {
  CARDIOLOGY: ["cardiology", "cardiac", "heart", "ecg", "ekg", "echocardiogram", "cardiovascular"],
  LAB: ["lab", "laboratory", "blood", "bloodwork", "blood test", "panel", "cbc", "metabolic"],
  IMAGING: ["imaging", "x-ray", "xray", "mri", "ct scan", "ultrasound", "radiology", "scan"],
  PRESCRIPTION: ["prescription", "medication", "medicine", "drug", "rx", "pharmacy"],
  SURGICAL: ["surgery", "surgical", "operation", "procedure", "biopsy"],
  MENTAL_HEALTH: ["mental health", "psychiatry", "psychology", "therapy", "counseling", "behavioral"],
  ALLERGY: ["allergy", "allergies", "allergic", "immunology"],
  VITAL_SIGNS: ["vital", "blood pressure", "temperature", "pulse", "oxygen", "weight", "height"],
  DIAGNOSIS: ["diagnosis", "diagnoses", "condition", "disease", "prognosis"],
  ALL: ["all", "everything", "all records", "full access", "complete", "entire"],
};

const PURPOSE_KEYWORDS: Record<string, string[]> = {
  TREATMENT: ["treatment", "treat", "treating", "care", "medical care", "healthcare"],
  INSURANCE: ["insurance", "claim", "coverage", "billing", "reimbursement", "payout"],
  RESEARCH: ["research", "study", "clinical trial", "academic", "scientific"],
  SECOND_OPINION: ["second opinion", "consult", "consultation", "referral"],
  EMERGENCY: ["emergency", "urgent", "critical", "life-threatening"],
  AUDIT: ["audit", "compliance", "review", "inspection", "regulatory"],
};

const DURATION_PATTERNS: [RegExp, (match: RegExpMatchArray) => number][] = [
  [/(\d+)\s*day/i, (m) => parseInt(m[1])],
  [/(\d+)\s*week/i, (m) => parseInt(m[1]) * 7],
  [/(\d+)\s*month/i, (m) => parseInt(m[1]) * 30],
  [/(\d+)\s*year/i, (m) => parseInt(m[1]) * 365],
  [/indefinite|permanent|forever|no\s*expir/i, () => 0], // 0 = indefinite
  [/one\s*time|single\s*use|once/i, () => 1],
];

const SCOPE_PATTERNS: Record<string, RegExp> = {
  read: /view|read|see|look|access|check|review/i,
  read_write: /update|modify|edit|add|write|change/i,
  full: /full|complete|everything|unrestricted|all\s*access/i,
};

const RESTRICTION_PATTERNS: [RegExp, string][] = [
  [/no\s*sharing|don't\s*share|do\s*not\s*share/i, "NO_THIRD_PARTY_SHARING"],
  [/anonymi[sz]ed|de-?identified|no\s*name/i, "ANONYMIZED_ONLY"],
  [/encrypt/i, "REQUIRE_ENCRYPTION"],
  [/no\s*copy|don't\s*copy/i, "NO_COPYING"],
  [/notify|alert\s*me|let\s*me\s*know/i, "NOTIFY_ON_ACCESS"],
];

// ─── NLP Engine ─────────────────────────────────────────────────────────────

function extractProvider(text: string): { grantee: string | null; granteeType: StructuredConsent["granteeType"] } {
  // Named provider pattern: "Dr. Smith", "Doctor Johnson"
  const drMatch = text.match(/(?:dr\.?|doctor)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  if (drMatch) {
    return { grantee: `Dr. ${drMatch[1]}`, granteeType: "specific_provider" };
  }

  // Organization pattern
  const orgMatch = text.match(/(?:hospital|clinic|center|institute|lab)\s+(?:of\s+)?([a-z\s]+?)(?:\s+(?:for|to|can|may|with)|$)/i);
  if (orgMatch) {
    return { grantee: orgMatch[1].trim(), granteeType: "organization" };
  }

  // Role-based patterns
  const rolePatterns: Record<string, RegExp> = {
    cardiologist: /cardiologist/i,
    surgeon: /surgeon/i,
    specialist: /specialist/i,
    nurse: /nurse/i,
    pharmacist: /pharmacist/i,
    insurance_provider: /insurance|insurer/i,
    researcher: /researcher/i,
    paramedic: /paramedic|emt|emergency\s*responder/i,
  };

  for (const [role, pattern] of Object.entries(rolePatterns)) {
    if (pattern.test(text)) {
      return { grantee: role, granteeType: "role" };
    }
  }

  // "anyone" / "everybody" pattern
  if (/anyone|anybody|everyone|everybody/i.test(text)) {
    return { grantee: null, granteeType: "any" };
  }

  // "my" patterns (my doctor, my provider)
  const myMatch = text.match(/my\s+(doctor|provider|physician|specialist|care\s*team)/i);
  if (myMatch) {
    return { grantee: `my ${myMatch[1]}`, granteeType: "role" };
  }

  return { grantee: null, granteeType: "any" };
}

function extractCategories(text: string): string[] {
  const found: string[] = [];
  for (const [category, keywords] of Object.entries(DATA_CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.toLowerCase().includes(kw))) {
      if (category === "ALL") return ["ALL"];
      found.push(category);
    }
  }
  return found.length > 0 ? found : ["ALL"];
}

function extractPurposes(text: string): string[] {
  const found: string[] = [];
  for (const [purpose, keywords] of Object.entries(PURPOSE_KEYWORDS)) {
    if (keywords.some((kw) => text.toLowerCase().includes(kw))) {
      found.push(purpose);
    }
  }
  return found.length > 0 ? found : ["TREATMENT"];
}

function extractDuration(text: string): number | null {
  for (const [pattern, extractor] of DURATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const days = extractor(match);
      return days === 0 ? null : days;
    }
  }
  return null;
}

function extractScope(text: string): StructuredConsent["scope"] {
  if (SCOPE_PATTERNS.full.test(text)) return "full";
  if (SCOPE_PATTERNS.read_write.test(text)) return "read_write";
  return "read";
}

function extractRestrictions(text: string): string[] {
  const found: string[] = [];
  for (const [pattern, restriction] of RESTRICTION_PATTERNS) {
    if (pattern.test(text)) {
      found.push(restriction);
    }
  }
  return found;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a natural-language consent statement into structured parameters.
 *
 * @example
 * parseConsent({
 *   text: "Only let Dr. Smith see my cardiology records for 2 weeks",
 *   patientAddress: "0x..."
 * })
 * // Returns: { grantee: "Dr. Smith", dataCategories: ["CARDIOLOGY"], durationDays: 14, ... }
 */
export function parseConsent(input: ConsentNlpInput): StructuredConsent {
  log.info("Parsing consent statement", { length: input.text.length });

  const { grantee, granteeType } = extractProvider(input.text);
  const dataCategories = extractCategories(input.text);
  const purposes = extractPurposes(input.text);
  const durationDays = extractDuration(input.text);
  const scope = extractScope(input.text);
  const restrictions = extractRestrictions(input.text);

  // Calculate confidence based on how many fields we could extract
  let confidence = 0.4; // Base confidence
  if (grantee) confidence += 0.15;
  if (dataCategories[0] !== "ALL") confidence += 0.15;
  if (purposes[0] !== "TREATMENT") confidence += 0.1;
  if (durationDays !== null) confidence += 0.1;
  if (restrictions.length > 0) confidence += 0.1;
  confidence = Math.min(1, confidence);

  // Generate warnings
  const warnings: string[] = [];
  if (!grantee && granteeType === "any") {
    warnings.push("No specific provider identified — consent applies broadly");
  }
  if (dataCategories.includes("ALL")) {
    warnings.push("Granting access to ALL data categories — consider narrowing scope");
  }
  if (durationDays === null) {
    warnings.push("No expiration specified — consent will be indefinite");
  }
  if (dataCategories.includes("MENTAL_HEALTH")) {
    warnings.push("Mental health records have additional regulatory protections under 42 CFR Part 2");
  }

  const result: StructuredConsent = {
    grantee,
    granteeType,
    dataCategories,
    purposes,
    durationDays,
    scope,
    restrictions,
    confidence,
    parsedFrom: input.text,
    warnings,
  };

  log.info("Consent parsed", {
    grantee: result.grantee,
    categories: result.dataCategories.length,
    confidence: result.confidence,
  });

  return result;
}

/**
 * Generate a human-readable confirmation summary from structured consent.
 */
export function consentToSummary(consent: StructuredConsent): string {
  const who = consent.grantee ?? "any authorized provider";
  const what = consent.dataCategories.join(", ");
  const why = consent.purposes.join(", ");
  const duration = consent.durationDays
    ? `for ${consent.durationDays} days`
    : "indefinitely";
  const scope = consent.scope === "read" ? "view" : consent.scope === "read_write" ? "view and update" : "fully access";

  let summary = `You are allowing **${who}** to **${scope}** your **${what}** records for **${why}** purposes ${duration}.`;

  if (consent.restrictions.length > 0) {
    summary += ` Restrictions: ${consent.restrictions.join(", ")}.`;
  }

  return summary;
}
