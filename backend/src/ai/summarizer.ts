import axios, { AxiosError } from "axios";
import config from "../config";
import { EHRSummary } from "../types";
import { createLogger } from "../utils/logging";

const log = createLogger("ai:summarizer");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/** System prompt instructing the LLM to extract structured clinical data. */
const SYSTEM_PROMPT = `You are an expert clinical NLP engine. Given a patient's electronic health record (EHR) text, extract and return a JSON object with these exact keys:

{
  "diagnoses": ["list of diagnoses"],
  "medications": [{"name": "...", "dosage": "...", "frequency": "...", "startDate": "...", "endDate": "..."}],
  "allergies": ["list of known allergies"],
  "procedures": ["list of past or planned procedures"],
  "redFlags": ["urgent clinical findings that need immediate attention"],
  "narrative": "A concise 2-4 sentence clinical summary suitable for a physician."
}

Rules:
- Return ONLY valid JSON, no markdown fences or extra text.
- If a field has no data, use an empty array or empty string.
- For medications, include dosage and frequency when available.
- Red flags include: critical lab values, drug interactions, suicidal ideation, unstable vitals, newly discovered malignancies, or any finding requiring urgent intervention.
- Be precise and use standard medical terminology.`;

/** Prompt suffix for translation. */
function translationInstruction(lang: string): string {
  if (lang === "en") return "";
  return `\n\nIMPORTANT: Translate ALL output values (not JSON keys) into the language with ISO 639-1 code "${lang}". Keep medical terms in English in parentheses when translating.`;
}

/**
 * Summarise raw EHR text using an OpenAI-compatible LLM endpoint.
 *
 * @param ehrText  - Raw EHR content (plain text, HL7, or JSON-formatted).
 * @param language - ISO 639-1 language code for the output (default "en").
 * @param patientId - Optional patient identifier to include in the result.
 * @returns Structured {@link EHRSummary}.
 */
export async function summariseEHR(
  ehrText: string,
  language = "en",
  patientId = "unknown",
): Promise<EHRSummary> {
  log.info("Starting EHR summarisation", {
    patientId,
    inputLength: ehrText.length,
    language,
  });

  const systemMessage = SYSTEM_PROMPT + translationInstruction(language);

  const body = {
    messages: [
      { role: "system", content: systemMessage },
      {
        role: "user",
        content: `Summarise the following EHR:\n\n${ehrText}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log.debug(`LLM request attempt ${attempt}/${MAX_RETRIES}`);

      const response = await axios.post(config.azureOpenAI.chatUrl, body, {
        headers: {
          "Content-Type": "application/json",
          "api-key": config.azureOpenAI.apiKey,
        },
        timeout: 60_000,
      });

      const content: string =
        response.data?.choices?.[0]?.message?.content ?? "{}";

      const parsed = parseResponse(content);

      const summary: EHRSummary = {
        patientId,
        diagnoses: parsed.diagnoses ?? [],
        medications: (parsed.medications ?? []).map((m: any) => ({
          name: m.name ?? "",
          dosage: m.dosage ?? "",
          frequency: m.frequency ?? "",
          startDate: m.startDate,
          endDate: m.endDate,
        })),
        allergies: parsed.allergies ?? [],
        procedures: parsed.procedures ?? [],
        redFlags: parsed.redFlags ?? [],
        narrative: parsed.narrative ?? "",
        language,
        generatedAt: new Date().toISOString(),
      };

      log.info("EHR summarisation complete", {
        patientId,
        diagnosesCount: summary.diagnoses.length,
        redFlagsCount: summary.redFlags.length,
      });

      return summary;
    } catch (err) {
      lastError = err as Error;
      const isRetryable = isRetryableError(err);
      log.warn(`LLM request failed (attempt ${attempt})`, {
        error: (err as Error).message,
        retryable: isRetryable,
      });

      if (!isRetryable || attempt === MAX_RETRIES) break;

      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  log.error("EHR summarisation failed after retries", {
    error: lastError?.message,
  });
  throw new Error(
    `EHR summarisation failed: ${lastError?.message ?? "unknown error"}`,
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseResponse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    // Attempt to extract JSON from markdown code fences
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) {
      return JSON.parse(match[1].trim());
    }
    throw new Error("LLM returned non-JSON response");
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    return status === 429 || status === 500 || status === 502 || status === 503;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
