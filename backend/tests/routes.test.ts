import request from "supertest";
import express from "express";
import { computeRiskScore } from "../src/ai/risk";
import { detectAnomaly } from "../src/ai/anomaly";
import { VitalMetric } from "../src/types";

// ─── Setup a minimal Express app with the AI routes ─────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Risk score endpoint
  app.post("/api/ai/risk-score", (req, res) => {
    try {
      const { validate, riskScoreSchema } = require("../src/utils/validators");
      const body = validate(riskScoreSchema, req.body);
      const result = computeRiskScore(body);
      res.json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      res.status(status).json({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Anomaly detection endpoint
  app.post("/api/ai/anomaly-detect", (req, res) => {
    try {
      const { validate, anomalyDetectSchema } = require("../src/utils/validators");
      const body = validate(anomalyDetectSchema, req.body);
      const result = detectAnomaly(body);
      res.json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (err: any) {
      const status = err.statusCode ?? 500;
      res.status(status).json({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      data: { status: "healthy", service: "medicare-backend" },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Routes – Health Check", () => {
  const app = createTestApp();

  it("GET /api/health should return 200 with healthy status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("healthy");
  });
});

describe("Routes – POST /api/ai/risk-score", () => {
  const app = createTestApp();

  it("should return 200 with a risk score for valid input", async () => {
    const payload = {
      age: 45,
      bmi: 27,
      chronicConditions: 2,
      medicationCount: 3,
      priorClaims: 1,
      smokingStatus: false,
      exerciseHoursPerWeek: 3,
      systolicBP: 135,
      fastingGlucose: 105,
      cholesterol: 210,
    };

    const res = await request(app)
      .post("/api/ai/risk-score")
      .send(payload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBeDefined();
    expect(res.body.data.level).toBeDefined();
    expect(res.body.data.factors).toBeDefined();
    expect(Array.isArray(res.body.data.factors)).toBe(true);
  });

  it("should return 400 for invalid input", async () => {
    const res = await request(app)
      .post("/api/ai/risk-score")
      .send({ age: -5 })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Validation failed");
  });

  it("should return 400 when body is empty", async () => {
    const res = await request(app)
      .post("/api/ai/risk-score")
      .send({})
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("Routes – POST /api/ai/anomaly-detect", () => {
  const app = createTestApp();

  it("should return 200 with anomaly result for valid input", async () => {
    const payload = {
      metric: "HEART_RATE",
      values: [72, 74, 71, 73, 72, 75, 73, 74, 72, 73],
      timestamps: Array.from({ length: 10 }, (_, i) => 1000 + i * 60),
    };

    const res = await request(app)
      .post("/api/ai/anomaly-detect")
      .send(payload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metric).toBe("HEART_RATE");
    expect(typeof res.body.data.isAnomaly).toBe("boolean");
    expect(typeof res.body.data.zScore).toBe("number");
  });

  it("should detect anomaly for spiked value", async () => {
    const payload = {
      metric: "BLOOD_GLUCOSE",
      values: [95, 92, 98, 94, 96, 93, 97, 95, 94, 400],
      timestamps: Array.from({ length: 10 }, (_, i) => 1000 + i * 60),
    };

    const res = await request(app)
      .post("/api/ai/anomaly-detect")
      .send(payload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.data.isAnomaly).toBe(true);
    expect(res.body.data.latestValue).toBe(400);
  });

  it("should return 400 for invalid metric type", async () => {
    const res = await request(app)
      .post("/api/ai/anomaly-detect")
      .send({ metric: "INVALID_METRIC", values: [1, 2, 3, 4, 5], timestamps: [1, 2, 3, 4, 5] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should return 400 when fewer than 5 values provided", async () => {
    const res = await request(app)
      .post("/api/ai/anomaly-detect")
      .send({
        metric: "HEART_RATE",
        values: [72, 74],
        timestamps: [1, 2],
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("Routes – response envelope", () => {
  const app = createTestApp();

  it("should always include success and timestamp in the response", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body).toHaveProperty("success");
    expect(res.body).toHaveProperty("timestamp");
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it("should include data on successful responses", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body).toHaveProperty("data");
  });

  it("should include error on failed responses", async () => {
    const res = await request(app)
      .post("/api/ai/risk-score")
      .send({})
      .set("Content-Type", "application/json");

    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty("error");
  });
});
