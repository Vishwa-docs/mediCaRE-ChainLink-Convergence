import { Router } from "express";
import healthRoutes from "./health.routes";
import ehrRoutes from "./ehr.routes";
import insuranceRoutes from "./insurance.routes";
import supplyRoutes from "./supply.routes";
import credentialRoutes from "./credential.routes";
import aiRoutes from "./ai.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/ehr", ehrRoutes);
router.use("/insurance", insuranceRoutes);
router.use("/supply", supplyRoutes);
router.use("/credentials", credentialRoutes);
router.use("/ai", aiRoutes);

// World ID verify is also exposed under /api/worldid/verify via the ai routes
// (see ai.routes.ts — mounted at /api/ai but the worldid sub-path is there)

export default router;
