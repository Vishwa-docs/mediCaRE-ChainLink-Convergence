/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — World ID Verification
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   HTTP  (called when a user submits a World ID proof
 *             for provider or patient identity verification)
 *
 *  Flow:
 *    1. Receive World ID proof + subject address + credential type
 *    2. Verify the proof against the World ID Verify API
 *    3. If valid, write attestation to CredentialRegistry on-chain
 *    4. Return verification result as HTTP response
 *
 *  Capabilities used:
 *    • HTTP Trigger
 *    • Standard HTTP      (World ID verification API)
 *    • EVM Write          (issue credential attestation)
 *    • Secrets            (World ID app/action IDs)
 *
 *  @module worldid
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
  credentialRegistryAddress: string;
  worldIdVerifierUrl: string;
  authorizedEVMAddress: string;
  gasLimit: number;
}

// ── HTTP trigger payload ─────────────────────────────────────

interface WorldIdVerificationRequest {
  /** Subject's Ethereum address (patient or provider) */
  subjectAddress: string;
  /** World ID proof object from IDKit */
  proof: {
    /** Merkle root of the World ID identity set */
    merkle_root: string;
    /** Nullifier hash (unique per app + action + user) */
    nullifier_hash: string;
    /** ZK proof bytes */
    proof: string;
    /** Verification level: "orb" | "phone" */
    verification_level: "orb" | "phone";
  };
  /** The credential type to issue upon successful verification */
  credentialType: "LICENSE" | "BOARD_CERT" | "NPI" | "OTHER";
  /** Human-readable description of the credential */
  credentialDescription: string;
  /** Optional: credential expiry in days from now (0 = no expiry) */
  expiryDays: number;
  /** Signal data (application-specific context) */
  signal: string;
}

// ── World ID Verify API response ─────────────────────────────

interface WorldIdVerifyResponse {
  /** Whether the proof was successfully verified */
  success: boolean;
  /** The nullifier hash (returned on success) */
  nullifier_hash?: string;
  /** Error code (returned on failure) */
  code?: string;
  /** Error detail message */
  detail?: string;
  /** Attribute metadata (optional, available with orb level) */
  attribute?: string;
}

// ── Credential attestation report ────────────────────────────

interface CredentialAttestationReport {
  subject: string;           // address
  credentialHash: string;    // bytes32 — hash of the credential document
  credentialType: number;    // uint8  — enum CredentialType index
  issuanceDate: number;      // uint256 — Unix timestamp
  expiryDate: number;        // uint256 — Unix timestamp (0 = no expiry)
  nullifierHash: string;     // bytes32 — World ID nullifier
}

// ── Credential type enum mapping (mirrors CredentialRegistry.sol) ─

const CredentialTypeMap: Record<string, number> = {
  LICENSE: 0,
  BOARD_CERT: 1,
  SPECIALTY: 2,
  DEA: 3,
  NPI: 4,
  CME: 5,
  FELLOWSHIP: 6,
  OTHER: 7,
};

// ──────────────────────────────────────────────────────────────
//  Handler: onWorldIdVerification
// ──────────────────────────────────────────────────────────────

