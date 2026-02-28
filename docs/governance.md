# mediCaRE — Governance Documentation

> **Version:** 1.0.0  
> **Contract:** `Governance.sol`  
> **Last Updated:** 2026-02-25

---

## Table of Contents

1. [Overview](#overview)
2. [Governance Token](#governance-token)
3. [Roles & Permissions](#roles--permissions)
4. [Proposal Types](#proposal-types)
5. [Proposal Lifecycle](#proposal-lifecycle)
6. [Voting Mechanics](#voting-mechanics)
7. [Timelock & Execution](#timelock--execution)
8. [Governance Parameters](#governance-parameters)
9. [Security Considerations](#security-considerations)
10. [Example Governance Scenarios](#example-governance-scenarios)
11. [Code Examples](#code-examples)
12. [Events Reference](#events-reference)
13. [Error Reference](#error-reference)

---

## Overview

The mediCaRE DAO enables decentralized governance over the healthcare protocol. Token holders — representing hospitals, insurers, patients, and other stakeholders — can propose and vote on changes to protocol parameters, risk thresholds, data-sharing agreements, and protocol upgrades.

The governance system is implemented in `Governance.sol`, a standalone Solidity contract that provides:

- **Token-weighted voting** — voting power equals the voter's governance token balance at the time of voting
- **Configurable quorum** — proposals require minimum total participation to be valid
- **Mandatory timelock** — a delay between vote conclusion and execution, allowing stakeholders to react
- **Generic execution** — proposals can execute arbitrary on-chain calls via `target` + `callData`, enabling governance over any contract in the protocol
- **Signal votes** — proposals with `target = address(0)` serve as non-binding governance signals

### Design Rationale

| Decision | Rationale |
|---|---|
| Snapshot-free voting | Simplicity for MVP; voter weight is token balance at `vote()` call time |
| Advisory proposal types | Proposal types are labels for categorization; execution logic is generic |
| Single-target execution | Each proposal can call one contract function; complex upgrades use multiple proposals |
| Timelock | Protects against malicious proposals by giving stakeholders time to exit or respond |

---

## Governance Token

The governance token is an ERC-20 token that confers voting rights within the mediCaRE DAO.

| Property | Value |
|---|---|
| **Standard** | ERC-20 |
| **Address** | Set at Governance contract deployment (immutable) |
| **Contract Variable** | `governanceToken` (immutable `IERC20`) |
| **Voting Weight** | 1 token = 1 vote (no delegation in v1) |
| **Proposal Threshold** | Minimum token balance required to create proposals |

### Token Utility

| Function | How Token Is Used |
|---|---|
| **Proposal Creation** | Proposer must hold ≥ `proposalThreshold` tokens |
| **Voting** | Voter's weight = `governanceToken.balanceOf(voter)` at vote time |
| **Quorum** | Total votes cast (for + against) must meet `quorumVotes` threshold |
| **No Staking/Locking** | Tokens are not locked during voting (snapshot-free design) |

---

## Roles & Permissions

The Governance contract uses OpenZeppelin's `AccessControl` with three roles:

| Role | Identifier | Permissions |
|---|---|---|
| **DEFAULT_ADMIN_ROLE** | `0x00` | Can manage all other roles |
| **ADMIN_ROLE** | `keccak256("ADMIN_ROLE")` | Update governance parameters, cancel any proposal, manage EXECUTOR_ROLE |
| **EXECUTOR_ROLE** | `keccak256("EXECUTOR_ROLE")` | Execute proposals after timelock expiry |

### Role Hierarchy

```
DEFAULT_ADMIN_ROLE
    └── ADMIN_ROLE
            └── EXECUTOR_ROLE   (admin is EXECUTOR_ROLE's role admin)
```

### Open Permissions (No Role Required)

| Function | Who Can Call |
|---|---|
| `createProposal()` | Any address with ≥ `proposalThreshold` tokens |
| `vote()` | Any address with > 0 token balance |
| `cancelProposal()` | The proposal's proposer OR any admin |
| `getProposal()` | Anyone (view function) |
| `getProposalStatus()` | Anyone (view function) |
| `getVoteInfo()` | Anyone (view function) |
| `totalProposals()` | Anyone (view function) |

---

## Proposal Types

Proposals are categorized into four types. These are advisory labels — the execution mechanism is the same regardless of type.

### `PARAMETER_CHANGE` (0)

Changes to protocol operational parameters.

| Example Parameters | Affected Contract |
|---|---|
| Insurance premium calculation weights | InsurancePolicy.sol |
| Quorum and voting period | Governance.sol |
| Rate limits and API thresholds | Backend configuration |
| EHR storage limits | EHRStorage.sol |

### `RISK_THRESHOLD` (1)

Adjustments to risk scoring and safety thresholds.

| Example Thresholds | Purpose |
|---|---|
| Maximum allowable risk score before policy deactivation | Caps coverage for extremely high-risk patients |
| Anomaly detection sensitivity levels | Adjusts alert triggers for vital sign monitoring |
| Supply-chain temperature breach thresholds | Determines when a batch is auto-flagged |
| Minimum confidence score for AI summaries | Quality gate for AI-generated clinical summaries |

### `DATA_SHARING` (2)

Governance over data access and sharing policies.

| Example Policies | Scope |
|---|---|
| New research institution data access agreement | Cross-institution data sharing with privacy constraints |
| Patient data export format standards | FHIR version and compliance requirements |
| Anonymization requirements for analytics | Level of de-identification for research data |
| Cross-chain data synchronization policies | Which data fields bridge across chains |

### `PROTOCOL_UPGRADE` (3)

Major changes to the protocol implementation.

| Example Upgrades | Impact |
|---|---|
| Deploy new contract version | Replace or extend existing contract logic |
| Add new credential types to CredentialRegistry | Extend the `CredentialType` enum |
| Integrate new CCIP lanes | Enable cross-chain operations on additional networks |
| Migrate to new IPFS pinning service | Change off-chain storage backend |

---

## Proposal Lifecycle

A proposal progresses through a well-defined lifecycle:

```
                     ┌─────────────────────────────────────────────┐
                     │                                             │
                     ▼                                             │
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐    │
│  CREATE   │───▶│  ACTIVE  │───▶│ SUCCEEDED │───▶│ EXECUTED  │    │
│           │    │ (voting) │    │ (timelock)│    │           │    │
└──────────┘    └──────────┘    └───────────┘    └───────────┘    │
                     │                                             │
                     │          ┌───────────┐                      │
                     ├─────────▶│ DEFEATED  │                      │
                     │          │           │                      │
                     │          └───────────┘                      │
                     │                                             │
                     │          ┌───────────┐                      │
                     └─────────▶│ CANCELLED │──────────────────────┘
                                │           │
                                └───────────┘
```

### Status Definitions

| Status | Condition |
|---|---|
| **Active** | `block.timestamp` is between `startTime` and `endTime`; not cancelled |
| **Succeeded** | Voting ended; `forVotes > againstVotes` AND `forVotes + againstVotes ≥ quorumVotes` |
| **Defeated** | Voting ended; quorum not met OR `againstVotes ≥ forVotes` |
| **Executed** | Succeeded proposal that has been executed after timelock |
| **Cancelled** | Proposer or admin cancelled the proposal before execution |

### Timeline

```
|←── Creation ──→|←── Voting Period ──→|←── Timelock ──→|←── Executable ──→|
      t=0              t=votingPeriod     t=executionDelay    (forever)
```

---

## Voting Mechanics

### Casting a Vote

| Property | Behavior |
|---|---|
| **Who can vote** | Any address with a non-zero governance token balance |
| **Vote weight** | Equal to `governanceToken.balanceOf(msg.sender)` at the time `vote()` is called |
| **Vote options** | `support = true` (for) or `support = false` (against) |
| **Vote finality** | Once cast, a vote cannot be changed or withdrawn |
| **One vote per address** | Each address can vote exactly once per proposal |

### Quorum

A proposal is valid only if the total votes cast (for + against) meet or exceed the `quorumVotes` threshold:

$$\text{quorumMet} = (\text{forVotes} + \text{againstVotes}) \geq \text{quorumVotes}$$

### Passing Condition

A proposal succeeds when both conditions are satisfied:

$$\text{succeeded} = (\text{forVotes} > \text{againstVotes}) \wedge (\text{quorumMet})$$

### Vote Weight Example

| Voter | Token Balance | Vote | Weight Applied |
|---|---|---|---|
| Hospital A | 100,000 MCR | For | 100,000 |
| Hospital B | 75,000 MCR | For | 75,000 |
| Insurer X | 50,000 MCR | Against | 50,000 |
| **Totals** | | **For: 175,000** | **Against: 50,000** |

If `quorumVotes = 200,000`: Quorum met (225,000 ≥ 200,000), passes (175,000 > 50,000).  
If `quorumVotes = 250,000`: Quorum **not** met (225,000 < 250,000), defeated.

---

## Timelock & Execution

### Timelock Period

After a proposal's voting period ends and it has succeeded, there is a mandatory waiting period (`executionDelay`) before the proposal can be executed:

$$\text{readyAt} = \text{endTime} + \text{executionDelay}$$

The timelock serves two purposes:

1. **Safety net** — gives dissenting stakeholders time to react (e.g., withdraw liquidity, adjust positions)
2. **Review period** — allows admins to cancel malicious proposals that passed through manipulation

### Execution

Execution is performed by calling `executeProposal(proposalId)`. Requirements:

| Requirement | Check |
|---|---|
| Caller has `EXECUTOR_ROLE` | `onlyRole(EXECUTOR_ROLE)` |
| Proposal exists | `startTime != 0` |
| Not already executed | `!executed` |
| Not cancelled | `!cancelled` |
| Voting has ended | `block.timestamp > endTime` |
| Proposal succeeded | `forVotes > againstVotes` AND quorum met |
| Timelock expired | `block.timestamp ≥ endTime + executionDelay` |
| On-chain call succeeds (if target ≠ address(0)) | `target.call(callData)` returns `true` |

### Signal Votes

When `target = address(0)`, the proposal is a **signal vote** — no on-chain function call is made. The proposal is still marked as executed, serving as a permanent on-chain record of the DAO's decision. Signal votes are used for off-chain policy changes that cannot be enforced on-chain (e.g., data classification policies, partnership agreements).

---

## Governance Parameters

The following parameters control the governance process and can themselves be updated through governance proposals:

| Parameter | Type | Description | Default (Example) |
|---|---|---|---|
| `proposalThreshold` | `uint256` | Minimum token balance to create a proposal | 1,000 MCR |
| `quorumVotes` | `uint256` | Minimum total votes for proposal validity | 100,000 MCR |
| `votingPeriod` | `uint256` | Duration of the voting window (seconds) | 259,200 (3 days) |
| `executionDelay` | `uint256` | Timelock duration after vote ends (seconds) | 86,400 (1 day) |

### Updating Parameters

Only addresses with `ADMIN_ROLE` can update parameters via `updateParameters()`:

```solidity
function updateParameters(
    uint256 _proposalThreshold,
    uint256 _quorumVotes,
    uint256 _votingPeriod,
    uint256 _executionDelay
) external onlyRole(ADMIN_ROLE)
```

**Constraints:**
- `_votingPeriod` must be > 0
- `_quorumVotes` must be > 0

For decentralized parameter updates, the admin can create a governance proposal that calls `updateParameters()` on the Governance contract itself.

---

## Security Considerations

### Voting Power

| Risk | Mitigation |
|---|---|
| **Flash loan voting** | Snapshot-free design means tokens could theoretically be borrowed to vote. **v2 improvement:** implement ERC-20 snapshot-based voting. |
| **Token concentration** | Quorum + for > against requirements ensure no single entity can unilaterally pass proposals (assuming sufficient quorum). |
| **Vote buying** | On-chain votes are public. Off-chain vote buying is an inherent limitation of token-weighted governance. |

### Proposal Safety

| Risk | Mitigation |
|---|---|
| **Malicious calldata** | Timelock gives stakeholders time to review and admins to cancel |
| **Arbitrary target** | Only `EXECUTOR_ROLE` can execute; admins should review proposal targets before execution |
| **Reentrancy** | `executeProposal()` uses `ReentrancyGuard` and marks `executed = true` before the external call |
| **Repeated execution** | `executed` flag prevents double execution |

### Access Control

| Risk | Mitigation |
|---|---|
| **Admin key compromise** | `DEFAULT_ADMIN_ROLE` should be held by a multi-sig; consider timelocking role changes |
| **Executor collusion** | `EXECUTOR_ROLE` is managed by `ADMIN_ROLE`; can be revoked immediately |
| **Proposer spam** | `proposalThreshold` requires minimum token holdings to create proposals |

### Operational Recommendations

1. **Multi-sig admin** — Deploy with a Gnosis Safe as the admin address, not an EOA
2. **Gradual decentralization** — Start with higher proposal thresholds and quorum, lower them as the community grows
3. **Proposal review** — Establish an off-chain review process (forum + discussion period) before on-chain voting
4. **Emergency procedures** — Admin should be able to cancel and update parameters without governance in emergency situations (this is already supported)

---

## Example Governance Scenarios

### Scenario A: Adjusting Risk Thresholds for Insurance

**Context:** The DAO wants to lower the maximum acceptable risk score from 75 to 60 before flagging policies for review.

**Step-by-step:**

1. **Discussion** — A community member posts a proposal on the governance forum explaining why the threshold should change, backed by claims data showing increased payouts for score > 60.

2. **Create Proposal:**
   ```solidity
   // Encode the function call to InsurancePolicy.setRiskThreshold(6000)
   bytes memory callData = abi.encodeWithSignature("setRiskThreshold(uint256)", 6000);

   governance.createProposal(
       "Lower insurance risk threshold from 7500 to 6000 bps",
       ProposalType.RISK_THRESHOLD,
       insurancePolicyAddress,
       callData
   );
   // Returns proposalId = 5
   ```

3. **Voting Period (3 days):**
   - Hospitals vote based on payout data and actuarial analysis
   - Final tally: 180,000 FOR, 45,000 AGAINST (quorum: 100,000 ✓)

4. **Timelock (1 day):**
   - Admins review the proposal calldata
   - No red flags identified

5. **Execution:**
   ```solidity
   governance.executeProposal(5);
   // Calls InsurancePolicy.setRiskThreshold(6000)
   ```

6. **Result:** The insurance contract now flags policies with risk scores above 60% for mandatory review.

---

### Scenario B: Adding New Data Sharing Agreement

**Context:** A research university wants access to anonymized patient health data for a clinical study.

**Step-by-step:**

1. **Create Signal Proposal (no on-chain action):**
   ```solidity
   governance.createProposal(
       "Approve data sharing agreement with University of Example for anonymized diabetes study. Terms: 12 months, max 10k records, k-anonymity >= 5.",
       ProposalType.DATA_SHARING,
       address(0),    // Signal vote — no on-chain execution
       ""            // Empty calldata
   );
   // Returns proposalId = 12
   ```

2. **Voting Period:**
   - Patient representatives review the privacy terms
   - Hospital administrators evaluate the research benefit
   - Final tally: 250,000 FOR, 30,000 AGAINST

3. **Execution (signal vote):**
   ```solidity
   governance.executeProposal(12);
   // No on-chain call made (target = address(0))
   // Proposal marked as executed — permanent on-chain record
   ```

4. **Off-chain Follow-up:**
   - Backend team configures the data export pipeline with the approved anonymization parameters
   - Research institution receives API credentials with scoped permissions

---

### Scenario C: Protocol Upgrade Procedure

**Context:** The development team has deployed CredentialRegistry v2 with support for a new `RESIDENCY` credential type. The DAO must approve switching to the new contract.

**Step-by-step:**

1. **Deploy New Contract:**
   ```bash
   npx hardhat run scripts/deploy_credential_v2.ts --network sepolia
   # CredentialRegistry v2 deployed to: 0xNewAddress...
   ```

2. **Create Upgrade Proposal:**
   ```solidity
   // Encode a call to a registry/router contract that updates the pointer
   bytes memory callData = abi.encodeWithSignature(
       "upgradeContract(string,address)",
       "CredentialRegistry",
       0xNewAddress
   );

   governance.createProposal(
       "Upgrade CredentialRegistry to v2 — adds RESIDENCY credential type, fixes renewal bug #42",
       ProposalType.PROTOCOL_UPGRADE,
       registryRouterAddress,
       callData
   );
   ```

3. **Extended Review:**
   - Security team audits the new contract
   - Testnet deployment and integration test results are published
   - Community discussion over the 3-day voting period

4. **Vote + Timelock + Execution:**
   - Proposal passes with > 80% approval
   - After timelock, executor triggers the upgrade
   - New contract becomes active for all new credential operations

5. **Data Migration:**
   - Existing credentials remain in v1 (immutable)
   - New issuances go to v2
   - Verification endpoints query both contracts during transition period

---

## Code Examples

### Reading Governance State (ethers.js)

```typescript
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
const governanceAddress = "0x...";
const governanceAbi = [ /* Governance ABI */ ];
const governance = new ethers.Contract(governanceAddress, governanceAbi, provider);

// Read governance parameters
const threshold = await governance.proposalThreshold();
const quorum = await governance.quorumVotes();
const period = await governance.votingPeriod();
const delay = await governance.executionDelay();

console.log(`Proposal Threshold: ${ethers.formatUnits(threshold, 18)} MCR`);
console.log(`Quorum: ${ethers.formatUnits(quorum, 18)} MCR`);
console.log(`Voting Period: ${Number(period) / 3600} hours`);
console.log(`Execution Delay: ${Number(delay) / 3600} hours`);

// Read total proposals
const total = await governance.totalProposals();
console.log(`Total Proposals: ${total}`);
```

### Creating a Proposal (ethers.js)

```typescript
import { ethers } from "ethers";

const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const governance = new ethers.Contract(governanceAddress, governanceAbi, signer);

// Encode the target function call
const insuranceInterface = new ethers.Interface([
  "function updateParameters(uint256,uint256,uint256,uint256)"
]);
const callData = insuranceInterface.encodeFunctionData("updateParameters", [
  ethers.parseUnits("500", 18),   // new proposalThreshold
  ethers.parseUnits("50000", 18), // new quorumVotes
  259200,                          // new votingPeriod (3 days)
  43200,                           // new executionDelay (12 hours)
]);

// Create the proposal
const tx = await governance.createProposal(
  "Update governance parameters: lower threshold and quorum for increased participation",
  0, // ProposalType.PARAMETER_CHANGE
  governanceAddress, // target is the governance contract itself
  callData,
);
const receipt = await tx.wait();
console.log("Proposal created:", receipt.hash);
```

### Voting (ethers.js)

```typescript
// Vote on proposal #5
const proposalId = 5;
const support = true; // true = for, false = against

const tx = await governance.vote(proposalId, support);
await tx.wait();
console.log("Vote cast successfully");

// Check vote info
const [hasVoted, weight] = await governance.getVoteInfo(proposalId, signer.address);
console.log(`Voted: ${hasVoted}, Weight: ${ethers.formatUnits(weight, 18)} MCR`);
```

### Querying Proposal Status (ethers.js)

```typescript
// Get proposal details
const proposal = await governance.getProposal(proposalId);
console.log("Description:", proposal.description);
console.log("For:", ethers.formatUnits(proposal.forVotes, 18));
console.log("Against:", ethers.formatUnits(proposal.againstVotes, 18));
console.log("Start:", new Date(Number(proposal.startTime) * 1000).toISOString());
console.log("End:", new Date(Number(proposal.endTime) * 1000).toISOString());

// Get computed status
const status = await governance.getProposalStatus(proposalId);
const statusLabels = ["Active", "Succeeded", "Defeated", "Executed", "Cancelled"];
console.log("Status:", statusLabels[status]);
```

### Executing a Proposal (ethers.js)

```typescript
// Ensure caller has EXECUTOR_ROLE
const executorRole = await governance.EXECUTOR_ROLE();
const hasRole = await governance.hasRole(executorRole, signer.address);
if (!hasRole) {
  throw new Error("Caller does not have EXECUTOR_ROLE");
}

// Check timelock has expired
const proposal = await governance.getProposal(proposalId);
const delay = await governance.executionDelay();
const readyAt = Number(proposal.endTime) + Number(delay);
const now = Math.floor(Date.now() / 1000);

if (now < readyAt) {
  const remaining = readyAt - now;
  console.log(`Timelock not expired. Ready in ${remaining} seconds.`);
} else {
  const tx = await governance.executeProposal(proposalId);
  const receipt = await tx.wait();
  console.log("Proposal executed:", receipt.hash);
}
```

### Cancelling a Proposal (ethers.js)

```typescript
// Only the proposer or an admin can cancel
const tx = await governance.cancelProposal(proposalId);
await tx.wait();
console.log("Proposal cancelled");
```

### Updating Governance Parameters (Admin)

```typescript
// Direct admin update (no governance vote required)
const tx = await governance.updateParameters(
  ethers.parseUnits("2000", 18),  // proposalThreshold: 2000 MCR
  ethers.parseUnits("200000", 18), // quorumVotes: 200,000 MCR
  604800,                           // votingPeriod: 7 days
  172800,                           // executionDelay: 2 days
);
await tx.wait();
console.log("Governance parameters updated");
```

---

## Events Reference

| Event | Parameters | Emitted When |
|---|---|---|
| `ProposalCreated` | `proposalId`, `proposer`, `description`, `proposalType`, `startTime`, `endTime`, `target` | New proposal created |
| `VoteCast` | `proposalId`, `voter`, `support`, `weight` | Vote cast on a proposal |
| `ProposalExecuted` | `proposalId`, `executor` | Succeeded proposal executed |
| `ProposalCancelled` | `proposalId`, `cancelledBy` | Proposal cancelled |
| `GovernanceParametersUpdated` | `proposalThreshold`, `quorumVotes`, `votingPeriod`, `executionDelay` | Admin updates governance parameters |

### Listening for Events

```typescript
// Listen for new proposals
governance.on("ProposalCreated", (proposalId, proposer, description, type) => {
  console.log(`New proposal #${proposalId} by ${proposer}: ${description}`);
});

// Listen for votes
governance.on("VoteCast", (proposalId, voter, support, weight) => {
  const direction = support ? "FOR" : "AGAINST";
  console.log(`Vote on #${proposalId}: ${voter} voted ${direction} with ${ethers.formatUnits(weight, 18)} MCR`);
});

// Listen for executions
governance.on("ProposalExecuted", (proposalId, executor) => {
  console.log(`Proposal #${proposalId} executed by ${executor}`);
});
```

---

## Error Reference

| Error | Parameters | Cause |
|---|---|---|
| `InsufficientTokenBalance` | `required`, `available` | Proposer's token balance is below `proposalThreshold` |
| `ProposalNotFound` | `proposalId` | No proposal exists with the given ID |
| `VotingNotActive` | `proposalId` | Voting has not started or has already ended |
| `AlreadyVoted` | `voter`, `proposalId` | Address has already voted on this proposal |
| `ProposalNotSucceeded` | `proposalId` | Attempted execution on a non-succeeded proposal |
| `TimelockNotExpired` | `proposalId`, `readyAt` | Timelock period has not elapsed |
| `ProposalAlreadyExecuted` | `proposalId` | Proposal has already been executed |
| `ProposalAlreadyCancelled` | `proposalId` | Proposal has already been cancelled |
| `ExecutionFailed` | `proposalId` | The `target.call(callData)` reverted |
| `NotProposerOrAdmin` | `caller`, `proposalId` | Non-proposer non-admin attempted to cancel |
| `InvalidVotingPeriod` | — | Attempted to set `votingPeriod` to 0 |
| `InvalidQuorum` | — | Attempted to set `quorumVotes` to 0 |
| `ZeroWeight` | — | Voter has 0 governance token balance |
| `DescriptionEmpty` | — | Proposal description is empty |

---

*This document is part of the mediCaRE project documentation suite. See also: [Architecture Documentation](architecture.md) · [API Documentation](api.md)*
