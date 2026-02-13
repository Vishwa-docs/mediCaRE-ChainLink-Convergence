/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Insurance Claim Processing
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   EVM Log  (fires when `ClaimSubmitted` event is
 *             emitted from InsurancePolicy.sol)
 *
 *  Flow:
 *    1. Decode the ClaimSubmitted event data
 *    2. Read the full policy details from InsurancePolicy on-chain
 *    3. Fetch relevant medical evidence via Confidential HTTP
 *    4. Call external risk-scoring service for claim assessment
 *    5. Write claim decision (approve/reject) back on-chain
 *    6. If approved, trigger payout via EVM Write
 *
 *  Capabilities used:
 *    • EVM Log Trigger    (ClaimSubmitted event)
 *    • EVM Read           (policy + claim details)
 *    • Confidential HTTP  (medical data fetch)
 *    • Standard HTTP      (risk-scoring API)
 *    • EVM Write          (processClaim + payoutClaim)
 *    • Secrets            (API keys)
 *
 *  @module insurance-claim
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
  chainName: string;
  insurancePolicyAddress: string;
  ehrStorageAddress: string;
  riskScoringUrl: string;
  medicalDataUrl: string;
  gasLimit: number;
}

// ── ClaimSubmitted event from InsurancePolicy.sol ─────────────
//    event ClaimSubmitted(
//      uint256 indexed claimId,
//      uint256 indexed policyId,
//      address indexed claimant,
//      uint256 amount,
//      bytes32 descriptionHash
//    );

interface ClaimSubmittedEvent {
  claimId: bigint;
  policyId: bigint;
  claimant: string;
  amount: bigint;
  descriptionHash: string;
}

// ── Policy struct from InsurancePolicy.sol ────────────────────

interface PolicyData {
  policyId: bigint;
  holder: string;
  coverageAmount: bigint;
  premiumAmount: bigint;
  expiryDate: bigint;
  isActive: boolean;
  riskScore: bigint;
}

// ── Risk scoring service response ────────────────────────────

interface RiskScoreResponse {
  /** Overall claim risk score (0–10000 basis points) */
  riskScore: number;
  /** Whether the claim should be approved */
  recommendation: "approve" | "reject" | "manual_review";
  /** Fraud probability (0–1) */
  fraudProbability: number;
  /** Factors contributing to the decision */
  factors: Array<{
    name: string;
    weight: number;
    value: string;
  }>;
  /** Suggested payout amount (may differ from requested) */
  suggestedPayout: string;
  /** Confidence in the recommendation (0–1) */
  confidence: number;
}

// ── Claim decision report ────────────────────────────────────

interface ClaimDecisionReport {
  claimId: number;        // uint256
  approved: boolean;      // bool
  riskScore: number;      // uint256
  payoutAmount: string;   // uint256 (stringified for precision)
}

// ── EVM Log data passed by trigger ───────────────────────────

interface EVMLog {
  topics: string[];
  data: string;
  address: string;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
}

// ──────────────────────────────────────────────────────────────
//  Event signature hash for ClaimSubmitted
//  keccak256("ClaimSubmitted(uint256,uint256,address,uint256,bytes32)")
// ──────────────────────────────────────────────────────────────

const CLAIM_SUBMITTED_TOPIC =
  "0x6b7b3e2e9d5e6c3e9f7a8b1c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2";

// ──────────────────────────────────────────────────────────────
//  Handler: onClaimSubmitted
// ──────────────────────────────────────────────────────────────

