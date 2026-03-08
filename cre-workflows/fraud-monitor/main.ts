/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Fraud & Anomaly Detection Monitor
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   Cron  (every 6 hours — scans recent claims for
 *             fraudulent billing patterns)
 *
 *  Flow:
 *    1. Read recent claims from InsurancePolicy on-chain
 *    2. Group claims by provider/hospital for frequency analysis
 *    3. Run graph-based anomaly detection on billing patterns
 *    4. Flag suspicious claims on-chain via flagClaim()
 *    5. Check treasury reserves — if below threshold, pause payouts
 *    6. Return fraud detection summary
 *
 *  Capabilities used:
 *    • Cron Trigger
 *    • EVM Read             (recent claims, reserve balances)
 *    • Standard HTTP        (fraud detection ML model)
 *    • EVM Write            (flagClaim, pausePayouts)
 *    • Secrets              (AI API key)
 *
 *  @module fraud-monitor
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
  fraudDetectionUrl: string;
  treasuryAddress: string;
  gasLimit: number;
  cronSchedule: string;
  fraudThreshold: number;
  reserveMinimum: number;
  stablecoinAddress: string;
}

// ── Claim data from on-chain ─────────────────────────────────

interface ClaimRecord {
  claimId: number;
  policyId: number;
  claimant: string;
  amount: bigint;
  timestamp: number;
  status: number;
  provider: string;
}

// ── Fraud detection response ─────────────────────────────────

interface FraudAnalysis {
  totalClaimsAnalyzed: number;
  flaggedClaims: {
    claimId: number;
    fraudScore: number;
    patterns: string[];
    recommendation: "FLAG" | "BLOCK" | "MONITOR";
  }[];
  providerRiskMap: {
    provider: string;
    billingFrequency: number;
    averageClaimAmount: number;
    anomalyScore: number;
  }[];
  networkAnomalies: string[];
}

// ── Handler ──────────────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  runtime.log(`[FraudMonitor] Cron triggered — scanning recent claims`);

  // ─── Step 1: Read recent claims ───────────────────────────
  const totalClaims = await evm.read({
    contractAddress: config.insurancePolicyAddress,
    method: "totalClaims()",
    args: [],
  });

  // Look at last 100 claims
  const lookback = Math.min(Number(totalClaims), 100);
  const startId = Number(totalClaims) - lookback;
  const recentClaims: ClaimRecord[] = [];

  for (let i = startId; i < Number(totalClaims); i++) {
    try {
      const claim = await evm.read({
        contractAddress: config.insurancePolicyAddress,
        method: "getClaim(uint256)",
        args: [BigInt(i)],
      });

      recentClaims.push({
        claimId: i,
        policyId: Number(claim.policyId),
        claimant: claim.claimant as string,
        amount: claim.amount as bigint,
        timestamp: Number(claim.timestamp),
        status: Number(claim.status),
        provider: claim.provider as string ?? "unknown",
      });
    } catch {
      // Skip failed reads
    }
  }

  runtime.log(`[FraudMonitor] Loaded ${recentClaims.length} recent claims`);

  // ─── Step 2: Run fraud detection model ────────────────────
  const fraudResponse = await http.fetch(
    `${config.fraudDetectionUrl}/analyze`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secrets.get("AI_API_KEY")}`,
      },
      body: JSON.stringify({
        claims: recentClaims.map((c) => ({
          claimId: c.claimId,
          claimant: c.claimant,
          amount: Number(c.amount),
          timestamp: c.timestamp,
          provider: c.provider,
        })),
      }),
    }
  );

  const analysis: FraudAnalysis = fraudResponse.json();

  // ─── Step 3: Flag suspicious claims on-chain ──────────────
  let flaggedCount = 0;
  for (const flagged of analysis.flaggedClaims) {
    if (flagged.fraudScore >= config.fraudThreshold) {
      await evm.write({
        contractAddress: config.insurancePolicyAddress,
        method: "flagClaim(uint256,string)",
        args: [
          BigInt(flagged.claimId),
          `Fraud score: ${flagged.fraudScore}/10000. Patterns: ${flagged.patterns.join(", ")}`,
        ],
        gasLimit: config.gasLimit,
      });
      flaggedCount++;

      runtime.log(
        `[FraudMonitor] Flagged claim ${flagged.claimId} (score: ${flagged.fraudScore})`
      );
    }
  }

  // ─── Step 4: Check treasury reserves ──────────────────────
  let pausedPayouts = false;
  if (config.stablecoinAddress !== "0x0000000000000000000000000000000000000000") {
    const reserveBalance = await evm.read({
      contractAddress: config.stablecoinAddress,
      method: "balanceOf(address)",
      args: [config.treasuryAddress],
    });

    const reserves = Number(reserveBalance);
    if (reserves < config.reserveMinimum) {
      runtime.log(
        `[FraudMonitor] Reserves (${reserves}) below minimum (${config.reserveMinimum}). Pausing payouts.`
      );

      await evm.write({
        contractAddress: config.insurancePolicyAddress,
        method: "pausePayouts()",
        args: [],
        gasLimit: config.gasLimit,
      });
      pausedPayouts = true;
    }
  }

  runtime.log(
    `[FraudMonitor] Scan complete. Flagged: ${flaggedCount}, ` +
    `Providers at risk: ${analysis.providerRiskMap.filter((p) => p.anomalyScore > 70).length}`
  );

  return {
    claimsAnalyzed: recentClaims.length,
    claimsFlagged: flaggedCount,
    providersAtRisk: analysis.providerRiskMap.filter((p) => p.anomalyScore > 70).length,
    networkAnomalies: analysis.networkAnomalies.length,
    payoutsPaused: pausedPayouts,
  };
};

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "fraud-monitor",
  handler,
  trigger: {
    type: "cron",
    config: {
      schedule: "${cronSchedule}",
    },
  },
};

export default workflow;
