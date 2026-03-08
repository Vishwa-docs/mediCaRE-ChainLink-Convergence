import { Router, Request, Response } from "express";
import {
  getTreasuryMetrics,
  getAlerts,
  getRecentPayouts,
  runAnomalyCheck,
  pauseTreasury,
  resumeTreasury,
} from "../services/treasury";

const router = Router();

/**
 * GET /api/treasury/reserves
 * Get current treasury reserve status and metrics.
 */
router.get("/reserves", (_req: Request, res: Response) => {
  const metrics = getTreasuryMetrics();
  res.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/treasury/health
 * Get treasury health score, alerts, and recent payouts.
 */
router.get("/health", (_req: Request, res: Response) => {
  const metrics = getTreasuryMetrics();
  const activeAlerts = getAlerts(false);
  const payouts = getRecentPayouts(10);

  res.json({
    success: true,
    data: {
      healthScore: metrics.healthScore,
      status: metrics.status,
      reserveRatio: metrics.reserveRatio,
      activeAlerts,
      recentPayouts: payouts,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/treasury/check
 * Run anomaly detection check on the treasury.
 */
router.post("/check", (_req: Request, res: Response) => {
  const alerts = runAnomalyCheck();
  const metrics = getTreasuryMetrics();

  res.json({
    success: true,
    data: {
      newAlerts: alerts,
      healthScore: metrics.healthScore,
      status: metrics.status,
    },
    message: alerts.length > 0
      ? `${alerts.length} alert(s) detected`
      : "No anomalies detected",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/treasury/pause
 * Pause all insurance payouts (CRE risk monitor or admin action).
 */
router.post("/pause", (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({
      success: false,
      error: "reason is required",
      timestamp: new Date().toISOString(),
    });
  }

  const alert = pauseTreasury(reason);
  res.json({
    success: true,
    data: alert,
    message: "Treasury payouts paused",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/treasury/resume
 * Resume payouts after review.
 */
router.post("/resume", (_req: Request, res: Response) => {
  resumeTreasury();
  const metrics = getTreasuryMetrics();

  res.json({
    success: true,
    data: { healthScore: metrics.healthScore, status: metrics.status },
    message: "Treasury payouts resumed",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/treasury/alerts
 * Get all treasury alerts.
 */
router.get("/alerts", (req: Request, res: Response) => {
  const { resolved } = req.query;
  const alerts = resolved !== undefined
    ? getAlerts(resolved === "true")
    : getAlerts();

  res.json({
    success: true,
    data: alerts,
    total: alerts.length,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/treasury/payouts
 * Get recent payout history.
 */
router.get("/payouts", (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const payouts = getRecentPayouts(limit);

  res.json({
    success: true,
    data: payouts,
    total: payouts.length,
    timestamp: new Date().toISOString(),
  });
});

export default router;
