import {
  IoTReading,
  SensorThresholds,
  ThresholdBreach,
} from "../types";
import { createLogger } from "../utils/logging";

const log = createLogger("service:oracle");

/**
 * Default thresholds for pharmaceutical cold-chain compliance.
 * Values aligned with WHO GDP (Good Distribution Practice) guidelines.
 */
const DEFAULT_THRESHOLDS: SensorThresholds = {
  temperatureMin: 2, // °C
  temperatureMax: 8, // °C  (standard cold-chain)
  humidityMin: 30, // %
  humidityMax: 75, // %
};

/**
 * Parse a raw IoT sensor payload into a structured {@link IoTReading}.
 *
 * Accepts JSON payloads with flat keys matching the IoTReading interface,
 * or a nested `{ data: { ... } }` envelope.
 */
export function parseSensorPayload(rawPayload: unknown): IoTReading {
  const obj: any =
    typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;

  const data = obj.data ?? obj;

  const reading: IoTReading = {
    sensorId: String(data.sensorId ?? data.sensor_id ?? "unknown"),
    batchId: String(data.batchId ?? data.batch_id ?? ""),
    timestamp: Number(data.timestamp ?? Date.now()),
    temperature:
      data.temperature !== undefined ? Number(data.temperature) : undefined,
    humidity: data.humidity !== undefined ? Number(data.humidity) : undefined,
    latitude: data.latitude !== undefined ? Number(data.latitude) : undefined,
    longitude: data.longitude !== undefined ? Number(data.longitude) : undefined,
  };

  return reading;
}

/**
 * Validate an IoT reading against given thresholds (*or* defaults).
 *
 * @returns `true` if the reading is within all thresholds.
 */
export function validateReading(
  reading: IoTReading,
  thresholds: SensorThresholds = DEFAULT_THRESHOLDS,
): boolean {
  const breaches = detectBreaches(reading, thresholds);
  return breaches.length === 0;
}

/**
 * Detect all threshold breaches for a single IoT reading.
 *
 * @param reading    - The parsed sensor reading.
 * @param thresholds - The thresholds to compare against (defaults to GDP
 *                     cold-chain ranges).
 * @returns An array of breaches (empty if all metrics are within range).
 */
export function detectBreaches(
  reading: IoTReading,
  thresholds: SensorThresholds = DEFAULT_THRESHOLDS,
): ThresholdBreach[] {
  const breaches: ThresholdBreach[] = [];

  if (reading.temperature !== undefined) {
    if (reading.temperature < thresholds.temperatureMin) {
      breaches.push({
        sensorId: reading.sensorId,
        metric: "temperature",
        value: reading.temperature,
        threshold: thresholds.temperatureMin,
        direction: "below",
        timestamp: reading.timestamp,
      });
    }
    if (reading.temperature > thresholds.temperatureMax) {
      breaches.push({
        sensorId: reading.sensorId,
        metric: "temperature",
        value: reading.temperature,
        threshold: thresholds.temperatureMax,
        direction: "above",
        timestamp: reading.timestamp,
      });
    }
  }

  if (reading.humidity !== undefined) {
    if (reading.humidity < thresholds.humidityMin) {
      breaches.push({
        sensorId: reading.sensorId,
        metric: "humidity",
        value: reading.humidity,
        threshold: thresholds.humidityMin,
        direction: "below",
        timestamp: reading.timestamp,
      });
    }
    if (reading.humidity > thresholds.humidityMax) {
      breaches.push({
        sensorId: reading.sensorId,
        metric: "humidity",
        value: reading.humidity,
        threshold: thresholds.humidityMax,
        direction: "above",
        timestamp: reading.timestamp,
      });
    }
  }

  if (breaches.length > 0) {
    log.warn("Threshold breaches detected", {
      sensorId: reading.sensorId,
      breachCount: breaches.length,
    });
  }

  return breaches;
}

/**
 * Process a batch of raw IoT payloads and return validated readings with
 * any breaches attached.
 */
export function processReadingsBatch(
  payloads: unknown[],
  thresholds?: SensorThresholds,
): Array<{ reading: IoTReading; valid: boolean; breaches: ThresholdBreach[] }> {
  return payloads.map((raw) => {
    const reading = parseSensorPayload(raw);
    const breaches = detectBreaches(reading, thresholds);
    return { reading, valid: breaches.length === 0, breaches };
  });
}
