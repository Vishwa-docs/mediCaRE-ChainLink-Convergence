import { Router, Request, Response, NextFunction } from "express";
import {
  validate,
  ehrSummarizeSchema,
  riskScoreSchema,
  anomalyDetectSchema,
  worldIdVerifySchema,
} from "../utils/validators";
import { summariseEHR } from "../ai/summarizer";
import { computeRiskScore } from "../ai/risk";
import { detectAnomaly } from "../ai/anomaly";
import { verifyWorldIDProof } from "../services/worldid";
import { aiLimiter } from "../middleware/rateLimiter";
import { createLogger } from "../utils/logging";

const log = createLogger("routes:ai");
const router = Router();

/**
 * POST /api/ai/summarize
 * Standalone EHR summarisation endpoint.
 */
router.post(
  "/summarize",
  aiLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(ehrSummarizeSchema, req.body);
      const summary = await summariseEHR(body.ehrText, body.language);

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/ai/risk-score
 * Compute a risk score for a patient / insurance claim.
 */
router.post(
  "/risk-score",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(riskScoreSchema, req.body);
      const result = computeRiskScore(body);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/ai/anomaly-detect
 * Run anomaly detection on a time-series of vital signs.
 */
router.post(
  "/anomaly-detect",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(anomalyDetectSchema, req.body);
      const result = detectAnomaly(body);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/worldid/verify
 * Verify a World ID zero-knowledge proof.
 */
router.post(
  "/worldid/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(worldIdVerifySchema, req.body);
      const result = await verifyWorldIDProof(body);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