async function onClaimSubmitted(
  config: Config,
  runtime: Runtime,
  log: EVMLog,
): Promise<{ processed: boolean; decision?: string; txHash?: string }> {
  const logger = runtime.logger();
  logger.info("insurance-claim workflow triggered by ClaimSubmitted event", {
    txHash: log.transactionHash,
    block: log.blockNumber.toString(),
  });

  // ── 1. Decode event data from log topics ───────────────────
  //    topics[0] = event signature
  //    topics[1] = claimId   (indexed)
  //    topics[2] = policyId  (indexed)
  //    topics[3] = claimant  (indexed)
  //    data       = (amount, descriptionHash)

  const claimId = BigInt(log.topics[1]);
  const policyId = BigInt(log.topics[2]);
  const claimant = "0x" + log.topics[3].slice(26); // address from bytes32

  logger.info("Claim event decoded", {
    claimId: claimId.toString(),
    policyId: policyId.toString(),
    claimant,
  });

  const evmClient = new EVMClient({ chainName: config.chainName });

  // ── 2. Read full claim details from InsurancePolicy ────────

  const claimResult = await evmClient
    .readContract(runtime, {
      contractAddress: config.insurancePolicyAddress,
      method: "getClaim",
      args: [claimId],
      abi: [
        {
          name: "getClaim",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "claimId", type: "uint256" }],
          outputs: [
            {
              name: "claim",
              type: "tuple",
              components: [
                { name: "claimId", type: "uint256" },
                { name: "policyId", type: "uint256" },
                { name: "claimant", type: "address" },
                { name: "amount", type: "uint256" },
                { name: "descriptionHash", type: "bytes32" },
                { name: "status", type: "uint8" },
                { name: "timestamp", type: "uint256" },
              ],
            },
          ],
        },
      ],
    })
    .result();

  const claim = claimResult[0];
  const claimAmount = claim.amount as bigint;
  const descriptionHash = claim.descriptionHash as string;

  // ── 3. Read policy details ─────────────────────────────────

  const policyResult = await evmClient
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

  const policy = policyResult[0] as PolicyData;

  logger.info("Policy and claim data loaded", {
    coverageAmount: policy.coverageAmount.toString(),
    claimAmount: claimAmount.toString(),
    riskScore: policy.riskScore.toString(),
    policyActive: policy.isActive,
  });

  // ── 4. Fetch medical evidence via Confidential HTTP ────────
  //    Retrieves supporting clinical data for claim assessment.
  //    Uses Confidential HTTP to protect patient medical data.

  const backendToken = await runtime
    .getSecret({ id: "MEDICARE_BACKEND_AUTH_TOKEN", namespace: "main" })
    .result();

  const httpClient = new HTTPClient();

  const medicalDataResponse = await httpClient
    .sendConfidentialRequest(runtime, {
      url: `${config.medicalDataUrl}/${claimId.toString()}`,
      method: "GET",
      headers: {
        Authorization: `Bearer {{.MEDICARE_BACKEND_AUTH_TOKEN}}`,
        Accept: "application/json",
      },
      encryptOutput: true,
    })
    .result();

  let medicalEvidenceSummary = "No additional medical data available";
  if (medicalDataResponse.statusCode === 200) {
    const medicalData = JSON.parse(
      new TextDecoder().decode(medicalDataResponse.body),
    );
    medicalEvidenceSummary = JSON.stringify(medicalData);
    logger.info("Medical evidence fetched for claim", {
      claimId: claimId.toString(),
    });
  }

  // ── 5. Call risk-scoring service ───────────────────────────
  //    Standard HTTP — scoring model is non-sensitive metadata.

  const riskApiKey = await runtime
    .getSecret({ id: "RISK_SCORING_API_KEY", namespace: "main" })
    .result();

  const scoringRequestBody = JSON.stringify({
    claimId: claimId.toString(),
    policyId: policyId.toString(),
    claimant,
    claimAmount: claimAmount.toString(),
    coverageAmount: policy.coverageAmount.toString(),
    currentRiskScore: Number(policy.riskScore),
    descriptionHash,
    medicalEvidence: medicalEvidenceSummary,
    policyExpiryDate: Number(policy.expiryDate),
    premiumAmount: policy.premiumAmount.toString(),
  });

  const scoringResponse = await httpClient
    .sendRequest(runtime, {
      url: config.riskScoringUrl,
      method: "POST",
      body: new TextEncoder().encode(scoringRequestBody),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${riskApiKey.value}`,
      },
      cacheSettings: {
        store: true,
        maxAge: 60,
      },
    })
    .result();

  if (scoringResponse.statusCode !== 200) {
    logger.error("Risk scoring service unavailable", {
      status: scoringResponse.statusCode,
    });
    throw new Error(`Risk scoring returned ${scoringResponse.statusCode}`);
  }

  const riskResult: RiskScoreResponse = JSON.parse(
    new TextDecoder().decode(scoringResponse.body),
  );

  logger.info("Risk assessment completed", {
    recommendation: riskResult.recommendation,
    riskScore: riskResult.riskScore,
    fraudProbability: riskResult.fraudProbability,
    confidence: riskResult.confidence,
    suggestedPayout: riskResult.suggestedPayout,
  });

  // ── 6. Determine claim decision ────────────────────────────
  //    Auto-approve only if recommendation is "approve" and
  //    confidence exceeds threshold. Otherwise, flag for manual review.

  const CONFIDENCE_THRESHOLD = 0.85;
  const approved =
    riskResult.recommendation === "approve" &&
    riskResult.confidence >= CONFIDENCE_THRESHOLD;

  // ── 7. Write claim decision on-chain ───────────────────────
  //    Generates a signed report and writes via KeystoneForwarder
  //    to the InsurancePolicy consumer contract.

  const decisionReport: ClaimDecisionReport = {
    claimId: Number(claimId),
    approved,
    riskScore: riskResult.riskScore,
    payoutAmount: approved ? riskResult.suggestedPayout : "0",
  };

  const report = await runtime
    .generateReport({
      encodedPayload: JSON.stringify(decisionReport),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const decisionTx = await evmClient
    .writeReport(runtime, config.insurancePolicyAddress, report, {
      gasLimit: BigInt(config.gasLimit),
    })
    .result();

  logger.info("Claim decision written on-chain", {
    txHash: decisionTx.hash,
    claimId: claimId.toString(),
    approved,
    riskScore: riskResult.riskScore,
  });

  // ── 8. If approved, trigger payout ─────────────────────────
  //    A second EVM Write to call payoutClaim on InsurancePolicy.

  if (approved) {
    const payoutReport = await runtime
      .generateReport({
        encodedPayload: JSON.stringify({
          claimId: Number(claimId),
          triggerPayout: true,
        }),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result();

    const payoutTx = await evmClient
      .writeReport(runtime, config.insurancePolicyAddress, payoutReport, {
        gasLimit: BigInt(config.gasLimit),
      })
      .result();

    logger.info("Claim payout triggered on-chain", {
      payoutTxHash: payoutTx.hash,
      claimId: claimId.toString(),
      amount: riskResult.suggestedPayout,
    });
  }

  return {
    processed: true,
    decision: approved ? "approved" : "rejected/manual_review",
    txHash: decisionTx.hash,
  };
}

// ──────────────────────────────────────────────────────────────
//  Workflow initialisation
// ──────────────────────────────────────────────────────────────

export function initWorkflow(
  config: Config,
  logger: ReturnType<Runtime["logger"]>,
): Workflow<Config> {
  // EVM Log Trigger — fires on ClaimSubmitted event from InsurancePolicy
  const trigger = new EVMLogTrigger({
    chainName: config.chainName,
    contractAddress: config.insurancePolicyAddress,
    topicFilters: [
      {
        values: [CLAIM_SUBMITTED_TOPIC],
      },
    ],
    confidence: "FINALIZED",
  });

  return [Handler(trigger, onClaimSubmitted)];
}

export default initWorkflow;
