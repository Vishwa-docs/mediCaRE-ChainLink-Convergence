/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — CCIP Cross-Chain Settlement
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   EVM Log  (fires when a cross-chain settlement is
 *             requested — e.g. ClaimPaid event from InsurancePolicy
 *             triggers a bridge to the destination chain)
 *
 *  Flow:
 *    1. Decode the ClaimPaid event data (policyId, recipient, amount)
 *    2. Read settlement details from InsurancePolicy on source chain
 *    3. Initiate CCIP token bridge via HTTP to the CCIP bridge API
 *    4. Write settlement confirmation on source chain
 *    5. Write settlement receipt on destination chain
 *
 *  Capabilities used:
 *    • EVM Log Trigger   (ClaimPaid event on source chain)
 *    • EVM Read          (claim + policy details)
 *    • Standard HTTP     (CCIP bridge API / CCIP SDK REST endpoint)
 *    • EVM Write         (settlement confirmation on both chains)
 *    • Secrets           (bridge API key)
 *
 *  @module crosschain
 */

import {
  HTTPClient,
  EVMClient,
  EVMLogTrigger,
  Runtime,
  Handler,
  Workflow,
} from "@chainlink/cre-sdk";

// ── Config schema ────────────────────────────────────────────

interface Config {
  sourceChainName: string;
  destinationChainName: string;
  insurancePolicyAddress: string;
  ccipRouterAddress: string;
  stablecoinAddress: string;
  settlementConsumerAddress: string;
  gasLimit: number;
}

// ── ClaimPaid event from InsurancePolicy.sol ──────────────────
//    event ClaimPaid(
//      uint256 indexed claimId,
//      uint256 indexed policyId,
//      address recipient,
//      uint256 amount
//    );

const CLAIM_PAID_TOPIC =
  "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

// ── EVM Log structure ────────────────────────────────────────

interface EVMLog {
  topics: string[];
  data: string;
  address: string;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
}

// ── CCIP Bridge API request/response ─────────────────────────

interface CCIPBridgeRequest {
  sourceChain: string;
  destinationChain: string;
  tokenAddress: string;
  amount: string;
  recipient: string;
  /** Extra data to attach to the CCIP message */
  extraData: string;
  /** Fee payment token (address(0) for native) */
  feeToken: string;
}

