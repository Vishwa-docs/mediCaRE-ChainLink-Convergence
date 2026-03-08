import { Router, Request, Response, NextFunction } from "express";
import { validate, createPolicySchema, submitClaimSchema } from "../utils/validators";
import {
  getInsurancePolicyContract,
  waitForTx,
  toBytes32Hash,
  parseEvent,
} from "../services/blockchain";
import { trackPolicyCreated, trackClaimSubmitted, trackClaimProcessed } from "../services/analytics";
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

      const tx = await contract.createPolicy(
        body.holder,
        body.coverageAmount,
        body.premiumAmount,
        body.durationDays,
        body.riskScore ?? 0,
      );
      const receipt = await waitForTx(tx);

      const event = parseEvent(receipt, contract, "PolicyCreated");
      const policyId = event?.args?.[0]?.toString() ?? "unknown";

      log.info("Insurance policy created", {
        policyId,
        holder: body.holder,
        coverage: body.coverageAmount,
      });

      trackPolicyCreated(body.holder, Number(policyId), Number(body.coverageAmount));

      res.status(201).json({
        success: true,
        data: {
          policyId,
          holder: body.holder,
          coverageAmount: body.coverageAmount,
          premiumAmount: body.premiumAmount,
          durationDays: body.durationDays,
          riskScore: body.riskScore ?? 0,
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

      const descriptionHash = toBytes32Hash(body.description);

      const tx = await contract.submitClaim(
        body.policyId,
        body.amount,
        descriptionHash,
      );
      const receipt = await waitForTx(tx);

      const event = parseEvent(receipt, contract, "ClaimSubmitted");
      const claimId = event?.args?.[0]?.toString() ?? "unknown";

      log.info("Insurance claim submitted", {
        claimId,
        policyId: body.policyId,
        amount: body.amount,
      });

      trackClaimSubmitted(req.body.holder ?? "unknown", Number(claimId), body.policyId, Number(body.amount));

      res.status(201).json({
        success: true,
        data: {
          claimId,
          policyId: body.policyId,
          amount: body.amount,
          description: body.description,
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

/**
 * GET /api/insurance/policies/:holder
 * Retrieve all policies for a given holder address.
 */
router.get(
  "/policies/:holder",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const holder = req.params.holder;
      const contract = getInsurancePolicyContract();

      let policies: any[] = [];
      try {
        const policyIds: bigint[] = await contract.getHolderPolicies(holder);
        for (const id of policyIds) {
          try {
            const p = await contract.getPolicy(id);
            policies.push({
              policyId: p.policyId.toString(),
              holder: p.holder,
              coverageAmount: p.coverageAmount.toString(),
              premiumAmount: p.premiumAmount.toString(),
              expiryDate: Number(p.expiryDate),
              isActive: p.isActive,
              riskScore: Number(p.riskScore),
            });
          } catch {
            log.warn("Failed to fetch policy", { policyId: id.toString() });
          }
        }
      } catch {
        log.info("No policies found for holder", { holder });
      }

      res.json({
        success: true,
        data: { policies },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/insurance/claims/:holder
 * Retrieve all claims for policies owned by the given holder address.
 */
router.get(
  "/claims/:holder",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const holder = req.params.holder;
      const contract = getInsurancePolicyContract();

      let claims: any[] = [];
      try {
        const policyIds: bigint[] = await contract.getHolderPolicies(holder);
        for (const pid of policyIds) {
          try {
            const claimIds: bigint[] = await contract.getPolicyClaims(pid);
            for (const cid of claimIds) {
              try {
                const c = await contract.getClaim(cid);
                claims.push({
                  claimId: c.claimId.toString(),
                  policyId: c.policyId.toString(),
                  claimant: c.claimant,
                  amount: c.amount.toString(),
                  descriptionHash: c.descriptionHash,
                  status: Number(c.status),
                  submittedAt: Number(c.submittedAt),
                });
              } catch {
                log.warn("Failed to fetch claim", { claimId: cid.toString() });
              }
            }
          } catch {
            // No claims for this policy
          }
        }
      } catch {
        log.info("No policies/claims found for holder", { holder });
      }

      res.json({
        success: true,
        data: { claims },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
