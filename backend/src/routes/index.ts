import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import ehrRoutes from "./ehr.routes";
import insuranceRoutes from "./insurance.routes";
import supplyRoutes from "./supply.routes";
import credentialRoutes from "./credential.routes";
import aiRoutes from "./ai.routes";
import governanceRoutes from "./governance.routes";
import fhirRoutes from "./fhir.routes";
import analyticsRoutes from "./analytics.routes";
import auditRoutes from "./audit.routes";
import emergencyRoutes from "./emergency.routes";
import researchRoutes from "./research.routes";
import treasuryRoutes from "./treasury.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/ehr", ehrRoutes);
router.use("/insurance", insuranceRoutes);
router.use("/supply", supplyRoutes);
router.use("/credentials", credentialRoutes);
router.use("/ai", aiRoutes);
router.use("/governance", governanceRoutes);
router.use("/fhir", fhirRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/audit", auditRoutes);
router.use("/emergency", emergencyRoutes);
router.use("/research", researchRoutes);
router.use("/treasury", treasuryRoutes);

export default router;
