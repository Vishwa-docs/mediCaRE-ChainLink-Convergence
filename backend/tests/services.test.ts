import {
  parseSensorPayload,
  validateReading,
  detectBreaches,
  processReadingsBatch,
} from "../src/services/oracle";
import { IoTReading, SensorThresholds } from "../src/types";

// ─── Oracle Service Tests ───────────────────────────────────────────────────

describe("services/oracle – parseSensorPayload", () => {
  it("should parse a flat JSON payload into an IoTReading", () => {
    const raw = {
      sensorId: "TEMP-001",
      batchId: "42",
      timestamp: 1700000000,
      temperature: 5.2,
      humidity: 55,
      latitude: 40.7128,
      longitude: -74.006,
    };

    const reading = parseSensorPayload(raw);

    expect(reading.sensorId).toBe("TEMP-001");
    expect(reading.batchId).toBe("42");
    expect(reading.temperature).toBe(5.2);
    expect(reading.humidity).toBe(55);
    expect(reading.latitude).toBe(40.7128);
    expect(reading.longitude).toBe(-74.006);
  });

  it("should parse a nested { data: { ... } } envelope", () => {
    const raw = {
      data: {
        sensor_id: "HUM-002",
        batch_id: "99",
        timestamp: 1700000100,
        humidity: 80,
      },
    };

    const reading = parseSensorPayload(raw);
    expect(reading.sensorId).toBe("HUM-002");
    expect(reading.batchId).toBe("99");
    expect(reading.humidity).toBe(80);
    expect(reading.temperature).toBeUndefined();
  });

  it("should parse a JSON string", () => {
    const jsonStr = JSON.stringify({
      sensorId: "GPS-100",
      batchId: "1",
      timestamp: 1700000200,
      latitude: 51.5074,
      longitude: -0.1278,
    });

    const reading = parseSensorPayload(jsonStr);
    expect(reading.sensorId).toBe("GPS-100");
    expect(reading.latitude).toBe(51.5074);
  });

  it("should default sensorId to 'unknown' when missing", () => {
    const reading = parseSensorPayload({ batchId: "5", timestamp: 123 });
    expect(reading.sensorId).toBe("unknown");
  });
});

describe("services/oracle – validateReading", () => {
  it("should return true for a reading within default thresholds", () => {
    const reading: IoTReading = {
      sensorId: "T-1",
      batchId: "1",
      timestamp: Date.now(),
      temperature: 5,
      humidity: 50,
    };
    expect(validateReading(reading)).toBe(true);
  });

  it("should return false when temperature exceeds max", () => {
    const reading: IoTReading = {
      sensorId: "T-2",
      batchId: "2",
      timestamp: Date.now(),
      temperature: 12,
      humidity: 50,
    };
    expect(validateReading(reading)).toBe(false);
  });

  it("should return false when temperature is below min", () => {
    const reading: IoTReading = {
      sensorId: "T-3",
      batchId: "3",
      timestamp: Date.now(),
      temperature: -1,
      humidity: 50,
    };
    expect(validateReading(reading)).toBe(false);
  });

  it("should accept custom thresholds", () => {
    const custom: SensorThresholds = {
      temperatureMin: -20,
      temperatureMax: -2,
      humidityMin: 10,
      humidityMax: 30,
    };
    const reading: IoTReading = {
      sensorId: "T-4",
      batchId: "4",
      timestamp: Date.now(),
      temperature: -10,
      humidity: 20,
    };
    expect(validateReading(reading, custom)).toBe(true);
  });
});

describe("services/oracle – detectBreaches", () => {
  it("should detect a temperature breach above max", () => {
    const reading: IoTReading = {
      sensorId: "B-1",
      batchId: "10",
      timestamp: 1700000000,
      temperature: 15,
    };

    const breaches = detectBreaches(reading);

    expect(breaches).toHaveLength(1);
    expect(breaches[0].metric).toBe("temperature");
    expect(breaches[0].direction).toBe("above");
    expect(breaches[0].value).toBe(15);
  });

  it("should detect multiple breaches", () => {
    const reading: IoTReading = {
      sensorId: "B-2",
      batchId: "11",
      timestamp: 1700000000,
      temperature: 20,
      humidity: 90,
    };

    const breaches = detectBreaches(reading);
    expect(breaches).toHaveLength(2);
    expect(breaches.find((b) => b.metric === "temperature")).toBeDefined();
    expect(breaches.find((b) => b.metric === "humidity")).toBeDefined();
  });

  it("should return empty for a compliant reading", () => {
    const reading: IoTReading = {
      sensorId: "B-3",
      batchId: "12",
      timestamp: 1700000000,
      temperature: 5,
      humidity: 50,
    };
    expect(detectBreaches(reading)).toHaveLength(0);
  });
});

