/**
 * @module treasury
 * @description Insurance Treasury Monitor Service
 *
 * Monitors reserve balances, computes health metrics, and triggers
 * pause alerts when anomalies or low reserves are detected.
 * Used by the CRE fraud-monitor workflow.
 */

import { createLogger } from "../utils/logging";

const log = createLogger("service:treasury");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TreasuryMetrics {
  totalReserves: number;
  totalLiabilities: number;
  reserveRatio: number; // reserves / liabilities
  payoutVelocity: number; // payouts per day (30-day rolling)
  averageClaimSize: number;
  pendingClaims: number;
  pendingPayoutAmount: number;
  healthScore: number; // 0–100
  status: "healthy" | "warning" | "critical" | "paused";
  lastUpdated: string;
}

export interface TreasuryAlert {
  id: string;
  type: "LOW_RESERVES" | "HIGH_VELOCITY" | "ANOMALY_SPIKE" | "FRAUD_DETECTED" | "MANUAL_PAUSE";
  severity: "info" | "warning" | "critical";
  message: string;
  data: Record<string, number | string>;
  timestamp: string;
  resolved: boolean;
}

export interface PayoutRecord {
  claimId: string;
  amount: number;
  recipient: string;
  chain: string;
  timestamp: string;
  txHash: string;
}

// ─── In-Memory State ────────────────────────────────────────────────────────

let treasuryState: TreasuryMetrics = {
  totalReserves: 2500000, // $2.5M USDC
  totalLiabilities: 1800000,
  reserveRatio: 1.389,
  payoutVelocity: 15000, // $15K/day
  averageClaimSize: 8500,
  pendingClaims: 12,
  pendingPayoutAmount: 102000,
  healthScore: 82,
  status: "healthy",
  lastUpdated: new Date().toISOString(),
};

const alerts: TreasuryAlert[] = [
  {
    id: "alert_001",
    type: "LOW_RESERVES",
    severity: "warning",
    message: "Reserve ratio approaching minimum threshold (1.2x)",
    data: { currentRatio: 1.389, threshold: 1.2 },
    timestamp: "2026-03-05T08:00:00Z",
    resolved: true,
  },
];

const recentPayouts: PayoutRecord[] = [
  { claimId: "claim_042", amount: 15000, recipient: "0xHospitalA...", chain: "Ethereum", timestamp: "2026-03-06T10:00:00Z", txHash: "0xpayout001..." },
  { claimId: "claim_043", amount: 8500, recipient: "0xHospitalB...", chain: "Base", timestamp: "2026-03-06T11:30:00Z", txHash: "0xpayout002..." },
  { claimId: "claim_044", amount: 22000, recipient: "0xHospitalA...", chain: "Ethereum", timestamp: "2026-03-06T14:00:00Z", txHash: "0xpayout003..." },
  { claimId: "claim_045", amount: 5200, recipient: "0xClinicC...", chain: "Base", timestamp: "2026-03-07T09:00:00Z", txHash: "0xpayout004..." },
];

// ─── Service Functions ──────────────────────────────────────────────────────

const RESERVE_THRESHOLD = 1.2; // Minimum reserve ratio
const VELOCITY_THRESHOLD = 50000; // Max daily payout velocity ($)
const SPIKE_THRESHOLD = 3; // Claims per hospital per day to flag

/**
 * Get current treasury metrics.
 */
export function getTreasuryMetrics(): TreasuryMetrics {
  return { ...treasuryState, lastUpdated: new Date().toISOString() };
}

/**
 * Compute health score from current metrics.
 */
