import axios from "axios";
import config from "../config";
import { createLogger } from "../utils/logging";

const log = createLogger("ai:visit-summary");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ─── Pre-Visit Summary ─────────────────────────────────────────────────────

const PRE_VISIT_SYSTEM_PROMPT = `You are an expert clinical NLP engine preparing a pre-visit summary for a physician.
Given a patient's combined electronic health records, produce a comprehensive pre-visit preparation document as JSON:

{
  "patientOverview": "Brief patient demographics and relevant history summary",
  "activeConditions": ["list of current active conditions"],
  "currentMedications": [{"name": "...", "dosage": "...", "frequency": "...", "since": "..."}],
  "allergies": ["list of known allergies and adverse reactions"],
  "recentLabResults": [{"test": "...", "value": "...", "date": "...", "status": "normal|abnormal|critical"}],
  "upcomingProcedures": ["scheduled or recommended procedures"],
  "openIssues": ["unresolved clinical issues from prior visits"],
  "suggestedFocusAreas": ["recommended discussion topics for the upcoming visit"],
  "riskFactors": ["relevant risk factors that may affect treatment"],
  "immunizationStatus": "Overview of vaccination status and due immunizations",
  "lastVisitSummary": "Brief summary of the most recent visit",
  "confidence": 0.0
}

Rules:
- Return ONLY valid JSON, no markdown fences or extra text.
- If a field has no data, use an empty array or empty string.
- Use standard medical terminology with lay explanations in parentheses.
- Prioritize actionable clinical information.
- confidence is 0.0-1.0 indicating data completeness.`;

// ─── Post-Visit Summary ────────────────────────────────────────────────────

const POST_VISIT_SYSTEM_PROMPT = `You are an expert clinical NLP engine creating a post-visit documentation summary.
Given the physician's visit notes and patient context, produce a structured post-visit document as JSON:

{
  "visitDate": "ISO date of the visit",
  "chiefComplaint": "Primary reason for the visit",
  "subjective": "Patient-reported symptoms and concerns",
  "objective": {
    "vitals": {"bp": "...", "hr": "...", "temp": "...", "weight": "...", "bmi": "..."},
    "physicalExam": "Key physical examination findings",
    "labResults": "Relevant lab results discussed"
  },
  "assessment": ["list of diagnoses or clinical impressions"],
  "plan": [{"action": "...", "details": "...", "timeline": "..."}],
  "medicationChanges": [{"medication": "...", "change": "started|stopped|modified|continued", "details": "..."}],
  "referrals": [{"specialty": "...", "reason": "...", "urgency": "routine|urgent|emergent"}],
  "patientInstructions": ["actionable instructions for the patient in plain language"],
  "followUp": {"timeframe": "...", "reason": "...", "tests": ["labs or tests needed before next visit"]},
  "billingCodes": [{"code": "...", "description": "..."}],
  "redFlags": ["symptoms or findings requiring immediate attention if they occur"],
  "confidence": 0.0
}

Rules:
- Return ONLY valid JSON, no markdown fences or extra text.
- If a field has no data, use an empty array, empty string, or empty object.
- Use ICD-10 codes where possible for assessment items.
- Patient instructions should be in plain, understandable language.
- confidence is 0.0-1.0 indicating documentation completeness.`;

function translationInstruction(lang: string): string {
  if (lang === "en") return "";
  return `\n\nIMPORTANT: Translate ALL output values (not JSON keys) into the language with ISO 639-1 code "${lang}". Keep medical terms in English in parentheses when translating.`;
}

export interface PreVisitSummary {
  patientAddress: string;
  patientOverview: string;
  activeConditions: string[];
  currentMedications: Array<{ name: string; dosage: string; frequency: string; since: string }>;
  allergies: string[];
  recentLabResults: Array<{ test: string; value: string; date: string; status: string }>;
  upcomingProcedures: string[];
  openIssues: string[];
  suggestedFocusAreas: string[];
  riskFactors: string[];
  immunizationStatus: string;
  lastVisitSummary: string;
  confidence: number;
  generatedAt: string;
  language: string;
  recordCount: number;
  blockchainVerified: boolean;
}

export interface PostVisitSummary {
  patientAddress: string;
  visitDate: string;
  chiefComplaint: string;
  subjective: string;
  objective: {
    vitals: Record<string, string>;
    physicalExam: string;
    labResults: string;
  };
  assessment: string[];
  plan: Array<{ action: string; details: string; timeline: string }>;
  medicationChanges: Array<{ medication: string; change: string; details: string }>;
  referrals: Array<{ specialty: string; reason: string; urgency: string }>;
  patientInstructions: string[];
  followUp: { timeframe: string; reason: string; tests: string[] };
  billingCodes: Array<{ code: string; description: string }>;
  redFlags: string[];
  confidence: number;
  generatedAt: string;
  language: string;
  blockchainVerified: boolean;
  summaryHash: string;
}

/**
 * Generate a pre-visit summary by aggregating all on-chain records for a patient
 * and sending them to Azure OpenAI for comprehensive analysis.
 */
