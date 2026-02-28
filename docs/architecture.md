# mediCaRE — Architecture Documentation

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-25  
> **Status:** Convergence Hackathon Submission

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Design Philosophy](#design-philosophy)
3. [Architecture Diagram](#architecture-diagram)
4. [Layer-by-Layer Description](#layer-by-layer-description)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Security Architecture](#security-architecture)
7. [Deployment Architecture](#deployment-architecture)
8. [Technology Justification](#technology-justification)

---

## System Overview

mediCaRE is a decentralized healthcare platform that combines AI, blockchain, and Chainlink's oracle infrastructure to deliver secure, interoperable services for hospitals, patients, insurers, and pharmaceutical supply-chain participants. The platform is built as a modular, multi-layer system where each layer has clearly defined responsibilities and interacts with adjacent layers through well-defined interfaces.

The platform provides five core capabilities:

| Capability | Description |
|---|---|
| **EHR Management** | Encrypted off-chain storage (IPFS) with on-chain access control and AI-powered summarization |
| **Insurance Automation** | NFT-based policy lifecycle with AI risk scoring and automated claims processing |
| **Supply-Chain Tracking** | ERC-1155 pharmaceutical batch tracking with IoT condition monitoring and counterfeit detection |
| **Credential Verification** | On-chain registry of healthcare provider verifiable credentials |
| **DAO Governance** | Token-weighted voting for protocol parameters, risk thresholds, and data-sharing agreements |

---

## Design Philosophy

mediCaRE's architecture is guided by the following principles:

1. **Patient Sovereignty** — Patients own their health data and explicitly grant/revoke access to providers. No party can access records without on-chain consent.

2. **Privacy by Design** — Medical data never touches the blockchain. Only cryptographic hashes (IPFS CID hashes, AI summary hashes) are stored on-chain. Sensitive off-chain operations use Chainlink Confidential HTTP and Confidential Compute.

3. **Composable Modules** — Each smart contract (EHR, Insurance, Supply Chain, Credentials, Governance) is independently deployable and upgradeable via governance, yet interconnected through CRE orchestration workflows.

4. **AI-Augmented, Human-Verified** — AI models generate summaries, risk scores, and anomaly alerts, but clinical decisions remain with human practitioners. AI outputs carry confidence scores and flagged items for review.

5. **Cross-Chain Ready** — CCIP integration enables multi-hospital consortiums across different EVM networks, with atomic cross-chain settlement for insurance payouts.

6. **Fail-Open Development, Fail-Closed Production** — World ID verification is optional during testnet development (fail-open) but enforced in production deployments.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         USER & IDENTITY LAYER                                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐   │
│  │ Patients │  │  Providers   │  │    Insurers      │  │  Manufacturers │   │
│  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘  └───────┬────────┘   │
│       │               │                   │                     │            │
│  ┌────▼───────────────▼───────────────────▼─────────────────────▼────────┐   │
│  │                    World ID  ·  DIDs  ·  Verifiable Credentials       │   │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────────────┐
│                           FRONTEND LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Next.js 15 + React 19  ·  thirdweb SDK  ·  TailwindCSS               │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐   │ │
│  │  │ Records  │ │Insurance │ │Supply     │ │Credentials│ │Governance│   │ │
│  │  │ Dashboard│ │ Portal   │ │Chain Track│ │ Viewer    │ │  Voting  │   │ │
│  │  └──────────┘ └──────────┘ └───────────┘ └───────────┘ └──────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │  REST API (JWT Auth)
┌──────────────────────────────────▼───────────────────────────────────────────┐
│                       BACKEND SERVICES LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  Express.js Server  ·  Helmet  ·  CORS  ·  Rate Limiting           │    │
│  │                                                                      │    │
│  │  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐            │    │
│  │  │ AI      │  │ IPFS      │  │ FHIR     │  │ World ID │            │    │
│  │  │ Modules │  │ Service   │  │ Adapter  │  │ Verifier │            │    │
│  │  │         │  │ (Pinata)  │  │ (HL7)    │  │          │            │    │
│  │  ├─────────┤  └───────────┘  └──────────┘  └──────────┘            │    │
│  │  │Summarize│                                                        │    │
│  │  │Risk     │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │Anomaly  │  │  Blockchain Service (ethers.js → EVM contracts) │  │    │
│  │  └─────────┘  └──────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────────────┐
│                     CRE ORCHESTRATION LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  Chainlink Runtime Environment (CRE)                                │    │
│  │                                                                      │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │    │
│  │  │ record-upload   │  │ consent         │  │ insurance-claim │     │    │
│  │  │ (AI Summary)    │  │ (Access Verify) │  │ (Risk + Payout) │     │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │    │
│  │  │ supply-chain    │  │ crosschain      │  │ worldid         │     │    │
│  │  │ (IoT Monitor)   │  │ (CCIP Bridge)   │  │ (ID Verify)     │     │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │    │
│  │                                                                      │    │
│  │  Capabilities: HTTP Trigger · Confidential HTTP · EVM Read/Write    │    │
│  │                 Secrets · Report Generation · Cache · BFT Consensus │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────────────┐
│                       SMART CONTRACT LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  EVM-Compatible Chains (Sepolia, Amoy)                              │    │
│  │                                                                      │    │
│  │  ┌────────────────┐   ┌──────────────────┐   ┌──────────────────┐   │    │
│  │  │ EHRStorage.sol │──▶│InsurancePolicy.sol│──▶│  Governance.sol  │   │    │
│  │  │ (Records, ACL) │   │  (ERC-721 NFT)   │   │ (DAO Voting)     │   │    │
│  │  └────────────────┘   └──────────────────┘   └──────────────────┘   │    │
│  │  ┌──────────────────┐ ┌──────────────────┐   ┌──────────────────┐   │    │
│  │  │SupplyChain.sol  │ │CredentialReg.sol │   │AccessManager.sol │   │    │
│  │  │ (ERC-1155 Batch)│ │ (Verifiable Cred)│   │  (World ID)      │   │    │
│  │  └──────────────────┘ └──────────────────┘   └──────────────────┘   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────────────┐
│                     CROSS-CHAIN & STORAGE LAYER                              │
│  ┌──────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐    │
│  │ Chainlink CCIP       │  │ IPFS / Pinata       │  │ Confidential     │    │
│  │ (Token & Message     │  │ (Encrypted EHRs,    │  │ Compute          │    │
│  │  Bridging)           │  │  Metadata, Models)  │  │ (Risk Scoring,   │    │
│  │ Sepolia ↔ Amoy       │  │                     │  │  Private Claims) │    │
│  └──────────────────────┘  └─────────────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer-by-Layer Description

### a. User & Identity Layer

| Component | Technology | Purpose |
|---|---|---|
| **World ID** | WorldCoin IDKit | Zero-knowledge proof-of-personhood — ensures each participant is a unique human without revealing personal data |
| **Decentralized Identifiers (DIDs)** | W3C DID Standard | Self-sovereign identity for patients and providers; enables selective disclosure of attributes |
| **Verifiable Credentials** | On-chain hashes (CredentialRegistry.sol) | Medical licenses, board certifications, DEA registrations, and specialty credentials stored as tamper-proof on-chain references |

**User Roles:**

| Role | Permissions |
|---|---|
| Patient | Upload records, grant/revoke access, submit claims, view summaries, vote in governance |
| Provider | Create records (with patient consent), view records (with access), request AI summaries |
| Insurer | Create policies, process claims, adjust premiums, view risk scores |
| Manufacturer | Create pharmaceutical batches, transfer custody, log IoT conditions |
| Distributor | Receive/transfer batches, log environmental conditions |
| Pharmacy | Receive delivered batches, verify authenticity |

### b. Frontend Layer

| Feature | Technology |
|---|---|
| **Framework** | Next.js 15 with React 19 (App Router, React Compiler) |
| **Wallet Connectivity** | thirdweb SDK with account abstraction |
| **Styling** | TailwindCSS with dark mode support |
| **State Management** | React hooks + SWR for data fetching |
| **API Client** | Axios with typed service wrappers |

**Dashboards:**

- **Health Records** — Upload EHRs, view AI summaries, manage provider access controls
- **Insurance Portal** — View policies, submit claims, track claim status, see risk assessments
- **Supply Chain Tracker** — Create batches, view transfer history, verify authenticity, monitor conditions
- **Credentials Viewer** — View issued credentials, check validity, verify provider qualifications
- **Governance** — Create proposals, cast votes, view proposal status and execution history

### c. Backend Services Layer

The backend is an Express.js server (Node.js/TypeScript) that acts as the middleware between the frontend and blockchain/off-chain services.

**Core Infrastructure:**

| Component | Purpose |
|---|---|
| **Express.js** | HTTP server with 6 route modules |
| **Helmet** | HTTP security headers |
| **CORS** | Cross-origin resource sharing configuration |
| **Morgan + Winston** | Structured HTTP/application logging |
| **Compression** | gzip response compression |
| **Rate Limiting** | Per-endpoint throttling (100 req/15min global, 10 req/min AI endpoints, 20 req/15min auth) |

**AI Modules:**

| Module | Description |
|---|---|
| `summarizer.ts` | GPT-4o-mini powered EHR summarization — extracts diagnoses, medications, allergies, procedures, and red flags into structured JSON; supports multi-language output via ISO 639-1 codes |
| `risk.ts` | Logistic regression risk model — weights 10 health features (age, BMI, chronic conditions, medications, prior claims, smoking, exercise, BP, glucose, cholesterol) to produce a 0–100 risk score with factor breakdown |
| `anomaly.ts` | Time-series anomaly detection — analyses vital sign readings (heart rate, blood pressure, glucose, SpO₂, temperature) using Z-score thresholds with configurable sensitivity |

**Integration Services:**

| Service | Purpose |
|---|---|
| `ipfs.ts` | Upload/download encrypted files to IPFS via Pinata API |
| `fhir.ts` | HL7 FHIR R4 interoperability — convert between EHR formats and FHIR resources |
| `worldid.ts` | World ID zero-knowledge proof verification via WorldCoin API |
| `blockchain.ts` | ethers.js contract abstraction — typed wrappers for all 5 contracts |
| `crypto.ts` | AES-256-GCM encryption/decryption for medical data at rest |

### d. CRE Orchestration Layer

The Chainlink Runtime Environment (CRE) provides decentralized, trust-minimized orchestration for multi-step operations that span off-chain services and on-chain contracts.

#### Workflow 1: Record Upload & AI Summarization

| Property | Value |
|---|---|
| **Trigger** | HTTP (from backend after EHR upload) |
| **Capabilities** | Confidential HTTP, Standard HTTP, EVM Write, Secrets |
| **Flow** | Receive upload notification → Fetch encrypted EHR from IPFS (Confidential HTTP) → Send to AI summarizer → Hash summary → Write summary hash on-chain to EHRStorage.sol |
| **Security** | IPFS gateway tokens never leave secure enclave; AI response uses BFT consensus across nodes |

#### Workflow 2: Consent Enforcement

| Property | Value |
|---|---|
| **Trigger** | HTTP (from backend on record access request) |
| **Capabilities** | EVM Read, Confidential HTTP, Secrets |
| **Flow** | Verify on-chain patient consent → Check provider credentials in CredentialRegistry → Verify World ID proof → Return decrypted record via Confidential HTTP |
| **Security** | Three-factor access control: consent + credential + identity |

#### Workflow 3: Insurance Claim Processing

| Property | Value |
|---|---|
| **Trigger** | HTTP (from backend on claim submission) |
| **Capabilities** | EVM Read/Write, Confidential Compute, Secrets |
| **Flow** | Retrieve medical data for claim → Run risk scoring in Confidential Compute → Determine approval/rejection → Update InsurancePolicy.sol claim status → Trigger stablecoin payout if approved |
| **Security** | Claim assessment data processed in Confidential Compute; intermediate medical data never exposed |

#### Workflow 4: Supply Chain Monitoring

| Property | Value |
|---|---|
| **Trigger** | Scheduled / Event-driven (IoT data feed) |
| **Capabilities** | Standard HTTP, EVM Read/Write |
| **Flow** | Poll IoT sensor data (temperature, humidity, GPS) → Validate against thresholds → If anomaly detected, flag batch in SupplyChain.sol → Optionally initiate recall |
| **Security** | IoT data hashed before on-chain storage to minimize gas and protect proprietary logistics data |

#### Workflow 5: Cross-Chain Settlement

| Property | Value |
|---|---|
| **Trigger** | HTTP (from backend on cross-chain payout request) |
| **Capabilities** | EVM Read/Write, CCIP Bridge |
| **Flow** | Verify payout authorization on source chain → Initiate CCIP token transfer (Sepolia ↔ Amoy) → Confirm delivery on destination chain → Log settlement in Governance.sol |
| **Security** | CCIP provides message-level security with multi-layer validation; atomic execution ensures no partial settlements |

#### Workflow 6: World ID Verification

| Property | Value |
|---|---|
| **Trigger** | HTTP (from backend on identity verification request) |
| **Capabilities** | Standard HTTP, EVM Write |
| **Flow** | Receive World ID proof → Verify proof against WorldCoin API → Write attestation to CredentialRegistry.sol → Return verification status |
| **Security** | Zero-knowledge proofs ensure no personal data is disclosed; nullifier hash prevents double-registration |

### e. Smart Contract Layer

All contracts are written in Solidity ^0.8.24 and inherit from OpenZeppelin's battle-tested libraries.

#### EHRStorage.sol

| Property | Value |
|---|---|
| **Token Standard** | None (data registry) |
| **Inheritance** | AccessControl, AccessManager |
| **Roles** | ADMIN_ROLE, PROVIDER_ROLE |
| **Key State** | Records (IPFS CID hash + AI summary hash), per-patient record IDs, patient→provider access permissions |
| **Core Functions** | `addRecord()`, `updateRecord()`, `grantAccess()`, `revokeAccess()`, `deactivateRecord()` |
| **Access Model** | Two-tier: Role-based (OpenZeppelin) + Patient-level consent |

#### InsurancePolicy.sol

| Property | Value |
|---|---|
| **Token Standard** | ERC-721 (each policy = one NFT) |
| **Inheritance** | ERC721, AccessControl, ReentrancyGuard, AccessManager |
| **Roles** | ADMIN_ROLE, CLAIMS_PROCESSOR_ROLE |
| **Financial** | ERC-20 stablecoin (USDC) for premiums and payouts via SafeERC20 |
| **Claims State Machine** | Pending → Approved → Paid \| Pending → Rejected |
| **Core Functions** | `createPolicy()`, `renewPolicy()`, `submitClaim()`, `processClaim()`, `payClaim()`, `adjustPremium()` |
| **Risk Integration** | `adjustPremium()` accepts risk scores (0–10,000 bps) from CRE/AI pipeline |

#### SupplyChain.sol

| Property | Value |
|---|---|
| **Token Standard** | ERC-1155 (one token ID per batch, supply = unit count) |
| **Inheritance** | ERC1155, AccessControl, ReentrancyGuard, AccessManager |
| **Roles** | ADMIN_ROLE, MANUFACTURER_ROLE, DISTRIBUTOR_ROLE, PHARMACY_ROLE |
| **Batch Status Machine** | Created → InTransit → Delivered \| Created → Flagged → Recalled |
| **IoT Integration** | `updateConditions()` stores hashed temperature, humidity, GPS readings |
| **Core Functions** | `createBatch()`, `transferBatch()`, `updateConditions()`, `flagBatch()`, `recallBatch()` |
| **Auto-Status** | Status automatically advances based on receiver's role during `transferBatch()` |

#### CredentialRegistry.sol

| Property | Value |
|---|---|
| **Token Standard** | None (credential registry) |
| **Inheritance** | AccessControl, AccessManager |
| **Roles** | ADMIN_ROLE, ISSUER_ROLE |
| **Credential Types** | LICENSE, BOARD_CERT, SPECIALTY, DEA, NPI, CME, FELLOWSHIP, OTHER |
| **Core Functions** | `issueCredential()`, `revokeCredential()`, `renewCredential()`, `verifyCredential()` |
| **Duplicate Prevention** | Hash→ID reverse mapping prevents duplicate credential issuance |

#### Governance.sol

| Property | Value |
|---|---|
| **Voting Model** | Token-weighted (ERC-20 balance at vote time) |
| **Inheritance** | AccessControl, ReentrancyGuard |
| **Roles** | ADMIN_ROLE, EXECUTOR_ROLE |
| **Proposal Types** | PARAMETER_CHANGE, RISK_THRESHOLD, DATA_SHARING, PROTOCOL_UPGRADE |
| **Proposal Lifecycle** | Active → Succeeded → Executed \| Active → Defeated \| Active → Cancelled |
| **Timelock** | Configurable delay between vote close and execution |
| **Core Functions** | `createProposal()`, `vote()`, `executeProposal()`, `cancelProposal()`, `updateParameters()` |

#### Contract Interactions

```
┌──────────────────┐         ┌──────────────────┐
│   Governance.sol │────────▶│ InsurancePolicy   │  (parameter changes, risk thresholds)
│   (DAO Voting)   │────────▶│ EHRStorage        │  (data sharing policies)
│                  │────────▶│ SupplyChain       │  (protocol upgrades)
│                  │────────▶│ CredentialRegistry│  (issuer management)
└──────────────────┘         └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│  EHRStorage.sol  │◀───────▶│CredentialReg.sol │  (provider credential checks)
│  (Patient Data)  │         │ (Provider Creds) │
└──────────────────┘         └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│InsurancePolicy   │◀────────│  EHRStorage.sol  │  (medical data for claims)
│  (Claims)        │         │ (Health Records) │
└──────────────────┘         └──────────────────┘

                   ┌──────────────────┐
                   │ AccessManager.sol│  (inherited by EHRStorage,
                   │ (World ID Gate)  │   InsurancePolicy, SupplyChain,
                   └──────────────────┘   CredentialRegistry)
```

### f. Cross-Chain Layer

| Component | Technology | Purpose |
|---|---|---|
| **Protocol** | Chainlink CCIP (Cross-Chain Interoperability Protocol) | Secure cross-chain token transfers and arbitrary messaging |
| **Source Chain** | Ethereum Sepolia | Primary deployment for EHR, Insurance, Governance |
| **Destination Chain** | Polygon Amoy | Secondary deployment for Supply Chain, Credentials |
| **Token Bridging** | CCIP token pools | Insurance payout settlement across chains |
| **Message Passing** | CCIP arbitrary messaging | Cross-chain governance execution and state synchronization |
| **Finality** | Chain-specific (see CCIP Execution Latency docs) | Confirmation timing varies by source chain |
| **Billing** | LINK or native gas token | CCIP fees paid per message |

### g. Storage & Privacy Layer

| Component | Technology | Purpose |
|---|---|---|
| **Document Storage** | IPFS via Pinata | Encrypted EHRs, supply-chain metadata, AI model outputs |
| **Encryption at Rest** | AES-256-GCM | All medical documents encrypted before IPFS upload |
| **Encryption Keys** | Per-patient key derivation | Each patient's records use unique encryption keys |
| **Confidential HTTP** | CRE Confidential HTTP | API keys and sensitive request parameters never leave secure enclave |
| **Confidential Compute** | CRE Confidential Compute | Risk scoring and claim assessments run in TEE; intermediate data destroyed after computation |
| **On-Chain Hashes** | Keccak-256 | Only hashes stored on-chain — IPFS CID hashes, AI summary hashes, credential document hashes |

---

## Data Flow Diagrams

### a. EHR Upload & Summarization Flow

```
Patient/Provider                Backend              IPFS           CRE Workflow          EHRStorage.sol
      │                           │                    │                 │                      │
      │  1. Upload EHR file       │                    │                 │                      │
      │──────────────────────────▶│                    │                 │                      │
      │                           │                    │                 │                      │
      │                           │  2. Encrypt file   │                 │                      │
      │                           │  (AES-256-GCM)     │                 │                      │
      │                           │                    │                 │                      │
      │                           │  3. Upload to IPFS │                 │                      │
      │                           │───────────────────▶│                 │                      │
      │                           │◀──── CID ─────────│                 │                      │
      │                           │                    │                 │                      │
      │                           │  4. Register on-chain (CID hash)    │                      │
      │                           │─────────────────────────────────────────────────────────────▶│
      │                           │◀──────────────── recordId ─────────────────────────────────│
      │                           │                    │                 │                      │
      │                           │  5. Trigger CRE workflow            │                      │
      │                           │────────────────────────────────────▶│                      │
      │                           │                    │                 │                      │
      │                           │                    │  6. Fetch EHR   │                      │
      │                           │                    │◀────(Confid.)──│                      │
      │                           │                    │──── data ──────▶│                      │
      │                           │                    │                 │                      │
      │                           │                    │  7. Call AI     │                      │
      │                           │                    │  Summarizer     │                      │
      │                           │                    │     │◀─────────│                      │
      │                           │                    │     │─summary──▶│                      │
      │                           │                    │                 │                      │
      │                           │                    │                 │ 8. Write summary hash│
      │                           │                    │                 │─────────────────────▶│
      │                           │                    │                 │                      │
      │  9. Return result         │                    │                 │                      │
      │◀──────────────────────────│                    │                 │                      │
```

### b. Insurance Claim Processing Flow

```
Patient          Backend         InsurancePolicy.sol     CRE Workflow      AI Risk Engine
   │                │                    │                     │                │
   │ 1. Submit      │                    │                     │                │
   │    claim       │                    │                     │                │
   │───────────────▶│                    │                     │                │
   │                │                    │                     │                │
   │                │ 2. Register claim  │                     │                │
   │                │───────────────────▶│                     │                │
   │                │◀─── claimId ──────│                     │                │
   │                │                    │                     │                │
   │                │ 3. Trigger CRE     │                     │                │
   │                │───────────────────────────────────────▶ │                │
   │                │                    │                     │                │
   │                │                    │  4. Fetch medical   │                │
   │                │                    │◀──── data ─────────│                │
   │                │                    │                     │                │
   │                │                    │     5. Risk scoring │                │
   │                │                    │     (Confidential   │                │
   │                │                    │      Compute)       │───────────────▶│
   │                │                    │                     │◀── score ──────│
   │                │                    │                     │                │
   │                │                    │  6. Process claim   │                │
   │                │                    │◀──── (approve/      │                │
   │                │                    │       reject) ──────│                │
   │                │                    │                     │                │
   │                │                    │  7. If approved:    │                │
   │                │                    │     transfer        │                │
   │                │                    │     stablecoin      │                │
   │                │                    │     payout          │                │
   │                │                    │                     │                │
   │ 8. Claim       │                    │                     │                │
   │    result      │                    │                     │                │
   │◀───────────────│                    │                     │                │
```

### c. Supply Chain Verification Flow

```
Pharmacy         Backend         SupplyChain.sol     CRE Workflow       IoT Sensors
   │                │                  │                   │                 │
   │ 1. Verify      │                  │                   │                 │
   │    batch       │                  │                   │                 │
   │───────────────▶│                  │                   │                 │
   │                │                  │                   │                 │
   │                │ 2. Query batch   │                   │                 │
   │                │─────────────────▶│                   │                 │
   │                │◀── batch data ──│                   │                 │
   │                │                  │                   │                 │
   │                │ 3. Compare lot   │                   │                 │
   │                │    hash (verify  │                   │                 │
   │                │    authenticity) │                   │                 │
   │                │                  │                   │                 │
   │                │ 4. Check status  │                   │                 │
   │                │    flags and     │                   │                 │
   │                │    conditions    │                   │                 │
   │                │                  │                   │                 │
   │ 5. Verification│                  │                   │                 │
   │    result      │                  │                   │                 │
   │◀───────────────│                  │                   │                 │
   │                │                  │                   │                 │
   │                │ ╌╌╌ Background (CRE Workflow) ╌╌╌╌╌╌│                 │
   │                │                  │                   │ 6. Poll IoT     │
   │                │                  │                   │    sensors      │
   │                │                  │                   │◀────────────────│
   │                │                  │                   │                 │
   │                │                  │ 7. If anomaly:    │                 │
   │                │                  │    flag batch     │                 │
   │                │                  │◀──────────────────│                 │
   │                │                  │                   │                 │
```

---

## Security Architecture

### Encryption

| Layer | Method | Scope |
|---|---|---|
| Data at Rest | AES-256-GCM | Medical documents on IPFS |
| Data in Transit | TLS 1.3 / HTTPS | All API communications |
| On-Chain Privacy | Keccak-256 Hashing | Only hashes stored on-chain; no plaintext medical data |
| Key Management | Per-patient key derivation | Unique encryption keys per patient |
| Secrets | CRE Secrets | API keys stored in encrypted CRE secret store; never exposed in workflow code |

### Access Control

| Contract | Mechanism | Description |
|---|---|---|
| EHRStorage | Role-based + Patient consent | Providers need PROVIDER_ROLE AND patient's explicit `grantAccess()` |
| InsurancePolicy | Role-based | ADMIN creates policies; CLAIMS_PROCESSOR processes claims |
| SupplyChain | Multi-role | MANUFACTURER creates; DISTRIBUTOR/PHARMACY receive; ADMIN recalls |
| CredentialRegistry | Issuer-based | Only ISSUER_ROLE can issue; only issuer or ADMIN can revoke |
| Governance | Token-weighted | Proposal creation requires minimum token balance; execution requires EXECUTOR_ROLE |

### World ID Integration

The `AccessManager.sol` abstract contract is inherited by EHRStorage, InsurancePolicy, SupplyChain, and CredentialRegistry. It provides:

- **`onlyVerifiedIdentity` modifier** — gates sensitive functions behind World ID proof-of-personhood
- **Fail-open development mode** — when `worldIdVerifier` is `address(0)`, the check passes (testnet convenience)
- **Fail-closed production mode** — when a verifier is configured, unverified callers are rejected with `IdentityNotVerified`
- **`IWorldIDVerifier` interface** — defines `isVerified(address)` and `verify(address, root, nullifierHash, proof)`

### Confidential Compute

| Operation | Why Confidential | Outcome |
|---|---|---|
| EHR Fetch from IPFS | Medical data is sensitive PII/PHI | IPFS gateway token and record content stay within TEE |
| Risk Score Computation | Insurance claim details are private | Score is returned; input data destroyed after computation |
| Claim Assessment | Assessment logic proprietary | Decision recorded on-chain; assessment details private |

---

## Deployment Architecture

### Testnet Configuration

| Network | Chain ID | Purpose | Contracts Deployed |
|---|---|---|---|
| Ethereum Sepolia | 11155111 | Primary testnet | All 5 contracts + MockStablecoin |
| Polygon Amoy | 80002 | Secondary testnet (CCIP destination) | SupplyChain, CredentialRegistry (cross-chain targets) |
| Hardhat Local | 31337 | Development and unit testing | All contracts |

### Tenderly Virtual TestNets

mediCaRE uses Tenderly Virtual TestNets (VTNs) for:

- **Deterministic testing** — Fork from specific block numbers for reproducible test scenarios
- **Cross-chain simulation** — Test CCIP flows between virtual Sepolia and Amoy forks
- **Transaction replay** — Inspect full transaction traces, state diffs, and gas consumption
- **CI/CD integration** — Automated deployment verification before promoting to public testnets

### Deployment Artifacts

Deployment scripts output contract addresses to `contracts/deployments/<network>.json`:

```json
{
  "network": "sepolia",
  "chainId": 11155111,
  "deployer": "0x...",
  "deployedAt": "2026-02-25T15:00:00.000Z",
  "contracts": {
    "MockStablecoin": "0x...",
    "EHRStorage": "0x...",
    "InsurancePolicy": "0x...",
    "SupplyChain": "0x...",
    "CredentialRegistry": "0x...",
    "Governance": "0x..."
  }
}
```

---

## Technology Justification

### Why Chainlink CRE?

| Requirement | CRE Capability | Alternative Considered | Why CRE Wins |
|---|---|---|---|
| Fetch medical data from IPFS without exposing API keys | Confidential HTTP | Custom HSM + proxy | CRE provides decentralized key management with no single-point-of-failure |
| Run risk scoring without exposing patient data | Confidential Compute | Off-chain server + attestation | CRE's TEE guarantees verifiable execution without trusting a single party |
| Coordinate multi-step workflows (fetch → process → write) | Workflow orchestration | Chainlink Automation + Functions | CRE natively chains capabilities with typed state passing and BFT consensus |
| Write AI results on-chain with cryptographic proof | EVM Write + Report Generation | Custom oracle | CRE's KeystoneForwarder provides signed, verifiable reports |

### Why Chainlink CCIP?

| Requirement | Why CCIP |
|---|---|
| Multi-hospital consortium across chains | CCIP provides secure, auditable cross-chain messaging with rate limiting and manual execution fallback |
| Insurance payout settlement | Token transfer with programmable hooks ensures atomic, all-or-nothing settlement |
| Governance across chains | Arbitrary messaging enables cross-chain proposal execution |

### Why Chainlink Data Feeds? (Optional Integration)

| Use Case | Data Feed |
|---|---|
| Stablecoin pricing for premium calculations | ETH/USD, MATIC/USD price feeds |
| Supply-chain environmental validation | IoT data aggregation via External Adapters |

---

*This document is part of the mediCaRE project documentation suite. See also: [API Documentation](api.md) · [Governance Documentation](governance.md)*
