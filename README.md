# mediCaRE — AI-Powered Blockchain Healthcare Platform

[![Built with Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE-375BD2?style=flat&logo=chainlink)](https://chain.link)
[![Convergence Hackathon 2026](https://img.shields.io/badge/Convergence-Hackathon%202026-orange)](https://chain.link/hackathon)
[![World ID](https://img.shields.io/badge/World%20ID-Proof%20of%20Personhood-000?style=flat)](https://docs.world.org/world-id)
[![Tenderly VNet](https://img.shields.io/badge/Tenderly-Virtual%20TestNet-6C47FF?style=flat)](https://tenderly.co)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A decentralized healthcare platform leveraging **Chainlink CRE**, **CCIP**, **Confidential Compute**, **World ID**, and **AI** to deliver secure EHR management, automated insurance with multi-agent AI adjudication, pharmaceutical supply-chain tracking, clinical trial matching, emergency glass-break access, and provider credentialing — deployed and tested on **Tenderly Virtual TestNets**.

---

## Live Demo

| | URL |
|---|---|
| **Live App** | **[https://medicare-frontend-production.up.railway.app](https://medicare-frontend-production.up.railway.app)** |
| **Backend API** | [https://medicare-backend-production-861b.up.railway.app](https://medicare-backend-production-861b.up.railway.app/health) |
| **Source Code** | [https://github.com/Vishwa-docs/mediCaRE-ChainLink-Convergence](https://github.com/Vishwa-docs/mediCaRE-ChainLink-Convergence) |
| **Tenderly VNet Explorer** | [View contracts & transactions](https://dashboard.tenderly.co/JackBright/medicare/testnet/4f438d0e-a57a-456b-b2d8-bf8683fe3b32) |

### Demo Accounts

Log in with any pre-seeded account to explore different roles:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@medicare-dao.eth` | `admin123` |
| Patient | `patient@medicare-dao.eth` | `patient123` |
| Doctor | `doctor@medicare-dao.eth` | `doctor123` |
| Insurer | `insurer@medicare-dao.eth` | `insurer123` |
| Paramedic | `paramedic@medicare-dao.eth` | `paramedic123` |
| Researcher | `researcher@medicare-dao.eth` | `researcher123` |

### Guided Demo Tour

After logging in, click the **"Guided Tour"** button (bottom-right). It walks through all 14 features, explains each page, and highlights which **Chainlink technology** powers it (CRE, CCIP, Confidential Compute).

---

## Table of Contents

- [Live Demo](#live-demo)
- [Problem Statement](#problem-statement)
- [Solution](#solution--medicare)
- [Architecture](#architecture)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [CRE Workflows](#cre-workflows)
- [Smart Contracts](#smart-contracts)
- [Deployed Contracts](#deployed-contracts-tenderly-vnet)
- [Prize Track Eligibility](#prize-track-eligibility)
- [Chainlink File References](#chainlink-file-references)
- [Local Development](#local-development)
- [License](#license)

---

## Problem Statement

Healthcare systems globally suffer from critical, interconnected challenges:

| Challenge | Impact |
|-----------|--------|
| **Fragmented EHRs** | 80% of hospitals can't exchange records; data breaches cost **$11M per incident** |
| **Documentation burden** | Clinicians spend **50%+ of time** on paperwork instead of patient care |
| **Slow insurance processing** | Claims take weeks; **$68B annual fraud** in US healthcare alone |
| **Counterfeit pharmaceuticals** | WHO estimates **~1M deaths/year** from fake or substandard drugs |
| **Manual credentialing** | Provider onboarding takes **60+ days** on average |
| **Identity fraud & Sybil attacks** | Growing bot/AI-driven fake accounts in healthcare systems |

---

## Solution — mediCaRE

**mediCaRE** is a production-grade decentralized application (DApp) that unifies six healthcare modules under a single platform, orchestrated by **Chainlink CRE** (Compute Runtime Environment):

| Module | Smart Contract | Token Standard | Description |
|--------|---------------|---------------|-------------|
| **EHR Management** | `EHRStorage.sol` | — | Encrypted records on IPFS, on-chain CID indexing, patient-controlled consent, longitudinal summaries |
| **Insurance Automation** | `InsurancePolicy.sol` | ERC-721 | NFT policies, multi-agent AI adjudication, BFT consensus, dynamic premiums, cross-chain payouts |
| **Supply Chain Tracking** | `SupplyChain.sol` | ERC-1155 | Pharmaceutical batch tokens, IoT monitoring, counterfeit detection |
| **Provider Credentialing** | `CredentialRegistry.sol` | — | Verifiable credentials, World ID proof-of-personhood |
| **DAO Governance** | `Governance.sol` | ERC-20 | Token-weighted voting, research proposals, IRB compliance, data consent |
| **AI Orchestration** | CRE Workflows (17) | — | Claim adjudication, emergency access, trial matching, fraud monitoring, and more |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Frontend (Next.js 16 / React 19)                      │
│  Dashboard │ Records │ Insurance │ Supply Chain │ Credentials │ Governance  │
│  Emergency │ Research │ Treasury │ Audit Log │ Visit Summary │ Analytics   │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                │
                     ┌──────────▼───────────┐
                     │  Backend (Express.js) │
                     │  AI Modules │ FHIR    │
                     │  IPFS │ World ID      │
                     │  Supabase │ JWT Auth  │
                     │  Audit │ Treasury     │
                     └──────────┬───────────┘
                                │
     ┌──────────────────────────▼──────────────────────────┐
     │           Chainlink CRE Workflows (17)              │
     │  ┌───────────────┐  ┌───────────────────────────┐   │
     │  │ Record Upload  │  │ Claim Adjudicator (BFT)  │   │
     │  │ Consent Mgmt   │  │ Fraud Monitor            │   │
     │  │ World ID       │  │ Emergency Glass-Break    │   │
     │  │ Vitals Monitor │  │ Trial Matcher (ZK)       │   │
     │  │ Key Rotation   │  │ IRB Agent                │   │
     │  │ Data Marketplace│ │ Premium Adjuster         │   │
     │  └───────────────┘  └───────────────────────────┘   │
     └────────┬──────────────────────────┬─────────────────┘
              │                          │
   ┌──────────▼──────────┐     ┌─────────▼──────────┐
   │   Smart Contracts    │     │  Chainlink CCIP    │
   │  (Tenderly VNet)     │     │  (Cross-Chain)     │
   │  EHR │ Insurance     │     └────────────────────┘
   │  Supply │ Credential │
   │  Governance          │
   └──────────────────────┘
```

---

## Technologies Used

### Chainlink (Primary)

| Technology | Role in mediCaRE |
|-----------|-----------------|
| **CRE (Compute Runtime Environment)** | Core orchestration layer — 17 decentralized workflows coordinating AI, identity, insurance, supply chain, auth, and cross-chain operations |
| **CCIP (Cross-Chain Interoperability Protocol)** | Cross-chain insurance settlement and multi-chain EHR data sharing |
| **Confidential Compute** | Privacy-preserving AI adjudication — insurance decisions and sensitive medical logic never exposed on-chain |
| **Confidential HTTP** | Secure API calls (FHIR, World ID, AI) — API keys and credentials never exposed to nodes or on-chain |

### World ID

| Component | Integration |
|-----------|------------|
| **Zero-Knowledge Proofs** | Patients/providers prove unique humanness without revealing identity |
| **IDKit v4** | Frontend widget with `deviceLegacy` preset, server-side `signRequest()` for RP context signing |
| **CRE World ID Workflow** | HTTP trigger → World ID API verification via Confidential HTTP → on-chain attestation via CRE DON consensus |
| **Backend Service** | `worldid.ts` — server-side proof verification + `@worldcoin/idkit-server` for request signing |

### Tenderly Virtual TestNets

| Capability | Usage |
|-----------|-------|
| **Virtual TestNet Deployment** | All 6 contracts deployed and verified (chainId `99911155111`) |
| **Transaction History** | 20+ seeded transactions for realistic demo |
| **Contract Verification** | All contracts verified on Tenderly explorer |
| **Hardhat Integration** | Full network config with etherscan-compatible verification |

### Application Stack

| Layer | Technologies |
|-------|-------------|
| **Smart Contracts** | Solidity 0.8.28, OpenZeppelin 5.6.1, Hardhat, TypeChain |
| **Backend** | Node.js 18+, Express.js, TypeScript, ethers.js v6, Zod, JWT, Winston |
| **Frontend** | Next.js 16.1.6, React 19, TailwindCSS v4, thirdweb v5, Recharts |
| **AI/ML** | Azure OpenAI (GPT-4o), logistic regression risk scoring, Z-score anomaly detection |
| **Storage** | IPFS (Pinata), AES-256-GCM encryption |
| **Database** | Supabase (PostgreSQL) — cloud-hosted auth, session, audit store |
| **Identity** | World ID (proof-of-personhood), Verifiable Credentials |
| **Healthcare** | FHIR R4 (HL7), hapi.fhir.org public server |

---

## Features

### Core Capabilities
- **Patient-Centric Identity** — World ID verification, DID-based consent management
- **Decentralized EHR Storage** — IPFS with on-chain CID indexing, AES-256-GCM encryption
- **AI-Powered Summarization** — Pre/post visit summarization using Azure OpenAI via CRE
- **Multi-Agent Claim Adjudication** — 3-agent BFT swarm (TriageBot, CodingBot, FraudDetectorBot) with on-chain explainability
- **Emergency Glass-Break Access** — Bypass consent for life-threatening emergencies, immutable audit trail, 15-minute access window
- **ZK Clinical Trial Matching** — Privacy-preserving patient-trial matching via Confidential Compute, only boolean eligibility exposed
- **Longitudinal Medical Historian** — AI-generated longitudinal health summaries with drug interaction detection
- **Smart Contract Insurance** — ERC-721 NFT policies, automated claims, dynamic premiums, cross-chain payouts
- **Supply Chain Traceability** — ERC-1155 pharmaceutical batch tracking, IoT integration
- **Counterfeit & Fraud Detection** — Graph-based anomaly detection, auto-pause payouts, treasury health monitoring
- **Provider Credentialing** — Verifiable credentials with World ID proof-of-personhood
- **Cross-Chain Interoperability** — CCIP-based token and message bridging
- **DAO Governance** — Token-weighted voting, research proposals, IRB compliance scoring

### Platform Features
- **Audit Log** — Real-time on-chain event viewer across all 6 deployed contracts
- **Contract Health Dashboard** — Live deployment status, bytecode size, entity counts
- **Emergency Dashboard** — Glass-break access with countdown timer
- **Research Portal** — Clinical trial matching pipeline, consent management, data monetization
- **Treasury Dashboard** — Reserve health gauge, payout velocity, anomaly alerts, pause controls
- **Visit Summary** — AI-generated pre-visit preparation and post-visit documentation
- **Analytics** — Real KPI counts from contracts, claim status breakdown
- **Guided Demo Tour** — Interactive step-by-step walkthrough with Chainlink feature callouts on every page

### Authentication & Identity
- **Supabase-backed auth** — cloud PostgreSQL with users, sessions, World ID verifications, and audit log tables
- **JWT login** — email/password, wallet, and World ID login methods with role-based tokens
- **6 demo accounts** — admin, patient, doctor, insurer, paramedic, researcher (quick-login cards on /login)
- **Role-based UI gating** — header shows role badge + WorldID verified status; unauthenticated users redirect to /login
- **World ID verification** — dev-mode simulation endpoint + production Worldcoin API verify; status persisted in Supabase

---

## CRE Workflows

mediCaRE uses **17 CRE workflows** as its orchestration layer, each integrating blockchain with external APIs, AI/LLM agents, or real-world data sources. All workflows are fully configured with real contract addresses and live backend API endpoints.

### Priority Workflows (Hackathon Demo)

| Workflow | Trigger | Capabilities | Output |
|----------|---------|-------------|--------|
| [`claim-adjudicator`](cre-workflows/claim-adjudicator/main.ts) | EVM Log | 3-agent BFT swarm → Confidential Compute → Explainability hash → EVM Write | Adjudication + flag |
| [`emergency-access`](cre-workflows/emergency-access/main.ts) | HTTP | Role verification → Glass-break bypass → TEE fetch → Immutable audit → Patient notification | Critical data + audit |
| [`trial-matcher`](cre-workflows/trial-matcher/main.ts) | HTTP | Consent check → Confidential HTTP → LLM eligibility (TEE) → ZK boolean result | Anonymous match count |
| [`fraud-monitor`](cre-workflows/fraud-monitor/main.ts) | Cron (6h) | Graph anomaly detection → Claim flagging → Treasury reserve check → Auto-pause | Fraud alerts |
| [`worldid`](cre-workflows/worldid/main.ts) | HTTP | World ID ZK proof verification via Confidential HTTP → on-chain credential attestation | Sybil-resistant identity |

### Full Workflow Catalog

| Workflow | Trigger | Output |
|----------|---------|--------|
| [`record-upload`](cre-workflows/record-upload/main.ts) | HTTP | EHR CID + AI summary hash on-chain |
| [`consent`](cre-workflows/consent/main.ts) | HTTP | Consent-gated data delivery |
| [`insurance-claim`](cre-workflows/insurance-claim/main.ts) | HTTP | Claim decision with risk score |
| [`supply-chain`](cre-workflows/supply-chain/main.ts) | Cron/HTTP | Batch flag/recall via IoT sensors |
| [`crosschain`](cre-workflows/crosschain/main.ts) | HTTP | CCIP cross-chain settlement |
| [`medical-historian`](cre-workflows/medical-historian/main.ts) | HTTP | Longitudinal summary hash |
| [`vitals-monitor`](cre-workflows/vitals-monitor/main.ts) | Cron (15m) | On-chain health alerts |
| [`irb-agent`](cre-workflows/irb-agent/main.ts) | HTTP | IRB compliance score |
| [`premium-adjuster`](cre-workflows/premium-adjuster/main.ts) | Cron (monthly) | Dynamic premium adjustment |
| [`key-rotation`](cre-workflows/key-rotation/main.ts) | EVM Log | Re-encrypted CIDs |
| [`data-marketplace`](cre-workflows/data-marketplace/main.ts) | HTTP | Anonymized dataset delivery |
| [`auth-session`](cre-workflows/auth-session/main.ts) | HTTP | JWT session + role permissions |

All workflow source code, configs, and the CRE project manifest: [`cre-workflows/`](cre-workflows/) · [`project.yaml`](cre-workflows/project.yaml)

---

## Smart Contracts

| Contract | Purpose | Token Standard |
|----------|---------|---------------|
| `EHRStorage.sol` | Health record management with consent + longitudinal summaries | — |
| `InsurancePolicy.sol` | ERC-721 insurance NFTs + claims + explainability | ERC-721 |
| `SupplyChain.sol` | Pharmaceutical batch tracking + IoT | ERC-1155 |
| `CredentialRegistry.sol` | Provider credentialing + World ID | — |
| `Governance.sol` | DAO governance + research proposals + IRB | ERC-20 |
| `MockStablecoin.sol` | Test stablecoin for claims/payouts | ERC-20 |

Security: `AccessManager` with World ID gating, OpenZeppelin `ReentrancyGuard`, optimizer with `viaIR: true`, custom errors, `unchecked` counter increments.

---

## Deployed Contracts (Tenderly VNet)

| Contract | Address | Verified |
|----------|---------|----------|
| MockStablecoin | `0x7Cf6cb620c2617887DC0Df5Faf8b14A984404f98` | ✅ |
| EHRStorage | `0xd3269fe5e7C03B505bB73d5B3ec5655B72DeFE00` | ✅ |
| InsurancePolicy | `0x960C6b7bA344ed26EFe7CeB9D878E11a465977d1` | ✅ |
| SupplyChain | `0xC69B9c117bA7207ae7c28796718e950fD2eE3507` | ✅ |
| CredentialRegistry | `0x57Df5458eDC1Cc1eD6F08D7eC3e3f9b170448a9A` | ✅ |
| Governance | `0xB5095Ecbf55E739395e346A6ebEA1701D47d5556` | ✅ |

Network: Tenderly Virtual Sepolia · Chain ID: `99911155111` · Deployer: `0x7637B8d8F46990441420343A7660436eD69c3716`

**Tenderly VNet Explorer**: [View transactions & contract state](https://dashboard.tenderly.co/JackBright/medicare/testnet/4f438d0e-a57a-456b-b2d8-bf8683fe3b32)

---

## Prize Track Eligibility

### Primary Tracks

| Track | How mediCaRE Qualifies |
|-------|----------------------|
| **CRE & AI ($17K)** | 17 CRE workflows including multi-agent BFT claim adjudication, ZK trial matching, medical historian, IRB agent, vitals monitoring, fraud detection, auth session management — all integrating blockchain with AI/LLM APIs via CRE orchestration with on-chain explainability |
| **Privacy ($16K)** | Confidential HTTP for FHIR data ingestion (hides API credentials from chain), Confidential Compute for all AI adjudication decisions (sensitive medical data never exposed on-chain), TEE-based clinical trial matching, emergency glass-break with immutable audit trail, AES-256-GCM encryption, World ID ZKPs for Sybil-resistant identity, consent NLP in CRE |

### Secondary Tracks

| Track | How mediCaRE Qualifies |
|-------|----------------------|
| **Risk & Compliance ($16K)** | IoT supply-chain monitoring CRE workflow triggers alerts on anomalies, graph-based fraud detection, auto-pause treasury when health drops below threshold, IRB compliance scoring via CRE, immutable audit trail, dynamic premium risk adjustment |
| **DeFi & Tokenization ($20K)** | ERC-721 insurance NFTs (lifecycle management — mint, claim, adjudicate), ERC-1155 pharmaceutical batch tokens (RWA tokenization for supply chain), CCIP cross-chain settlement workflow, treasury health monitoring, data monetization marketplace |

### Sponsor Tracks

| Sponsor Track | How mediCaRE Qualifies |
|---------------|----------------------|
| **World ID × CRE ($5K)** | Real World ID integration using IDKit v4 with `deviceLegacy` preset and server-side `signRequest()` for RP context signing. Dedicated CRE workflow ([`cre-workflows/worldid/`](cre-workflows/worldid/)) verifies World ID proofs via Confidential HTTP (hides app secrets) and writes credential attestations on-chain to `CredentialRegistry.sol`. Frontend Settings page launches IDKit widget; backend performs off-chain proof verification; CRE orchestrates the full flow. |
| **Tenderly Virtual TestNets ($5K)** | All 6 smart contracts deployed and verified on Tenderly Virtual Sepolia (chain ID `99911155111`). Full transaction history and contract interactions on [Tenderly VNet Explorer](https://dashboard.tenderly.co/JackBright/medicare/testnet/4f438d0e-a57a-456b-b2d8-bf8683fe3b32). CRE workflows configured against VNet RPCs. |
| **thirdweb × CRE ($5K+)** | thirdweb SDK v5 used for wallet connection, contract reads/writes, and user onboarding across all frontend pages. Combined with CRE workflows for orchestrated contract interactions (claim adjudication, credential issuance, supply chain updates). |

### Requirements Checklist

| Requirement | Status |
|-------------|--------|
| CRE Workflow integrating blockchain + external API/AI | ✅ 17 workflows (e.g., `claim-adjudicator` uses AI LLM + EVM write) |
| CRE CLI simulation or live deployment | ✅ Workflow configs + [`project.yaml`](cre-workflows/project.yaml) |
| 3-5 minute video | ⬜ To be recorded |
| Public source code | ✅ [GitHub](https://github.com/Vishwa-docs/mediCaRE-ChainLink-Convergence) |
| README with links to Chainlink files | ✅ See below |
| Tenderly VNet Explorer link | ✅ [Explorer](https://dashboard.tenderly.co/JackBright/medicare/testnet/4f438d0e-a57a-456b-b2d8-bf8683fe3b32) |

---

## Chainlink File References

| File | Purpose |
|------|---------|
| [`cre-workflows/`](cre-workflows/) | All 17 CRE workflow definitions (YAML configs + TypeScript handlers) |
| [`cre-workflows/project.yaml`](cre-workflows/project.yaml) | CRE project manifest (multi-chain RPC config) |
| [`cre-workflows/secrets.yaml`](cre-workflows/secrets.yaml) | CRE secrets manifest (World ID, AI, IPFS, CCIP keys) |
| [`cre-workflows/claim-adjudicator/main.ts`](cre-workflows/claim-adjudicator/main.ts) | Multi-agent BFT insurance claim adjudication via AI |
| [`cre-workflows/worldid/main.ts`](cre-workflows/worldid/main.ts) | World ID verification CRE workflow — verifies ZK proofs + writes credential attestation |
| [`cre-workflows/emergency-access/main.ts`](cre-workflows/emergency-access/main.ts) | Emergency glass-break access with Confidential Compute |
| [`cre-workflows/trial-matcher/main.ts`](cre-workflows/trial-matcher/main.ts) | ZK clinical trial matching via Confidential HTTP |
| [`cre-workflows/fraud-monitor/main.ts`](cre-workflows/fraud-monitor/main.ts) | Graph-based fraud detection CRE workflow |
| [`cre-workflows/crosschain/main.ts`](cre-workflows/crosschain/main.ts) | CCIP cross-chain settlement workflow |
| [`cre-workflows/medical-historian/main.ts`](cre-workflows/medical-historian/main.ts) | AI-powered longitudinal medical record summarization |
| [`cre-workflows/vitals-monitor/main.ts`](cre-workflows/vitals-monitor/main.ts) | Wearable IoT vitals monitoring with anomaly detection |
| [`cre-workflows/irb-agent/main.ts`](cre-workflows/irb-agent/main.ts) | IRB compliance scoring for research proposals |
| [`cre-workflows/premium-adjuster/main.ts`](cre-workflows/premium-adjuster/main.ts) | Dynamic insurance premium adjustment |
| [`cre-workflows/record-upload/main.ts`](cre-workflows/record-upload/main.ts) | EHR record upload with AI summarization |
| [`cre-workflows/consent/main.ts`](cre-workflows/consent/main.ts) | Patient consent management with NLP |
| [`cre-workflows/supply-chain/main.ts`](cre-workflows/supply-chain/main.ts) | Pharmaceutical supply chain IoT monitoring |
| [`cre-workflows/data-marketplace/main.ts`](cre-workflows/data-marketplace/main.ts) | Consent-gated anonymized data monetization |
| [`cre-workflows/key-rotation/main.ts`](cre-workflows/key-rotation/main.ts) | Automatic encryption key rotation |
| [`cre-workflows/auth-session/main.ts`](cre-workflows/auth-session/main.ts) | Auth session management + role permissions |
| [`contracts/src/`](contracts/src/) | 6 Solidity contracts deployed on Tenderly VNet |
| [`contracts/scripts/deploy.ts`](contracts/scripts/deploy.ts) | Deployment script with role setup and verification |
| [`contracts/scripts/seed_data.ts`](contracts/scripts/seed_data.ts) | Demo data seeding (20+ transactions) |
| [`backend/src/services/worldid.ts`](backend/src/services/worldid.ts) | Backend World ID proof verification service |
| [`backend/src/routes/auth.routes.ts`](backend/src/routes/auth.routes.ts) | Auth routes including World ID sign-request and verify |
| [`frontend/src/app/settings/page.tsx`](frontend/src/app/settings/page.tsx) | IDKit v4 widget integration |
| [`frontend/src/lib/contracts.ts`](frontend/src/lib/contracts.ts) | Contract addresses + ABIs for on-chain reads/writes |

---

## Project Structure

```
mediCaRE/
├── contracts/                    # Solidity smart contracts
│   ├── src/                      # Contract source
│   │   ├── EHRStorage.sol
│   │   ├── InsurancePolicy.sol
│   │   ├── SupplyChain.sol
│   │   ├── CredentialRegistry.sol
│   │   ├── Governance.sol
│   │   ├── utils/                # AccessManager, ReentrancyGuard
│   │   ├── interfaces/           # Contract interfaces
│   │   └── mocks/                # MockStablecoin
│   ├── test/                     # Unit + integration tests
│   ├── scripts/                  # Deploy + seed
│   └── deployments/              # Deployed addresses (tenderlyVNet.json)
├── cre-workflows/                # Chainlink CRE workflows (17 total)
│   ├── claim-adjudicator/        # ★ BFT multi-agent swarm
│   ├── emergency-access/         # ★ Glass-break access
│   ├── trial-matcher/            # ★ ZK clinical trial matching
│   ├── fraud-monitor/            # ★ Graph anomaly detection
│   ├── worldid/                  # ★ World ID verification
│   ├── crosschain/               # CCIP settlement
│   ├── medical-historian/        # Longitudinal AI summaries
│   ├── ...                       # + 10 more workflows
│   ├── project.yaml              # CRE project manifest
│   └── secrets.yaml              # CRE secrets manifest
├── backend/                      # Express.js API server
│   └── src/
│       ├── ai/                   # AI modules (summarizer, risk, adjudicator, etc.)
│       ├── services/             # Blockchain, IPFS, FHIR, WorldID, audit, treasury
│       ├── routes/               # 14 route modules
│       └── middleware/           # Auth, rate limiting, error handling
├── frontend/                     # Next.js 16 application
│   └── src/
│       ├── app/                  # 18 page routes
│       ├── components/           # 27+ React components
│       ├── contexts/             # AuthContext (JWT + role + WorldID state)
│       └── lib/                  # API clients, contract ABIs, thirdweb config
├── docs/                         # architecture.md, api.md, governance.md
├── SECURITY.md
├── SETUP_GUIDE.md
├── docker-compose.yml
└── README.md
```

---

## Local Development

<details>
<summary>Click to expand local development setup</summary>

### Prerequisites

- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- MetaMask or compatible Web3 wallet
- Tenderly Account — [tenderly.co](https://tenderly.co)

### Quick Start

```bash
# Clone
git clone https://github.com/Vishwa-docs/mediCaRE-ChainLink-Convergence.git
cd mediCaRE

# Install dependencies
cd contracts && npm install && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Configure environment
cp .env.example .env
cp backend/.env.example backend/.env
# Edit both .env files with your API keys

# Deploy contracts (optional — already deployed on Tenderly VNet)
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy.ts --network tenderlyVNet
npx hardhat run scripts/seed_data.ts --network tenderlyVNet
cd ..

# Start backend
cd backend && npm run dev    # Port 3001

# Start frontend (new terminal)
cd frontend && npm run dev   # Port 3000
```

### Running Tests

```bash
# Smart contract tests
cd contracts && npx hardhat test

# Backend tests
cd backend && npm test

# Frontend build verification
cd frontend && npx next build
```

</details>

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ for the **Chainlink Convergence Hackathon 2026**

