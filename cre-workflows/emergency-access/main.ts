/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Emergency Glass-Break Access
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   HTTP  (paramedic/ER doctor triggers emergency access)
 *
 *  Flow:
 *    1. Receive glass-break request (paramedic ID, patient ID, reason)
 *    2. Verify paramedic credentials on-chain (EMERGENCY_ROLE)
 *    3. Bypass normal consent — invoke emergencyAccess() on EHRStorage
 *    4. Fetch critical records via Confidential HTTP:
 *       - Blood type, allergies, current medications, emergency contacts
 *    5. Write immutable audit trail on-chain (reason code, accessor, timestamp)
 *    6. Send patient notification via webhook
 *    7. Return emergency data with time-locked access window (15 min)
 *
 *  Capabilities used:
 *    • HTTP Trigger
 *    • EVM Read           (credential check, emergency data)
 *    • Confidential HTTP  (PHI fetch in TEE)
 *    • EVM Write          (glass-break audit log)
 *    • Secrets            (IPFS token, notification key)
 *
 *  @module emergency-access
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
  healthPassportAddress: string;
  ipfsGatewayUrl: string;
  gasLimit: number;
  accessWindowSeconds: number;
  notificationWebhookUrl: string;
}

// ── HTTP trigger payload ─────────────────────────────────────

interface GlassBreakRequest {
  paramedicAddress: string;
  patientAddress: string;
  reasonCode: string; // "CARDIAC_ARREST" | "ANAPHYLAXIS" | "TRAUMA" | "UNCONSCIOUS" | "OTHER"
  reasonText: string;
  location: { lat: number; lng: number };
  incidentId: string;
}

// ── Emergency response ───────────────────────────────────────

interface EmergencyData {
  bloodType: string;
  allergies: string[];
  currentMedications: { name: string; dosage: string }[];
  emergencyContacts: { name: string; phone: string; relationship: string }[];
  criticalConditions: string[];
  doNotResuscitate: boolean;
  organDonor: boolean;
}

interface GlassBreakResponse {
  granted: boolean;
  reason: string;
  emergencyData?: EmergencyData;
  auditTxHash?: string;
  accessExpiresAt?: string;
  accessWindowSeconds?: number;
}

// ── Handler ──────────────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  // ─── Step 1: Parse glass-break request ────────────────────
  const trigger = runtime.getTrigger<HTTPTrigger>();
  const request: GlassBreakRequest = trigger.getBody();

  runtime.log(
    `[EmergencyAccess] Glass-break request: paramedic=${request.paramedicAddress}, ` +
    `patient=${request.patientAddress}, reason=${request.reasonCode}`
  );

  // ─── Step 2: Verify paramedic has EMERGENCY_ROLE ──────────
  const hasRole = await evm.read({
    contractAddress: config.ehrStorageAddress,
    method: "hasRole(bytes32,address)",
    args: [
      "0x" + Buffer.from("EMERGENCY_ROLE").toString("hex").padEnd(64, "0"),
      request.paramedicAddress,
    ],
  });

  if (!hasRole) {
    runtime.log(`[EmergencyAccess] DENIED — paramedic lacks EMERGENCY_ROLE`);
    return {
      granted: false,
      reason: "Requester does not have EMERGENCY_ROLE",
    } as GlassBreakResponse;
  }

  // ─── Step 3: Invoke emergencyAccess() on-chain ────────────
  //  This bypasses consent and creates an immutable audit entry
  const auditTx = await evm.write({
    contractAddress: config.ehrStorageAddress,
    method: "emergencyAccess(address,string)",
    args: [
      request.patientAddress,
      `${request.reasonCode}: ${request.reasonText} [Incident: ${request.incidentId}]`,
    ],
    gasLimit: config.gasLimit,
  });

  runtime.log(`[EmergencyAccess] On-chain audit recorded: ${auditTx.hash}`);

  // ─── Step 4: Fetch critical data via Confidential HTTP ────
  const emergencyResponse = await http.confidentialFetch(
    `${config.ipfsGatewayUrl}/emergency/${request.patientAddress}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secrets.get("IPFS_GATEWAY_TOKEN")}`,
        "X-Emergency-Access": "true",
        "X-Incident-Id": request.incidentId,
      },
    }
  );

  const emergencyData: EmergencyData = emergencyResponse.json();

  // ─── Step 5: Notify patient via webhook ───────────────────
  try {
    await http.fetch(config.notificationWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secrets.get("NOTIFICATION_KEY")}`,
      },
      body: JSON.stringify({
        type: "EMERGENCY_ACCESS",
        patientAddress: request.patientAddress,
        accessedBy: request.paramedicAddress,
        reasonCode: request.reasonCode,
        incidentId: request.incidentId,
        timestamp: new Date().toISOString(),
        auditTxHash: auditTx.hash,
      }),
    });
  } catch (err) {
    // Non-fatal — notification failure should not block emergency access
    runtime.log(`[EmergencyAccess] Notification failed (non-fatal): ${err}`);
  }

  // ─── Step 6: Return time-locked emergency data ────────────
  const expiresAt = new Date(
    Date.now() + config.accessWindowSeconds * 1000
  ).toISOString();

  runtime.log(
    `[EmergencyAccess] Access granted. Expires at ${expiresAt}`
  );

  return {
    granted: true,
    reason: `Emergency access granted for ${request.reasonCode}`,
    emergencyData,
    auditTxHash: auditTx.hash,
    accessExpiresAt: expiresAt,
    accessWindowSeconds: config.accessWindowSeconds,
  } as GlassBreakResponse;
};

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "emergency-access",
  handler,
  trigger: {
    type: "http",
    config: {
      method: "POST",
      path: "/api/cre/emergency-access",
    },
  },
};

export default workflow;
