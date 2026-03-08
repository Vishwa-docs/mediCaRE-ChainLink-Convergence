/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — AI Medical Historian
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   HTTP / Cron  (periodic longitudinal summary
 *             generation or on-demand via patient request)
 *
 *  Flow:
 *    1. Receive patient address (HTTP) or iterate patients (Cron)
 *    2. Read all record CIDs from EHRStorage on-chain
 *    3. Fetch full records via Confidential HTTP (TEE-secured)
 *    4. Aggregate into timeline: diagnoses, medications, procedures
 *    5. LLM generates 1-page longitudinal clinical summary
 *    6. Detect medication interactions + red-flag patterns
 *    7. Store summary hash on-chain via setLongitudinalSummary()
 *    8. Return structured summary to caller
 *
 *  Capabilities used:
 *    • HTTP Trigger / Cron Trigger
 *    • EVM Read             (patient record list)
 *    • Confidential HTTP    (IPFS record fetch in TEE)
 *    • Standard HTTP        (LLM summarization API)
 *    • EVM Write            (store summary hash)
 *    • Secrets              (IPFS gateway, AI API key)
 *
 *  @module medical-historian
 */

import {
  HTTPClient,
  EVMClient,
  HTTPTrigger,
  Runtime,
  Handler,
  Workflow,
} from "@chainlink/cre-sdk";

// ── Config ───────────────────────────────────────────────────

interface Config {
  chainName: string;
  ehrStorageAddress: string;
  medicalDataUrl: string;
  summarizationUrl: string;
  gasLimit: number;
  lookbackYears: number;
  cronSchedule: string;
}

// ── HTTP trigger payload ─────────────────────────────────────

interface HistorianRequest {
  patientAddress: string;
  requestedBy: string;
  purpose: string;
  includeRedFlags: boolean;
  includeMedInteractions: boolean;
}

// ── On-chain record reference ────────────────────────────────

interface RecordRef {
  recordId: number;
  ipfsCid: string;
  recordType: string;
  timestamp: number;
  providerAddress: string;
}

// ── Fetched medical record ───────────────────────────────────

interface MedicalRecord {
  recordId: number;
  type: string;
  date: string;
  provider: string;
  diagnosis?: string[];
  medications?: { name: string; dosage: string; startDate: string; endDate?: string }[];
  procedures?: { code: string; description: string; date: string }[];
  vitals?: { metric: string; value: number; unit: string }[];
  notes?: string;
}

// ── Summary output ───────────────────────────────────────────

interface LongitudinalSummary {
  patientAddress: string;
  generatedAt: string;
  recordCount: number;
  timelineSpanYears: number;
  summary: string;
  activeMedications: string[];
  chronicConditions: string[];
  allergies: string[];
  redFlags: string[];
  medicationInteractions: { drug1: string; drug2: string; severity: string; description: string }[];
  icdCodes: string[];
  summaryHash: string;
}

// ── Handler ──────────────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  // ─── Step 1: Get patient address from trigger ─────────────
  const trigger = runtime.getTrigger<HTTPTrigger>();
  const request: HistorianRequest = trigger.getBody();

  runtime.log(
    `[MedicalHistorian] Generating summary for ${request.patientAddress}`
  );

  // ─── Step 2: Read record list from EHRStorage ─────────────
  const recordCount = await evm.read({
    contractAddress: config.ehrStorageAddress,
    method: "getPatientRecordCount(address)",
    args: [request.patientAddress],
  });

  const recordRefs: RecordRef[] = [];
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - config.lookbackYears * 365 * 24 * 3600;

  for (let i = 0; i < Number(recordCount); i++) {
    const ref = await evm.read({
      contractAddress: config.ehrStorageAddress,
      method: "getRecordByIndex(address,uint256)",
      args: [request.patientAddress, BigInt(i)],
    });

    if (Number(ref.timestamp) >= cutoffTimestamp) {
      recordRefs.push({
        recordId: Number(ref.recordId),
        ipfsCid: ref.ipfsCid as string,
        recordType: ref.recordType as string,
        timestamp: Number(ref.timestamp),
        providerAddress: ref.providerAddress as string,
      });
    }
  }

  runtime.log(
    `[MedicalHistorian] Found ${recordRefs.length} records within ${config.lookbackYears}-year window`
  );

  // ─── Step 3: Fetch records via Confidential HTTP ──────────
  const medicalRecords: MedicalRecord[] = [];

  for (const ref of recordRefs) {
    const recordResponse = await http.confidentialFetch(
      `${config.medicalDataUrl}/ipfs/${ref.ipfsCid}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secrets.get("IPFS_GATEWAY_TOKEN")}`,
          "X-Record-Type": ref.recordType,
        },
      }
    );
    medicalRecords.push(recordResponse.json() as MedicalRecord);
  }

  // ─── Step 4: Call LLM summarization API ───────────────────
  const summarizationPayload = {
    patientAddress: request.patientAddress,
    records: medicalRecords,
    options: {
      includeRedFlags: request.includeRedFlags,
      includeMedInteractions: request.includeMedInteractions,
      maxSummaryLength: 2000,
      format: "clinical",
    },
  };

  const summaryResponse = await http.fetch(
    `${config.summarizationUrl}/longitudinal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secrets.get("AI_API_KEY")}`,
      },
      body: JSON.stringify(summarizationPayload),
    }
  );

  const summary: LongitudinalSummary = summaryResponse.json();

  // ─── Step 5: Store summary hash on-chain ──────────────────
  await evm.write({
    contractAddress: config.ehrStorageAddress,
    method: "setLongitudinalSummary(address,bytes32)",
    args: [request.patientAddress, summary.summaryHash],
    gasLimit: config.gasLimit,
  });

  runtime.log(
    `[MedicalHistorian] Summary stored on-chain. Hash: ${summary.summaryHash}`
  );

  return {
    patientAddress: request.patientAddress,
    recordCount: medicalRecords.length,
    summaryHash: summary.summaryHash,
    redFlags: summary.redFlags,
    medicationInteractions: summary.medicationInteractions.length,
    chronicConditions: summary.chronicConditions,
  };
};

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "medical-historian",
  handler,
  trigger: {
    type: "http",
    config: {
      method: "POST",
      path: "/api/cre/medical-historian",
    },
  },
};

export default workflow;
