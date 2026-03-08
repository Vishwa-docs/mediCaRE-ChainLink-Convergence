import { Router, Request, Response, NextFunction } from "express";
import {
  getPatient,
  getPatientBundle,
  bundleToEHRText,
} from "../services/fhir";
import { createLogger } from "../utils/logging";

const log = createLogger("routes:fhir");
const router = Router();

/**
 * GET /api/fhir/patient/:id
 * Fetch a FHIR Patient resource by ID.
 */
router.get(
  "/patient/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      log.info("Fetching FHIR patient", { patientId: id });

      const patient = await getPatient(id);

      res.json({
        success: true,
        data: patient,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/fhir/patient/:id/bundle
 * Fetch a complete FHIR patient bundle (patient + conditions + meds + observations).
 */
router.get(
  "/patient/:id/bundle",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      log.info("Fetching FHIR patient bundle", { patientId: id });

      const bundle = await getPatientBundle(id);

      res.json({
        success: true,
        data: bundle,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/fhir/patient/:id/ehr-text
 * Fetch a FHIR patient bundle and convert it to EHR text for AI processing.
 */
router.get(
  "/patient/:id/ehr-text",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      log.info("Fetching FHIR patient EHR text", { patientId: id });

      const bundle = await getPatientBundle(id);
      const ehrText = bundleToEHRText(bundle);

      res.json({
        success: true,
        data: {
          patientId: id,
          ehrText,
          patientName: bundle.patient.name,
          conditionCount: bundle.conditions.length,
          medicationCount: bundle.medications.length,
          observationCount: bundle.observations.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
