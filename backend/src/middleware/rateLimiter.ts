import rateLimit from "express-rate-limit";
import config from "../config";
import { createLogger } from "../utils/logging";

const log = createLogger("rate-limiter");

/**
 * Default rate limiter applied to all API routes.
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests — please try again later",
    timestamp: new Date().toISOString(),
  },
  handler: (_req, res, _next, options) => {
    log.warn("Rate limit exceeded", {
      ip: _req.ip,
      path: _req.path,
    });
    res.status(429).json(options.message);
  },
});

/**
 * Stricter rate limiter for authentication endpoints.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many authentication attempts — try again in 15 minutes",
    timestamp: new Date().toISOString(),
  },
});

/**
 * Stricter rate limiter for AI/LLM endpoints (costly operations).
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "AI rate limit reached — try again shortly",
    timestamp: new Date().toISOString(),
  },
});
