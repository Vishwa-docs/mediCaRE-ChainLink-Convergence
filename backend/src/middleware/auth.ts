import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import { JWTPayload, UserRole } from "../types";
import { createLogger } from "../utils/logging";

const log = createLogger("auth");

/** Extend Express Request to carry decoded JWT. */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware that validates the `Authorization: Bearer <token>` header.
 * On success the decoded payload is attached to `req.user`.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Missing or malformed Authorization header",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    req.user = decoded;
    log.debug("Authenticated request", { sub: decoded.sub, role: decoded.role });
    next();
  } catch (err) {
    log.warn("JWT verification failed", { error: (err as Error).message });
    res.status(401).json({
      success: false,
      error: "Invalid or expired token",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Factory that creates middleware restricting access to specific roles.
 */
export function authorise(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      log.warn("Authorisation denied", {
        sub: req.user.sub,
        role: req.user.role,
        required: roles,
      });
      res.status(403).json({
        success: false,
        error: "Insufficient permissions",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Sign a JWT for the given payload.
 */
export function signToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, config.jwt.secret as jwt.Secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}