export async function generatePreVisitSummary(
  combinedEHRText: string,
  patientAddress: string,
  recordCount: number,
  language = "en",
): Promise<PreVisitSummary> {
  log.info("Generating pre-visit summary", { patientAddress, recordCount, language });

  const systemMessage = PRE_VISIT_SYSTEM_PROMPT + translationInstruction(language);

  const body = {
    messages: [
      { role: "system", content: systemMessage },
      {
        role: "user",
        content: `Generate a pre-visit preparation summary from the following ${recordCount} combined health records for patient ${patientAddress}:\n\n${combinedEHRText}`,
      },
    ],
    temperature: 0.15,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  };

  const result = await callAzureOpenAI(body);
  const parsed = parseResponse(result);

  const summary: PreVisitSummary = {
    patientAddress,
    patientOverview: parsed.patientOverview ?? "",
    activeConditions: parsed.activeConditions ?? [],
    currentMedications: (parsed.currentMedications ?? []).map((m: any) => ({
      name: m.name ?? "",
      dosage: m.dosage ?? "",
      frequency: m.frequency ?? "",
      since: m.since ?? "",
    })),
    allergies: parsed.allergies ?? [],
    recentLabResults: (parsed.recentLabResults ?? []).map((r: any) => ({
      test: r.test ?? "",
      value: r.value ?? "",
      date: r.date ?? "",
      status: r.status ?? "normal",
    })),
    upcomingProcedures: parsed.upcomingProcedures ?? [],
    openIssues: parsed.openIssues ?? [],
    suggestedFocusAreas: parsed.suggestedFocusAreas ?? [],
    riskFactors: parsed.riskFactors ?? [],
    immunizationStatus: parsed.immunizationStatus ?? "",
    lastVisitSummary: parsed.lastVisitSummary ?? "",
    confidence: parsed.confidence ?? 0,
    generatedAt: new Date().toISOString(),
    language,
    recordCount,
    blockchainVerified: true,
  };

  log.info("Pre-visit summary generated", {
    patientAddress,
    conditionsCount: summary.activeConditions.length,
    medicationsCount: summary.currentMedications.length,
  });

  return summary;
}

/**
 * Generate a post-visit summary from physician notes + patient context.
 */
export async function generatePostVisitSummary(
  visitNotes: string,
  patientContext: string,
  patientAddress: string,
  language = "en",
): Promise<PostVisitSummary> {
  log.info("Generating post-visit summary", { patientAddress, language });

  const systemMessage = POST_VISIT_SYSTEM_PROMPT + translationInstruction(language);

  const body = {
    messages: [
      { role: "system", content: systemMessage },
      {
        role: "user",
        content: `Patient context from on-chain records:\n${patientContext}\n\n---\n\nPhysician visit notes:\n${visitNotes}`,
      },
    ],
    temperature: 0.15,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  };

  const result = await callAzureOpenAI(body);
  const parsed = parseResponse(result);

  // Generate hash of the summary for on-chain storage
  const { ethers } = await import("ethers");
  const summaryHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(parsed)));

  const summary: PostVisitSummary = {
    patientAddress,
    visitDate: parsed.visitDate ?? new Date().toISOString().split("T")[0],
    chiefComplaint: parsed.chiefComplaint ?? "",
    subjective: parsed.subjective ?? "",
    objective: {
      vitals: parsed.objective?.vitals ?? {},
      physicalExam: parsed.objective?.physicalExam ?? "",
      labResults: parsed.objective?.labResults ?? "",
    },
    assessment: parsed.assessment ?? [],
    plan: (parsed.plan ?? []).map((p: any) => ({
      action: p.action ?? "",
      details: p.details ?? "",
      timeline: p.timeline ?? "",
    })),
    medicationChanges: (parsed.medicationChanges ?? []).map((m: any) => ({
      medication: m.medication ?? "",
      change: m.change ?? "continued",
      details: m.details ?? "",
    })),
    referrals: (parsed.referrals ?? []).map((r: any) => ({
      specialty: r.specialty ?? "",
      reason: r.reason ?? "",
      urgency: r.urgency ?? "routine",
    })),
    patientInstructions: parsed.patientInstructions ?? [],
    followUp: {
      timeframe: parsed.followUp?.timeframe ?? "",
      reason: parsed.followUp?.reason ?? "",
      tests: parsed.followUp?.tests ?? [],
    },
    billingCodes: (parsed.billingCodes ?? []).map((b: any) => ({
      code: b.code ?? "",
      description: b.description ?? "",
    })),
    redFlags: parsed.redFlags ?? [],
    confidence: parsed.confidence ?? 0,
    generatedAt: new Date().toISOString(),
    language,
    blockchainVerified: true,
    summaryHash,
  };

  log.info("Post-visit summary generated", {
    patientAddress,
    assessmentCount: summary.assessment.length,
    planCount: summary.plan.length,
    summaryHash,
  });

  return summary;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function callAzureOpenAI(body: Record<string, unknown>): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log.debug(`Azure OpenAI request attempt ${attempt}/${MAX_RETRIES}`);

      const response = await axios.post(config.azureOpenAI.chatUrl, body, {
        headers: {
          "Content-Type": "application/json",
          "api-key": config.azureOpenAI.apiKey,
        },
        timeout: 120_000,
      });

      return response.data?.choices?.[0]?.message?.content ?? "{}";
    } catch (err) {
      lastError = err as Error;
      const isRetryable =
        err instanceof axios.AxiosError &&
        (err.response?.status === 429 || err.response?.status === 500 || err.response?.status === 502 || err.response?.status === 503);

      log.warn(`Azure OpenAI request failed (attempt ${attempt})`, {
        error: (err as Error).message,
        retryable: isRetryable,
      });

      if (!isRetryable || attempt === MAX_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }

  throw new Error(`Azure OpenAI call failed: ${lastError?.message ?? "unknown error"}`);
}

function parseResponse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) {
      return JSON.parse(match[1].trim());
    }
    throw new Error("LLM returned non-JSON response");
  }
}
