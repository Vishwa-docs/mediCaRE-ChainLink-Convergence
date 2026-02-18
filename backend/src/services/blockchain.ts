import { ethers } from "ethers";
import config from "../config";
import { createLogger } from "../utils/logging";

const log = createLogger("service:blockchain");

// ─── ABI fragments (function signatures used by the backend) ────────────────
// Full ABIs would be imported from compiled artifacts in production.
// Here we define the minimal interfaces needed for each contract.

const EHR_STORAGE_ABI = [
  "function addRecord(address patient, bytes32 ipfsCidHash, string recordType) external returns (uint256)",
  "function updateSummary(uint256 recordId, bytes32 aiSummaryHash) external",
  "function getRecord(uint256 recordId) external view returns (tuple(uint256 recordId, address patient, bytes32 ipfsCidHash, bytes32 aiSummaryHash, string recordType, uint256 createdAt, uint256 updatedAt, bool isActive))",
  "function getPatientRecordIds(address patient) external view returns (uint256[])",
  "function grantAccess(address provider) external",
  "function revokeAccess(address provider) external",
  "function hasAccess(address patient, address provider) external view returns (bool)",
  "event RecordAdded(uint256 indexed recordId, address indexed patient, bytes32 ipfsCidHash, string recordType)",
  "event SummaryUpdated(uint256 indexed recordId, bytes32 aiSummaryHash)",
];

const INSURANCE_POLICY_ABI = [
  "function createPolicy(address holder, uint256 coverageAmount, uint256 premiumAmount, uint256 expiryDate) external returns (uint256)",
  "function submitClaim(uint256 policyId, uint256 amount, string reason, bytes32 evidenceCidHash) external returns (uint256)",
  "function approveClaim(uint256 claimId) external",
  "function rejectClaim(uint256 claimId) external",
  "function payClaim(uint256 claimId) external",
  "function adjustPremium(uint256 policyId, uint256 newPremium, uint256 newRiskScore) external",
  "function getPolicy(uint256 policyId) external view returns (tuple(uint256 policyId, address holder, uint256 coverageAmount, uint256 premiumAmount, uint256 expiryDate, bool isActive, uint256 riskScore))",
  "function getClaim(uint256 claimId) external view returns (tuple(uint256 claimId, uint256 policyId, address claimant, uint256 amount, string reason, uint8 status, bytes32 evidenceCidHash, uint256 submittedAt))",
  "event PolicyCreated(uint256 indexed policyId, address indexed holder, uint256 coverageAmount)",
  "event ClaimSubmitted(uint256 indexed claimId, uint256 indexed policyId, address indexed claimant, uint256 amount)",
];

const SUPPLY_CHAIN_ABI = [
  "function createBatch(bytes32 lotNumber, bytes32 drugNameHash, uint256 expiryDate, uint256 quantity) external returns (uint256)",
  "function updateBatchStatus(uint256 batchId, uint8 newStatus) external",
  "function addConditionLog(uint256 batchId, bytes32 conditionHash) external",
  "function getBatch(uint256 batchId) external view returns (tuple(uint256 batchId, address manufacturer, bytes32 lotNumber, uint256 manufactureDate, uint256 expiryDate, uint256 quantity, uint8 status, bytes32 drugNameHash))",
  "function flagBatch(uint256 batchId, string reason) external",
  "event BatchCreated(uint256 indexed batchId, address indexed manufacturer, bytes32 lotNumber)",
  "event BatchStatusUpdated(uint256 indexed batchId, uint8 newStatus)",
  "event BatchFlagged(uint256 indexed batchId, string reason)",
];

const CREDENTIAL_REGISTRY_ABI = [
  "function issueCredential(address subject, uint8 credentialType, bytes32 credentialHash, uint256 expiryDate) external returns (uint256)",
  "function revokeCredential(uint256 credentialId) external",
  "function getCredential(uint256 credentialId) external view returns (tuple(uint256 credentialId, bytes32 credentialHash, address issuer, address subject, uint8 credentialType, uint256 issuanceDate, uint256 expiryDate, bool isValid))",
  "function getCredentialsBySubject(address subject) external view returns (uint256[])",
  "function verifyCredentialByHash(bytes32 credentialHash) external view returns (bool isValid, uint256 credentialId)",
  "event CredentialIssued(uint256 indexed credentialId, address indexed issuer, address indexed subject, uint8 credentialType)",
  "event CredentialRevoked(uint256 indexed credentialId)",
];

