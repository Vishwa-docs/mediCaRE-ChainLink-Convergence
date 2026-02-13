/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Consent Enforcement
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   HTTP  (called when a healthcare provider requests
 *             access to a patient's medical record)
 *
 *  Flow:
 *    1. Receive access request with provider + patient + record ID
 *    2. Read on-chain consent status from EHRStorage.checkAccess()
 *    3. Verify provider credentials from CredentialRegistry
 *    4. If valid, fetch record from IPFS via Confidential HTTP
 *    5. Write access audit log on-chain via EVM Write
 *    6. Return record data (or rejection) as HTTP response
 *
 *  Capabilities used:
 *    • HTTP Trigger
 *    • EVM Read           (consent check, credential verification)
 *    • Confidential HTTP  (fetch sensitive record)
 *    • EVM Write          (access audit log)
 *    • Secrets            (IPFS gateway token)
 *
 *  @module consent
 */

import {
  HTTPClient,
  EVMClient,
  HTTPTrigger,
  Runtime,
  Handler,
  Workflow,
} from "@chainlink/cre-sdk";

// ── Config schema ────────────────────────────────────────────

interface Config {
  chainName: string;
  ehrStorageAddress: string;
  credentialRegistryAddress: string;
  ipfsGatewayUrl: string;
  authorizedEVMAddress: string;
  gasLimit: number;
}

// ── HTTP trigger payload ─────────────────────────────────────

interface AccessRequestPayload {
  /** Provider's Ethereum address */
  providerAddress: string;
  /** Patient's Ethereum address */
  patientAddress: string;
  /** On-chain record ID to access */
  recordId: number;
  /** Purpose of access (audit trail) */
  purpose: string;
  /** Request timestamp (ISO 8601) */
  requestTime: string;
}

// ── Access decision response ─────────────────────────────────

interface AccessResponse {
  granted: boolean;
  reason: string;
  /** Base64-encoded encrypted record (only if granted) */
  encryptedRecord?: string;
  /** Provider credential details */
  credential?: {
    credentialId: number;
    credentialType: string;
    isValid: boolean;
    isExpired: boolean;
  };
  /** On-chain audit log tx hash */
  auditTxHash?: string;
}

// ── On-chain structs for EVM Read responses ──────────────────

interface CheckAccessResult {
  hasAccess: boolean;
}

interface VerifyCredentialResult {
  isValid: boolean;
  isExpired: boolean;
  credential: {
    credentialId: bigint;
    credentialHash: string;
    issuer: string;
    subject: string;
    credentialType: number;
    issuanceDate: bigint;
    expiryDate: bigint;
    isValid: boolean;
  };
}

interface GetRecordResult {
  recordId: bigint;
  patient: string;
  ipfsCidHash: string;
  aiSummaryHash: string;
  recordType: string;
  createdAt: bigint;
  updatedAt: bigint;
  isActive: boolean;
}

// ── Audit log report struct ──────────────────────────────────

interface AccessAuditReport {
  provider: string;       // address
  patient: string;        // address
  recordId: number;       // uint256
  granted: boolean;       // bool
  purpose: string;        // string
  timestamp: number;      // uint256
}

// ──────────────────────────────────────────────────────────────
//  Handler: onConsentRequest
// ──────────────────────────────────────────────────────────────

async function onConsentRequest(
  config: Config,
  runtime: Runtime,
  payload: { input: Uint8Array; key: string },
): Promise<AccessResponse> {
  const logger = runtime.logger();
  logger.info("consent workflow triggered");

  // ── 1. Parse the incoming request ──────────────────────────
  const request: AccessRequestPayload = JSON.parse(
    new TextDecoder().decode(payload.input),
  );

  logger.info("Access request received", {
    provider: request.providerAddress,
    patient: request.patientAddress,
    recordId: request.recordId,
    purpose: request.purpose,
  });

  const evmClient = new EVMClient({ chainName: config.chainName });

  // ── 2. Check on-chain consent ──────────────────────────────
  //    Calls EHRStorage.checkAccess(patient, provider) → bool

  const consentResult = await evmClient
    .readContract(runtime, {
      contractAddress: config.ehrStorageAddress,
      method: "checkAccess",
      args: [request.patientAddress, request.providerAddress],
      abi: [
        {
          name: "checkAccess",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "patient", type: "address" },
            { name: "provider", type: "address" },
          ],
          outputs: [{ name: "hasAccess", type: "bool" }],
        },
      ],
    })
    .result();

  const hasConsent = consentResult[0] as boolean;

  if (!hasConsent) {
    logger.warn("Consent denied — patient has not granted provider access", {
      provider: request.providerAddress,
      patient: request.patientAddress,
    });

    // Write denial to audit log
    await writeAuditLog(config, runtime, evmClient, request, false);

    return {
      granted: false,
      reason: "Patient has not granted access to this provider",
    };
  }

  logger.info("On-chain consent verified");

  // ── 3. Verify provider credentials ─────────────────────────
  //    Query CredentialRegistry for the provider's credentials
  //    and verify at least one is valid and non-expired.

  const credentialIds = await evmClient
    .readContract(runtime, {
      contractAddress: config.credentialRegistryAddress,
      method: "getProviderCredentials",
      args: [request.providerAddress],
      abi: [
        {
          name: "getProviderCredentials",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "provider", type: "address" }],
          outputs: [{ name: "credentialIds", type: "uint256[]" }],
        },
      ],
    })
    .result();

  const ids = credentialIds[0] as bigint[];

  if (!ids || ids.length === 0) {
    logger.warn("Provider has no registered credentials", {
      provider: request.providerAddress,
    });

    await writeAuditLog(config, runtime, evmClient, request, false);

    return {
      granted: false,
      reason: "Provider has no registered credentials in CredentialRegistry",
    };
  }

  // Verify the first credential (in production, check all or a specific type)
  const credVerify = await evmClient
    .readContract(runtime, {
      contractAddress: config.credentialRegistryAddress,
      method: "verifyCredential",
      args: [ids[0]],
      abi: [
        {
          name: "verifyCredential",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "credentialId", type: "uint256" }],
          outputs: [
            { name: "isValid", type: "bool" },
            { name: "isExpired", type: "bool" },
            {
              name: "credential",
              type: "tuple",
              components: [
                { name: "credentialId", type: "uint256" },
                { name: "credentialHash", type: "bytes32" },
                { name: "issuer", type: "address" },
                { name: "subject", type: "address" },
                { name: "credentialType", type: "uint8" },
                { name: "issuanceDate", type: "uint256" },
                { name: "expiryDate", type: "uint256" },
                { name: "isValid", type: "bool" },
              ],
            },
          ],
        },
      ],
    })
    .result();

  const isValid = credVerify[0] as boolean;
  const isExpired = credVerify[1] as boolean;

  if (!isValid) {
    const reason = isExpired
      ? "Provider credential has expired"
      : "Provider credential has been revoked";

    logger.warn(reason, { provider: request.providerAddress });

    await writeAuditLog(config, runtime, evmClient, request, false);

    return { granted: false, reason };
  }

  logger.info("Provider credential verified", {
    credentialId: Number(ids[0]),
    valid: isValid,
  });

  // ── 4. Fetch record metadata from EHRStorage ──────────────
  //    We need the IPFS CID hash to construct the gateway URL.

  const recordData = await evmClient
    .readContract(runtime, {
      contractAddress: config.ehrStorageAddress,
      method: "getRecord",
      args: [request.recordId],
      abi: [
        {
          name: "getRecord",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "recordId", type: "uint256" }],
          outputs: [
            {
              name: "record",
              type: "tuple",
              components: [
                { name: "recordId", type: "uint256" },
                { name: "patient", type: "address" },
                { name: "ipfsCidHash", type: "bytes32" },
                { name: "aiSummaryHash", type: "bytes32" },
                { name: "recordType", type: "string" },
                { name: "createdAt", type: "uint256" },
                { name: "updatedAt", type: "uint256" },
                { name: "isActive", type: "bool" },
              ],
            },
          ],
        },
      ],
    })
    .result();

  const record = recordData[0] as GetRecordResult;

  if (!record.isActive) {
    logger.warn("Record has been deactivated", {
      recordId: request.recordId,
    });
    return { granted: false, reason: "Record is no longer active" };
  }

  // ── 5. Fetch encrypted record via Confidential HTTP ────────

  const ipfsSecret = await runtime
    .getSecret({ id: "IPFS_GATEWAY_TOKEN", namespace: "main" })
    .result();

  const httpClient = new HTTPClient();

  // NOTE: In production the CID is recovered from the on-chain hash
  // via an off-chain lookup. For the workflow we receive it in the request.
  const ipfsResponse = await httpClient
    .sendConfidentialRequest(runtime, {
      url: `${config.ipfsGatewayUrl}/${record.ipfsCidHash}`,
      method: "GET",
      headers: {
        Authorization: `Bearer {{.IPFS_GATEWAY_TOKEN}}`,
      },
      encryptOutput: true,
    })
    .result();

  if (ipfsResponse.statusCode !== 200) {
    throw new Error(`IPFS fetch failed with status ${ipfsResponse.statusCode}`);
  }

  logger.info("Record fetched via Confidential HTTP", {
    recordId: request.recordId,
    bytes: ipfsResponse.body.length,
  });

  // ── 6. Write access audit log on-chain ─────────────────────

  const auditTxHash = await writeAuditLog(
    config,
    runtime,
    evmClient,
    request,
    true,
  );

  // ── 7. Return encrypted record to caller ───────────────────

  return {
    granted: true,
    reason: "Access granted — consent and credentials verified",
    encryptedRecord: Buffer.from(ipfsResponse.body).toString("base64"),
    credential: {
      credentialId: Number(ids[0]),
      credentialType: "LICENSE",
      isValid: true,
      isExpired: false,
    },
    auditTxHash,
  };
}

