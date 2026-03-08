# mediCaRE — CRE Workflows

17 Chainlink CRE workflows that serve as the orchestration layer for mediCaRE, coordinating blockchain operations with AI agents, external APIs, IoT data, and cross-chain messaging.

---

## All Workflows

| Workflow | Trigger | What It Does |
|----------|---------|-------------|
| **claim-adjudicator** | EVM Log | 3-agent BFT AI swarm (TriageBot, CodingBot, FraudDetectorBot) adjudicates insurance claims with on-chain explainability |
| **emergency-access** | HTTP | Glass-break consent bypass for life-threatening emergencies with 15-min access window and immutable audit trail |
| **trial-matcher** | HTTP | Privacy-preserving clinical trial matching via Confidential HTTP — only boolean eligibility exposed |
| **fraud-monitor** | Cron (6h) | Graph-based anomaly detection on billing patterns, auto-flags claims, auto-pauses treasury if reserves drop |
| **worldid** | HTTP | World ID ZK proof verification → on-chain credential attestation to CredentialRegistry |
| **crosschain** | EVM Log | CCIP cross-chain insurance settlement — bridges payouts between source and destination chains |
| **record-upload** | HTTP | Fetches encrypted EHR from IPFS via Confidential HTTP, runs AI summarization, writes summary hash on-chain |
| **consent** | HTTP | Enforces patient consent — checks on-chain access, verifies provider credentials, fetches record via Confidential HTTP |
| **insurance-claim** | EVM Log | Single-agent claim processing — reads policy, fetches medical evidence via Confidential HTTP, writes decision on-chain |
| **medical-historian** | HTTP/Cron | Longitudinal clinical summaries — aggregates all records, LLM generates summary with drug interaction detection |
| **vitals-monitor** | Cron (15 min) | Polls wearable data via Confidential HTTP, runs anomaly detection, writes alerts on-chain |
| **irb-agent** | HTTP | Autonomous IRB compliance scoring — LLM evaluates research proposals using BFT consensus, writes score on-chain |
| **premium-adjuster** | Cron (monthly) | Recalculates insurance premiums from claims history, applies ±5% cap, updates on-chain |
| **key-rotation** | EVM Log | Re-encrypts records inside TEE after access revocation, updates IPFS CID on-chain |
| **data-marketplace** | HTTP | Consent-gated data monetization — anonymizes patient data inside TEE, delivers to researchers |
| **supply-chain** | Cron (5 min) | IoT pharmaceutical monitoring — polls sensors, flags/recalls breached batches on-chain |
| **auth-session** | HTTP | Validates login credentials, checks on-chain credential status, issues role-based JWT |

---

## Overview

CRE is used throughout mediCaRE to connect on-chain smart contracts with off-chain computation that would be impossible or unsafe to run directly on the blockchain — things like AI-powered claim adjudication, privacy-preserving clinical trial matching, real-time IoT monitoring, and World ID zero-knowledge proof verification. Every workflow uses the `@chainlink/cre-sdk` and follows the same pattern: a trigger fires, the handler reads on-chain state, calls external services (often via Confidential HTTP to protect sensitive data), and writes results back on-chain.

---

## Priority Workflows

These are the core workflows that demonstrate the most advanced CRE capabilities:

### claim-adjudicator
**Trigger:** EVM Log (`ClaimSubmitted` event from InsurancePolicy.sol)

Runs a 3-agent AI swarm in parallel using BFT node execution. When a patient files an insurance claim, the event fires this workflow which reads the policy and claim details on-chain, fetches medical evidence via Confidential HTTP (so patient data stays inside a TEE), and then runs three independent AI agents — TriageBot (validates diagnosis codes and coverage), MedicalCodingBot (verifies CPT/ICD-10 accuracy), and FraudDetectorBot (billing pattern anomaly detection). Results are aggregated via BFT consensus with median scoring. The final adjudication decision and an explainability hash are written on-chain, and if approved, payout is triggered automatically.

**Capabilities:** EVM Log Trigger, EVM Read, Confidential HTTP, Standard HTTP, EVM Write, BFT Consensus, Secrets

### emergency-access
**Trigger:** HTTP (paramedic or ER doctor initiates glass-break access)

Handles life-threatening emergency scenarios where normal patient consent must be bypassed. The workflow verifies that the requester holds an `EMERGENCY_ROLE` credential on-chain, then invokes the `emergencyAccess()` function on EHRStorage to unlock critical patient data — blood type, allergies, current medications, emergency contacts, and DNR status. All data is fetched via Confidential HTTP inside a TEE. An immutable audit trail is written on-chain recording who accessed what and why, and the patient is notified via webhook. Access is time-locked to a 15-minute window.

**Capabilities:** HTTP Trigger, EVM Read, Confidential HTTP, EVM Write, Secrets

### trial-matcher
**Trigger:** HTTP (researcher submits trial criteria)

Privacy-preserving clinical trial matching. A researcher defines eligibility criteria (age range, conditions, medications, biomarkers), and the workflow reads which patients have opted into research via on-chain governance consent. For each consented patient, records are fetched via Confidential HTTP and an LLM evaluates eligibility inside a TEE — the actual patient data never leaves the secure environment. Only a boolean `isEligible` result and an anonymized match ID (non-reversible hash) are returned. The total match count is written on-chain with no patient identifiers.

