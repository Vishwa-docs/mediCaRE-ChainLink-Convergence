import axios, { AxiosInstance } from "axios";
import config from "../config";
import {
  FHIRPatient,
  FHIRCondition,
  FHIRMedicationRequest,
  FHIRObservation,
  FHIRPatientBundle,
  EHRRecord,
} from "../types";
import { createLogger } from "../utils/logging";

const log = createLogger("service:fhir");

/** Lazily initialised Axios instance targeting the FHIR R4 server. */
let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!client) {
    const headers: Record<string, string> = {
      Accept: "application/fhir+json",
      "Content-Type": "application/fhir+json",
    };
    if (config.fhir.authToken) {
      headers.Authorization = `Bearer ${config.fhir.authToken}`;
    }
    client = axios.create({
      baseURL: config.fhir.baseUrl,
      headers,
      timeout: 30_000,
    });
  }
  return client;
}

// ─── Patient ────────────────────────────────────────────────────────────────

/**
 * Fetch a FHIR Patient resource by ID.
 */
export async function getPatient(patientId: string): Promise<FHIRPatient> {
  log.info("Fetching FHIR Patient", { patientId });
  const { data } = await getClient().get(`/Patient/${patientId}`);
  return mapPatient(data);
}

/**
 * Search patients by name.
 */
export async function searchPatients(name: string): Promise<FHIRPatient[]> {
  log.info("Searching FHIR Patients", { name });
  const { data } = await getClient().get("/Patient", {
    params: { name, _count: 20 },
  });
  return extractEntries(data).map(mapPatient);
}

// ─── Condition ──────────────────────────────────────────────────────────────

/**
 * Fetch Condition resources associated with a patient.
 */
export async function getConditions(
  patientId: string,
): Promise<FHIRCondition[]> {
  log.info("Fetching FHIR Conditions", { patientId });
  const { data } = await getClient().get("/Condition", {
    params: { patient: patientId, _count: 100 },
  });
  return extractEntries(data).map(mapCondition);
}

// ─── MedicationRequest ──────────────────────────────────────────────────────

/**
 * Fetch MedicationRequest resources for a patient.
 */
export async function getMedications(
  patientId: string,
): Promise<FHIRMedicationRequest[]> {
  log.info("Fetching FHIR MedicationRequests", { patientId });
  const { data } = await getClient().get("/MedicationRequest", {
    params: { patient: patientId, _count: 100 },
  });
  return extractEntries(data).map(mapMedicationRequest);
}

// ─── Observation ────────────────────────────────────────────────────────────

/**
 * Fetch Observation resources for a patient, optionally filtered by code.
 */
export async function getObservations(
  patientId: string,
  code?: string,
): Promise<FHIRObservation[]> {
  log.info("Fetching FHIR Observations", { patientId, code });
  const params: Record<string, string | number> = {
    patient: patientId,
    _count: 200,
    _sort: "-date",
  };
  if (code) params.code = code;
  const { data } = await getClient().get("/Observation", { params });
  return extractEntries(data).map(mapObservation);
}

// ─── Composite ──────────────────────────────────────────────────────────────

/**
 * Fetch a complete patient bundle (patient + conditions + meds + observations).
 */
export async function getPatientBundle(
  patientId: string,
): Promise<FHIRPatientBundle> {
  log.info("Building FHIR patient bundle", { patientId });

  const [patient, conditions, medications, observations] = await Promise.all([
    getPatient(patientId),
    getConditions(patientId),
    getMedications(patientId),
    getObservations(patientId),
  ]);

  return { patient, conditions, medications, observations };
}

/**
 * Convert a FHIR patient bundle into a flat internal EHR text representation
 * suitable for feeding into the AI summariser.
 */
export function bundleToEHRText(bundle: FHIRPatientBundle): string {
  const lines: string[] = [];

  lines.push(`Patient: ${bundle.patient.name}`);
  lines.push(`DOB: ${bundle.patient.birthDate}  Gender: ${bundle.patient.gender}`);
  lines.push("");

  if (bundle.conditions.length > 0) {
    lines.push("== CONDITIONS ==");
    for (const c of bundle.conditions) {
      lines.push(`- ${c.display} (${c.clinicalStatus})${c.onsetDate ? ` onset ${c.onsetDate}` : ""}`);
    }
    lines.push("");
  }

  if (bundle.medications.length > 0) {
    lines.push("== MEDICATIONS ==");
    for (const m of bundle.medications) {
      lines.push(`- ${m.medicationName} ${m.dosage} [${m.status}]`);
    }
    lines.push("");
  }

  if (bundle.observations.length > 0) {
    lines.push("== OBSERVATIONS ==");
    for (const o of bundle.observations) {
      lines.push(`- ${o.display}: ${o.value} ${o.unit} (${o.effectiveDate})`);
    }
  }

  return lines.join("\n");
}

// ─── Mappers ────────────────────────────────────────────────────────────────

function extractEntries(bundle: any): any[] {
  if (!bundle?.entry || !Array.isArray(bundle.entry)) return [];
  return bundle.entry.map((e: any) => e.resource).filter(Boolean);
}

function mapPatient(r: any): FHIRPatient {
  const nameObj = r.name?.[0];
  const name = nameObj
    ? `${nameObj.given?.join(" ") ?? ""} ${nameObj.family ?? ""}`.trim()
    : "Unknown";

  return {
    id: r.id ?? "",
    name,
    birthDate: r.birthDate ?? "",
    gender: r.gender ?? "",
    address: r.address?.[0]?.text,
    phone: r.telecom?.find((t: any) => t.system === "phone")?.value,
  };
}

function mapCondition(r: any): FHIRCondition {
  return {
    id: r.id ?? "",
    code: r.code?.coding?.[0]?.code ?? "",
    display: r.code?.coding?.[0]?.display ?? r.code?.text ?? "",
    clinicalStatus: r.clinicalStatus?.coding?.[0]?.code ?? "",
    onsetDate: r.onsetDateTime ?? r.onsetPeriod?.start,
  };
}

function mapMedicationRequest(r: any): FHIRMedicationRequest {
  const medName =
    r.medicationCodeableConcept?.coding?.[0]?.display ??
    r.medicationCodeableConcept?.text ??
    "";

  const dosageText =
    r.dosageInstruction?.[0]?.text ??
    r.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity
      ? `${r.dosageInstruction[0].doseAndRate[0].doseQuantity.value} ${r.dosageInstruction[0].doseAndRate[0].doseQuantity.unit}`
      : "";

  return {
    id: r.id ?? "",
    medicationName: medName,
    dosage: dosageText,
    status: r.status ?? "",
    authoredOn: r.authoredOn,
  };
}

function mapObservation(r: any): FHIRObservation {
  let value: number | string = "";
  let unit = "";

  if (r.valueQuantity) {
    value = r.valueQuantity.value ?? "";
    unit = r.valueQuantity.unit ?? "";
  } else if (r.valueString) {
    value = r.valueString;
  } else if (r.valueCodeableConcept) {
    value = r.valueCodeableConcept.text ?? r.valueCodeableConcept.coding?.[0]?.display ?? "";
  }

  return {
    id: r.id ?? "",
    code: r.code?.coding?.[0]?.code ?? "",
    display: r.code?.coding?.[0]?.display ?? r.code?.text ?? "",
    value,
    unit,
    effectiveDate: r.effectiveDateTime ?? r.effectivePeriod?.start ?? "",
  };
}
