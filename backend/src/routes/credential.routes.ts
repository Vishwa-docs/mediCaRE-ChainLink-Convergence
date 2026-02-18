import { Router, Request, Response, NextFunction } from "express";
import { validate, issueCredentialSchema } from "../utils/validators";
import {
  getCredentialRegistryContract,
  waitForTx,
  parseEvent,
} from "../services/blockchain";
import { createLogger } from "../utils/logging";

const log = createLogger("routes:credential");
const router = Router();

const CREDENTIAL_TYPE_LABELS = [
  "LICENSE",
  "BOARD_CERT",
  "SPECIALTY",
  "DEA",
  "NPI",
  "CME",
  "FELLOWSHIP",
  "OTHER",
];

/**
 * POST /api/credentials/issue
 * Issue a verifiable credential for a healthcare provider.
 */
router.post(
  "/issue",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validate(issueCredentialSchema, req.body);
      const contract = getCredentialRegistryContract();

      const tx = await contract.issueCredential(
        body.subject,
        body.credentialType,
        body.credentialHash,
        body.expiryDate,
      );
      const receipt = await waitForTx(tx);

      const event = parseEvent(receipt, contract, "CredentialIssued");
      const credentialId = event?.args?.[0]?.toString() ?? "unknown";

      log.info("Credential issued", {
        credentialId,
        subject: body.subject,
        type: CREDENTIAL_TYPE_LABELS[body.credentialType] ?? "UNKNOWN",
      });

      res.status(201).json({
        success: true,
        data: {
          credentialId,
          subject: body.subject,
          credentialType:
            CREDENTIAL_TYPE_LABELS[body.credentialType] ?? "UNKNOWN",
          credentialHash: body.credentialHash,
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
 * GET /api/credentials/verify/:hash
 * Verify a credential by its document hash.
 */
router.get(
  "/verify/:hash",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hash } = req.params;

      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        res.status(400).json({
          success: false,
          error: "Invalid credential hash format (expected bytes32)",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const contract = getCredentialRegistryContract();
      const [isValid, credentialId] =
        await contract.verifyCredentialByHash(hash);

      if (!isValid) {
        res.json({
          success: true,
          data: {
            credentialHash: hash,
            isValid: false,
            message:
              "Credential not found or has been revoked.",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const c = await contract.getCredential(credentialId);

      res.json({
        success: true,
        data: {
          credentialHash: hash,
          isValid: true,
          credentialId: credentialId.toString(),
          issuer: c.issuer,
          subject: c.subject,
          credentialType:
            CREDENTIAL_TYPE_LABELS[Number(c.credentialType)] ?? "UNKNOWN",
          issuanceDate: Number(c.issuanceDate),
          expiryDate: Number(c.expiryDate),
          message: "Credential is valid and on-chain.",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
