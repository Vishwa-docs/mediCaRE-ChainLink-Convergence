import winston from "winston";
import config from "../config";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss.SSS" }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${ts} ${level}: ${stack ?? message}${metaStr}`;
  }),
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: config.logLevel,
  format: config.nodeEnv === "production" ? prodFormat : devFormat,
  defaultMeta: { service: "medicare-backend" },
  transports: [
    new winston.transports.Console(),
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
  ],
});

/** Create a child logger with a component label. */
export function createLogger(component: string): winston.Logger {
  return logger.child({ component });
}

export default logger;