describe("services/oracle – processReadingsBatch", () => {
  it("should process multiple readings and flag invalid ones", () => {
    const payloads = [
      { sensorId: "A", batchId: "1", timestamp: 1, temperature: 5, humidity: 50 },
      { sensorId: "B", batchId: "2", timestamp: 2, temperature: 25, humidity: 50 },
      { sensorId: "C", batchId: "3", timestamp: 3, temperature: 4, humidity: 85 },
    ];

    const results = processReadingsBatch(payloads);

    expect(results).toHaveLength(3);
    expect(results[0].valid).toBe(true);
    expect(results[0].breaches).toHaveLength(0);
    expect(results[1].valid).toBe(false);
    expect(results[2].valid).toBe(false);
  });
});

// ─── Crypto Utility Tests ───────────────────────────────────────────────────

describe("utils/crypto – encrypt / decrypt", () => {
  // We need to set env vars before importing crypto
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.ENCRYPTION_KEY = "abcdefghijklmnopqrstuvwxyz123456";
    process.env.RPC_URL = "http://localhost:8545";
    process.env.PRIVATE_KEY = "0x" + "ab".repeat(32);
    process.env.EHR_STORAGE_ADDRESS = "0x" + "00".repeat(20);
    process.env.INSURANCE_POLICY_ADDRESS = "0x" + "00".repeat(20);
    process.env.SUPPLY_CHAIN_ADDRESS = "0x" + "00".repeat(20);
    process.env.CREDENTIAL_REGISTRY_ADDRESS = "0x" + "00".repeat(20);
    process.env.GOVERNANCE_ADDRESS = "0x" + "00".repeat(20);
    process.env.PINATA_API_KEY = "test";
    process.env.PINATA_SECRET_KEY = "test";
    process.env.LLM_API_KEY = "test";
    process.env.WORLDID_APP_ID = "test";
  });

  it("should encrypt and decrypt a buffer back to original", () => {
    const { encrypt, decrypt } = require("../src/utils/crypto");
    const original = Buffer.from("Hello, mediCaRE! This is sensitive medical data.");
    const encrypted = encrypt(original);

    expect(encrypted).toContain(":");
    expect(encrypted).not.toContain("Hello");

    const decrypted = decrypt(encrypted);
    expect(decrypted.toString("utf-8")).toBe(original.toString("utf-8"));
  });

  it("should produce a SHA-256 hash", () => {
    const { sha256 } = require("../src/utils/crypto");
    const hash = sha256("test data");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("should throw on invalid encrypted payload format", () => {
    const { decrypt } = require("../src/utils/crypto");
    expect(() => decrypt("no-colon-here")).toThrow("Invalid encrypted payload");
  });
});

// ─── Validator Tests ────────────────────────────────────────────────────────

describe("utils/validators", () => {
  const { validate, riskScoreSchema, ehrSummarizeSchema, addressSchema } =
    require("../src/utils/validators");

  it("should validate a correct risk score input", () => {
    const input = {
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
    const result = validate(riskScoreSchema, input);
    expect(result.age).toBe(45);
  });

  it("should reject invalid risk score input", () => {
    expect(() =>
      validate(riskScoreSchema, { age: -5, bmi: "not-a-number" }),
    ).toThrow("Validation failed");
  });

  it("should validate a correct EHR summarize input", () => {
    const result = validate(ehrSummarizeSchema, {
      ehrText: "Patient presents with chest pain and shortness of breath...",
      language: "en",
    });
    expect(result.ehrText).toBeDefined();
    expect(result.language).toBe("en");
  });

  it("should reject ehrText that is too short", () => {
    expect(() =>
      validate(ehrSummarizeSchema, { ehrText: "too short" }),
    ).toThrow("Validation failed");
  });

  it("should validate a proper Ethereum address", () => {
    const addr = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";
    const result = addressSchema.parse(addr);
    expect(result).toBe(addr);
  });

  it("should reject an invalid Ethereum address", () => {
    expect(() => addressSchema.parse("not-an-address")).toThrow();
    expect(() => addressSchema.parse("0x123")).toThrow();
  });
});
