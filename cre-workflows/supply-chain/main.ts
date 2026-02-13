/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — Supply Chain IoT Monitoring
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   Cron  (runs every 5 minutes to poll IoT sensor data)
 *
 *  Flow:
 *    1. Fetch latest temperature/humidity readings from IoT oracle
 *    2. Read active batch list from SupplyChain contract
 *    3. Evaluate readings against cold-chain thresholds
 *    4. If breached: flag the batch on-chain + optionally recall
 *    5. Log condition data hashes on-chain for the audit trail
 *
 *  Capabilities used:
 *    • Cron Trigger
 *    • Standard HTTP      (IoT oracle API)
 *    • EVM Read           (batch metadata, condition logs)
 *    • EVM Write          (flagBatch, updateConditions, recallBatch)
 *    • Secrets            (IoT oracle API key)
 *
 *  @module supply-chain
 */

import {
  HTTPClient,
  EVMClient,
  CronTrigger,
  Runtime,
  Handler,
  Workflow,
} from "@chainlink/cre-sdk";

// ── Config schema ────────────────────────────────────────────

interface Config {
  chainName: string;
  supplyChainAddress: string;
  iotOracleUrl: string;
  cronSchedule: string;
  temperatureMaxCelsius: number;
  temperatureMinCelsius: number;
  humidityMaxPercent: number;
  humidityMinPercent: number;
  gasLimit: number;
}

// ── IoT oracle API response ──────────────────────────────────

interface SensorReading {
  batchId: number;
  temperature: number;     // Celsius
  humidity: number;        // Percentage (0–100)
  gpsLatitude: number;
  gpsLongitude: number;
  timestamp: number;       // Unix seconds
  sensorId: string;
  batteryLevel: number;    // Percentage
}

interface IoTOracleResponse {
  readings: SensorReading[];
  totalBatchesMonitored: number;
  lastUpdated: number;
}

// ── Batch struct from SupplyChain.sol ─────────────────────────

interface BatchData {
  batchId: bigint;
  manufacturer: string;
  lotNumber: string;
  manufactureDate: bigint;
  expiryDate: bigint;
  quantity: bigint;
  status: number;   // 0=Created, 1=InTransit, 2=Delivered, 3=Flagged, 4=Recalled
  drugNameHash: string;
}

// Status enum mirroring SupplyChain.BatchStatus
const BatchStatus = {
  Created: 0,
  InTransit: 1,
  Delivered: 2,
  Flagged: 3,
  Recalled: 4,
} as const;

// ── Condition update report ──────────────────────────────────

interface ConditionUpdateReport {
  batchId: number;          // uint256
  temperatureHash: string;  // bytes32
  humidityHash: string;     // bytes32
  gpsHash: string;          // bytes32
}

// ── Breach info for flagging ─────────────────────────────────

interface BreachInfo {
  batchId: number;
  breachType: "temperature_high" | "temperature_low" | "humidity_high" | "humidity_low";
  actualValue: number;
  threshold: number;
  severity: "warning" | "critical";
}

// ──────────────────────────────────────────────────────────────
//  Handler: onCronTick
// ──────────────────────────────────────────────────────────────

