/**
 * @module audit
 * @description Immutable Audit Trail Service
 *
 * Indexes on-chain audit events, stores structured audit records,
 * and provides query/export APIs for HIPAA/GDPR compliance.
 */

import { createLogger } from "../utils/logging";

const log = createLogger("service:audit");

// ─── Types ──────────────────────────────────────────────────────────────────

export enum AuditAction {
  RECORD_CREATE = "RECORD_CREATE",
  RECORD_UPDATE = "RECORD_UPDATE",
  RECORD_READ = "RECORD_READ",
  ACCESS_GRANT = "ACCESS_GRANT",
  ACCESS_REVOKE = "ACCESS_REVOKE",
  CONSENT_GRANT = "CONSENT_GRANT",
  CONSENT_REVOKE = "CONSENT_REVOKE",
  EMERGENCY_ACCESS = "EMERGENCY_ACCESS",
  AI_DECISION = "AI_DECISION",
  CLAIM_SUBMIT = "CLAIM_SUBMIT",
  CLAIM_PROCESS = "CLAIM_PROCESS",
  CLAIM_PAYOUT = "CLAIM_PAYOUT",
  CREDENTIAL_ISSUE = "CREDENTIAL_ISSUE",
  CREDENTIAL_REVOKE = "CREDENTIAL_REVOKE",
  POLICY_CREATE = "POLICY_CREATE",
  GOVERNANCE_VOTE = "GOVERNANCE_VOTE",
  RESEARCH_CONSENT = "RESEARCH_CONSENT",
  KEY_ROTATION = "KEY_ROTATION",
  CROSS_CHAIN_PAYOUT = "CROSS_CHAIN_PAYOUT",
  FRAUD_FLAG = "FRAUD_FLAG",
  PAYOUTS_PAUSED = "PAYOUTS_PAUSED",
  PAYOUTS_RESUMED = "PAYOUTS_RESUMED",
}

export interface AuditRecord {
  id: string;
  action: AuditAction;
  accessor: string; // address
  patient: string; // address
  entityId: string; // recordId, claimId, etc.
  dataHash: string;
  metadata: Record<string, string | number | boolean>;
  timestamp: string;
  blockNumber?: number;
  txHash?: string;
  complianceFlags: string[]; // HIPAA, GDPR, etc.
}

