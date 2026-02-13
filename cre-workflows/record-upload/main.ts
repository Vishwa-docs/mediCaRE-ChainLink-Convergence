/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Record Upload & AI Summarization
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   HTTP  (called by mediCaRE backend after a provider
 *             uploads an encrypted EHR to IPFS)
 *
 *  Flow:
 *    1. Receive upload notification with IPFS CID + patient address
 *    2. Fetch encrypted record from IPFS via Confidential HTTP
 *    3. Send record payload to AI summarization service
 *    4. Hash the summary and write metadata back to EHRStorage.sol
 *
 *  Capabilities used:
 *    • HTTP Trigger
 *    • Confidential HTTP  (IPFS fetch — sensitive medical data)
 *    • Standard HTTP      (AI service call)
 *    • EVM Write          (store summary hash on-chain)
 *    • Secrets            (API keys)
 *
 *  @module record-upload
 */

import {
  HTTPClient,
  EVMClient,
  HTTPTrigger,
  Runtime,
  Handler,
  Workflow,
} from "@chainlink/cre-sdk";

// ── Config schema (loaded from config.staging.json) ──────────

interface Config {
  chainName: string;
  ehrStorageAddress: string;
  ipfsGatewayUrl: string;
  aiSummarizerUrl: string;
  authorizedEVMAddress: string;
  gasLimit: number;
}

// ── HTTP trigger payload schema ──────────────────────────────

interface RecordUploadPayload {
  /** Patient's Ethereum address */
  patientAddress: string;
  /** IPFS CID where the encrypted EHR is stored */
  ipfsCid: string;
  /** Keccak-256 hash of the IPFS CID (bytes32) */
  ipfsCidHash: string;
  /** Record type label (e.g. "LAB", "IMAGING") */
  recordType: string;
  /** EHR record ID if this is an update, otherwise null */
  existingRecordId: number | null;
}

// ── AI summarization service response ────────────────────────

interface AiSummaryResponse {
  /** AI-generated clinical summary text */
  summary: string;
  /** Keccak-256 hash of the summary (hex) */
  summaryHash: string;
  /** Key diagnoses extracted */
  diagnoses: string[];
  /** Flagged items requiring review */
  flags: string[];
  /** Confidence score (0–1) */
  confidence: number;
}

// ── EVM write report struct (matches EHRStorage.sol) ─────────

interface RecordReport {
  patient: string;         // address
  ipfsCidHash: string;     // bytes32
  aiSummaryHash: string;   // bytes32
  recordType: string;      // string
}

// ──────────────────────────────────────────────────────────────
//  Handler: onRecordUpload
// ──────────────────────────────────────────────────────────────