const GOVERNANCE_ABI = [
  "function createProposal(string description, uint8 proposalType, address target, bytes callData) external returns (uint256)",
  "function vote(uint256 proposalId, bool support) external",
  "function executeProposal(uint256 proposalId) external",
  "function getProposal(uint256 proposalId) external view returns (tuple(uint256 proposalId, address proposer, string description, uint256 forVotes, uint256 againstVotes, uint256 startTime, uint256 endTime, bool executed, bool cancelled, uint8 proposalType, address target, bytes callData))",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)",
];

// ─── Provider & Signer Singletons ───────────────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null;
let _signer: ethers.Wallet | null = null;

/** Get (or create) the JSON-RPC provider. */
export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    log.info("JSON-RPC provider initialised", { rpc: config.blockchain.rpcUrl });
  }
  return _provider;
}

/** Get (or create) the wallet signer connected to the provider. */
export function getSigner(): ethers.Wallet {
  if (!_signer) {
    _signer = new ethers.Wallet(config.blockchain.privateKey, getProvider());
    log.info("Wallet signer initialised", {
      address: _signer.address,
    });
  }
  return _signer;
}

// ─── Contract Factories ─────────────────────────────────────────────────────

export function getEHRStorageContract(): ethers.Contract {
  return new ethers.Contract(
    config.contracts.ehrStorage,
    EHR_STORAGE_ABI,
    getSigner(),
  );
}

export function getInsurancePolicyContract(): ethers.Contract {
  return new ethers.Contract(
    config.contracts.insurancePolicy,
    INSURANCE_POLICY_ABI,
    getSigner(),
  );
}

export function getSupplyChainContract(): ethers.Contract {
  return new ethers.Contract(
    config.contracts.supplyChain,
    SUPPLY_CHAIN_ABI,
    getSigner(),
  );
}

export function getCredentialRegistryContract(): ethers.Contract {
  return new ethers.Contract(
    config.contracts.credentialRegistry,
    CREDENTIAL_REGISTRY_ABI,
    getSigner(),
  );
}

export function getGovernanceContract(): ethers.Contract {
  return new ethers.Contract(
    config.contracts.governance,
    GOVERNANCE_ABI,
    getSigner(),
  );
}

// ─── On-Chain Helpers ───────────────────────────────────────────────────────

/**
 * Wait for a transaction to be mined and return the receipt.
 */
export async function waitForTx(
  tx: ethers.ContractTransactionResponse,
): Promise<ethers.ContractTransactionReceipt> {
  log.info("Waiting for transaction", { hash: tx.hash });
  const receipt = await tx.wait();
  if (!receipt) throw new Error(`Transaction ${tx.hash} returned null receipt`);
  log.info("Transaction mined", {
    hash: tx.hash,
    block: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  });
  return receipt;
}

/**
 * Convert a string to a bytes32 keccak hash (for on-chain storage).
 */
export function toBytes32Hash(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

/**
 * Parse a specific event from a transaction receipt.
 */
export function parseEvent(
  receipt: ethers.ContractTransactionReceipt,
  contract: ethers.Contract,
  eventName: string,
): ethers.LogDescription | null {
  for (const eventLog of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({
        topics: eventLog.topics as string[],
        data: eventLog.data,
      });
      if (parsed && parsed.name === eventName) return parsed;
    } catch {
      // Log doesn't match this contract's ABI — skip
    }
  }
  return null;
}

/**
 * Subscribe to a contract event and invoke a callback on each emission.
 */
export function onContractEvent(
  contract: ethers.Contract,
  eventName: string,
  callback: (...args: any[]) => void,
): void {
  contract.on(eventName, callback);
  log.info("Listening for contract event", {
    event: eventName,
    address: contract.target,
  });
}

/**
 * Fetch the current block number.
 */
export async function getBlockNumber(): Promise<number> {
  return getProvider().getBlockNumber();
}

/**
 * Get the native balance of an address (in ETH / native token).
 */
export async function getNativeBalance(address: string): Promise<string> {
  const balance = await getProvider().getBalance(address);
  return ethers.formatEther(balance);
}
