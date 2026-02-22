// ──────────────────────────────────────────────
//  Contract addresses – replace with actual deployments
// ──────────────────────────────────────────────

export const CONTRACTS = {
  EHRStorage: process.env.NEXT_PUBLIC_EHR_ADDRESS || "0x0000000000000000000000000000000000000001",
  InsurancePolicy: process.env.NEXT_PUBLIC_INSURANCE_ADDRESS || "0x0000000000000000000000000000000000000002",
  SupplyChain: process.env.NEXT_PUBLIC_SUPPLY_ADDRESS || "0x0000000000000000000000000000000000000003",
  CredentialRegistry: process.env.NEXT_PUBLIC_CREDENTIAL_ADDRESS || "0x0000000000000000000000000000000000000004",
  Governance: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || "0x0000000000000000000000000000000000000005",
} as const;

// ──────────────────────────────────────────────
//  Minimal ABIs (read/write functions used by the frontend)
// ──────────────────────────────────────────────

export const EHR_ABI = [
  "function addRecord(address patient, bytes32 ipfsCidHash, string recordType) external",
  "function getRecord(uint256 recordId) view returns (tuple(uint256 recordId, address patient, bytes32 ipfsCidHash, bytes32 aiSummaryHash, string recordType, uint256 createdAt, uint256 updatedAt, bool isActive))",
  "function getPatientRecords(address patient) view returns (uint256[])",
  "function grantAccess(address provider) external",
  "function revokeAccess(address provider) external",
  "function hasAccess(address patient, address provider) view returns (bool)",
  "function setAISummary(uint256 recordId, bytes32 aiSummaryHash) external",
  "event RecordAdded(uint256 indexed recordId, address indexed patient, string recordType)",
  "event AccessGranted(address indexed patient, address indexed provider)",
  "event AccessRevoked(address indexed patient, address indexed provider)",
];

export const INSURANCE_ABI = [
  "function mintPolicy(address holder, uint256 coverageAmount, uint256 premiumAmount, uint256 duration) external returns (uint256)",
  "function getPolicy(uint256 policyId) view returns (tuple(uint256 policyId, address holder, uint256 coverageAmount, uint256 premiumAmount, uint256 expiryDate, bool isActive, uint256 riskScore))",
  "function submitClaim(uint256 policyId, uint256 amount, string description) external returns (uint256)",
  "function getClaim(uint256 claimId) view returns (tuple(uint256 claimId, uint256 policyId, address claimant, uint256 amount, string description, uint8 status, uint256 timestamp))",
  "function getPolicyClaims(uint256 policyId) view returns (uint256[])",
  "function payPremium(uint256 policyId) external",
  "event PolicyMinted(uint256 indexed policyId, address indexed holder)",
  "event ClaimSubmitted(uint256 indexed claimId, uint256 indexed policyId)",
  "event ClaimStatusChanged(uint256 indexed claimId, uint8 newStatus)",
];

export const SUPPLY_ABI = [
  "function createBatch(bytes32 lotNumber, uint256 expiryDate, uint256 quantity, bytes32 drugNameHash) external returns (uint256)",
  "function getBatch(uint256 batchId) view returns (tuple(uint256 batchId, address manufacturer, bytes32 lotNumber, uint256 manufactureDate, uint256 expiryDate, uint256 quantity, uint8 status, bytes32 drugNameHash))",
  "function updateBatchStatus(uint256 batchId, uint8 newStatus) external",
  "function verifyBatch(uint256 batchId) view returns (bool)",
  "function getBatchHistory(uint256 batchId) view returns (tuple(uint256 timestamp, uint8 status, bytes32 locationHash, bytes32 notesHash)[])",
  "event BatchCreated(uint256 indexed batchId, address indexed manufacturer)",
  "event BatchStatusUpdated(uint256 indexed batchId, uint8 newStatus)",
];

export const CREDENTIAL_ABI = [
  "function issueCredential(address subject, uint8 credentialType, bytes32 credentialHash, uint256 expiryDate) external returns (uint256)",
  "function getCredential(uint256 credentialId) view returns (tuple(uint256 credentialId, bytes32 credentialHash, address issuer, address subject, uint8 credentialType, uint256 issuanceDate, uint256 expiryDate, bool isValid))",
  "function getSubjectCredentials(address subject) view returns (uint256[])",
  "function revokeCredential(uint256 credentialId) external",
  "function isCredentialValid(uint256 credentialId) view returns (bool)",
  "event CredentialIssued(uint256 indexed credentialId, address indexed subject)",
  "event CredentialRevoked(uint256 indexed credentialId)",
];

export const GOVERNANCE_ABI = [
  "function createProposal(string description, uint8 proposalType, address target, bytes callData) external returns (uint256)",
  "function vote(uint256 proposalId, bool support) external",
  "function getProposal(uint256 proposalId) view returns (tuple(uint256 proposalId, address proposer, string description, uint256 forVotes, uint256 againstVotes, uint256 startTime, uint256 endTime, bool executed, bool cancelled, uint8 proposalType, address target, bytes callData))",
  "function getProposalCount() view returns (uint256)",
  "function executeProposal(uint256 proposalId) external",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer)",
  "event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)",
  "event ProposalExecuted(uint256 indexed proposalId)",
];