async function onRecordUpload(
  config: Config,
  runtime: Runtime,
  payload: { input: Uint8Array; key: string },
): Promise<{ success: boolean; recordId?: string; summaryHash?: string }> {
  const logger = runtime.logger();
  logger.info("record-upload workflow triggered");

  // ── 1. Parse the incoming HTTP payload ─────────────────────
  const request: RecordUploadPayload = JSON.parse(
    new TextDecoder().decode(payload.input),
  );

  logger.info("Processing record upload", {
    patient: request.patientAddress,
    cid: request.ipfsCid,
    recordType: request.recordType,
  });

  // ── 2. Fetch encrypted EHR from IPFS via Confidential HTTP ─
  //    Confidential HTTP ensures the IPFS gateway token never
  //    leaves the secure enclave.  Only a single HTTP call is
  //    made (no per-node duplication).

  const ipfsSecret = await runtime
    .getSecret({ id: "IPFS_GATEWAY_TOKEN", namespace: "main" })
    .result();

  const httpClient = new HTTPClient();

  const ipfsResponse = await httpClient
    .sendConfidentialRequest(runtime, {
      url: `${config.ipfsGatewayUrl}/${request.ipfsCid}`,
      method: "GET",
      headers: {
        Authorization: `Bearer {{.IPFS_GATEWAY_TOKEN}}`,
        Accept: "application/octet-stream",
      },
      encryptOutput: true,   // AES-GCM encrypt the response
    })
    .result();

  if (ipfsResponse.statusCode !== 200) {
    logger.error("IPFS fetch failed", { status: ipfsResponse.statusCode });
    throw new Error(`IPFS fetch returned ${ipfsResponse.statusCode}`);
  }

  logger.info("Encrypted EHR fetched from IPFS", {
    bytes: ipfsResponse.body.length,
  });

  // ── 3. Call AI summarization service ───────────────────────
  //    Standard HTTP (multi-node consensus) — the AI response
  //    is public metadata so BFT consensus is appropriate.

  const aiApiKey = await runtime
    .getSecret({ id: "AI_SUMMARIZER_API_KEY", namespace: "main" })
    .result();

  const aiRequestBody = JSON.stringify({
    encryptedPayload: Buffer.from(ipfsResponse.body).toString("base64"),
    patientAddress: request.patientAddress,
    recordType: request.recordType,
    options: {
      language: "en",
      extractDiagnoses: true,
      flagAnomalies: true,
    },
  });

  const aiResponse = await httpClient
    .sendRequest(runtime, {
      url: config.aiSummarizerUrl,
      method: "POST",
      body: new TextEncoder().encode(aiRequestBody),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiApiKey.value}`,
      },
      cacheSettings: {
        store: true,
        maxAge: 60,  // seconds — ensures single execution across nodes
      },
    })
    .result();

  if (aiResponse.statusCode !== 200) {
    logger.error("AI summarization failed", { status: aiResponse.statusCode });
    throw new Error(`AI service returned ${aiResponse.statusCode}`);
  }

  const aiResult: AiSummaryResponse = JSON.parse(
    new TextDecoder().decode(aiResponse.body),
  );

  logger.info("AI summary generated", {
    diagnoses: aiResult.diagnoses.length,
    flags: aiResult.flags.length,
    confidence: aiResult.confidence,
    summaryHash: aiResult.summaryHash,
  });

  // ── 4. Write the summary hash back on-chain ───────────────
  //    EVM Write goes through KeystoneForwarder → EHRStorage
  //    consumer contract's onReport() handler.

  const evmClient = new EVMClient({ chainName: config.chainName });

  // ABI-encode the report payload matching EHRStorage consumer
  const reportData: RecordReport = {
    patient: request.patientAddress,
    ipfsCidHash: request.ipfsCidHash,
    aiSummaryHash: aiResult.summaryHash,
    recordType: request.recordType,
  };

  // Generate a cryptographically signed report
  const report = await runtime
    .generateReport({
      encodedPayload: JSON.stringify(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  // Submit the report on-chain via KeystoneForwarder
  const tx = await evmClient
    .writeReport(runtime, config.ehrStorageAddress, report, {
      gasLimit: BigInt(config.gasLimit),
    })
    .result();

  logger.info("Record metadata written on-chain", {
    txHash: tx.hash,
    patient: request.patientAddress,
    summaryHash: aiResult.summaryHash,
  });

  // ── 5. Return result (sent as HTTP response to caller) ────
  return {
    success: true,
    recordId: tx.hash,
    summaryHash: aiResult.summaryHash,
  };
}

// ──────────────────────────────────────────────────────────────
//  Workflow initialisation
// ──────────────────────────────────────────────────────────────

export function initWorkflow(
  config: Config,
  logger: ReturnType<Runtime["logger"]>,
): Workflow<Config> {
  // HTTP trigger — in production, restrict to authorized backend key
  const trigger = new HTTPTrigger({
    authorizedKeys: config.authorizedEVMAddress
      ? [{ type: "ECDSA_EVM", publicKey: config.authorizedEVMAddress }]
      : [],
  });

  return [Handler(trigger, onRecordUpload)];
}

// ──────────────────────────────────────────────────────────────
//  Entry point — CRE SDK auto-invokes main() during compilation
// ──────────────────────────────────────────────────────────────

export default initWorkflow;