interface CCIPBridgeResponse {
  messageId: string;
  sourceChainTxHash: string;
  estimatedArrivalSeconds: number;
  fee: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

// ── Settlement confirmation report ───────────────────────────

interface SettlementReport {
  claimId: number;          // uint256
  policyId: number;         // uint256
  recipient: string;        // address
  amount: string;           // uint256 (stringified)
  ccipMessageId: string;    // bytes32
  sourceChain: string;      // string
  destinationChain: string; // string
  confirmed: boolean;       // bool
}

// ──────────────────────────────────────────────────────────────
//  Handler: onClaimPaid
// ──────────────────────────────────────────────────────────────

async function onClaimPaid(
  config: Config,
  runtime: Runtime,
  log: EVMLog,
): Promise<{
  success: boolean;
  ccipMessageId?: string;
  sourceTxHash?: string;
  destTxHash?: string;
}> {
  const logger = runtime.logger();
  logger.info("crosschain settlement workflow triggered by ClaimPaid event", {
    txHash: log.transactionHash,
    block: log.blockNumber.toString(),
  });

  // ── 1. Decode ClaimPaid event ──────────────────────────────
  //    topics[1] = claimId  (indexed)
  //    topics[2] = policyId (indexed)
  //    data      = (recipient: address, amount: uint256)

  const claimId = BigInt(log.topics[1]);
  const policyId = BigInt(log.topics[2]);

  // Decode non-indexed data (ABI-encoded address + uint256)
  // In production, use proper ABI decoding; here we extract manually
  const dataHex = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
  const recipient = "0x" + dataHex.slice(24, 64);  // first 32 bytes → address
  const amount = BigInt("0x" + dataHex.slice(64, 128));  // next 32 bytes → uint256

  logger.info("ClaimPaid event decoded", {
    claimId: claimId.toString(),
    policyId: policyId.toString(),
    recipient,
    amount: amount.toString(),
  });

  // ── 2. Read settlement context from source chain ───────────

  const sourceEvm = new EVMClient({ chainName: config.sourceChainName });

  const policyResult = await sourceEvm
    .readContract(runtime, {
      contractAddress: config.insurancePolicyAddress,
      method: "getPolicy",
      args: [policyId],
      abi: [
        {
          name: "getPolicy",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "policyId", type: "uint256" }],
          outputs: [
            {
              name: "policy",
              type: "tuple",
              components: [
                { name: "policyId", type: "uint256" },
                { name: "holder", type: "address" },
                { name: "coverageAmount", type: "uint256" },
                { name: "premiumAmount", type: "uint256" },
                { name: "expiryDate", type: "uint256" },
                { name: "isActive", type: "bool" },
                { name: "riskScore", type: "uint256" },
              ],
            },
          ],
        },
      ],
    })
    .result();

  const policy = policyResult[0];
  logger.info("Source chain policy loaded", {
    policyId: policyId.toString(),
    holder: policy.holder,
    coverageAmount: policy.coverageAmount?.toString(),
  });

  // ── 3. Initiate CCIP token bridge ──────────────────────────
  //    Calls the mediCaRE bridge API which wraps the CCIP SDK
  //    to send stablecoin tokens cross-chain.

  const bridgeApiKey = await runtime
    .getSecret({ id: "CCIP_BRIDGE_API_KEY", namespace: "main" })
    .result();

  const httpClient = new HTTPClient();

  // Encode extra data: claimId + policyId for the destination consumer
  const extraData = JSON.stringify({
    claimId: claimId.toString(),
    policyId: policyId.toString(),
    sourceChain: config.sourceChainName,
  });

  const bridgeRequest: CCIPBridgeRequest = {
    sourceChain: config.sourceChainName,
    destinationChain: config.destinationChainName,
    tokenAddress: config.stablecoinAddress,
    amount: amount.toString(),
    recipient: config.settlementConsumerAddress,
    extraData,
    feeToken: "0x0000000000000000000000000000000000000000", // native ETH
  };

  const bridgeResponse = await httpClient
    .sendRequest(runtime, {
      url: `${config.ccipRouterAddress}/api/v1/bridge`,
      method: "POST",
      body: new TextEncoder().encode(JSON.stringify(bridgeRequest)),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bridgeApiKey.value}`,
      },
      cacheSettings: {
        store: true,
        maxAge: 120, // 2 minutes — ensures single bridge execution
      },
    })
    .result();

  if (bridgeResponse.statusCode !== 200 && bridgeResponse.statusCode !== 201) {
    logger.error("CCIP bridge request failed", {
      status: bridgeResponse.statusCode,
      body: new TextDecoder().decode(bridgeResponse.body),
    });
    throw new Error(`CCIP bridge returned ${bridgeResponse.statusCode}`);
  }

  const bridgeResult: CCIPBridgeResponse = JSON.parse(
    new TextDecoder().decode(bridgeResponse.body),
  );

  logger.info("CCIP bridge initiated", {
    messageId: bridgeResult.messageId,
    sourceTxHash: bridgeResult.sourceChainTxHash,
    estimatedArrival: `${bridgeResult.estimatedArrivalSeconds}s`,
    fee: bridgeResult.fee,
  });

  // ── 4. Write settlement confirmation on source chain ───────

  const sourceReport: SettlementReport = {
    claimId: Number(claimId),
    policyId: Number(policyId),
    recipient,
    amount: amount.toString(),
    ccipMessageId: bridgeResult.messageId,
    sourceChain: config.sourceChainName,
    destinationChain: config.destinationChainName,
    confirmed: true,
  };

  const sourceSignedReport = await runtime
    .generateReport({
      encodedPayload: JSON.stringify(sourceReport),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const sourceTx = await sourceEvm
    .writeReport(
      runtime,
      config.insurancePolicyAddress,
      sourceSignedReport,
      { gasLimit: BigInt(config.gasLimit) },
    )
    .result();

  logger.info("Settlement confirmation written on source chain", {
    txHash: sourceTx.hash,
    chain: config.sourceChainName,
  });

  // ── 5. Write settlement receipt on destination chain ───────

  const destEvm = new EVMClient({ chainName: config.destinationChainName });

  const destReport: SettlementReport = {
    claimId: Number(claimId),
    policyId: Number(policyId),
    recipient,
    amount: amount.toString(),
    ccipMessageId: bridgeResult.messageId,
    sourceChain: config.sourceChainName,
    destinationChain: config.destinationChainName,
    confirmed: true,
  };

  const destSignedReport = await runtime
    .generateReport({
      encodedPayload: JSON.stringify(destReport),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const destTx = await destEvm
    .writeReport(
      runtime,
      config.settlementConsumerAddress,
      destSignedReport,
      { gasLimit: BigInt(config.gasLimit) },
    )
    .result();

  logger.info("Settlement receipt written on destination chain", {
    txHash: destTx.hash,
    chain: config.destinationChainName,
  });

  // ── 6. Return result ───────────────────────────────────────

  return {
    success: true,
    ccipMessageId: bridgeResult.messageId,
    sourceTxHash: sourceTx.hash,
    destTxHash: destTx.hash,
  };
}

// ──────────────────────────────────────────────────────────────
//  Workflow initialisation
// ──────────────────────────────────────────────────────────────

export function initWorkflow(
  config: Config,
  logger: ReturnType<Runtime["logger"]>,
): Workflow<Config> {
  // EVM Log Trigger — fires on ClaimPaid event from InsurancePolicy
  const trigger = new EVMLogTrigger({
    chainName: config.sourceChainName,
    contractAddress: config.insurancePolicyAddress,
    topicFilters: [
      {
        values: [CLAIM_PAID_TOPIC],
      },
    ],
    confidence: "FINALIZED",
  });

  return [Handler(trigger, onClaimPaid)];
}

export default initWorkflow;