// ──────────────────────────────────────────────────────────────
//  Helper: write access audit log on-chain
// ──────────────────────────────────────────────────────────────

async function writeAuditLog(
  config: Config,
  runtime: Runtime,
  evmClient: EVMClient,
  request: AccessRequestPayload,
  granted: boolean,
): Promise<string> {
  const logger = runtime.logger();
  const now = await runtime.now().result();

  const auditReport: AccessAuditReport = {
    provider: request.providerAddress,
    patient: request.patientAddress,
    recordId: request.recordId,
    granted,
    purpose: request.purpose,
    timestamp: Math.floor(now.getTime() / 1000),
  };

  const report = await runtime
    .generateReport({
      encodedPayload: JSON.stringify(auditReport),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const tx = await evmClient
    .writeReport(runtime, config.ehrStorageAddress, report, {
      gasLimit: BigInt(config.gasLimit),
    })
    .result();

  logger.info("Access audit log written on-chain", {
    txHash: tx.hash,
    granted,
    provider: request.providerAddress,
    patient: request.patientAddress,
  });

  return tx.hash;
}

// ──────────────────────────────────────────────────────────────
//  Workflow initialisation
// ──────────────────────────────────────────────────────────────

export function initWorkflow(
  config: Config,
  logger: ReturnType<Runtime["logger"]>,
): Workflow<Config> {
  const trigger = new HTTPTrigger({
    authorizedKeys: config.authorizedEVMAddress
      ? [{ type: "ECDSA_EVM", publicKey: config.authorizedEVMAddress }]
      : [],
  });

  return [Handler(trigger, onConsentRequest)];
}

export default initWorkflow;
