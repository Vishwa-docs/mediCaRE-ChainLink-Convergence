/**
 * ────────────────────────────────────────────────────────────────
 *  mediCaRE · CRE Workflow — IoT Vitals Anomaly Detection
 * ────────────────────────────────────────────────────────────────
 *
 *  Trigger:   Cron  (every 15 minutes — scans enrolled patients'
 *             wearable data for anomalies)
 *
 *  Flow:
 *    1. Fetch list of enrolled patient addresses from on-chain
 *    2. For each patient, fetch latest vitals from wearable API
 *    3. Run anomaly detection model on vitals data
 *    4. If anomaly detected, write alert on-chain (EHRStorage)
 *    5. Critical anomalies trigger emergency notification
 *
 *  Capabilities used:
 *    • Cron Trigger
 *    • EVM Read             (enrolled patients list)
 *    • Confidential HTTP    (wearable API — patient health data)
 *    • Standard HTTP        (anomaly detection ML model)
 *    • EVM Write            (store alert on-chain)
 *    • Secrets              (wearable API key)
 *
 *  @module vitals-monitor
 */

import {
  HTTPClient,
  EVMClient,
  CronTrigger,
  Runtime,
  Handler,
  Workflow,
} from "@chainlink/cre-sdk";

// ── Config ───────────────────────────────────────────────────

interface AlertThresholds {
  heartRateHigh: number;
  heartRateLow: number;
  bloodGlucoseHigh: number;
  bloodGlucoseLow: number;
  bloodPressureSystolicHigh: number;
  oxygenSaturationLow: number;
}

interface Config {
  chainName: string;
  ehrStorageAddress: string;
  wearableApiUrl: string;
  anomalyDetectionUrl: string;
  gasLimit: number;
  cronSchedule: string;
  alertThresholds: AlertThresholds;
}

// ── Vitals data from wearable API ────────────────────────────

interface VitalsReading {
  patientAddress: string;
  timestamp: string;
  heartRate: number;
  bloodGlucose: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  oxygenSaturation: number;
  temperature: number;
  steps: number;
  sleepHours: number;
}

// ── Anomaly detection result ─────────────────────────────────

interface AnomalyResult {
  isAnomaly: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  anomalies: {
    metric: string;
    value: number;
    threshold: number;
    direction: "above" | "below";
    zScore: number;
  }[];
  riskScore: number;
  recommendation: string;
}

// ── Handler ──────────────────────────────────────────────────

const handler: Handler<Config> = async (runtime: Runtime<Config>) => {
  const config = runtime.getConfig();
  const evm = runtime.getEVMClient(config.chainName);
  const http = runtime.getHTTPClient();
  const secrets = runtime.getSecrets();

  runtime.log(`[VitalsMonitor] Cron triggered — scanning enrolled patients`);

  // ─── Step 1: Get enrolled patient addresses ───────────────
  const enrolledPatients = await evm.read({
    contractAddress: config.ehrStorageAddress,
    method: "getMonitoredPatients()",
    args: [],
  });

  const patientAddresses = enrolledPatients as string[];
  runtime.log(`[VitalsMonitor] Monitoring ${patientAddresses.length} patients`);

  const alerts: { patient: string; severity: string; anomalies: number }[] = [];

  // ─── Step 2–4: For each patient, fetch + analyze vitals ───
  for (const patientAddress of patientAddresses) {
    try {
      // Fetch latest vitals via Confidential HTTP
      const vitalsResponse = await http.confidentialFetch(
        `${config.wearableApiUrl}/${patientAddress}/latest`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secrets.get("WEARABLE_API_KEY")}`,
            "X-Patient-Consent": "monitoring-enrolled",
          },
        }
      );

      const vitals: VitalsReading = vitalsResponse.json();

      // Run anomaly detection
      const anomalyResponse = await http.fetch(
        `${config.anomalyDetectionUrl}/detect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secrets.get("AI_API_KEY")}`,
          },
          body: JSON.stringify({
            vitals,
            thresholds: config.alertThresholds,
            patientHistory: true,
          }),
        }
      );

      const result: AnomalyResult = anomalyResponse.json();

      if (result.isAnomaly) {
        runtime.log(
          `[VitalsMonitor] ANOMALY for ${patientAddress}: ` +
          `severity=${result.severity}, risk=${result.riskScore}`
        );

        // Write alert on-chain
        await evm.write({
          contractAddress: config.ehrStorageAddress,
          method: "recordVitalsAlert(address,uint8,uint256,string)",
          args: [
            patientAddress,
            severityToUint(result.severity),
            BigInt(result.riskScore),
            JSON.stringify({
              anomalies: result.anomalies.map((a) => `${a.metric}: ${a.value}`),
              recommendation: result.recommendation,
            }),
          ],
          gasLimit: config.gasLimit,
        });

        alerts.push({
          patient: patientAddress,
          severity: result.severity,
          anomalies: result.anomalies.length,
        });
      }
    } catch (err) {
      runtime.log(
        `[VitalsMonitor] Error processing ${patientAddress}: ${err}`
      );
    }
  }

  runtime.log(
    `[VitalsMonitor] Scan complete. ${alerts.length} alerts generated`
  );

  return {
    patientsScanned: patientAddresses.length,
    alertsGenerated: alerts.length,
    alerts,
  };
};

// ── Helpers ──────────────────────────────────────────────────

function severityToUint(severity: string): number {
  switch (severity) {
    case "LOW": return 0;
    case "MEDIUM": return 1;
    case "HIGH": return 2;
    case "CRITICAL": return 3;
    default: return 1;
  }
}

// ── Workflow definition ──────────────────────────────────────

const workflow: Workflow<Config> = {
  name: "vitals-monitor",
  handler,
  trigger: {
    type: "cron",
    config: {
      schedule: "${cronSchedule}",
    },
  },
};

export default workflow;
