// ──────────────────────────────────────────────
//  Contract addresses — Tenderly VNet (chain ID 99911155111)
// ──────────────────────────────────────────────

export const CONTRACTS = {
  EHRStorage: process.env.NEXT_PUBLIC_EHR_ADDRESS || "0xd3269fe5e7C03B505bB73d5B3ec5655B72DeFE00",
  InsurancePolicy: process.env.NEXT_PUBLIC_INSURANCE_ADDRESS || "0x960C6b7bA344ed26EFe7CeB9D878E11a465977d1",
  SupplyChain: process.env.NEXT_PUBLIC_SUPPLY_ADDRESS || "0xC69B9c117bA7207ae7c28796718e950fD2eE3507",
  CredentialRegistry: process.env.NEXT_PUBLIC_CREDENTIAL_ADDRESS || "0x57Df5458eDC1Cc1eD6F08D7eC3e3f9b170448a9A",
  Governance: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || "0xB5095Ecbf55E739395e346A6ebEA1701D47d5556",
} as const;

// ──────────────────────────────────────────────
//  Minimal ABIs (read/write functions used by the frontend)
// ──────────────────────────────────────────────

export const EHR_ABI = [
  "function addRecord(address patient, bytes32 ipfsCidHash, bytes32 aiSummaryHash, string recordType) external",
  "function updateRecord(uint256 recordId, bytes32 newIpfsCidHash, bytes32 newAiSummaryHash) external",
  "function deactivateRecord(uint256 recordId) external",
  "function getRecord(uint256 recordId) view returns (tuple(uint256 recordId, address patient, bytes32 ipfsCidHash, bytes32 aiSummaryHash, string recordType, uint256 createdAt, uint256 updatedAt, bool isActive))",
  "function getPatientRecords(address patient) view returns (uint256[])",
  "function grantAccess(address provider) external",
  "function revokeAccess(address provider) external",
  "function checkAccess(address patient, address provider) view returns (bool)",
  "function totalRecords() view returns (uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "event RecordAdded(uint256 indexed recordId, address indexed patient, string recordType)",
  "event AccessGranted(address indexed patient, address indexed provider)",
  "event AccessRevoked(address indexed patient, address indexed provider)",
];

export const INSURANCE_ABI = [
  "function createPolicy(address holder, uint256 coverageAmount, uint256 premiumAmount, uint256 durationDays, uint256 riskScore) external returns (uint256)",
  "function getPolicy(uint256 policyId) view returns (tuple(uint256 policyId, address holder, uint256 coverageAmount, uint256 premiumAmount, uint256 expiryDate, bool isActive, uint256 riskScore))",
  "function submitClaim(uint256 policyId, uint256 amount, bytes32 descriptionHash) external returns (uint256)",
  "function getClaim(uint256 claimId) view returns (tuple(uint256 claimId, uint256 policyId, address claimant, uint256 amount, bytes32 descriptionHash, uint8 status, uint256 timestamp))",
  "function processClaim(uint256 claimId, bool approved) external",
  "function payoutClaim(uint256 claimId) external",
  "function adjustPremium(uint256 policyId, uint256 newPremium, uint256 newRiskScore) external",
  "function renewPolicy(uint256 policyId, uint256 durationDays) external",
  "function deactivatePolicy(uint256 policyId) external",
  "function getHolderPolicies(address holder) view returns (uint256[])",
  "function getPolicyClaims(uint256 policyId) view returns (uint256[])",
  "function totalPolicies() view returns (uint256)",
  "function totalClaims() view returns (uint256)",
  "event PolicyCreated(uint256 indexed policyId, address indexed holder, uint256 coverageAmount, uint256 premiumAmount, uint256 expiryDate, uint256 riskScore)",
  "event ClaimSubmitted(uint256 indexed claimId, uint256 indexed policyId, address claimant, uint256 amount, bytes32 descriptionHash)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "event ClaimProcessed(uint256 indexed claimId, uint8 newStatus, address processor)",
  "event PremiumAdjusted(uint256 indexed policyId, uint256 oldPremium, uint256 newPremium, uint256 newRiskScore)",
];

export const SUPPLY_ABI = [
  "function createBatch(bytes32 lotNumber, uint256 manufactureDate, uint256 expiryDate, uint256 quantity, bytes32 drugNameHash) external returns (uint256)",
  "function getBatch(uint256 batchId) view returns (tuple(uint256 batchId, address manufacturer, bytes32 lotNumber, uint256 manufactureDate, uint256 expiryDate, uint256 quantity, uint8 status, bytes32 drugNameHash))",
  "function flagBatch(uint256 batchId, string reason) external",
  "function recallBatch(uint256 batchId, string reason) external",
  "function verifyBatch(uint256 batchId) external",
  "function transferBatch(uint256 batchId, address to, uint256 quantity) external",
  "function updateConditions(uint256 batchId, bytes32 temperatureHash, bytes32 humidityHash, bytes32 gpsHash) external",
  "function getConditionLogs(uint256 batchId) view returns (tuple(bytes32 temperatureHash, bytes32 humidityHash, bytes32 gpsHash, uint256 timestamp)[])",
  "function getTransferHistory(uint256 batchId) view returns (tuple(address from, address to, uint256 quantity, uint256 timestamp)[])",
  "function totalBatches() view returns (uint256)",
  "event BatchCreated(uint256 indexed batchId, address indexed manufacturer, bytes32 drugNameHash, uint256 quantity)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "event BatchFlagged(uint256 indexed batchId, string reason)",
  "event BatchRecalled(uint256 indexed batchId, string reason)",
];

export const CREDENTIAL_ABI = [
  "function issueCredential(bytes32 credentialHash, address subject, uint8 credentialType, uint256 issuanceDate, uint256 expiryDate) external returns (uint256)",
  "function getCredential(uint256 credentialId) view returns (tuple(uint256 credentialId, bytes32 credentialHash, address issuer, address subject, uint8 credentialType, uint256 issuanceDate, uint256 expiryDate, bool isValid))",
  "function getProviderCredentials(address provider) view returns (uint256[])",
  "function revokeCredential(uint256 credentialId) external",
  "function renewCredential(uint256 credentialId, uint256 newExpiryDate) external",
  "function verifyCredential(uint256 credentialId) view returns (bool)",
  "function totalCredentials() view returns (uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "event CredentialIssued(uint256 indexed credentialId, address indexed subject, bytes32 credentialHash)",
  "event CredentialRevoked(uint256 indexed credentialId)",
];

export const GOVERNANCE_ABI = [
  "function createProposal(string description, uint8 proposalType, address target, bytes callData) external returns (uint256)",
  "function vote(uint256 proposalId, bool support) external",
  "function executeProposal(uint256 proposalId) external",
  "function cancelProposal(uint256 proposalId) external",
  "function getProposal(uint256 proposalId) view returns (tuple(uint256 proposalId, address proposer, string description, uint256 forVotes, uint256 againstVotes, uint256 startTime, uint256 endTime, bool executed, bool cancelled, uint8 proposalType, address target, bytes callData))",
  "function totalProposals() view returns (uint256)",
  "function getProposalStatus(uint256 proposalId) view returns (uint8)",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)",
  "event ProposalExecuted(uint256 indexed proposalId)",
];
