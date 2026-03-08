/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Multi-Agent Claim Adjudicator
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   EVM Log  (fires on `ClaimSubmitted` event
 *             from InsurancePolicy.sol)
 *
 *  Flow:
 *    1. Decode ClaimSubmitted event data
 *    2. Read policy + claim details from InsurancePolicy on-chain
 *    3. Fetch medical evidence via Confidential HTTP (TEE-secured)
 *    4. Run 3-agent AI swarm in parallel via BFT node execution:
 *       a. TriageBot — validates diagnosis codes, checks coverage
 *       b. MedicalCodingBot — verifies CPT/ICD-10 code accuracy
 *       c. FraudDetectorBot — billing pattern anomaly detection
 *    5. Aggregate results via BFT consensus (median scoring)
 *    6. Write adjudication decision + explanation hash on-chain
 *    7. If approved, trigger payout; if flagged, emit ClaimFlagged
 *
 *  Capabilities used:
 *    • EVM Log Trigger      (ClaimSubmitted event)
 *    • EVM Read             (policy details, claim data)
 *    • Confidential HTTP    (medical records in TEE)
 *    • Standard HTTP        (AI adjudication swarm API)
 *    • EVM Write            (submitAIAdjudication, setExplanationHash, flagClaim)
 *    • BFT Consensus        (multi-node AI inference aggregation)
 *    • Secrets              (API keys, IPFS gateway token)
 *
 *  @module claim-adjudicator
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
  adjudicatorUrl: string;
  gasLimit: number;
  consensusThreshold: number;
  totalAgents: number;
}

// ── ClaimSubmitted event ─────────────────────────────────────

interface ClaimSubmittedEvent {
  claimId: bigint;
  policyId: bigint;
  claimant: string;
  amount: bigint;
  descriptionHash: string;
}

// ── Agent verdict structures ─────────────────────────────────

interface AgentVerdict {
  agentName: string;
  recommendation: "APPROVE" | "REJECT" | "FLAG_FOR_REVIEW";
  confidence: number; // 0-10000 basis points
  reasoning: string[];
  riskScore: number;
}

interface SwarmResult {
  triageVerdict: AgentVerdict;
  codingVerdict: AgentVerdict;
  fraudVerdict: AgentVerdict;
  consensusRecommendation: "APPROVE" | "REJECT" | "FLAG_FOR_REVIEW";
  consensusScore: number;
  explanationHash: string;
}

// ── Medical evidence from Confidential HTTP ──────────────────

interface MedicalEvidence {
  patientId: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  providerNPI: string;
  claimAmount: number;
  previousClaims: number;
  billingFrequency: number;
  redFlags: string[];
}

