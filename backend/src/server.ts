import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import config from "./config";
import routes from "./routes";
import { apiLimiter } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import logger from "./utils/logging";

const app = express();

// ─── Security & Utility Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP request logging via morgan → winston
app.use(
  morgan("short", {
    stream: {
      write: (message: string) => logger.http(message.trim()),
    },
  }),
);

// ─── Rate Limiting ──────────────────────────────────────────────────────────
app.use("/api", apiLimiter);

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use("/api", routes);

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────
if (require.main === module) {
  const port = config.port;
  app.listen(port, () => {
    logger.info(`mediCaRE backend listening on port ${port}`, {
      env: config.nodeEnv,
    });
  });
}

export default app;
