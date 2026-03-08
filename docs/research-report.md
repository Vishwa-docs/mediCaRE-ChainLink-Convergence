# mediCaRE — Technical Research Report

> Full codebase analysis covering backend, frontend, smart contracts, CRE workflows, tests, and infrastructure.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Backend Architecture](#2-backend-architecture)
3. [Smart Contracts](#3-smart-contracts)
4. [Frontend Architecture](#4-frontend-architecture)
5. [CRE Workflows](#5-cre-workflows)
6. [Test Coverage](#6-test-coverage)
7. [AI and ML Integration](#7-ai-and-ml-integration)
8. [Blockchain Integration](#8-blockchain-integration)
9. [External Dependencies](#9-external-dependencies)

---

## 1. Project Overview

mediCaRE is a decentralized healthcare platform built for the Chainlink Convergence Hackathon. It combines AI, blockchain, and Chainlink's oracle infrastructure (CRE, CCIP) to deliver five core capabilities:

| Capability | Contract | Token Standard |
|---|---|---|
| EHR Management | `EHRStorage.sol` | Data registry |
| Insurance Automation | `InsurancePolicy.sol` | ERC-721 (policy = NFT) |
| Supply-Chain Tracking | `SupplyChain.sol` | ERC-1155 (batch = token) |
| Credential Verification | `CredentialRegistry.sol` | Credential registry |
| DAO Governance | `Governance.sol` | Uses ERC-20 governance token |

### Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 16.1.6, React 19, thirdweb SDK v5, TailwindCSS v4, Recharts |
| Backend | Express.js, TypeScript, ethers.js v6, Zod, JWT, Winston |
| Contracts | Solidity 0.8.28, Hardhat, OpenZeppelin v5.6.1 |
| AI | Azure OpenAI (GPT-4o), logistic regression risk scoring, Z-score anomaly detection |
| Storage | IPFS via Pinata, AES-256-GCM encryption |
| Identity | World ID (IDKit v4), Verifiable Credentials |
| Healthcare | FHIR R4 (HL7), hapi.fhir.org public server |
| Database | Supabase (PostgreSQL) |

### Deployed Contract Addresses (Tenderly VNet)

| Contract | Address |
|---|---|
| MockStablecoin | `0x7Cf6cb620c2617887DC0Df5Faf8b14A984404f98` |
| EHRStorage | `0xd3269fe5e7C03B505bB73d5B3ec5655B72DeFE00` |
| InsurancePolicy | `0x960C6b7bA344ed26EFe7CeB9D878E11a465977d1` |
| SupplyChain | `0xC69B9c117bA7207ae7c28796718e950fD2eE3507` |
| CredentialRegistry | `0x57Df5458eDC1Cc1eD6F08D7eC3e3f9b170448a9A` |
| Governance | `0xB5095Ecbf55E739395e346A6ebEA1701D47d5556` |

---

## 2. Backend Architecture

### Directory Layout

```
backend/src/
├── server.ts              — Express app (helmet, cors, compression, morgan, rate limiting)
├── ai/
│   ├── summarizer.ts      — LLM call to OpenAI-compatible API
│   ├── risk.ts            — Local logistic regression (no external API)
│   └── anomaly.ts         — Local Z-score anomaly detection
├── config/
│   └── index.ts           — Centralized config from env vars
├── middleware/
│   ├── auth.ts            — JWT authentication + role-based authorise()
│   ├── errorHandler.ts    — Global error handler + 404 handler
│   └── rateLimiter.ts     — Three tiers: api (100/15min), auth (20/15min), ai (10/1min)
├── routes/
│   ├── index.ts           — Router mounting
│   ├── ai.routes.ts       — POST /summarize, /risk-score, /anomaly-detect
│   ├── auth.routes.ts     — Login, register, World ID verify/sign-request
│   ├── ehr.routes.ts      — POST /upload, GET /:patientAddress, POST /summarize
│   ├── insurance.routes.ts
│   ├── supply.routes.ts
│   ├── credential.routes.ts
│   └── health.routes.ts   — GET /health (blockchain status, block number)
├── services/
│   ├── blockchain.ts      — ethers.js v6 (5 contract instances)
│   ├── ipfs.ts            — Pinata API (upload, download, unpin)
│   ├── fhir.ts            — FHIR R4 client (hapi.fhir.org)
│   ├── worldid.ts         — World ID verification API
│   ├── oracle.ts          — IoT sensor data processing
│   ├── notifications.ts   — Webhook channel (email stubbed for production)
│   └── analytics.ts       — In-memory event store (production: ClickHouse/BigQuery)
├── types/
│   └── index.ts           — TypeScript type definitions
└── utils/
    ├── crypto.ts           — AES-256 encrypt/decrypt, sha256, keccak256
    ├── logging.ts          — Winston logger (dev: colorized, prod: JSON)
    └── validators.ts       — 11 Zod schemas for API input validation
```

### Service Details

| Service | External API | Description |
|---|---|---|
| `summarizer.ts` | OpenAI API | Chat completions with structured JSON output. 3 retries with exponential backoff. |
| `risk.ts` | None | Logistic regression with 10 feature weights. Output: 0-100 score mapped to LOW/MEDIUM/HIGH/CRITICAL. |
| `anomaly.ts` | None | Z-score analysis on vital sign time series (5 metrics). Severity: Z>=4 CRITICAL, Z>=3 ALERT, Z>=2 WARNING. |
| `blockchain.ts` | RPC node | ethers.js v6 singleton provider/signer. Factory functions for all 5 contracts. |
| `ipfs.ts` | Pinata | Upload: AES-256 encrypt then pin. Download: fetch then decrypt. Also: JSON metadata upload, unpin. |
| `fhir.ts` | hapi.fhir.org | getPatient, searchPatients, getConditions, getMedications, getObservations, getPatientBundle. |
| `worldid.ts` | Worldcoin API | Proof verification with action/signal validation. |
| `oracle.ts` | None | IoT sensor payload parsing, cold-chain threshold validation (WHO GDP: 2-8C, 30-75% humidity). |

---

## 3. Smart Contracts

All contracts are deployed on Tenderly Virtual Sepolia (chain ID `99911155111`).

### EHRStorage.sol (~330 lines)

- **Roles:** ADMIN_ROLE, PROVIDER_ROLE
- **Record struct:** recordId, patient, ipfsCidHash (bytes32), aiSummaryHash (bytes32), recordType (string), timestamps, isActive
- **Key functions:** `addRecord`, `updateRecord`, `grantAccess`/`revokeAccess` (patient-controlled), `deactivateRecord` (soft delete)
- **Events:** RecordCreated, RecordUpdated, AccessGranted, AccessRevoked, RecordDeactivated

### InsurancePolicy.sol (~505 lines)

- **Token:** ERC-721 (each policy = one NFT)
- **Financial:** ERC-20 stablecoin for premiums and payouts (SafeERC20)
- **Roles:** ADMIN_ROLE, CLAIMS_PROCESSOR_ROLE
- **Key functions:** createPolicy (mints NFT), renewPolicy, submitClaim, processClaim, payoutClaim, adjustPremium
- **Events:** PolicyCreated, PolicyRenewed, ClaimSubmitted, ClaimProcessed, ClaimPaid, PremiumAdjusted

### SupplyChain.sol (~491 lines)

- **Token:** ERC-1155 (one token ID per batch)
- **Roles:** ADMIN_ROLE, MANUFACTURER_ROLE, DISTRIBUTOR_ROLE, PHARMACY_ROLE
- **Auto-Status Logic:** Transfer to distributor sets InTransit; transfer to pharmacy sets Delivered
- **Key functions:** createBatch, transferBatch, updateConditions (IoT data hashes), flagBatch, recallBatch
- **Condition logging:** temperatureHash, humidityHash, gpsHash per checkpoint

### CredentialRegistry.sol (~340 lines)

- **Roles:** ADMIN_ROLE, ISSUER_ROLE
- **CredentialType enum:** LICENSE, BOARD_CERT, SPECIALTY, DEA, NPI, CME, FELLOWSHIP, OTHER
- **Key functions:** issueCredential, revokeCredential, renewCredential, verifyCredential (returns isValid + isExpired)
- **Duplicate Prevention:** Hash-to-ID reverse mapping prevents duplicate credential hashes

### Governance.sol (~474 lines)

- **Voting Model:** Token-weighted (ERC-20 balance at vote time, no delegation)
- **ProposalType:** PARAMETER_CHANGE, RISK_THRESHOLD, DATA_SHARING, PROTOCOL_UPGRADE
- **Lifecycle:** Active -> Succeeded -> Executed | Active -> Defeated | Active -> Cancelled
- **Configurable:** proposalThreshold, quorumVotes, votingPeriod, executionDelay (timelock)

### Supporting Contracts

| Contract | Purpose |
|---|---|
| `AccessManager.sol` | Abstract contract with `IWorldIDVerifier` interface and `onlyVerifiedIdentity` modifier. Fail-open when verifier is `address(0)` (dev mode). |
| `ReentrancyGuardCustom.sol` | Extended reentrancy guard with `ReentrancyBlocked` event for monitoring. |
| `DataTypes.sol` | Shared enums, structs, constants (MAX_RISK_SCORE = 10000, MIN_VOTING_DURATION = 1 day). |
| `MockStablecoin.sol` | ERC-20 ("Mock USDC") with public `mint()` for testing. |

---

## 4. Frontend Architecture

### Directory Layout

```
frontend/src/
├── app/
│   ├── page.tsx               — Landing page (hero, features, tech badges)
│   ├── layout.tsx             — Root layout (ThirdwebProvider, AuthGate, sidebar)
│   ├── login/page.tsx         — Login with 6 demo account cards
│   ├── dashboard/page.tsx     — Metrics overview + activity feed
│   ├── records/page.tsx       — RecordUploader + RecordList + SummaryViewer
│   ├── insurance/page.tsx     — Policy cards, claim form, adjudicator swarm
│   ├── supply-chain/page.tsx  — Batch tracker + timeline
│   ├── governance/page.tsx    — Proposal cards + voting
│   ├── credentials/page.tsx   — Credential management + World ID
│   ├── settings/page.tsx      — Wallet info, World ID IDKit widget
│   ├── analytics/page.tsx     — KPI dashboards + charts
│   ├── emergency/page.tsx     — Glass-break access + countdown
│   ├── research/page.tsx      — Trial matching pipeline
│   ├── treasury/page.tsx      — Reserve health + payout velocity
│   ├── audit-log/page.tsx     — On-chain event viewer
│   ├── contract-health/page.tsx — Live contract status
│   ├── visit-summary/page.tsx — AI visit summaries
│   ├── mini-app/page.tsx      — Mobile-first patient app
│   └── ai-models/page.tsx     — AI model information
├── components/
│   ├── dashboard/             — MetricsOverview, ActivityFeed
│   ├── records/               — RecordUploader, RecordList, SummaryViewer
│   ├── insurance/             — ClaimForm, PolicyCard, ClaimStatus, AdjudicatorSwarm
│   ├── governance/            — ProposalCard, VotePanel
│   ├── supply/                — BatchTracker, BatchTimeline
│   ├── layout/                — Sidebar, Header, Footer, GuidedTour
│   └── shared/                — Badge, Button, Card, Modal, StatCard, LoadingSpinner
├── contexts/
│   └── AuthContext.tsx        — JWT state, login/logout, role, World ID status
├── hooks/
│   ├── useApi.ts              — React hooks wrapping backend API calls
│   └── useContract.ts         — Contract interaction hooks via ethers BrowserProvider
├── lib/
│   ├── api.ts                 — Axios client for backend API
│   ├── contracts.ts           — Contract addresses + ABIs
│   └── thirdweb.ts            — thirdweb client configuration
└── types/
    └── index.ts               — Frontend type definitions
```

### Pages (18 routes)

| Page | Description |
|---|---|
| `/` | Landing page with feature overview and call-to-action |
| `/login` | 6 demo account quick-login cards + email/password form |
| `/dashboard` | On-chain metrics overview and activity feed |
| `/records` | EHR upload, list, AI summary viewer, access control |
| `/insurance` | NFT policies, claims, multi-agent adjudicator |
| `/supply-chain` | Pharmaceutical batch tracking with IoT data |
| `/governance` | Proposal creation and token-weighted voting |
| `/credentials` | Provider credentialing with World ID verification |
| `/settings` | Wallet info, World ID IDKit v4 widget, notifications |
| `/analytics` | KPI counts from contracts, claim breakdown charts |
| `/emergency` | Glass-break access with 15-minute countdown timer |
| `/research` | Clinical trial matching pipeline, consent management |
| `/treasury` | Reserve health gauge, payout velocity, anomaly alerts |
| `/audit-log` | On-chain event viewer across all 6 contracts |
| `/contract-health` | Live deployment status, bytecode size, entity counts |
| `/visit-summary` | AI-generated pre/post visit documentation |
| `/mini-app` | Mobile-first patient app (medications, records, reminders) |
| `/ai-models` | AI model documentation and capabilities |

---

## 5. CRE Workflows

mediCaRE uses 17 CRE workflows. Each workflow has `main.ts` (TypeScript handler), `workflow.yaml` (definition), and `config.staging.json` (contract addresses and API URLs).

### Workflow Details

#### Record Upload (`record-upload/`)
- **Trigger:** HTTP (called by backend after EHR upload to IPFS)
- **Capabilities:** Confidential HTTP, Standard HTTP, EVM Write, Secrets
- **Flow:** Parse upload notification -> Fetch encrypted EHR from IPFS via Confidential HTTP -> Call AI summarization -> Generate signed report -> Write summary hash on-chain to EHRStorage

#### Consent Enforcement (`consent/`)
- **Trigger:** HTTP (provider requests access to patient record)
- **Capabilities:** EVM Read, Confidential HTTP, EVM Write, Secrets
- **Flow:** Check on-chain consent -> Verify provider credentials -> Fetch record metadata -> Fetch encrypted record from IPFS -> Write access audit log on-chain
- **Three-factor access control:** consent + credential + identity

#### Claim Adjudicator (`claim-adjudicator/`)
- **Trigger:** EVM Log (ClaimSubmitted event)
- **Capabilities:** EVM Read/Write, Confidential Compute, Standard HTTP, Secrets
- **Flow:** Decode claim event -> Read claim/policy details -> 3-agent BFT swarm (TriageBot, CodingBot, FraudDetectorBot) -> Consensus -> Write adjudication with explainability hash on-chain

#### Insurance Claim (`insurance-claim/`)
- **Trigger:** EVM Log (ClaimSubmitted event)
- **Capabilities:** EVM Read/Write, Confidential HTTP, Standard HTTP, Secrets
- **Flow:** Decode event -> Read claim/policy -> Fetch medical evidence -> Risk scoring -> Auto-approve if confidence >= 0.85 -> Write decision + trigger payout on-chain

#### Supply Chain IoT Monitoring (`supply-chain/`)
- **Trigger:** Cron (every 5 minutes)
- **Capabilities:** Standard HTTP, EVM Read/Write, Secrets
- **Flow:** Fetch IoT readings -> Group by batch -> Evaluate cold-chain thresholds (2-8C, 35-65% humidity) -> Log condition hashes -> Flag/recall batches on breach

#### Cross-Chain Settlement (`crosschain/`)
- **Trigger:** EVM Log (ClaimPaid event)
- **Capabilities:** EVM Read/Write, Standard HTTP (CCIP bridge), Secrets
- **Flow:** Decode ClaimPaid event -> Initiate CCIP bridge -> Write settlement confirmation on source chain -> Write receipt on destination chain

#### World ID Verification (`worldid/`)
- **Trigger:** HTTP (user submits World ID proof)
- **Capabilities:** Standard HTTP, EVM Write, Secrets
- **Flow:** Parse request -> Retrieve secrets -> Verify against World ID API -> Compute credential hash -> Write attestation to CredentialRegistry on-chain

#### Emergency Access (`emergency-access/`)
- **Trigger:** HTTP (paramedic requests emergency access)
- **Capabilities:** EVM Read, Confidential HTTP, EVM Write, Secrets
- **Flow:** Verify paramedic role -> Bypass consent in TEE -> Fetch critical data -> 15-minute access window -> Write immutable audit trail

#### Trial Matcher (`trial-matcher/`)
- **Trigger:** HTTP (patient requests trial matching)
- **Capabilities:** EVM Read, Confidential HTTP, Confidential Compute, EVM Write
- **Flow:** Check consent -> Fetch patient data confidentially -> LLM eligibility evaluation in TEE -> Return boolean only -> Write match count on-chain

#### Fraud Monitor (`fraud-monitor/`)
- **Trigger:** Cron (every 6 hours)
- **Capabilities:** EVM Read/Write, Standard HTTP, Secrets
- **Flow:** Scan recent claims -> Graph-based anomaly detection -> Flag suspicious patterns -> Check treasury reserves -> Auto-pause payouts if needed

#### Additional Workflows

| Workflow | Trigger | Description |
|---|---|---|
| `medical-historian` | HTTP | Longitudinal health summary via AI. 10-year record fetch + LLM summarization + drug interaction detection |
| `vitals-monitor` | Cron (15m) | Wearable IoT vitals + Z-score anomaly detection + on-chain health alerts |
| `irb-agent` | HTTP | IRB compliance scoring for research proposals via LLM |
| `premium-adjuster` | Cron (monthly) | Dynamic premium adjustment based on patient risk data |
| `key-rotation` | EVM Log | Triggered on AccessRevoked. Rotates encryption keys and re-encrypts IPFS content |
| `data-marketplace` | HTTP | Consent-gated anonymized data monetization with TEE anonymization |
| `auth-session` | HTTP | Role-based permission mapping + JWT session construction |

### CRE Secrets

| Secret Name | Purpose |
|---|---|
| IPFS_GATEWAY_TOKEN | Pinata/IPFS gateway authentication |
| AI_SUMMARIZER_API_KEY | AI summarization service key |
| RISK_SCORING_API_KEY | Risk scoring service key |
| WORLD_ID_APP_ID | World ID application ID |
| WORLD_ID_ACTION_ID | World ID action ID |
| IOT_ORACLE_API_KEY | IoT sensor data oracle key |
| CCIP_BRIDGE_API_KEY | CCIP bridge API key |
| MEDICARE_BACKEND_AUTH_TOKEN | Backend authentication token |

---

## 6. Test Coverage

### Smart Contract Tests (Hardhat/Chai)

- EHRStorage: deployment, provider registration, access grants, addRecord, updateRecord, deactivateRecord, edge cases
- InsurancePolicy: full policy lifecycle, claims state machine, premium adjustment
- SupplyChain: batch creation, transfers, auto-status, IoT condition logging, flagging, recall
- CredentialRegistry: issuance, verification, revocation, renewal, duplicate prevention
- Governance: proposal creation, voting, execution, timelock, quorum
- **Total: 214 passing tests**

### Backend Tests (Jest)

| Test File | Tests | Coverage |
|---|---|---|
| `ai.test.ts` | 19 | Risk scoring, anomaly detection, LLM summarizer (mocked), crypto, validators |
| `services.test.ts` | 12 | IoT sensor parsing, threshold validation, breach detection, batch processing |
| `routes.test.ts` | 8 | Health endpoint, risk-score endpoint, anomaly-detect endpoint (supertest) |
| **Total** | **39** | |

---

## 7. AI and ML Integration

### EHR Summarization

- **File:** `backend/src/ai/summarizer.ts`
- **Model:** GPT-4o (configurable via `LLM_MODEL`)
- **Output:** Structured JSON with diagnoses, medications, allergies, procedures, redFlags, narrative, confidence
- **Retry Logic:** 3 retries with exponential backoff

### Risk Scoring

- **File:** `backend/src/ai/risk.ts`
- **Algorithm:** Logistic regression (sigmoid activation) with 10 features
- **Features:** age, bmi, chronicConditions, medicationCount, priorClaims, smokingStatus, exerciseFactor, systolicBP, fastingGlucose, cholesterol
- **Output:** Score 0-100, classified as LOW (0-25), MEDIUM (25-50), HIGH (50-75), CRITICAL (75-100)

### Anomaly Detection

- **File:** `backend/src/ai/anomaly.ts`
- **Algorithm:** Z-score based time-series analysis
- **Supported Metrics:** heart_rate, blood_pressure_systolic, blood_glucose, temperature, oxygen_saturation
- **Severity Thresholds:** Z >= 4 (CRITICAL), Z >= 3 (ALERT), Z >= 2 (WARNING)

---

## 8. Blockchain Integration

### On-Chain Features

| Feature | Contract | Token | Status |
|---|---|---|---|
| EHR hash pointer storage | EHRStorage | -- | Deployed |
| Patient consent management | EHRStorage | -- | grantAccess/revokeAccess on-chain |
| Insurance policy as NFT | InsurancePolicy | ERC-721 | Full lifecycle |
| Premium collection (stablecoin) | InsurancePolicy | ERC-20 | SafeERC20 transfers |
| Claims state machine | InsurancePolicy | -- | Pending -> Approved -> Paid / Rejected |
| Pharma batch tracking | SupplyChain | ERC-1155 | Auto-status by role |
| IoT condition logging | SupplyChain | -- | Hashed audit trail |
| Credential issuance/verification | CredentialRegistry | -- | 8 credential types |
| Token-weighted governance | Governance | ERC-20 | Full proposal lifecycle |
| World ID gating | All 4 contracts | -- | Via AccessManager |

### Chainlink Integration

| Product | Usage |
|---|---|
| CRE | 17 decentralized workflows |
| CCIP | Cross-chain settlement (crosschain workflow) |
| Confidential HTTP | IPFS fetches, medical data retrieval (3 workflows) |
| Confidential Compute | AI adjudication, trial matching (4 workflows) |
| Report Generation | Signed reports via KeystoneForwarder (all workflows) |

---

## 9. External Dependencies

| API | Status | Notes |
|---|---|---|
| Azure OpenAI / LLM | Ready | Needs `LLM_API_KEY` |
| Pinata / IPFS | Ready | Needs `PINATA_API_KEY` + `PINATA_SECRET_KEY` |
| World ID | Integrated | App ID: `app_cf4f67cc7a208b56b418fdc252b16aa5` |
| thirdweb | Integrated | SDK v5 for wallet connection |
| FHIR R4 | Active | Using hapi.fhir.org public server |
| Supabase | Active | Cloud-hosted PostgreSQL |
| Tenderly | Active | Virtual Sepolia deployment |