// ── Workflow handler ─────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  // ─── Step 1: Decode trigger event ────────────────────────
  const trigger = runtime.getTrigger<EVMLogTrigger>();
  const event: ClaimSubmittedEvent = {
    claimId: trigger.getIndexedParam(0) as bigint,
    policyId: trigger.getIndexedParam(1) as bigint,
    claimant: trigger.getIndexedParam(2) as string,
    amount: trigger.getDataParam(0) as bigint,
    descriptionHash: trigger.getDataParam(1) as string,
  };

  runtime.log(
    `[ClaimAdjudicator] Processing claim ${event.claimId} for policy ${event.policyId}`
  );

  // ─── Step 2: Read policy details from chain ──────────────
  const policyData = await evm.read({
    contractAddress: config.insurancePolicyAddress,
    method: "getPolicy(uint256)",
    args: [event.policyId],
  });

  const claimData = await evm.read({
    contractAddress: config.insurancePolicyAddress,
    method: "getClaim(uint256)",
    args: [event.claimId],
  });

  // ─── Step 3: Fetch medical evidence via Confidential HTTP ─
  const evidenceResponse = await http.confidentialFetch(
    `${config.adjudicatorUrl}/evidence/${event.claimId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secrets.get("MEDICAL_API_KEY")}`,
        "X-Patient-Consent": "verified",
      },
    }
  );

  const evidence: MedicalEvidence = evidenceResponse.json();

  // ─── Step 4: Run 3-agent swarm via BFT consensus ─────────
  //  Each agent runs independently; results aggregated via
  //  median scoring and majority vote.

  const swarmPayload = {
    claimId: Number(event.claimId),
    policyId: Number(event.policyId),
    claimant: event.claimant,
    claimAmount: Number(event.amount),
    coverageAmount: Number(policyData.coverageAmount),
    diagnosisCodes: evidence.diagnosisCodes,
    procedureCodes: evidence.procedureCodes,
    providerNPI: evidence.providerNPI,
    previousClaims: evidence.previousClaims,
    billingFrequency: evidence.billingFrequency,
    redFlags: evidence.redFlags,
  };

  // Run in BFT node mode — each DON node runs the swarm
  // independently and results are aggregated via consensus
  const swarmResponse = await runtime.runInNodeMode(async () => {
    const result = await http.fetch(
      `${config.adjudicatorUrl}/swarm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secrets.get("AI_API_KEY")}`,
        },
        body: JSON.stringify(swarmPayload),
      }
    );
    return result.json() as SwarmResult;
  }, {
    aggregation: "consensusMedianAggregation",
    minResponses: config.consensusThreshold,
  });

  runtime.log(
    `[ClaimAdjudicator] BFT consensus: ${swarmResponse.consensusRecommendation} ` +
    `(score: ${swarmResponse.consensusScore})`
  );

  // ─── Step 5: Write explanation hash on-chain ──────────────
  await evm.write({
    contractAddress: config.insurancePolicyAddress,
    method: "setExplanationHash(uint256,bytes32)",
    args: [event.claimId, swarmResponse.explanationHash],
    gasLimit: config.gasLimit,
  });

  // ─── Step 6: Write adjudication decision on-chain ─────────
  if (swarmResponse.consensusRecommendation === "APPROVE") {
    // Submit AI adjudication with approval
    await evm.write({
      contractAddress: config.insurancePolicyAddress,
      method: "submitAIAdjudication(uint256,uint256,bool,uint256)",
      args: [
        event.claimId,
        swarmResponse.consensusScore,
        true, // recommended
        BigInt(Math.floor(Date.now() / 1000) + 86400), // 24h expiry
      ],
      gasLimit: config.gasLimit,
    });

    runtime.log(`[ClaimAdjudicator] Claim ${event.claimId} APPROVED`);
  } else if (swarmResponse.consensusRecommendation === "FLAG_FOR_REVIEW") {
    // Flag claim for manual review
    await evm.write({
      contractAddress: config.insurancePolicyAddress,
      method: "flagClaim(uint256,string)",
      args: [
        event.claimId,
        `AI swarm flagged: score=${swarmResponse.consensusScore}, ` +
        `fraud=${swarmResponse.fraudVerdict.riskScore}`,
      ],
      gasLimit: config.gasLimit,
    });

    runtime.log(`[ClaimAdjudicator] Claim ${event.claimId} FLAGGED for review`);
  } else {
    // Reject claim
    await evm.write({
      contractAddress: config.insurancePolicyAddress,
      method: "submitAIAdjudication(uint256,uint256,bool,uint256)",
      args: [
        event.claimId,
        swarmResponse.consensusScore,
        false, // not recommended
        BigInt(Math.floor(Date.now() / 1000) + 86400),
      ],
      gasLimit: config.gasLimit,
    });

    runtime.log(`[ClaimAdjudicator] Claim ${event.claimId} REJECTED`);
  }

  return {
    claimId: Number(event.claimId),
    decision: swarmResponse.consensusRecommendation,
    consensusScore: swarmResponse.consensusScore,
    explanationHash: swarmResponse.explanationHash,
    agents: {
      triage: swarmResponse.triageVerdict.recommendation,
      coding: swarmResponse.codingVerdict.recommendation,
      fraud: swarmResponse.fraudVerdict.recommendation,
    },
  };
};

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "claim-adjudicator",
  handler,
  trigger: {
    type: "evm-log",
    config: {
      event: "ClaimSubmitted(uint256,uint256,address,uint256,bytes32)",
      contractAddress: "${insurancePolicyAddress}",
      chain: "${chainName}",
    },
  },
};

export default workflow;
