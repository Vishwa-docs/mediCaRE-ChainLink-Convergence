import { Router, Request, Response } from "express";

const router = Router();

/**
 * POST /api/emergency/glass-break
 * Trigger emergency glass-break access to a patient's records.
 * Records are retrieved bypassing normal consent, with mandatory audit trail.
 */
router.post("/glass-break", (req: Request, res: Response) => {
  const { patientAddress, reason, paramedicAddress } = req.body;

  if (!patientAddress || !reason) {
    return res.status(400).json({
      success: false,
      error: "patientAddress and reason are required",
      timestamp: new Date().toISOString(),
    });
  }

  // Simulate emergency access — in production this calls the CRE workflow
  const accessResult = {
    granted: true,
    accessId: `emg_${Date.now()}`,
    patientAddress,
    accessor: paramedicAddress || "0xParamedicDefault",
    reason,
    emergencyData: {
      bloodType: "O+",
      allergies: ["Penicillin", "Sulfa drugs"],
      emergencyContacts: [
        { name: "Jane Doe", phone: "+1-555-0101", relationship: "Spouse" },
      ],
      criticalConditions: ["Type 2 Diabetes", "Hypertension"],
      currentMedications: ["Metformin 500mg", "Lisinopril 10mg"],
      dnrStatus: false,
    },
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour access
    auditTrailRecorded: true,
    timestamp: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: accessResult,
    message: "Emergency access granted. Immutable audit trail recorded on-chain.",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/emergency/access-log
 * Retrieve log of all emergency access events
 */
router.get("/access-log", (_req: Request, res: Response) => {
  const demoLog = [
    {
      accessId: "emg_001",
      accessor: "0x9999...paramedic",
      patient: "0xabcd...patient",
      reason: "Cardiac arrest in ER — need blood type and allergies",
      timestamp: "2026-03-04T02:45:00Z",
      expiresAt: "2026-03-04T03:45:00Z",
      auditTxHash: "0xdeadbeef004...",
      reviewed: true,
    },
    {
      accessId: "emg_002",
      accessor: "0x8888...emt",
      patient: "0xefgh...patient2",
      reason: "Unconscious patient found — checking for medication conflicts",
      timestamp: "2026-03-06T18:30:00Z",
      expiresAt: "2026-03-06T19:30:00Z",
      auditTxHash: "0xdeadbeef006...",
      reviewed: false,
    },
  ];

  res.json({
    success: true,
    data: demoLog,
    total: demoLog.length,
    timestamp: new Date().toISOString(),
  });
});

export default router;