export function computeHealthScore(metrics: TreasuryMetrics): number {
  let score = 100;

  // Reserve ratio penalty
  if (metrics.reserveRatio < 1.0) score -= 40;
  else if (metrics.reserveRatio < RESERVE_THRESHOLD) score -= 25;
  else if (metrics.reserveRatio < 1.5) score -= 10;

  // Payout velocity penalty
  if (metrics.payoutVelocity > VELOCITY_THRESHOLD) score -= 20;
  else if (metrics.payoutVelocity > VELOCITY_THRESHOLD * 0.7) score -= 10;

  // Pending claims penalty
  if (metrics.pendingClaims > 50) score -= 15;
  else if (metrics.pendingClaims > 20) score -= 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Run fraud/anomaly check on recent payouts.
 * Returns alerts if anomalies detected.
 */
export function runAnomalyCheck(): TreasuryAlert[] {
  const newAlerts: TreasuryAlert[] = [];

  // 1. Reserve ratio check
  if (treasuryState.reserveRatio < RESERVE_THRESHOLD) {
    const alert: TreasuryAlert = {
      id: `alert_${Date.now()}`,
      type: "LOW_RESERVES",
      severity: treasuryState.reserveRatio < 1.0 ? "critical" : "warning",
      message: `Reserve ratio ${treasuryState.reserveRatio.toFixed(2)}x is below threshold ${RESERVE_THRESHOLD}x`,
      data: { currentRatio: treasuryState.reserveRatio, threshold: RESERVE_THRESHOLD },
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    newAlerts.push(alert);
    alerts.push(alert);
  }

  // 2. Payout velocity check
  if (treasuryState.payoutVelocity > VELOCITY_THRESHOLD) {
    const alert: TreasuryAlert = {
      id: `alert_${Date.now()}_vel`,
      type: "HIGH_VELOCITY",
      severity: "warning",
      message: `Payout velocity $${treasuryState.payoutVelocity.toLocaleString()}/day exceeds threshold`,
      data: { velocity: treasuryState.payoutVelocity, threshold: VELOCITY_THRESHOLD },
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    newAlerts.push(alert);
    alerts.push(alert);
  }

  // 3. Hospital billing frequency spike
  const hospitalCounts: Record<string, number> = {};
  const oneDayAgo = Date.now() - 86400000;
  for (const p of recentPayouts) {
    if (new Date(p.timestamp).getTime() > oneDayAgo) {
      hospitalCounts[p.recipient] = (hospitalCounts[p.recipient] ?? 0) + 1;
    }
  }
  for (const [hospital, count] of Object.entries(hospitalCounts)) {
    if (count >= SPIKE_THRESHOLD) {
      const alert: TreasuryAlert = {
        id: `alert_${Date.now()}_spike`,
        type: "ANOMALY_SPIKE",
        severity: "critical",
        message: `Hospital ${hospital.slice(0, 10)}... filed ${count} claims in 24h — potential fraud`,
        data: { hospital, claimCount: count, threshold: SPIKE_THRESHOLD },
        timestamp: new Date().toISOString(),
        resolved: false,
      };
      newAlerts.push(alert);
      alerts.push(alert);
    }
  }

  // Update health score
  treasuryState.healthScore = computeHealthScore(treasuryState);
  if (newAlerts.some((a) => a.severity === "critical")) {
    treasuryState.status = "critical";
  } else if (newAlerts.some((a) => a.severity === "warning")) {
    treasuryState.status = "warning";
  }

  log.info("Anomaly check completed", {
    alertCount: newAlerts.length,
    healthScore: treasuryState.healthScore,
  });

  return newAlerts;
}

/**
 * Get all alerts, optionally filtered.
 */
export function getAlerts(resolved?: boolean): TreasuryAlert[] {
  if (resolved === undefined) return [...alerts];
  return alerts.filter((a) => a.resolved === resolved);
}

/**
 * Get recent payout history.
 */
export function getRecentPayouts(limit = 20): PayoutRecord[] {
  return recentPayouts.slice(-limit);
}

/**
 * Pause payouts (triggered by CRE risk monitor).
 */
export function pauseTreasury(reason: string): TreasuryAlert {
  treasuryState.status = "paused";
  const alert: TreasuryAlert = {
    id: `alert_${Date.now()}_pause`,
    type: "MANUAL_PAUSE",
    severity: "critical",
    message: `Payouts paused: ${reason}`,
    data: { reason },
    timestamp: new Date().toISOString(),
    resolved: false,
  };
  alerts.push(alert);
  log.warn("Treasury payouts paused", { reason });
  return alert;
}

/**
 * Resume payouts after review.
 */
export function resumeTreasury(): void {
  treasuryState.status = "healthy";
  treasuryState.healthScore = computeHealthScore(treasuryState);
  // Resolve all active pause alerts
  for (const a of alerts) {
    if (a.type === "MANUAL_PAUSE" && !a.resolved) {
      a.resolved = true;
    }
  }
  log.info("Treasury payouts resumed");
}