**Capabilities:** HTTP Trigger, EVM Read, Confidential HTTP, Standard HTTP, EVM Write, Secrets

### fraud-monitor
**Trigger:** Cron (every 6 hours)

Automated fraud detection that runs on a schedule. Reads recent claims from the InsurancePolicy contract, groups them by provider for frequency analysis, and runs a graph-based anomaly detection model to identify suspicious billing patterns. Flagged claims are marked on-chain via `flagClaim()`. The workflow also checks treasury reserves — if the balance drops below a configurable threshold, it automatically pauses payouts to protect the system.

**Capabilities:** Cron Trigger, EVM Read, Standard HTTP, EVM Write, Secrets

### worldid
**Trigger:** HTTP (user submits World ID proof from IDKit)

Verifies World ID zero-knowledge proofs for Sybil-resistant identity. When a patient or provider completes World ID verification in the frontend, the proof (merkle root, nullifier hash, ZK proof bytes, verification level) is sent to this workflow. It calls the World ID Verify API via Standard HTTP to validate the proof, then maps the credential type (LICENSE, BOARD_CERT, NPI, etc.) to the on-chain enum and writes a credential attestation to the CredentialRegistry contract with the nullifier hash, issuance date, and expiry.

**Capabilities:** HTTP Trigger, Standard HTTP, EVM Write, Secrets

### crosschain
**Trigger:** EVM Log (`ClaimPaid` event from InsurancePolicy.sol)

CCIP-based cross-chain settlement. When a claim payout occurs on the source chain, this workflow reads the settlement details, initiates a CCIP token bridge to the destination chain via the CCIP bridge API, writes a settlement confirmation on the source chain, and writes a settlement receipt on the destination chain. Supports multi-chain insurance where policyholders and insurers operate on different networks.

**Capabilities:** EVM Log Trigger, EVM Read, Standard HTTP, EVM Write, Secrets

---

## Chainlink Capabilities Used

| Capability | Used In |
|-----------|---------|
| **EVM Log Trigger** | claim-adjudicator, insurance-claim, crosschain, key-rotation |
| **HTTP Trigger** | emergency-access, trial-matcher, worldid, record-upload, consent, medical-historian, irb-agent, data-marketplace, auth-session |
| **Cron Trigger** | fraud-monitor (6h), vitals-monitor (15min), supply-chain (5min), premium-adjuster (monthly), medical-historian |
| **EVM Read** | All workflows except auth-session |
| **EVM Write** | All workflows except auth-session |
| **Confidential HTTP** | claim-adjudicator, emergency-access, trial-matcher, record-upload, consent, medical-historian, vitals-monitor, irb-agent, key-rotation, data-marketplace |
| **Standard HTTP** | claim-adjudicator, trial-matcher, fraud-monitor, worldid, crosschain, insurance-claim, medical-historian, vitals-monitor, irb-agent, premium-adjuster, supply-chain, auth-session |
| **BFT Consensus** | claim-adjudicator, irb-agent |
| **Secrets** | All workflows |

---

## File Structure

Each workflow directory contains three files:

```
workflow-name/
├── main.ts                 # Workflow handler — imports from @chainlink/cre-sdk,
│                           # defines Config interface, trigger payload types,
│                           # response types, and the handler function
├── workflow.yaml           # CRE workflow definition — declares trigger type,
│                           # capabilities, and handler entry point
└── config.staging.json     # Staging config — contract addresses (Tenderly VNet),
                            # API endpoints (mediCaRE backend), gas limits, thresholds
```

Top-level files:

| File | Purpose |
|------|---------|
| `project.yaml` | CRE project manifest — RPC endpoints for Sepolia, OP Sepolia, and Base Sepolia; simulator config; workflow owner address |
| `secrets.yaml` | Maps secret names used in workflow code to environment variables — IPFS gateway token, AI API keys, World ID app/action IDs, IoT oracle key, CCIP bridge key, backend auth token |
| `.env.example` | Template for local `.env` with all required secret values |

---

## Smart Contracts Referenced

All workflows interact with these contracts deployed on Tenderly Virtual TestNet (chain ID `99911155111`):

| Contract | Address | Workflows |
|----------|---------|-----------|
| EHRStorage | `0xd3269fe5e7C03B505bB73d5B3ec5655B72DeFE00` | record-upload, consent, emergency-access, medical-historian, vitals-monitor, key-rotation |
| InsurancePolicy | `0x960C6b7bA344ed26EFe7CeB9D878E11a465977d1` | claim-adjudicator, insurance-claim, fraud-monitor, premium-adjuster, crosschain |
| SupplyChain | `0xC69B9c117bA7207ae7c28796718e950fD2eE3507` | supply-chain |
| CredentialRegistry | `0x57Df5458eDC1Cc1eD6F08D7eC3e3f9b170448a9A` | worldid, consent, auth-session |
| Governance | `0xB5095Ecbf55E739395e346A6ebEA1701D47d5556` | trial-matcher, irb-agent, data-marketplace |
| MockStablecoin | `0x7Cf6cb620c2617887DC0Df5Faf8b14A984404f98` | crosschain, fraud-monitor |
