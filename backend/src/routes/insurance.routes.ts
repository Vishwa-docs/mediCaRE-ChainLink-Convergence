import { Router, Request, Response, NextFunction } from "express";
import { validate, createPolicySchema, submitClaimSchema } from "../utils/validators";
import {
  getInsurancePolicyContract,
  waitForTx,
  toBytes32Hash,
  parseEvent,
} from "../services/blockchain";
import { createLogger } from "../utils/logging";

const log = createLogger("routes:insurance");
const router = Router();

/**
 * POST /api/insurance/create-policy
 * Create a new insurance policy represented as an ERC-721 NFT.
 */
router.post(
  "/create-policy",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(createPolicySchema, req.body);
      const contract = getInsurancePolicyContract();

      const expiryDate = Math.floor(Date.now() / 1000) + body.durationDays * 86400;

      const tx = await contract.createPolicy(
        body.holder,
        body.coverageAmount,
        body.premiumAmount,
        expiryDate,
      );
      const receipt = await waitForTx(tx);

      const event = parseEvent(receipt, contract, "PolicyCreated");
      const policyId = event?.args?.[0]?.toString() ?? "unknown";

      log.info("Insurance policy created", {
        policyId,
        holder: body.holder,
        coverage: body.coverageAmount,
      });

      res.status(201).json({
        success: true,
        data: {
          policyId,
          holder: body.holder,
          coverageAmount: body.coverageAmount,
          premiumAmount: body.premiumAmount,
          expiryDate,
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
 * POST /api/insurance/submit-claim
 * Submit an insurance claim against an existing policy.
 */
router.post(
  "/submit-claim",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(submitClaimSchema, req.body);
      const contract = getInsurancePolicyContract();

      const evidenceHash = toBytes32Hash(body.evidenceCid);

      const tx = await contract.submitClaim(
        body.policyId,
        body.amount,
        body.reason,
        evidenceHash,
      );
      const receipt = await waitForTx(tx);

      const event = parseEvent(receipt, contract, "ClaimSubmitted");
      const claimId = event?.args?.[0]?.toString() ?? "unknown";

      log.info("Insurance claim submitted", {
        claimId,
        policyId: body.policyId,
        amount: body.amount,
      });

      res.status(201).json({
        success: true,
        data: {
          claimId,
          policyId: body.policyId,
          amount: body.amount,
          reason: body.reason,
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
 * GET /api/insurance/policy/:policyId
 * Retrieve details of an insurance policy by ID.
 */
router.get(
  "/policy/:policyId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const policyId = parseInt(req.params.policyId, 10);
      if (isNaN(policyId) || policyId < 0) {
        res.status(400).json({
          success: false,
          error: "Invalid policy ID",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const contract = getInsurancePolicyContract();
      const p = await contract.getPolicy(policyId);

      res.json({
        success: true,
        data: {
          policyId: p.policyId.toString(),
          holder: p.holder,
          coverageAmount: p.coverageAmount.toString(),
          premiumAmount: p.premiumAmount.toString(),
          expiryDate: Number(p.expiryDate),
          isActive: p.isActive,
          riskScore: Number(p.riskScore),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
