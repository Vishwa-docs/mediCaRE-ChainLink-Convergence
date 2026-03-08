# mediCaRE — AI-Powered Blockchain Healthcare Platform

[![Built with Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE-375BD2?style=flat&logo=chainlink)](https://chain.link)
[![Convergence Hackathon 2026](https://img.shields.io/badge/Convergence-Hackathon%202026-orange)](https://chain.link/hackathon)
[![World ID](https://img.shields.io/badge/World%20ID-Proof%20of%20Personhood-000?style=flat)](https://docs.world.org/world-id)
[![Tenderly VNet](https://img.shields.io/badge/Tenderly-Virtual%20TestNet-6C47FF?style=flat)](https://tenderly.co)
[![Tests](https://img.shields.io/badge/Tests-214%20passing-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A decentralized healthcare platform leveraging **Chainlink CRE**, **CCIP**, **Confidential Compute**, **World ID**, and **AI** to deliver secure EHR management, automated insurance with multi-agent AI adjudication, pharmaceutical supply-chain tracking, clinical trial matching, emergency glass-break access, and provider credentialing — deployed and tested on **Tenderly Virtual TestNets**.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution — mediCaRE](#solution--medicare)
- [Architecture](#architecture)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Smart Contracts](#smart-contracts)
- [CRE Workflows](#cre-workflows)
- [Backend API](#backend-api)
- [Frontend](#frontend)
- [Deployment](#deployment)
- [Seeding Demo Data](#seeding-demo-data)
- [Testing](#testing)
- [Deployed Contracts (Tenderly VNet)](#deployed-contracts-tenderly-vnet)
- [Prize Track Eligibility](#prize-track-eligibility)
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
                     │  SQLite │ JWT Auth    │
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
| **Chainlink Functions** | Off-chain computation for risk scoring and external data retrieval |
| **Confidential Compute** | Privacy-preserving risk scoring — insurance decisions remain private |
| **Confidential HTTP** | Secure API calls (FHIR, World ID, AI) — API keys never exposed to nodes |

### World ID

| Component | Integration |
|-----------|------------|
| **Zero-Knowledge Proofs** | Patients/providers prove unique humanness without revealing identity |
| **IWorldIDVerifier** | Solidity interface in `AccessManager.sol` — 4 core contracts gated behind World ID |
| **CRE World ID Workflow** | HTTP trigger → World ID API verification → on-chain attestation via CRE DON consensus |
| **Backend Service** | `worldid.ts` — server-side proof verification |
| **Frontend Integration** | Verification UI in mini-app and settings pages |

### Tenderly Virtual TestNets

| Capability | Usage |
|-----------|-------|
| **Virtual TestNet Deployment** | All 6 contracts deployed and verified (chainId `99911155111`) |
| **Transaction Simulation** | Seeded demo data with 20+ transactions for realistic demo |
| **Contract Verification** | All contracts verified on Tenderly explorer |
| **Hardhat Integration** | Full network config, etherscan verification setup |

### Application Stack

| Layer | Technologies |
|-------|-------------|
| **Smart Contracts** | Solidity 0.8.28, OpenZeppelin 5.6.1, Hardhat, TypeChain |
| **Backend** | Node.js 18+, Express.js, TypeScript, ethers.js v6, Zod, JWT, Winston |
| **Frontend** | Next.js 16.1.6, React 19, TailwindCSS v4, thirdweb v5, Recharts |
| **AI/ML** | Azure OpenAI (GPT-4o), logistic regression risk scoring, Z-score anomaly detection |
| **Storage** | IPFS (Pinata), AES-256-GCM encryption |
| **Database** | Supabase (PostgreSQL) — cloud-hosted auth, session, audit store with auto-seeding demo users |
| **Identity** | World ID (proof-of-personhood), Verifiable Credentials |
| **Healthcare** | FHIR R4 (HL7), hapi.fhir.org public server |
| **Testing** | Hardhat + Chai (contracts), Jest (backend), Next.js build verification |
| **DevOps** | Docker Compose, GitHub Actions CI/CD |

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
- **Audit Log** — Real-time on-chain event viewer across all 5 deployed contracts
- **Contract Health Dashboard** — Live deployment status, bytecode size, entity counts
- **Emergency Dashboard** — Glass-break access with countdown timer and Health Passport NFT card
- **Research Portal** — Clinical trial matching pipeline, consent management, data monetization
- **Treasury Dashboard** — Reserve health gauge, payout velocity, anomaly alerts, pause controls
- **Visit Summary** — AI-generated pre-visit preparation and post-visit documentation
- **Analytics** — Real KPI counts from contracts, claim status breakdown
- **Guided Demo Tour** — interactive step-by-step walkthrough for judges with Chainlink feature callouts on every page

### Authentication & Identity
- **Supabase-backed auth** — cloud PostgreSQL with users, sessions, World ID verifications, and audit log tables
- **JWT login** — email/password, wallet, and World ID login methods with role-based tokens
- **6 demo accounts** — admin, patient, doctor, insurer, paramedic, researcher (quick-login cards on /login)
- **Role-based UI gating** — header shows role badge + WorldID verified status; unauthenticated users redirect to /login
- **World ID verification** — dev-mode simulation endpoint + production Worldcoin API verify; status persisted in SQLite

### Security & Gas Optimization
- AES-256-GCM encryption, JWT auth, three-tier rate limiting, ReentrancyGuard
- Solidity optimizer with `viaIR: true`, `unchecked` counter increments, custom errors
- AccessManager with World ID gating, Helmet, CORS, Zod input validation
- TEE/Confidential Compute for all sensitive AI operations

---

## Project Structure

```
mediCaRE/
├── contracts/                    # Solidity smart contracts
│   ├── src/                      # Contract source (~4,000 lines)
│   │   ├── EHRStorage.sol        # + longitudinal summaries
│   │   ├── InsurancePolicy.sol   # + explainability, cross-chain payouts
│   │   ├── SupplyChain.sol
│   │   ├── CredentialRegistry.sol
│   │   ├── Governance.sol        # + research proposals, IRB, consent
│   │   ├── utils/                # AccessManager, ReentrancyGuard
│   │   ├── interfaces/           # Contract interfaces
│   │   └── mocks/                # MockStablecoin for testing
│   ├── test/                     # 214 unit tests
│   ├── scripts/                  # Deploy + seed (with new features)
│   └── deployments/              # Network deployment addresses
├── cre-workflows/                # Chainlink CRE workflows (17 total)
│   ├── record-upload/
│   ├── consent/
│   ├── insurance-claim/
│   ├── supply-chain/
│   ├── crosschain/
│   ├── worldid/
│   ├── claim-adjudicator/        # ★ BFT multi-agent swarm
│   ├── medical-historian/        # ★ Longitudinal AI summaries
│   ├── emergency-access/         # ★ Glass-break access
│   ├── vitals-monitor/           # Wearable IoT monitoring
│   ├── irb-agent/                # IRB compliance scoring
│   ├── premium-adjuster/         # Dynamic premium adjustment
│   ├── fraud-monitor/            # ★ Graph anomaly detection
│   ├── trial-matcher/            # ★ ZK clinical trial matching
│   ├── key-rotation/             # Automatic key rotation
│   ├── data-marketplace/         # Consent-gated data monetization
│   └── auth-session/            # ★ Auth session management + role permissions
├── backend/                      # Express.js API server
│   ├── src/
│   │   ├── ai/                   # Summarizer, risk, anomaly, claim adjudicator,
│   │   │                         #   consent NLP, explainability, medical historian
│   │   ├── services/             # Blockchain, IPFS, FHIR, WorldID, audit, treasury, ABDM, database (Supabase)
│   │   ├── routes/               # 14 route modules (+auth)
│   │   └── middleware/
│   └── tests/                    # 50 unit tests
├── frontend/                     # Next.js 16 application
│   └── src/
│       ├── app/                  # 18 page routes (+emergency, research, treasury, login)
│       ├── components/           # 27 components (+10 new feature components)
│       ├── contexts/             # AuthContext (JWT + role + WorldID state)
│       ├── hooks/
│       └── lib/                  # api.ts, authApi.ts, thirdweb.ts
├── scripts/                      # Demo launcher (demo.sh)
├── docs/                         # architecture.md, api.md, governance.md
├── VK/                           # Private strategy docs
├── docker-compose.yml
└── README.md
```

---

## Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0
- **Git**
- **MetaMask** or compatible Web3 wallet
- **Tenderly Account** — [tenderly.co](https://tenderly.co)

---

## Installation & Setup

```bash
# Clone
git clone https://github.com/your-username/mediCaRE.git
cd mediCaRE

# Install all dependencies
cd contracts && npm install && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your API keys and private key

# Create frontend env
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001' > frontend/.env.local

# Deploy contracts
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy.ts --network tenderlyVNet
npx hardhat run scripts/seed_data.ts --network tenderlyVNet
cd ..

# Start backend (Terminal 1)
cd backend && npm run dev

# Start frontend (Terminal 2)
cd frontend && npm run dev
```

Open http://localhost:3000 — you'll see the **login page**. Use any of the 6 demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@medicare-dao.eth` | `admin123` |
| Patient | `patient@medicare-dao.eth` | `patient123` |
| Doctor | `doctor@medicare-dao.eth` | `doctor123` |
| Insurer | `insurer@medicare-dao.eth` | `insurer123` |
| Paramedic | `paramedic@medicare-dao.eth` | `paramedic123` |
| Researcher | `researcher@medicare-dao.eth` | `researcher123` |

Or connect MetaMask to Tenderly VNet (chainId `99911155111`).

---

## Smart Contracts

| Contract | Purpose | Lines |
|----------|---------|-------|
| `EHRStorage.sol` | Health record management with consent | 383 |
| `InsurancePolicy.sol` | ERC-721 insurance NFTs + claims | 505 |
| `SupplyChain.sol` | ERC-1155 pharma batch tracking | ~490 |
| `CredentialRegistry.sol` | Provider credentialing | 390 |
| `Governance.sol` | DAO governance | 473 |
| `AccessManager.sol` | World ID + consent control | 142 |

```bash
cd contracts
npx hardhat compile
npx hardhat test    # 214 tests
```

---

## CRE Workflows

### Priority Workflows (Hackathon Demo)

| Workflow | Trigger | Capabilities | Output |
|----------|---------|-------------|--------|
| `claim-adjudicator` | EVM Log | 3-agent BFT swarm → Confidential Compute → Explainability hash → EVM Write | Adjudication + flag |
| `emergency-access` | HTTP | Role verification → Glass-break bypass → TEE fetch → Immutable audit → Patient notification | Critical data + audit |
| `trial-matcher` | HTTP | Consent check → Confidential HTTP → LLM eligibility (TEE) → ZK boolean result | Anonymous match count |
| `fraud-monitor` | Cron (6h) | Graph anomaly detection → Claim flagging → Treasury reserve check → Auto-pause | Fraud alerts |

### Additional Workflows

| Workflow | Trigger | Output |
|----------|---------|--------|
| `record-upload` | HTTP | Summary hash |
| `consent` | HTTP | Data delivery |
| `insurance-claim` | HTTP | Claim decision |
| `supply-chain` | Cron/HTTP | Batch flag/recall |
| `crosschain` | HTTP | Cross-chain transfer |
| `worldid` | HTTP | On-chain attestation |
| `medical-historian` | HTTP | Longitudinal summary hash |
| `vitals-monitor` | Cron (15m) | On-chain health alerts |
| `irb-agent` | HTTP | IRB compliance score |
| `premium-adjuster` | Cron (monthly) | Premium adjustment |
| `key-rotation` | EVM Log | Re-encrypted CIDs |
| `data-marketplace` | HTTP | Anonymized dataset delivery |\n| `auth-session` | HTTP | JWT session + role permissions |

---

## Backend API

```bash
cd backend && npm run dev    # Port 3001
```

Key endpoints:

| Area | Endpoints |
|------|----------|
| **Auth** | `POST /api/auth/login`, `/wallet-login`, `/register`, `/worldid/verify`, `/worldid/simulate`, `GET /me`, `/users` (admin) |
| **EHR** | `POST /api/ehr/upload`, `GET /api/ehr/records` |
| **Insurance** | `POST /api/insurance/create-policy`, `/submit-claim`, `GET /policies/:holder`, `/claims/:holder` |
| **Supply** | `POST /api/supply/create-batch`, `/record-checkpoint` |
| **AI** | `POST /api/ai/summarize`, `/pre-visit-summary`, `/post-visit-summary`, `/risk-score`, `/adjudicate` |
| **Identity** | `POST /api/ai/worldid/verify` |
| **System** | `GET /api/health` |

Full reference: [docs/api.md](docs/api.md)

---

## Frontend

```bash
cd frontend && npm run dev    # Port 3000
```

18 routes: **Login**, Dashboard, Records, Visit Summary, Insurance, Supply Chain, Credentials, Governance, Audit Log, Contract Health, Analytics, Settings, Mini App, **Emergency**, **Research**, **Treasury**, AI Models. All pages read **real on-chain data** — zero mock data. Unauthenticated users are redirected to `/login` where they can sign in with email/password, connect a wallet, or use one of 6 quick-login demo accounts (admin, patient, doctor, insurer, paramedic, researcher).

---

## Seeding Demo Data

```bash
cd contracts
npx hardhat run scripts/seed_data.ts --network tenderlyVNet
```

Creates: 5 EHR records + 1 longitudinal summary, 3 insurance policies + 1 claim + AI explanation hash, 4 supply chain batches + IoT data, 5 credentials, 3 governance proposals + 1 vote, 2 research proposals + IRB scores, research consent.

---

## Cloud Deployment (Live Demo)

mediCaRE runs as a live website with **zero local dependencies**:

| Component | Platform | Free Tier |
|-----------|----------|-----------|
| **Frontend** | Vercel | ✅ |
| **Backend API** | Railway | ✅ (500 hrs/mo) |
| **Database** | Supabase (PostgreSQL) | ✅ (500 MB) |
| **Smart Contracts** | Tenderly Virtual TestNet | ✅ |

### 1. Set Up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the contents of `backend/supabase-schema.sql`
3. Run the SQL — this creates the `users`, `sessions`, `worldid_verifications`, and `audit_log` tables
4. Copy your **Project URL** and **Service Role Key** from Settings → API

### 2. Deploy Backend to Railway

1. Create a free account at [railway.app](https://railway.app)
2. Connect your GitHub repo, select the `backend/` directory as root
3. Add these environment variables in Railway dashboard:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-key
JWT_SECRET=your-production-secret
RPC_URL=https://virtual.sepolia.eu.rpc.tenderly.co/...
PRIVATE_KEY=your-deployer-private-key
CHAIN_ID=99911155111
EHR_STORAGE_ADDRESS=0xd3269fe5e7C03B505bB73d5B3ec5655B72DeFE00
INSURANCE_POLICY_ADDRESS=0x960C6b7bA344ed26EFe7CeB9D878E11a465977d1
SUPPLY_CHAIN_ADDRESS=0xC69B9c117bA7207ae7c28796718e950fD2eE3507
CREDENTIAL_REGISTRY_ADDRESS=0x57Df5458eDC1Cc1eD6F08D7eC3e3f9b170448a9A
GOVERNANCE_ADDRESS=0xB5095Ecbf55E739395e346A6ebEA1701D47d5556
PINATA_API_KEY=your-pinata-key
PINATA_SECRET_KEY=your-pinata-secret
AZURE_OPENAI_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com
AZURE_OPENAI_API_KEY=your-key
WORLDID_APP_ID=your-world-id-app
ENCRYPTION_KEY=your-32-byte-key
NODE_ENV=production
```

4. Railway will auto-build from the Dockerfile and deploy

### 3. Deploy Frontend to Vercel

1. Create a free account at [vercel.com](https://vercel.com)
2. Import your GitHub repo, set root directory to `frontend/`
3. Add these environment variables:

```
NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app
NEXT_PUBLIC_CHAIN_ID=99911155111
NEXT_PUBLIC_RPC_URL=https://virtual.sepolia.eu.rpc.tenderly.co/...
NEXT_PUBLIC_EHR_ADDRESS=0xd3269fe5e7C03B505bB73d5B3ec5655B72DeFE00
NEXT_PUBLIC_INSURANCE_ADDRESS=0x960C6b7bA344ed26EFe7CeB9D878E11a465977d1
NEXT_PUBLIC_SUPPLY_ADDRESS=0xC69B9c117bA7207ae7c28796718e950fD2eE3507
NEXT_PUBLIC_CREDENTIAL_ADDRESS=0x57Df5458eDC1Cc1eD6F08D7eC3e3f9b170448a9A
NEXT_PUBLIC_GOVERNANCE_ADDRESS=0xB5095Ecbf55E739395e346A6ebEA1701D47d5556
NEXT_PUBLIC_STABLECOIN_ADDRESS=0x7Cf6cb620c2617887DC0Df5Faf8b14A984404f98
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=demo
```

4. Vercel auto-deploys on push — your live URL will be `https://your-app.vercel.app`

### Guided Demo Tour

When judges visit the live site and log in, a **"Guided Tour"** button appears in the bottom-right corner. Clicking it starts a 14-step interactive walkthrough that:
- Navigates to each feature page automatically
- Explains what the page does and what data is real vs. on-chain
- Shows which **Chainlink technology** powers each feature (CRE, CCIP, Confidential Compute)
- Can be skipped/cancelled at any time for free exploration

---

## Testing

```bash
# Smart contracts — 214 tests
cd contracts && npx hardhat test

# Backend — 50 tests
cd backend && npm test

# Frontend build
cd frontend && npx next build
```

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

---

## Prize Track Eligibility

| Track | How mediCaRE Qualifies |
|-------|----------------------|
| **CRE & AI** | 17 CRE workflows including multi-agent BFT claim adjudication, ZK trial matching, medical historian, IRB agent, vitals monitoring, fraud detection, auth session management — all with on-chain explainability |
| **Privacy** | Confidential HTTP for FHIR data, Confidential Compute for all AI decisions, TEE-based trial matching, emergency glass-break with immutable audit, AES-256-GCM, World ID ZKPs, consent NLP |
| **Risk & Compliance** | IoT monitoring, graph-based fraud detection, auto-pause treasury, IRB compliance scoring, immutable audit trail, premium risk adjustment |
| **DeFi & Tokenization** | ERC-721 insurance NFTs, ERC-1155 supply-chain tokens, CCIP cross-chain settlements, treasury health monitoring, data monetization marketplace |

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ for the **Chainlink Convergence Hackathon 2026**

