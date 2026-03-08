import { Router, Request, Response } from "express";
import { queryAuditTrail, exportAuditTrailCsv, getAuditStats, AuditAction } from "../services/audit";

const router = Router();

/**
 * GET /api/audit/trail/:entityId
 * Retrieve audit trail for a specific entity (record, claim, etc.)
 */
router.get("/trail/:entityId", (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { page, pageSize } = req.query;

  const result = queryAuditTrail({
    entityId,
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 50,
  });

  res.json({
    success: true,
    data: result.records,
    total: result.total,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/audit/search
 * Search audit records with filters
 */
router.get("/search", (req: Request, res: Response) => {
  const { accessor, patient, action, startDate, endDate, page, pageSize } = req.query;

  const result = queryAuditTrail({
    accessor: accessor as string,
    patient: patient as string,
    action: action as AuditAction | undefined,
    startDate: startDate as string,
    endDate: endDate as string,
    page: page ? parseInt(page as string) : 1,
    pageSize: pageSize ? parseInt(pageSize as string) : 50,
  });

  res.json({
    success: true,
    data: result.records,
    total: result.total,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/audit/export
 * Export audit trail as CSV
 */
router.get("/export", (req: Request, res: Response) => {
  const { accessor, patient, action, startDate, endDate } = req.query;

  const csv = exportAuditTrailCsv({
    accessor: accessor as string,
    patient: patient as string,
    action: action as AuditAction | undefined,
    startDate: startDate as string,
    endDate: endDate as string,
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=audit_trail.csv");
  res.send(csv);
});

/**
 * GET /api/audit/stats/:patient
 * Get audit statistics for a patient
 */
router.get("/stats/:patient", (req: Request, res: Response) => {
  const stats = getAuditStats(req.params.patient);
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString(),
  });
});

export default router;
