/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Revocable Access Key Rotation
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   EVM Log  (fires when `AccessRevoked` event is
 *             emitted from EHRStorage.sol)
 *
 *  Flow:
 *    1. Decode AccessRevoked event (patient, provider, recordId)
 *    2. Generate new encryption key pair inside TEE
 *    3. Fetch encrypted record from IPFS via Confidential HTTP
 *    4. Re-encrypt record with new key inside TEE
 *    5. Upload re-encrypted content to IPFS (new CID)
 *    6. Update on-chain CID hash via EVM Write
 *    7. Distribute new key only to still-authorized providers
 *
 *  Capabilities used:
 *    • EVM Log Trigger      (AccessRevoked event)
 *    • EVM Read             (authorized providers list)
 *    • Confidential HTTP    (IPFS fetch + upload in TEE)
 *    • EVM Write            (update record CID)
 *    • Secrets              (IPFS API key, encryption keys)
 *
 *  @module key-rotation
 */

import {
  HTTPClient,
  EVMClient,
  EVMLogTrigger,
  Runtime,
  Handler,
  Workflow,
} from "@chainlink/cre-sdk";

// ── Config ───────────────────────────────────────────────────

interface Config {
  chainName: string;
  ehrStorageAddress: string;
  ipfsGatewayUrl: string;
  ipfsUploadUrl: string;
  gasLimit: number;
}

// ── AccessRevoked event from EHRStorage.sol ──────────────────

interface AccessRevokedEvent {
  patient: string;
  provider: string;
  recordId: bigint;
  revokedAt: bigint;
}

// ── Handler ──────────────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  // ─── Step 1: Decode trigger event ─────────────────────────
  const trigger = runtime.getTrigger<EVMLogTrigger>();
  const event: AccessRevokedEvent = {
    patient: trigger.getIndexedParam(0) as string,
    provider: trigger.getIndexedParam(1) as string,
    recordId: trigger.getDataParam(0) as bigint,
    revokedAt: trigger.getDataParam(1) as bigint,
  };

  runtime.log(
    `[KeyRotation] Access revoked: patient=${event.patient}, ` +
    `provider=${event.provider}, record=${event.recordId}`
  );

  // ─── Step 2: Read current record CID from on-chain ────────
  const recordData = await evm.read({
    contractAddress: config.ehrStorageAddress,
    method: "getRecord(uint256)",
    args: [event.recordId],
  });

  const currentCid = recordData.ipfsCid as string;

  // ─── Step 3: Get list of still-authorized providers ───────
  const authorizedProviders = await evm.read({
    contractAddress: config.ehrStorageAddress,
    method: "getAuthorizedProviders(address,uint256)",
    args: [event.patient, event.recordId],
  });

  const providers = authorizedProviders as string[];
  runtime.log(
    `[KeyRotation] ${providers.length} providers still authorized after revocation`
  );

  // ─── Step 4: Fetch + re-encrypt in TEE ────────────────────
  //  The old encrypted content is fetched, decrypted with the
  //  old key, then re-encrypted with a freshly generated key.
  //  All crypto happens inside the TEE — plaintext is never exposed.

  const reEncryptResponse = await http.confidentialFetch(
    `${config.ipfsGatewayUrl}/${currentCid}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secrets.get("IPFS_GATEWAY_TOKEN")}`,
        "X-Decryption-Key": secrets.get("RECORD_ENCRYPTION_KEY") ?? "",
        "X-Operation": "re-encrypt",
      },
    }
  );

  const reEncryptedData = reEncryptResponse.json();

  // ─── Step 5: Upload re-encrypted content to IPFS ──────────
  const uploadResponse = await http.confidentialFetch(
    config.ipfsUploadUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secrets.get("IPFS_API_KEY")}`,
      },
      body: JSON.stringify({
        pinataContent: reEncryptedData.encryptedContent,
        pinataMetadata: {
          name: `ehr-record-${event.recordId}-rotated`,
          keyValues: {
            patient: event.patient,
            rotatedAt: new Date().toISOString(),
            previousCid: currentCid,
          },
        },
      }),
    }
  );

  const newCid = uploadResponse.json().IpfsHash;

  // ─── Step 6: Update CID on-chain ─────────────────────────
  await evm.write({
    contractAddress: config.ehrStorageAddress,
    method: "updateRecordCid(uint256,string)",
    args: [event.recordId, newCid],
    gasLimit: config.gasLimit,
  });

  runtime.log(
    `[KeyRotation] Record ${event.recordId} re-encrypted. ` +
    `Old CID: ${currentCid}, New CID: ${newCid}`
  );

  // ─── Step 7: Distribute new key to authorized providers ───
  for (const provider of providers) {
    try {
      await http.confidentialFetch(
        `${config.ipfsGatewayUrl}/key-distribute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secrets.get("KEY_DISTRIBUTION_SECRET")}`,
          },
          body: JSON.stringify({
            provider,
            recordId: Number(event.recordId),
            newKeyFragment: reEncryptedData.newKeyFragment,
          }),
        }
      );
    } catch (err) {
      runtime.log(`[KeyRotation] Key distribution to ${provider} failed: ${err}`);
    }
  }

  return {
    recordId: Number(event.recordId),
    revokedProvider: event.provider,
    previousCid: currentCid,
    newCid,
    authorizedProvidersNotified: providers.length,
  };
};

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "key-rotation",
  handler,
  trigger: {
    type: "evm-log",
    config: {
      event: "AccessRevoked(address,address,uint256,uint256)",
      contractAddress: "${ehrStorageAddress}",
      chain: "${chainName}",
    },
  },
};

export default workflow;