export interface AuditQuery {
  entityId?: string;
  accessor?: string;
  patient?: string;
  action?: AuditAction;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// ─── In-Memory Store (would be DB in production) ────────────────────────────

const auditStore: AuditRecord[] = [];

// Seed with demo data
const DEMO_AUDIT_DATA: AuditRecord[] = [
  {
    id: "aud_001",
    action: AuditAction.RECORD_CREATE,
    accessor: "0x1234567890abcdef1234567890abcdef12345678",
    patient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    entityId: "record_001",
    dataHash: "0xabc123...",
    metadata: { recordType: "LAB", provider: "City Hospital" },
    timestamp: "2026-03-01T10:00:00Z",
    blockNumber: 18500001,
    txHash: "0xdeadbeef001...",
    complianceFlags: ["HIPAA_ACCESS_LOG", "GDPR_PROCESSING_RECORD"],
  },
  {
    id: "aud_002",
    action: AuditAction.CONSENT_GRANT,
    accessor: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    patient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    entityId: "consent_001",
    dataHash: "0xdef456...",
    metadata: { grantee: "Dr. Smith", categories: "CARDIOLOGY,LAB", duration: "14 days" },
    timestamp: "2026-03-02T14:30:00Z",
    blockNumber: 18500050,
    txHash: "0xdeadbeef002...",
    complianceFlags: ["HIPAA_CONSENT_LOG", "GDPR_CONSENT_RECORD"],
  },
  {
    id: "aud_003",
    action: AuditAction.AI_DECISION,
    accessor: "0x0000000000000000000000000000000000000CRE",
    patient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    entityId: "claim_001",
    dataHash: "0x789abc...",
    metadata: { verdict: "APPROVED", consensusScore: 7850, model: "adjudicator-v2.1" },
    timestamp: "2026-03-03T09:15:00Z",
    blockNumber: 18500100,
    txHash: "0xdeadbeef003...",
    complianceFlags: ["HIPAA_ACCESS_LOG", "AI_DECISION_AUDIT"],
  },
  {
    id: "aud_004",
    action: AuditAction.EMERGENCY_ACCESS,
    accessor: "0x9999999999999999999999999999999999999999",
    patient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    entityId: "glassbreak_001",
    dataHash: "0xemergency...",
    metadata: { reason: "Cardiac arrest in ER — need blood type and allergies", role: "PARAMEDIC" },
    timestamp: "2026-03-04T02:45:00Z",
    blockNumber: 18500150,
    txHash: "0xdeadbeef004...",
    complianceFlags: ["HIPAA_EMERGENCY_ACCESS", "MANDATORY_REVIEW"],
  },
  {
    id: "aud_005",
    action: AuditAction.CROSS_CHAIN_PAYOUT,
    accessor: "0x0000000000000000000000000000000000000CRE",
    patient: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    entityId: "claim_001",
    dataHash: "0xccip_msg_001...",
    metadata: { amount: "15000", token: "USDC", destinationChain: "Base", ccipMessageId: "0xccip123..." },
    timestamp: "2026-03-03T09:16:00Z",
    blockNumber: 18500101,
    txHash: "0xdeadbeef005...",
    complianceFlags: ["CROSS_CHAIN_SETTLEMENT", "FINANCIAL_AUDIT"],
  },
];

// Initialize with demo data
auditStore.push(...DEMO_AUDIT_DATA);

// ─── Service Functions ──────────────────────────────────────────────────────

/**
 * Record a new audit entry.
 */
export function recordAuditEntry(entry: Omit<AuditRecord, "id">): AuditRecord {
  const record: AuditRecord = {
    ...entry,
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  auditStore.push(record);
  log.info("Audit entry recorded", { id: record.id, action: record.action });
  return record;
}

/**
 * Query audit records with filters.
 */
export function queryAuditTrail(query: AuditQuery): { records: AuditRecord[]; total: number } {
  let filtered = [...auditStore];

  if (query.entityId) {
    filtered = filtered.filter((r) => r.entityId === query.entityId);
  }
  if (query.accessor) {
    filtered = filtered.filter((r) => r.accessor.toLowerCase() === query.accessor!.toLowerCase());
  }
  if (query.patient) {
    filtered = filtered.filter((r) => r.patient.toLowerCase() === query.patient!.toLowerCase());
  }
  if (query.action) {
    filtered = filtered.filter((r) => r.action === query.action);
  }
  if (query.startDate) {
    const start = new Date(query.startDate).getTime();
    filtered = filtered.filter((r) => new Date(r.timestamp).getTime() >= start);
  }
  if (query.endDate) {
    const end = new Date(query.endDate).getTime();
    filtered = filtered.filter((r) => new Date(r.timestamp).getTime() <= end);
  }

  // Sort by timestamp descending
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = filtered.length;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const start = (page - 1) * pageSize;
  const records = filtered.slice(start, start + pageSize);

  return { records, total };
}

/**
 * Export audit trail as CSV string.
 */
export function exportAuditTrailCsv(query: AuditQuery): string {
  const { records } = queryAuditTrail({ ...query, pageSize: 10000 });

  const headers = [
    "ID", "Action", "Accessor", "Patient", "Entity ID",
    "Data Hash", "Timestamp", "Block Number", "TX Hash", "Compliance Flags",
  ];

  const rows = records.map((r) => [
    r.id, r.action, r.accessor, r.patient, r.entityId,
    r.dataHash, r.timestamp, r.blockNumber ?? "", r.txHash ?? "",
    r.complianceFlags.join(";"),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Get audit statistics for a patient.
 */
export function getAuditStats(patient: string) {
  const records = auditStore.filter((r) => r.patient.toLowerCase() === patient.toLowerCase());

  const actionCounts: Record<string, number> = {};
  for (const r of records) {
    actionCounts[r.action] = (actionCounts[r.action] ?? 0) + 1;
  }

  return {
    totalEntries: records.length,
    actionCounts,
    lastAccess: records.length > 0 ? records[records.length - 1].timestamp : null,
    emergencyAccessCount: records.filter((r) => r.action === AuditAction.EMERGENCY_ACCESS).length,
    aiDecisionCount: records.filter((r) => r.action === AuditAction.AI_DECISION).length,
  };
}
