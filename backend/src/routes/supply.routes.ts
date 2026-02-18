import { Router, Request, Response, NextFunction } from "express";
import { validate, createBatchSchema, verifyBatchSchema } from "../utils/validators";
import {
  getSupplyChainContract,
  waitForTx,
  toBytes32Hash,
  parseEvent,
} from "../services/blockchain";
import { createLogger } from "../utils/logging";

const log = createLogger("routes:supply");
const router = Router();

/**
 * POST /api/supply/create-batch
 * Create a new pharmaceutical supply-chain batch (ERC-1155 token).
 */
router.post(
  "/create-batch",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(createBatchSchema, req.body);
      const contract = getSupplyChainContract();

      const lotHash = toBytes32Hash(body.lotNumber);
      const drugHash = toBytes32Hash(body.drugName);

      const tx = await contract.createBatch(
        lotHash,
        drugHash,
        body.expiryDate,
        body.quantity,
      );
      const receipt = await waitForTx(tx);

      const event = parseEvent(receipt, contract, "BatchCreated");
      const batchId = event?.args?.[0]?.toString() ?? "unknown";

      log.info("Supply chain batch created", {
        batchId,
        drugName: body.drugName,
        quantity: body.quantity,
      });

      res.status(201).json({
        success: true,
        data: {
          batchId,
          lotNumber: body.lotNumber,
          drugName: body.drugName,
          quantity: body.quantity,
          expiryDate: body.expiryDate,
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
 * GET /api/supply/batch/:batchId
 * Retrieve details of a supply-chain batch.
 */
router.get(
  "/batch/:batchId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batchId = parseInt(req.params.batchId, 10);
      if (isNaN(batchId) || batchId < 0) {
        res.status(400).json({
          success: false,
          error: "Invalid batch ID",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const contract = getSupplyChainContract();
      const b = await contract.getBatch(batchId);

      const statusLabels = [
        "CREATED",
        "IN_TRANSIT",
        "DELIVERED",
        "FLAGGED",
        "RECALLED",
      ];

      res.json({
        success: true,
        data: {
          batchId: b.batchId.toString(),
          manufacturer: b.manufacturer,
          lotNumber: b.lotNumber,
          manufactureDate: Number(b.manufactureDate),
          expiryDate: Number(b.expiryDate),
          quantity: Number(b.quantity),
          status: statusLabels[Number(b.status)] ?? "UNKNOWN",
          drugNameHash: b.drugNameHash,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/supply/verify
 * Verify the authenticity of a supply-chain batch by cross-checking its
 * lot number hash against on-chain records.
 */
router.post(
  "/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(verifyBatchSchema, req.body);
      const contract = getSupplyChainContract();

      const b = await contract.getBatch(body.batchId);
      const expectedLotHash = toBytes32Hash(body.lotNumber);
      const isAuthentic = b.lotNumber === expectedLotHash;

      const statusLabels = [
        "CREATED",
        "IN_TRANSIT",
        "DELIVERED",
        "FLAGGED",
        "RECALLED",
      ];
      const status = statusLabels[Number(b.status)] ?? "UNKNOWN";
      const isFlagged = status === "FLAGGED" || status === "RECALLED";

      log.info("Batch verification", {
        batchId: body.batchId,
        isAuthentic,
        status,
      });

      res.json({
        success: true,
        data: {
          batchId: body.batchId,
          isAuthentic,
          isFlagged,
          status,
          manufacturer: b.manufacturer,
          expiryDate: Number(b.expiryDate),
          message: isAuthentic
            ? isFlagged
              ? "Batch is authentic but has been flagged — do not dispense."
              : "Batch verified as authentic."
            : "WARNING: Lot number does not match on-chain record. Potential counterfeit.",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
