import { Router, Request, Response, NextFunction } from "express";
import {
  track,
  getMetrics,
  getRecentEvents,
  AnalyticsEvent,
  EventCategory,
} from "../services/analytics";
import { createLogger } from "../utils/logging";

const log = createLogger("routes:analytics");
const router = Router();

/**
 * GET /api/analytics/metrics?window=60
 * Retrieve aggregated analytics metrics for a given time window.
 */
router.get(
  "/metrics",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const windowMinutes = parseInt(req.query.window as string, 10) || 60;
      const metrics = getMetrics(windowMinutes);

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/analytics/events?limit=50
 * Retrieve the most recent analytics events.
 */
router.get(
  "/events",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const events = getRecentEvents(limit);

      res.json({
        success: true,
        data: events,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/analytics/track
 * Track a custom analytics event.
 *
 * Body: { event: string, category: EventCategory, actor?: string, properties?: Record<string, any> }
 */
router.post(
  "/track",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event, category, actor, properties } = req.body;

      if (!event || !category) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: event, category",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const analyticsEvent: AnalyticsEvent = {
        event,
        category,
        actor,
        properties,
      };

      track(analyticsEvent);

      log.info("Custom analytics event tracked", { event, category, actor });

      res.status(201).json({
        success: true,
        data: { event, category, actor },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