async function onWorldIdVerification(
  config: Config,
  runtime: Runtime,
  payload: { input: Uint8Array; key: string },
): Promise<{
  verified: boolean;
  reason: string;
  credentialTxHash?: string;
  nullifierHash?: string;
}> {
  const logger = runtime.logger();
  logger.info("worldid verification workflow triggered");

  // ── 1. Parse the incoming request ──────────────────────────

  const request: WorldIdVerificationRequest = JSON.parse(
    new TextDecoder().decode(payload.input),
  );

  logger.info("World ID verification request received", {
    subject: request.subjectAddress,
    credentialType: request.credentialType,
    verificationLevel: request.proof.verification_level,
  });

  // ── 2. Retrieve World ID app and action IDs from secrets ──

  const appId = await runtime
    .getSecret({ id: "WORLD_ID_APP_ID", namespace: "main" })
    .result();

  const actionId = await runtime
    .getSecret({ id: "WORLD_ID_ACTION_ID", namespace: "main" })
    .result();

  // ── 3. Verify proof against World ID API ───────────────────
  //    The World ID Developer Portal's Verify endpoint validates
  //    the ZK proof against the on-chain identity set.

  const httpClient = new HTTPClient();

  const verifyRequestBody = JSON.stringify({
    merkle_root: request.proof.merkle_root,
    nullifier_hash: request.proof.nullifier_hash,
    proof: request.proof.proof,
    verification_level: request.proof.verification_level,
    action: actionId.value,
    signal: request.signal || request.subjectAddress,
  });

  const verifyUrl = `${config.worldIdVerifierUrl}/${appId.value}/verify/${actionId.value}`;

  const verifyResponse = await httpClient
    .sendRequest(runtime, {
      url: verifyUrl,
      method: "POST",
      body: new TextEncoder().encode(verifyRequestBody),
      headers: {
        "Content-Type": "application/json",
      },
      cacheSettings: {
        store: true,
        maxAge: 60, // Ensure single verification call across nodes
      },
    })
    .result();

  // ── 4. Handle verification result ──────────────────────────

  if (verifyResponse.statusCode !== 200) {
    const errorBody = new TextDecoder().decode(verifyResponse.body);
    let errorDetail = "Unknown verification error";

    try {
      const errorJson: WorldIdVerifyResponse = JSON.parse(errorBody);
      errorDetail = errorJson.detail || errorJson.code || errorDetail;
    } catch {
      errorDetail = errorBody;
    }

    logger.warn("World ID verification failed", {
      status: verifyResponse.statusCode,
      error: errorDetail,
      subject: request.subjectAddress,
    });

    return {
      verified: false,
      reason: `World ID verification failed: ${errorDetail}`,
    };
  }

  const verifyResult: WorldIdVerifyResponse = JSON.parse(
    new TextDecoder().decode(verifyResponse.body),
  );

  if (!verifyResult.success) {
    logger.warn("World ID proof invalid", {
      code: verifyResult.code,
      detail: verifyResult.detail,
    });
    return {
      verified: false,
      reason: `Proof invalid: ${verifyResult.detail || verifyResult.code}`,
    };
  }

  logger.info("World ID proof verified successfully", {
    nullifierHash: verifyResult.nullifier_hash,
    subject: request.subjectAddress,
  });

  // ── 5. Compute credential hash ────────────────────────────
  //    Hash the credential metadata to create a unique on-chain
  //    pointer. This hash also serves as a duplicate check.

  const now = await runtime.now().result();
  const issuanceTimestamp = Math.floor(now.getTime() / 1000);
  const expiryTimestamp =
    request.expiryDays > 0
      ? issuanceTimestamp + request.expiryDays * 86400
      : 0;

  // Deterministic credential document hash (all nodes produce same value)
  const credentialDocument = JSON.stringify({
    subject: request.subjectAddress,
    credentialType: request.credentialType,
    description: request.credentialDescription,
    nullifierHash: verifyResult.nullifier_hash,
    verificationLevel: request.proof.verification_level,
    issuanceDate: issuanceTimestamp,
    expiryDate: expiryTimestamp,
    platform: "mediCaRE",
    version: "1.0",
  });

  // Use a deterministic hash for the credential document
  const credentialHash = deterministicHash(credentialDocument);

  // ── 6. Write attestation to CredentialRegistry on-chain ────

  const evmClient = new EVMClient({ chainName: config.chainName });

  const attestation: CredentialAttestationReport = {
    subject: request.subjectAddress,
    credentialHash,
    credentialType: CredentialTypeMap[request.credentialType] ?? 7,
    issuanceDate: issuanceTimestamp,
    expiryDate: expiryTimestamp,
    nullifierHash: verifyResult.nullifier_hash || "0x" + "0".repeat(64),
  };

  const report = await runtime
    .generateReport({
      encodedPayload: JSON.stringify(attestation),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const tx = await evmClient
    .writeReport(runtime, config.credentialRegistryAddress, report, {
      gasLimit: BigInt(config.gasLimit),
    })
    .result();

  logger.info("Credential attestation written on-chain", {
    txHash: tx.hash,
    subject: request.subjectAddress,
    credentialType: request.credentialType,
    credentialHash,
    expiryDate: expiryTimestamp > 0 ? new Date(expiryTimestamp * 1000).toISOString() : "none",
  });

  // ── 7. Return verification result ──────────────────────────

  return {
    verified: true,
    reason: "World ID proof verified; credential attestation issued on-chain",
    credentialTxHash: tx.hash,
    nullifierHash: verifyResult.nullifier_hash,
  };
}

// ──────────────────────────────────────────────────────────────
//  Helper: deterministic hash (consensus-safe across all nodes)
// ──────────────────────────────────────────────────────────────

function deterministicHash(input: string): string {
  // Simple deterministic hash for producing a bytes32-like value.
  // In production, use runtime-provided keccak256 or the SDK's
  // built-in hashing. This ensures all DON nodes produce the
  // same credential hash for the same input.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return "0x" + (hex1 + hex2).padEnd(64, "0");
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

  return [Handler(trigger, onWorldIdVerification)];
}

export default initWorkflow;