async function onCronTick(
  config: Config,
  runtime: Runtime,
  _trigger: unknown,
): Promise<{
  batchesChecked: number;
  breachesDetected: number;
  conditionsLogged: number;
}> {
  const logger = runtime.logger();
  const now = await runtime.now().result();
  logger.info("supply-chain monitoring workflow triggered", {
    timestamp: now.toISOString(),
  });

  // ── 1. Fetch IoT sensor data from oracle ───────────────────

  const iotApiKey = await runtime
    .getSecret({ id: "IOT_ORACLE_API_KEY", namespace: "main" })
    .result();

  const httpClient = new HTTPClient();

  const iotResponse = await httpClient
    .sendRequest(runtime, {
      url: `${config.iotOracleUrl}?since=${Math.floor(now.getTime() / 1000) - 300}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${iotApiKey.value}`,
        Accept: "application/json",
      },
    })
    .result();

  if (iotResponse.statusCode !== 200) {
    logger.error("IoT oracle API unavailable", {
      status: iotResponse.statusCode,
    });
    throw new Error(`IoT oracle returned ${iotResponse.statusCode}`);
  }

  const iotData: IoTOracleResponse = JSON.parse(
    new TextDecoder().decode(iotResponse.body),
  );

  logger.info("IoT sensor readings received", {
    readingCount: iotData.readings.length,
    batchesMonitored: iotData.totalBatchesMonitored,
  });

  if (iotData.readings.length === 0) {
    logger.info("No new sensor readings — nothing to process");
    return { batchesChecked: 0, breachesDetected: 0, conditionsLogged: 0 };
  }

  const evmClient = new EVMClient({ chainName: config.chainName });

  // ── 2. Group readings by batch and evaluate ────────────────

  const batchReadings = new Map<number, SensorReading[]>();
  for (const reading of iotData.readings) {
    const existing = batchReadings.get(reading.batchId) || [];
    existing.push(reading);
    batchReadings.set(reading.batchId, existing);
  }

  const breaches: BreachInfo[] = [];
  let conditionsLogged = 0;

  for (const [batchId, readings] of Array.from(batchReadings.entries()).sort(
    (a, b) => a[0] - b[0],
  )) {
    // ── 2a. Check batch status on-chain ──────────────────────

    let batchData: BatchData;
    try {
      const batchResult = await evmClient
        .readContract(runtime, {
          contractAddress: config.supplyChainAddress,
          method: "getBatch",
          args: [batchId],
          abi: [
            {
              name: "getBatch",
              type: "function",
              stateMutability: "view",
              inputs: [{ name: "batchId", type: "uint256" }],
              outputs: [
                {
                  name: "batch",
                  type: "tuple",
                  components: [
                    { name: "batchId", type: "uint256" },
                    { name: "manufacturer", type: "address" },
                    { name: "lotNumber", type: "bytes32" },
                    { name: "manufactureDate", type: "uint256" },
                    { name: "expiryDate", type: "uint256" },
                    { name: "quantity", type: "uint256" },
                    { name: "status", type: "uint8" },
                    { name: "drugNameHash", type: "bytes32" },
                  ],
                },
              ],
            },
          ],
        })
        .result();

      batchData = batchResult[0] as BatchData;
    } catch (err) {
      logger.warn("Batch not found on-chain, skipping", { batchId });
      continue;
    }

    // Skip already recalled batches
    if (batchData.status === BatchStatus.Recalled) {
      logger.info("Batch already recalled, skipping", { batchId });
      continue;
    }

    // ── 2b. Evaluate each reading against thresholds ─────────

    for (const reading of readings) {
      // Temperature checks
      if (reading.temperature > config.temperatureMaxCelsius) {
        breaches.push({
          batchId,
          breachType: "temperature_high",
          actualValue: reading.temperature,
          threshold: config.temperatureMaxCelsius,
          severity:
            reading.temperature > config.temperatureMaxCelsius + 5
              ? "critical"
              : "warning",
        });
      }

      if (reading.temperature < config.temperatureMinCelsius) {
        breaches.push({
          batchId,
          breachType: "temperature_low",
          actualValue: reading.temperature,
          threshold: config.temperatureMinCelsius,
          severity:
            reading.temperature < config.temperatureMinCelsius - 5
              ? "critical"
              : "warning",
        });
      }

      // Humidity checks
      if (reading.humidity > config.humidityMaxPercent) {
        breaches.push({
          batchId,
          breachType: "humidity_high",
          actualValue: reading.humidity,
          threshold: config.humidityMaxPercent,
          severity: reading.humidity > 80 ? "critical" : "warning",
        });
      }

      if (reading.humidity < config.humidityMinPercent) {
        breaches.push({
          batchId,
          breachType: "humidity_low",
          actualValue: reading.humidity,
          threshold: config.humidityMinPercent,
          severity: reading.humidity < 20 ? "critical" : "warning",
        });
      }

      // ── 2c. Log condition data hashes on-chain ─────────────
      //    Hash the sensor values so raw data stays off-chain
      //    while an immutable audit trail is preserved on-chain.

      const conditionReport: ConditionUpdateReport = {
        batchId,
        temperatureHash: `0x${hashValue(reading.temperature.toString())}`,
        humidityHash: `0x${hashValue(reading.humidity.toString())}`,
        gpsHash: `0x${hashValue(`${reading.gpsLatitude},${reading.gpsLongitude}`)}`,
      };

      const condReport = await runtime
        .generateReport({
          encodedPayload: JSON.stringify(conditionReport),
          encoderName: "evm",
          signingAlgo: "ecdsa",
          hashingAlgo: "keccak256",
        })
        .result();

      await evmClient
        .writeReport(runtime, config.supplyChainAddress, condReport, {
          gasLimit: BigInt(config.gasLimit),
        })
        .result();

      conditionsLogged++;
    }
  }

  // ── 3. Process breaches: flag or recall ────────────────────

  if (breaches.length > 0) {
    logger.warn("Environmental breaches detected", {
      total: breaches.length,
      critical: breaches.filter((b) => b.severity === "critical").length,
    });

    // Deduplicate by batch — one flag/recall per batch per run
    const batchBreaches = new Map<number, BreachInfo[]>();
    for (const breach of breaches) {
      const existing = batchBreaches.get(breach.batchId) || [];
      existing.push(breach);
      batchBreaches.set(breach.batchId, existing);
    }

    for (const [batchId, batchBreachList] of Array.from(
      batchBreaches.entries(),
    ).sort((a, b) => a[0] - b[0])) {
      const hasCritical = batchBreachList.some(
        (b) => b.severity === "critical",
      );
      const reason = batchBreachList
        .map(
          (b) =>
            `${b.breachType}: ${b.actualValue} (threshold: ${b.threshold})`,
        )
        .join("; ");

      if (hasCritical) {
        // Critical breach → initiate recall
        logger.error("CRITICAL breach — initiating batch recall", {
          batchId,
          reason,
        });

        const recallReport = await runtime
          .generateReport({
            encodedPayload: JSON.stringify({
              batchId,
              action: "recall",
              reason: `CRE auto-recall: ${reason}`,
            }),
            encoderName: "evm",
            signingAlgo: "ecdsa",
            hashingAlgo: "keccak256",
          })
          .result();

        const recallTx = await evmClient
          .writeReport(runtime, config.supplyChainAddress, recallReport, {
            gasLimit: BigInt(config.gasLimit),
          })
          .result();

        logger.info("Batch recall transaction submitted", {
          batchId,
          txHash: recallTx.hash,
        });
      } else {
        // Warning breach → flag the batch
        logger.warn("Warning breach — flagging batch", {
          batchId,
          reason,
        });

        const flagReport = await runtime
          .generateReport({
            encodedPayload: JSON.stringify({
              batchId,
              action: "flag",
              reason: `CRE auto-flag: ${reason}`,
            }),
            encoderName: "evm",
            signingAlgo: "ecdsa",
            hashingAlgo: "keccak256",
          })
          .result();

        const flagTx = await evmClient
          .writeReport(runtime, config.supplyChainAddress, flagReport, {
            gasLimit: BigInt(config.gasLimit),
          })
          .result();

        logger.info("Batch flag transaction submitted", {
          batchId,
          txHash: flagTx.hash,
        });
      }
    }
  } else {
    logger.info("All sensor readings within acceptable thresholds");
  }

  return {
    batchesChecked: batchReadings.size,
    breachesDetected: breaches.length,
    conditionsLogged,
  };
}

// ──────────────────────────────────────────────────────────────
//  Helper: simple deterministic hash for sensor values
//  (in production this would use keccak256; here we use a
//  placeholder that is consistent across DON nodes)
// ──────────────────────────────────────────────────────────────

function hashValue(value: string): string {
  // Deterministic: same input → same output on every node
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

// ──────────────────────────────────────────────────────────────
//  Workflow initialisation
// ──────────────────────────────────────────────────────────────

export function initWorkflow(
  config: Config,
  logger: ReturnType<Runtime["logger"]>,
): Workflow<Config> {
  // Cron trigger: every 5 minutes (6-field format: sec min hr day month dow)
  const trigger = new CronTrigger({
    schedule: config.cronSchedule, // "0 */5 * * * *"
  });

  return [Handler(trigger, onCronTick)];
}

export default initWorkflow;
