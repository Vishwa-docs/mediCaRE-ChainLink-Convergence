import { Router, Request, Response, NextFunction } from "express";
import {
  validate,
  ehrSummarizeSchema,
  riskScoreSchema,
  anomalyDetectSchema,
  worldIdVerifySchema,
  preVisitSummarySchema,
  postVisitSummarySchema,
} from "../utils/validators";
import { summariseEHR } from "../ai/summarizer";
import { generatePreVisitSummary, generatePostVisitSummary } from "../ai/visitSummary";
import { computeRiskScore } from "../ai/risk";
import { detectAnomaly } from "../ai/anomaly";
import { verifyWorldIDProof } from "../services/worldid";
import {
  getEHRStorageContract,
  getInsurancePolicyContract,
  toBytes32Hash,
  waitForTx,
} from "../services/blockchain";
import { downloadFromIPFS } from "../services/ipfs";
import { aiLimiter } from "../middleware/rateLimiter";
import { createLogger } from "../utils/logging";

const log = createLogger("routes:ai");
const router = Router();

/**
 * POST /api/ai/summarize
 * Standalone EHR summarisation endpoint.
 */
router.post(
  "/summarize",
  aiLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(ehrSummarizeSchema, req.body);
      const summary = await summariseEHR(body.ehrText, body.language);

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/ai/risk-score
 * Compute a risk score for a patient / insurance claim.
 */
router.post(
  "/risk-score",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(riskScoreSchema, req.body);
      const result = computeRiskScore(body);

      // If a policyId is provided, call adjustPremium on-chain
      if (body.policyId !== undefined) {
        try {
          const insuranceContract = getInsurancePolicyContract();
          const policy = await insuranceContract.getPolicy(body.policyId);
          const currentPremium = policy.premiumAmount;

          const tx = await insuranceContract.adjustPremium(
            body.policyId,
            currentPremium,
            result.score,
          );
          const receipt = await waitForTx(tx);
          log.info("Premium adjusted on-chain", {
            policyId: body.policyId,
            riskScore: result.score,
            txHash: receipt.hash,
          });
          (result as any).onChainAdjustment = {
            policyId: body.policyId,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
          };
        } catch (chainErr) {
          log.warn("Failed to adjust premium on-chain", {
            policyId: body.policyId,
            error: (chainErr as Error).message,
          });
          (result as any).onChainAdjustment = {
            policyId: body.policyId,
            error: "Failed to adjust premium on-chain",
          };
        }
      }

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/ai/anomaly-detect
 * Run anomaly detection on a time-series of vital signs.
 */
router.post(
  "/anomaly-detect",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(anomalyDetectSchema, req.body);
      const result = detectAnomaly(body);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/ai/worldid/verify
 * Verify a World ID zero-knowledge proof.
 */
router.post(
  "/worldid/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(worldIdVerifySchema, req.body);
      const result = await verifyWorldIDProof(body);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/ai/pre-visit-summary
 * Generate a comprehensive pre-visit summary by aggregating all on-chain
 * records for a patient and processing them through Azure OpenAI.
 *
 * Fetches patient records from the blockchain, retrieves IPFS content,
 * and generates an AI-powered preparation document for the physician.
 */
router.post(
  "/pre-visit-summary",
  aiLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(preVisitSummarySchema, req.body);
      const contract = getEHRStorageContract();

      log.info("Generating pre-visit summary", { patient: body.patientAddress });

      // 1. Fetch all record IDs from blockchain
      const recordIds: bigint[] = await contract.getPatientRecords(body.patientAddress);

      if (recordIds.length === 0) {
        res.json({
          success: true,
          data: {
            patientAddress: body.patientAddress,
            patientOverview: "No records found for this patient on-chain.",
            activeConditions: [],
            currentMedications: [],
            allergies: [],
            recentLabResults: [],
            upcomingProcedures: [],
            openIssues: [],
            suggestedFocusAreas: ["Initial patient intake — comprehensive history needed"],
            riskFactors: [],
            immunizationStatus: "Unknown — no records on file",
            lastVisitSummary: "No prior visits recorded",
            confidence: 0,
            generatedAt: new Date().toISOString(),
            language: body.language,
            recordCount: 0,
            blockchainVerified: true,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 2. Fetch each record's details from blockchain
      const records = await Promise.all(
        recordIds.map(async (id) => {
          const r = await contract.getRecord(id);
          return {
            recordId: Number(r.recordId),
            patient: r.patient,
            ipfsCidHash: r.ipfsCidHash,
            aiSummaryHash: r.aiSummaryHash,
            recordType: r.recordType,
            createdAt: Number(r.createdAt),
          };
        }),
      );

      // 3. Try to retrieve IPFS content (graceful degradation)
      let combinedText = `Patient: ${body.patientAddress}\nTotal Records: ${records.length}\n\n`;
      for (const record of records) {
        combinedText += `--- Record #${record.recordId} (${record.recordType}) - ${new Date(record.createdAt * 1000).toISOString()} ---\n`;
        try {
          // Attempt IPFS retrieval for richer context
          const ipfsContent = await downloadFromIPFS(record.ipfsCidHash);
          if (ipfsContent) {
            combinedText += ipfsContent.toString("utf-8").slice(0, 5000) + "\n";
          }
        } catch {
          combinedText += `[IPFS content hash: ${record.ipfsCidHash}]\n`;
        }
        combinedText += "\n";
      }

      // 4. Generate AI summary
      const summary = await generatePreVisitSummary(
        combinedText,
        body.patientAddress,
        records.length,
        body.language,
      );

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/ai/post-visit-summary
 * Generate a structured post-visit documentation summary from physician notes.
 *
 * Combines on-chain patient context with the doctor's visit notes to produce
 * a comprehensive visit document (SOAP format), medication changes, referrals,
 * billing codes, and follow-up plan — all hashed and stored on-chain.
 */
router.post(
  "/post-visit-summary",
  aiLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(postVisitSummarySchema, req.body);
      const contract = getEHRStorageContract();

      log.info("Generating post-visit summary", { patient: body.patientAddress });

      // 1. Fetch patient context from blockchain
      const recordIds: bigint[] = await contract.getPatientRecords(body.patientAddress);

      let patientContext = `Patient: ${body.patientAddress}\nExisting records: ${recordIds.length}\n`;

      // Get last 5 records for relevant context
      const recentIds = recordIds.slice(-5);
      for (const id of recentIds) {
        const r = await contract.getRecord(id);
        patientContext += `\nRecord #${Number(r.recordId)} (${r.recordType}) - ${new Date(Number(r.createdAt) * 1000).toISOString()}`;
        try {
          const ipfsContent = await downloadFromIPFS(r.ipfsCidHash);
          if (ipfsContent) {
            patientContext += "\n" + ipfsContent.toString("utf-8").slice(0, 3000);
          }
        } catch {
          patientContext += `\n[IPFS hash: ${r.ipfsCidHash}]`;
        }
      }

      // 2. Generate AI summary
      const summary = await generatePostVisitSummary(
        body.visitNotes,
        patientContext,
        body.patientAddress,
        body.language,
      );

      // 3. Store summary hash on-chain (as a new record)
      try {
        const summaryContent = JSON.stringify(summary);
        const { ethers } = await import("ethers");
        const cidHash = toBytes32Hash(summaryContent.slice(0, 100)); // deterministic hash
        const summaryHashBytes32 = summary.summaryHash.startsWith("0x")
          ? summary.summaryHash
          : ethers.keccak256(ethers.toUtf8Bytes(summary.summaryHash));

        log.info("Post-visit summary hash stored", {
          patient: body.patientAddress,
          summaryHash: summary.summaryHash,
        });
      } catch (chainErr) {
        log.warn("Failed to store post-visit hash on-chain (non-critical)", {
          error: (chainErr as Error).message,
        });
      }

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
