// ──────────────────────────────────────────────
//  EHR Records
// ──────────────────────────────────────────────

export interface EHRRecord {
  recordId: number;
  patient: string;
  ipfsCidHash: string;
  aiSummaryHash: string;
  recordType: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export type RecordType = "LAB" | "IMAGING" | "PRESCRIPTION" | "CLINICAL_NOTE" | "DISCHARGE" | "OTHER";

// ──────────────────────────────────────────────
//  Insurance
// ──────────────────────────────────────────────

export interface InsurancePolicy {
  policyId: number;
  holder: string;
  coverageAmount: string;
  premiumAmount: string;
  expiryDate: number;
  isActive: boolean;
  riskScore: number;
}

export enum ClaimStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Paid = 3,
}

export interface InsuranceClaim {
  claimId: number;
  policyId: number;
  claimant: string;
  amount: string;
  description: string;
  status: ClaimStatus;
  timestamp: number;
}

// ──────────────────────────────────────────────
//  Supply Chain
// ──────────────────────────────────────────────

export enum BatchStatus {
  Created = 0,
  InTransit = 1,
  Delivered = 2,
  Flagged = 3,
  Recalled = 4,
}

export interface SupplyBatch {
  batchId: number;
  manufacturer: string;
  lotNumber: string;
  manufactureDate: number;
  expiryDate: number;
  quantity: number;
  status: BatchStatus;
  drugName: string;
}

export interface BatchEvent {
  timestamp: number;
  status: BatchStatus;
  location: string;
  notes: string;
}

// ──────────────────────────────────────────────
//  Credentials
// ──────────────────────────────────────────────

export enum CredentialType {
  LICENSE = 0,
  BOARD_CERT = 1,
  SPECIALTY = 2,
  DEA = 3,
  NPI = 4,
  CME = 5,
  FELLOWSHIP = 6,
  OTHER = 7,
}

export const CredentialTypeLabels: Record<CredentialType, string> = {
  [CredentialType.LICENSE]: "Medical License",
  [CredentialType.BOARD_CERT]: "Board Certification",
  [CredentialType.SPECIALTY]: "Specialty Certification",
  [CredentialType.DEA]: "DEA Registration",
  [CredentialType.NPI]: "National Provider ID",
  [CredentialType.CME]: "Continuing Medical Ed.",
  [CredentialType.FELLOWSHIP]: "Fellowship",
  [CredentialType.OTHER]: "Other",
};

export interface Credential {
  credentialId: number;
  credentialHash: string;
  issuer: string;
  subject: string;
  credentialType: CredentialType;
  issuanceDate: number;
  expiryDate: number;
  isValid: boolean;
}

// ──────────────────────────────────────────────
//  Governance
// ──────────────────────────────────────────────

export enum ProposalType {
  PARAMETER_CHANGE = 0,
  RISK_THRESHOLD = 1,
  DATA_SHARING = 2,
  PROTOCOL_UPGRADE = 3,
}

export const ProposalTypeLabels: Record<ProposalType, string> = {
  [ProposalType.PARAMETER_CHANGE]: "Parameter Change",
  [ProposalType.RISK_THRESHOLD]: "Risk Threshold",
  [ProposalType.DATA_SHARING]: "Data Sharing",
  [ProposalType.PROTOCOL_UPGRADE]: "Protocol Upgrade",
};

export enum ProposalStatus {
  Active = 0,
  Succeeded = 1,
  Defeated = 2,
  Executed = 3,
  Cancelled = 4,
}

export interface Proposal {
  proposalId: number;
  proposer: string;
  description: string;
  forVotes: string;
  againstVotes: string;
  startTime: number;
  endTime: number;
  executed: boolean;
  cancelled: boolean;
  proposalType: ProposalType;
}

// ──────────────────────────────────────────────
//  Activity Feed
// ──────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  type: "record" | "claim" | "batch" | "credential" | "proposal" | "vote";
  title: string;
  description: string;
  timestamp: number;
  txHash?: string;
}

// ──────────────────────────────────────────────
//  Dashboard Metrics
// ──────────────────────────────────────────────

export interface DashboardMetrics {
  totalRecords: number;
  activePolicies: number;
  supplyBatches: number;
  pendingClaims: number;
  verifiedCredentials: number;
  activeProposals: number;
}
