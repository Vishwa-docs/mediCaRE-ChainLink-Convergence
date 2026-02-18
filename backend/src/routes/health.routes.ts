import { Router, Request, Response } from "express";
import { getBlockNumber, getNativeBalance, getSigner } from "../services/blockchain";

const router = Router();

/**
 * GET /api/health
 * Returns service health information.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    let blockNumber: number | null = null;
    let signerAddress: string | null = null;

    try {
      blockNumber = await getBlockNumber();
      signerAddress = getSigner().address;
    } catch {
      // Blockchain may not be reachable — still report healthy for HTTP layer
    }

    res.json({
      success: true,
      data: {
        status: "healthy",
        service: "medicare-backend",
        version: "1.0.0",
        uptime: process.uptime(),
        blockchain: {
          connected: blockNumber !== null,
          blockNumber,
          signerAddress,
        },
        memory: process.memoryUsage(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: "Service unavailable",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
