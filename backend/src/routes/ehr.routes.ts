import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { validate, ehrUploadSchema, ehrSummarizeSchema } from "../utils/validators";
import { uploadToIPFS, downloadFromIPFS } from "../services/ipfs";
import {
  getEHRStorageContract,
  waitForTx,
  toBytes32Hash,
  parseEvent,
} from "../services/blockchain";
import { summariseEHR } from "../ai/summarizer";
import { createLogger } from "../utils/logging";

const log = createLogger("routes:ehr");
const router = Router();

/** Multer memory storage for file uploads. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/**
 * POST /api/ehr/upload
 * Upload an EHR file to IPFS and register its hash on-chain.
 *
 * Accepts either a multipart file upload (`file` field) or a JSON body
 * with `fileContent` (base64-encoded).
 */
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(ehrUploadSchema, req.body);
      let fileBuffer: Buffer;

      if (req.file) {
        fileBuffer = req.file.buffer;
      } else if (body.fileContent) {
        fileBuffer = Buffer.from(body.fileContent, "base64");
      } else {
        res.status(400).json({
          success: false,
          error: "Provide a file upload or base64-encoded fileContent",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 1. Upload encrypted file to IPFS
      const fileName = `ehr_${body.patientAddress}_${uuidv4()}.enc`;
      const cid = await uploadToIPFS(fileBuffer, fileName, {
        patient: body.patientAddress,
        recordType: body.recordType,
      });

      // 2. Register on-chain
      const contract = getEHRStorageContract();
      const cidHash = toBytes32Hash(cid);
      const tx = await contract.addRecord(
        body.patientAddress,
        cidHash,
        body.recordType,
      );
      const receipt = await waitForTx(tx);

      const event = parseEvent(receipt, contract, "RecordAdded");
      const recordId = event?.args?.[0]?.toString() ?? "unknown";

      log.info("EHR uploaded and registered", {
        recordId,
        cid,
        patientAddress: body.patientAddress,
      });

      res.status(201).json({
        success: true,
        data: {
          recordId,
          cid,
          cidHash,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/ehr/:patientAddress
 * Retrieve all record IDs and metadata for a given patient.
 */
router.get(
  "/:patientAddress",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientAddress } = req.params;
      const contract = getEHRStorageContract();

      const recordIds: bigint[] = await contract.getPatientRecordIds(
        patientAddress,
      );

      const records = await Promise.all(
        recordIds.map(async (id) => {
          const r = await contract.getRecord(id);
          return {
            recordId: r.recordId.toString(),
            patient: r.patient,
            ipfsCidHash: r.ipfsCidHash,
            aiSummaryHash: r.aiSummaryHash,
            recordType: r.recordType,
            createdAt: Number(r.createdAt),
            updatedAt: Number(r.updatedAt),
            isActive: r.isActive,
          };
        }),
      );

      res.json({
        success: true,
        data: records,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/ehr/summarize
 * Submit raw EHR text for AI-powered summarisation.
 */
router.post(
  "/summarize",
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

export default router;
