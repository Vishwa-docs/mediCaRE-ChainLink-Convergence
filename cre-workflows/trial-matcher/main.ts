/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Zero-Knowledge Clinical Trial Matcher
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   HTTP  (researcher posts trial criteria; CRE matches
 *             against opted-in patient profiles confidentially)
 *
 *  Flow:
 *    1. Receive trial criteria from researcher
 *    2. Read opted-in research consent from Governance on-chain
 *    3. For consented patients, fetch profile via Confidential HTTP
 *    4. LLM evaluates eligibility inside TEE — PHI never exposed
 *    5. Return only isEligible boolean per patient (ZK-style output)
 *    6. Write match count on-chain (no patient identifiers)
 *
 *  Capabilities used:
 *    • HTTP Trigger
 *    • EVM Read             (research consent, patient profiles)
 *    • Confidential HTTP    (patient records in TEE)
 *    • Standard HTTP        (eligibility LLM model)
 *    • EVM Write            (match results — anonymous count only)
 *    • Secrets              (IPFS/AI API keys)
 *
 *  @module trial-matcher
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
  trialMatchUrl: string;
  gasLimit: number;
}

// ── HTTP trigger payload ─────────────────────────────────────

interface TrialMatchRequest {
  researcherAddress: string;
  trialId: string;
  title: string;
  criteria: {
    ageRange: { min: number; max: number };
    conditions: string[];
    excludeConditions: string[];
    medications: string[];
    excludeMedications: string[];
    biomarkers?: { marker: string; range: { min: number; max: number } }[];
  };
  maxParticipants: number;
}

// ── Eligibility result (ZK-style — no patient identifiers) ──

interface TrialMatchResult {
  trialId: string;
  eligibleCount: number;
  totalScreened: number;
  anonymizedMatches: {
    matchId: string; // deterministic hash, non-reversible
    eligibilityScore: number;
    matchedCriteria: string[];
  }[];
  onChainTxHash: string;
}

// ── Handler ──────────────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  const trigger = runtime.getTrigger<HTTPTrigger>();
  const request: TrialMatchRequest = trigger.getBody();

  runtime.log(
    `[TrialMatcher] Matching trial "${request.title}" (${request.trialId})`
  );

  // ─── Step 1: Get opted-in patients from Governance ────────
  const consentedPatients = await evm.read({
    contractAddress: config.governanceAddress,
    method: "getResearchConsentedPatients()",
    args: [],
  });

  const patientAddresses = consentedPatients as string[];
  runtime.log(
    `[TrialMatcher] ${patientAddresses.length} patients opted into research`
  );

  // ─── Step 2: Fetch profiles via Confidential HTTP ─────────
  //  All processing happens inside TEE — no PHI leaks to researcher
  const matchResults: {
    matchId: string;
    eligible: boolean;
    eligibilityScore: number;
    matchedCriteria: string[];
  }[] = [];

  for (const patientAddress of patientAddresses) {
    try {
      // Fetch patient profile in TEE
      const profileResponse = await http.confidentialFetch(
        `${config.trialMatchUrl}/profile/${patientAddress}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secrets.get("IPFS_GATEWAY_TOKEN")}`,
            "X-Research-Consent": "verified",
          },
        }
      );

      const profile = profileResponse.json();

      // ─── Step 3: LLM evaluates eligibility in TEE ─────────
      const eligibilityResponse = await http.confidentialFetch(
        `${config.trialMatchUrl}/evaluate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secrets.get("AI_API_KEY")}`,
          },
          body: JSON.stringify({
            criteria: request.criteria,
            patientProfile: profile,
          }),
        }
      );

      const eligibility = eligibilityResponse.json();

      // Generate non-reversible match ID (hash of address + trial)
      const crypto = await import("crypto");
      const matchId = crypto
        .createHash("sha256")
        .update(`${patientAddress}:${request.trialId}`)
        .digest("hex")
        .slice(0, 16);

      matchResults.push({
        matchId,
        eligible: eligibility.isEligible,
        eligibilityScore: eligibility.score,
        matchedCriteria: eligibility.matchedCriteria ?? [],
      });
    } catch (err) {
      runtime.log(`[TrialMatcher] Error evaluating patient: ${err}`);
    }
  }

  const eligibleCount = matchResults.filter((m) => m.eligible).length;

  // ─── Step 4: Write anonymous match count on-chain ─────────
  const resultTx = await evm.write({
    contractAddress: config.governanceAddress,
    method: "recordTrialMatchResult(string,uint256,uint256)",
    args: [
      request.trialId,
      BigInt(eligibleCount),
      BigInt(patientAddresses.length),
    ],
    gasLimit: config.gasLimit,
  });

  runtime.log(
    `[TrialMatcher] Matched ${eligibleCount}/${patientAddresses.length}. Tx: ${resultTx.hash}`
  );

  return {
    trialId: request.trialId,
    eligibleCount,
    totalScreened: patientAddresses.length,
    anonymizedMatches: matchResults
      .filter((m) => m.eligible)
      .slice(0, request.maxParticipants)
      .map((m) => ({
        matchId: m.matchId,
        eligibilityScore: m.eligibilityScore,
        matchedCriteria: m.matchedCriteria,
      })),
    onChainTxHash: resultTx.hash,
  } as TrialMatchResult;
};

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "trial-matcher",
  handler,
  trigger: {
    type: "http",
    config: {
      method: "POST",
      path: "/api/cre/trial-match",
    },
  },
};

export default workflow;
