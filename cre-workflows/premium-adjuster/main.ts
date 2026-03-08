/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Dynamic Premium Adjuster
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   Cron  (monthly — recalculates premiums based on
 *             aggregated patient risk data)
 *
 *  Flow:
 *    1. Fetch all active policy IDs from InsurancePolicy on-chain
 *    2. For each policy, gather risk factors:
 *       a. Claims history (frequency, amounts)
 *       b. Vitals data trends (if opted in)
 *       c. Lifestyle/wellness metrics
 *    3. Run risk model to compute new premium recommendation
 *    4. Apply cap on max adjustment per cycle (±5%)
 *    5. Call adjustPremiumByCron() on-chain for each policy
 *
 *  Capabilities used:
 *    • Cron Trigger
 *    • EVM Read             (active policies, claims history)
 *    • Standard HTTP        (risk model API)
 *    • EVM Write            (adjustPremiumByCron)
 *    • Secrets              (AI API key)
 *
 *  @module premium-adjuster
 */

import {
  HTTPClient,
  EVMClient,
  CronTrigger,
  Runtime,
  Handler,
  Workflow,
} from "@chainlink/cre-sdk";

// ── Config ───────────────────────────────────────────────────

interface Config {
  chainName: string;
  insurancePolicyAddress: string;
  ehrStorageAddress: string;
  riskModelUrl: string;
  gasLimit: number;
  cronSchedule: string;
  maxAdjustmentBps: number;
  batchSize: number;
}

// ── Policy summary from on-chain ─────────────────────────────

interface PolicySummary {
  policyId: bigint;
  holder: string;
  coverageAmount: bigint;
  premiumAmount: bigint;
  riskScore: bigint;
  claimCount: number;
  totalClaimAmount: bigint;
}

// ── Risk model output ────────────────────────────────────────

interface RiskAssessment {
  policyId: number;
  currentRiskScore: number;
  newRiskScore: number;
  recommendedPremiumBps: number; // basis points change (positive = increase)
  factors: {
    claimFrequency: number;
    claimSeverity: number;
    healthTrend: number;
    ageAdjustment: number;
    lifestyleScore: number;
  };
}

// ── Handler ──────────────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  runtime.log(`[PremiumAdjuster] Monthly premium recalculation triggered`);

  // ─── Step 1: Get active policy count ──────────────────────
  const policyCount = await evm.read({
    contractAddress: config.insurancePolicyAddress,
    method: "totalPolicies()",
    args: [],
  });

  const totalPolicies = Number(policyCount);
  runtime.log(`[PremiumAdjuster] Found ${totalPolicies} total policies`);

  let adjustmentsApplied = 0;
  let adjustmentsSkipped = 0;

  // ─── Step 2: Process in batches ───────────────────────────
  for (let batch = 0; batch < totalPolicies; batch += config.batchSize) {
    const end = Math.min(batch + config.batchSize, totalPolicies);
    const policyBatch: PolicySummary[] = [];

    // Read policy details for this batch
    for (let i = batch; i < end; i++) {
      try {
        const policy = await evm.read({
          contractAddress: config.insurancePolicyAddress,
          method: "getPolicy(uint256)",
          args: [BigInt(i)],
        });

        if (policy.isActive) {
          policyBatch.push({
            policyId: BigInt(i),
            holder: policy.holder as string,
            coverageAmount: policy.coverageAmount as bigint,
            premiumAmount: policy.premiumAmount as bigint,
            riskScore: policy.riskScore as bigint,
            claimCount: Number(policy.claimCount ?? 0),
            totalClaimAmount: (policy.totalClaimAmount as bigint) ?? BigInt(0),
          });
        }
      } catch {
        // Skip invalid policies
      }
    }

    if (policyBatch.length === 0) continue;

    // ─── Step 3: Run risk model on batch ────────────────────
    const riskModelResponse = await http.fetch(
      `${config.riskModelUrl}/batch-assess`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secrets.get("AI_API_KEY")}`,
        },
        body: JSON.stringify({
          policies: policyBatch.map((p) => ({
            policyId: Number(p.policyId),
            currentRiskScore: Number(p.riskScore),
            claimCount: p.claimCount,
            premiumAmount: Number(p.premiumAmount),
            coverageAmount: Number(p.coverageAmount),
          })),
        }),
      }
    );

    const assessments: RiskAssessment[] = riskModelResponse.json();

    // ─── Step 4: Apply adjustments with cap ─────────────────
    for (const assessment of assessments) {
      // Cap the adjustment
      let adjustmentBps = assessment.recommendedPremiumBps;
      if (Math.abs(adjustmentBps) > config.maxAdjustmentBps) {
        adjustmentBps = adjustmentBps > 0
          ? config.maxAdjustmentBps
          : -config.maxAdjustmentBps;
      }

      // Skip tiny adjustments (< 0.5%)
      if (Math.abs(adjustmentBps) < 50) {
        adjustmentsSkipped++;
        continue;
      }

      // Find the original policy data
      const policy = policyBatch.find(
        (p) => Number(p.policyId) === assessment.policyId
      );
      if (!policy) continue;

      // Calculate new premium
      const currentPremium = Number(policy.premiumAmount);
      const newPremium = Math.floor(
        currentPremium * (1 + adjustmentBps / 10000)
      );

      // ─── Step 5: Write new premium on-chain ───────────────
      await evm.write({
        contractAddress: config.insurancePolicyAddress,
        method: "adjustPremiumByCron(uint256,uint256)",
        args: [policy.policyId, BigInt(newPremium)],
        gasLimit: config.gasLimit,
      });

      adjustmentsApplied++;
      runtime.log(
        `[PremiumAdjuster] Policy ${assessment.policyId}: ` +
        `${currentPremium} → ${newPremium} (${adjustmentBps > 0 ? "+" : ""}${adjustmentBps}bps)`
      );
    }
  }

  runtime.log(
    `[PremiumAdjuster] Complete. Applied: ${adjustmentsApplied}, Skipped: ${adjustmentsSkipped}`
  );

  return {
    totalPolicies,
    adjustmentsApplied,
    adjustmentsSkipped,
  };
};

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "premium-adjuster",
  handler,
  trigger: {
    type: "cron",
    config: {
      schedule: "${cronSchedule}",
    },
  },
};

export default workflow;
