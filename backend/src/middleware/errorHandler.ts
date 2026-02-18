import { Request, Response, NextFunction } from "express";
import { createLogger } from "../utils/logging";

const log = createLogger("error-handler");

/** Extended error with optional HTTP status code. */
interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

/**
 * Global Express error handler.
 * Must be registered **after** all routes.
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    log.error("Unhandled server error", {
      message: err.message,
      stack: err.stack,
      details: err.details,
    });
  } else {
    log.warn("Client error", {
      status: statusCode,
      message: err.message,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: isServerError ? "Internal server error" : err.message,
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
      details: err.details,
    }),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Catch-all for routes that don't match.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
}
