/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Opt-In Data Marketplace
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   HTTP  (researcher requests anonymized data set)
 *
 *  Flow:
 *    1. Receive data request (researcher, data categories, purpose)
 *    2. Check researcher credentials on-chain
 *    3. Read research consent tokens (opt-in patients) from Governance
 *    4. Fetch consented patients' records via Confidential HTTP
 *    5. Anonymize/de-identify data inside TEE via LLM pipeline
 *    6. Deliver anonymized dataset via secure channel
 *    7. Record payment event on-chain (CCIP cross-chain if needed)
 *    8. Emit DataAccessGranted event for audit trail
 *
 *  Capabilities used:
 *    • HTTP Trigger
 *    • EVM Read             (consent tokens, credentials)
 *    • Confidential HTTP    (record fetch + anonymization in TEE)
 *    • EVM Write            (payment record, audit event)
 *    • Secrets              (IPFS/AI keys, payment tokens)
 *
 *  @module data-marketplace
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
  governanceAddress: string;
  ehrStorageAddress: string;
  ccipRouterAddress: string;
  anonymizationUrl: string;
  gasLimit: number;
  paymentTokenAddress: string;
}

// ── HTTP trigger payload ─────────────────────────────────────

interface DataRequest {
  researcherAddress: string;
  institution: string;
  purpose: string;
  dataCategories: string[]; // "diagnoses", "medications", "vitals", "procedures"
  sampleSize: number;
  paymentAmount: number;
  paymentToken: string;
  destinationChain?: string; // for CCIP payment
}

// ── Anonymized dataset output ────────────────────────────────

interface AnonymizedDataset {
  requestId: string;
  recordCount: number;
  categories: string[];
  anonymizationMethod: string;
  dataHash: string;
  deliveryUrl: string;
  expiresAt: string;
}

// ── Handler ──────────────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  const trigger = runtime.getTrigger<HTTPTrigger>();
  const request: DataRequest = trigger.getBody();

  runtime.log(
    `[DataMarketplace] Data request from ${request.institution}: ` +
    `${request.dataCategories.join(", ")}`
  );

  // ─── Step 1: Verify researcher credentials ────────────────
  const isVerified = await evm.read({
    contractAddress: config.governanceAddress,
    method: "hasRole(bytes32,address)",
    args: [
      "0x" + Buffer.from("RESEARCHER_ROLE").toString("hex").padEnd(64, "0"),
      request.researcherAddress,
    ],
  });

  if (!isVerified) {
    return {
      error: "Researcher not verified. RESEARCHER_ROLE required.",
      granted: false,
    };
  }

  // ─── Step 2: Get opted-in patients ────────────────────────
  const consentedPatients = await evm.read({
    contractAddress: config.governanceAddress,
    method: "getResearchConsentedPatients()",
    args: [],
  });

  const patients = (consentedPatients as string[]).slice(0, request.sampleSize);
  runtime.log(
    `[DataMarketplace] ${patients.length} consented patients available`
  );

  if (patients.length === 0) {
    return {
      error: "No patients have opted in to research data sharing.",
      granted: false,
    };
  }

  // ─── Step 3: Fetch + anonymize in TEE ─────────────────────
  const anonymizedResponse = await http.confidentialFetch(
    `${config.anonymizationUrl}/batch`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secrets.get("AI_API_KEY")}`,
      },
      body: JSON.stringify({
        patientAddresses: patients,
        categories: request.dataCategories,
        anonymizationLevel: "full_deidentification",
        outputFormat: "FHIR_R4",
      }),
    }
  );

  const dataset: AnonymizedDataset = anonymizedResponse.json();

  // ─── Step 4: Record payment on-chain ──────────────────────
  const paymentTx = await evm.write({
    contractAddress: config.governanceAddress,
    method: "recordDataPayment(address,string,uint256,uint256)",
    args: [
      request.researcherAddress,
      dataset.requestId,
      BigInt(request.paymentAmount),
      BigInt(patients.length),
    ],
    gasLimit: config.gasLimit,
  });

  // ─── Step 5: Emit audit event ─────────────────────────────
  await evm.write({
    contractAddress: config.ehrStorageAddress,
    method: "recordDataAccessEvent(address,string,uint256,bytes32)",
    args: [
      request.researcherAddress,
      request.purpose,
      BigInt(patients.length),
      dataset.dataHash,
    ],
    gasLimit: config.gasLimit,
  });

  runtime.log(
    `[DataMarketplace] Dataset delivered. Records: ${dataset.recordCount}, ` +
    `Hash: ${dataset.dataHash}`
  );

  return {
    granted: true,
    requestId: dataset.requestId,
    recordCount: dataset.recordCount,
    categories: dataset.categories,
    anonymizationMethod: dataset.anonymizationMethod,
    dataHash: dataset.dataHash,
    deliveryUrl: dataset.deliveryUrl,
    expiresAt: dataset.expiresAt,
    paymentTxHash: paymentTx.hash,
  };
};

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "data-marketplace",
  handler,
  trigger: {
    type: "http",
    config: {
      method: "POST",
      path: "/api/cre/data-marketplace",
    },
  },
};

export default workflow;
