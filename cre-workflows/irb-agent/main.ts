/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Autonomous IRB Agent
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   HTTP  (fired when a research proposal is submitted)
 *
 *  Flow:
 *    1. Receive research proposal (title, protocol, researcher)
 *    2. Submit proposal on-chain via Governance.submitResearchProposal()
 *    3. Fetch IRB ethical guidelines via Confidential HTTP
 *    4. LLM evaluates proposal against guidelines (BFT consensus)
 *    5. Write IRB compliance score on-chain via recordIRBScore()
 *    6. Return structured compliance report
 *
 *  Capabilities used:
 *    • HTTP Trigger
 *    • EVM Read             (existing proposals)
 *    • Confidential HTTP    (IRB guidelines — sensitive)
 *    • Standard HTTP        (LLM evaluation API)
 *    • EVM Write            (submit proposal, record score)
 *    • BFT Consensus        (multi-node compliance scoring)
 *    • Secrets              (AI API key)
 *
 *  @module irb-agent
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
  irbGuidelinesUrl: string;
  gasLimit: number;
  minComplianceScore: number;
}

// ── HTTP trigger payload ─────────────────────────────────────

interface IRBRequest {
  researcher: string;
  title: string;
  description: string;
  protocolHash: string;
  studyType: string;
  participantCount: number;
  duration: string;
  dataCategories: string[];
  consentModel: string;
}

// ── IRB evaluation result ────────────────────────────────────

interface IRBEvaluation {
  complianceScore: number; // 0–10000 basis points
  passed: boolean;
  findings: {
    category: string;
    severity: "INFO" | "WARNING" | "VIOLATION";
    description: string;
    guidelineRef: string;
  }[];
  recommendations: string[];
  riskLevel: "MINIMAL" | "MODERATE" | "HIGH";
}

// ── Handler ──────────────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  const trigger = runtime.getTrigger<HTTPTrigger>();
  const request: IRBRequest = trigger.getBody();

  runtime.log(
    `[IRBAgent] Evaluating proposal: "${request.title}" by ${request.researcher}`
  );

  // ─── Step 1: Submit research proposal on-chain ────────────
  const submitTx = await evm.write({
    contractAddress: config.governanceAddress,
    method: "submitResearchProposal(address,string,string,bytes32)",
    args: [
      request.researcher,
      request.title,
      request.description,
      request.protocolHash,
    ],
    gasLimit: config.gasLimit,
  });

  runtime.log(`[IRBAgent] Proposal submitted on-chain: ${submitTx.hash}`);

  // ─── Step 2: Fetch IRB guidelines via Confidential HTTP ───
  const guidelinesResponse = await http.confidentialFetch(
    `${config.irbGuidelinesUrl}/guidelines`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secrets.get("IRB_API_KEY")}`,
      },
    }
  );

  const guidelines = guidelinesResponse.json();

  // ─── Step 3: LLM evaluates proposal via BFT consensus ────
  const evaluationResult = await runtime.runInNodeMode(async () => {
    const evalResponse = await http.fetch(
      `${config.irbGuidelinesUrl}/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secrets.get("AI_API_KEY")}`,
        },
        body: JSON.stringify({
          proposal: request,
          guidelines,
          evaluationCriteria: [
            "informed_consent",
            "data_privacy",
            "participant_safety",
            "data_minimization",
            "withdrawal_rights",
            "vulnerable_populations",
            "conflict_of_interest",
          ],
        }),
      }
    );
    return evalResponse.json() as IRBEvaluation;
  }, {
    aggregation: "consensusMedianAggregation",
    minResponses: 2,
  });

  // ─── Step 4: Record IRB score on-chain ────────────────────
  // Get the proposal ID from the submit transaction events
  const proposalId = submitTx.events?.[0]?.args?.proposalId ?? BigInt(0);

  await evm.write({
    contractAddress: config.governanceAddress,
    method: "recordIRBScore(uint256,uint256)",
    args: [proposalId, BigInt(evaluationResult.complianceScore)],
    gasLimit: config.gasLimit,
  });

  runtime.log(
    `[IRBAgent] Score recorded: ${evaluationResult.complianceScore}/10000 ` +
    `(${evaluationResult.passed ? "PASSED" : "FAILED"})`
  );

  return {
    proposalId: Number(proposalId),
    title: request.title,
    researcher: request.researcher,
    complianceScore: evaluationResult.complianceScore,
    passed: evaluationResult.complianceScore >= config.minComplianceScore,
    findings: evaluationResult.findings,
    recommendations: evaluationResult.recommendations,
    riskLevel: evaluationResult.riskLevel,
    onChainTxHash: submitTx.hash,
  };
};

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "irb-agent",
  handler,
  trigger: {
    type: "http",
    config: {
      method: "POST",
      path: "/api/cre/irb-evaluate",
    },
  },
};

export default workflow;
