import { Router, Request, Response, NextFunction } from "express";
import {
  getGovernanceContract,
  waitForTx,
  parseEvent,
} from "../services/blockchain";
import { trackProposalCreated, trackVoteCast } from "../services/analytics";
import { createLogger } from "../utils/logging";

const log = createLogger("routes:governance");
const router = Router();

/**
 * POST /api/governance/create-proposal
 * Create a new governance proposal.
 */
router.post(
  "/create-proposal",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { description, proposalType, target, callData } = req.body;

      if (!description || proposalType === undefined || !target) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: description, proposalType, target",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const contract = getGovernanceContract();
      const tx = await contract.createProposal(
        description,
        proposalType,
        target,
        callData ?? "0x",
      );
      const receipt = await waitForTx(tx);

      const event = parseEvent(receipt, contract, "ProposalCreated");
      const proposalId = event?.args?.[0]?.toString() ?? "unknown";

      log.info("Governance proposal created", { proposalId, description });

      trackProposalCreated(req.body.proposer ?? "unknown", Number(proposalId));

      res.status(201).json({
        success: true,
        data: {
          proposalId,
          description,
          proposalType,
          target,
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
 * POST /api/governance/vote
 * Cast a vote on a governance proposal.
 */
router.post(
  "/vote",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { proposalId, support } = req.body;

      if (proposalId === undefined || support === undefined) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: proposalId, support",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const contract = getGovernanceContract();
      const tx = await contract.vote(proposalId, support);
      const receipt = await waitForTx(tx);

      log.info("Vote cast", { proposalId, support });

      trackVoteCast(req.body.voter ?? "unknown", proposalId, support);

      res.json({
        success: true,
        data: {
          proposalId,
          support,
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
 * POST /api/governance/execute
 * Execute a passed governance proposal.
 */
router.post(
  "/execute",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { proposalId } = req.body;

      if (proposalId === undefined) {
        res.status(400).json({
          success: false,
          error: "Missing required field: proposalId",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const contract = getGovernanceContract();
      const tx = await contract.executeProposal(proposalId);
      const receipt = await waitForTx(tx);

      log.info("Proposal executed", { proposalId });

      res.json({
        success: true,
        data: {
          proposalId,
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
 * GET /api/governance/proposals
 * List all governance proposals.
 */
router.get(
  "/proposals",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contract = getGovernanceContract();
      const total = await contract.totalProposals();
      const count = Number(total);

      const proposals = [];
      for (let i = 0; i < count; i++) {
        const p = await contract.getProposal(i);
        proposals.push({
          proposalId: p.proposalId.toString(),
          proposer: p.proposer,
          description: p.description,
          forVotes: p.forVotes.toString(),
          againstVotes: p.againstVotes.toString(),
          startTime: Number(p.startTime),
          endTime: Number(p.endTime),
          executed: p.executed,
          cancelled: p.cancelled,
          proposalType: Number(p.proposalType),
          target: p.target,
        });
      }

      res.json({
        success: true,
        data: proposals,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/governance/proposal/:id
 * Get a single governance proposal by ID.
 */
router.get(
  "/proposal/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id) || id < 0) {
        res.status(400).json({
          success: false,
          error: "Invalid proposal ID",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const contract = getGovernanceContract();
      const p = await contract.getProposal(id);

      res.json({
        success: true,
        data: {
          proposalId: p.proposalId.toString(),
          proposer: p.proposer,
          description: p.description,
          forVotes: p.forVotes.toString(),
          againstVotes: p.againstVotes.toString(),
          startTime: Number(p.startTime),
          endTime: Number(p.endTime),
          executed: p.executed,
          cancelled: p.cancelled,
          proposalType: Number(p.proposalType),
          target: p.target,
          callData: p.callData,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
