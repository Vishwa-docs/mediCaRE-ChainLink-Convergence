# mediCaRE — AI-Powered Blockchain Healthcare Platform

[![Built with Chainlink](https://img.shields.io/badge/Built%20with-Chainlink-375BD2?style=flat&logo=chainlink)](https://chain.link)
[![Convergence Hackathon](https://img.shields.io/badge/Convergence-Hackathon%202026-orange)](https://chain.link/hackathon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A decentralized healthcare platform leveraging Chainlink CRE, CCIP, Functions, and Confidential Compute to deliver secure EHR management, AI-assisted summarization, insurance automation, supply-chain tracking, and provider credentialing.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Smart Contracts](#smart-contracts)
- [CRE Workflows](#cre-workflows)
- [Backend](#backend)
- [Frontend](#frontend)
- [Deployment](#deployment)
- [Testing](#testing)
- [Demo & Testnet Links](#demo--testnet-links)
- [License](#license)

---

## Overview

**mediCaRE** is a comprehensive decentralized application (DApp) that enables patients, hospitals, insurers, and suppliers to collaborate securely on a blockchain-based platform. It uses **Chainlink CRE** as the orchestration layer to connect on-chain logic with AI services, external APIs, and cross-chain networks.

### Problem Statement

Hospitals worldwide face critical challenges:
- **Fragmented EHRs**: Patient records are siloed and vulnerable to tampering
- **Documentation burden**: Clinicians spend enormous time on documentation
- **Slow insurance**: Claims processing takes weeks and is prone to fraud
- **Counterfeit drugs**: Pharmaceutical supply chains lack transparency
- **Manual credentialing**: Provider verification is slow and error-prone
- **No interoperability**: Cross-chain communication is missing from healthcare

### Solution

mediCaRE addresses these gaps by combining AI, blockchain, and Chainlink technologies:

| Module | Description |
|--------|-------------|
| **EHR Management** | Encrypted records stored on IPFS with on-chain CID pointers |
| **AI Summarization** | LLM-powered medical record summarization via CRE workflows |
| **Insurance Automation** | NFT-based policies with automated claims processing |
| **Supply Chain** | ERC-1155 pharmaceutical tracking with IoT integration |
| **Credentialing** | Verifiable credential registry for healthcare providers |
| **Governance** | DAO-style governance for hospital network decisions |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│  Patient Dashboard │ Doctor View │ Insurer Portal │ Supply Chain│
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Backend (Express)  │
                    │  AI │ FHIR │ IPFS    │
                    └──────────┬──────────┘
                               │
            ┌──────────────────▼──────────────────┐
            │        Chainlink CRE Workflows       │
            │  Record Upload │ Consent │ Insurance  │
            │  Supply Chain │ Cross-Chain │ WorldID  │
            └──────┬──────────────────────┬────────┘
                   │                      │
        ┌──────────▼──────────┐  ┌───────▼────────┐
        │   Smart Contracts    │  │   Chainlink    │
        │  (Sepolia / Amoy)    │  │   CCIP Bridge  │
        │  EHR │ Insurance     │  │                │
        │  Supply │ Credential │  └────────────────┘
        │  Governance          │
        └──────────────────────┘
```

For detailed architecture, see [docs/architecture.md](docs/architecture.md).

---

## Features

- **Patient-Centric Identity**: World ID verification, DID-based consent management
- **Decentralized EHR Storage**: IPFS/Filecoin with on-chain CID indexing
- **AI-Powered Summarization**: Open-source LLM integration via CRE workflows
- **Diagnostic Anomaly Detection**: Time-series models for health metric monitoring
- **Smart Contract Insurance**: NFT policies, automated claims, dynamic premiums
- **Supply Chain Traceability**: ERC-1155 pharmaceutical batch tracking
- **Counterfeit Detection**: IoT sensor integration with automated flagging
- **Provider Credentialing**: Verifiable credentials with on-chain registry
- **Cross-Chain Interoperability**: CCIP-based token and message bridging
- **DAO Governance**: Token-weighted voting for protocol decisions
- **Confidential Compute**: Privacy-preserving risk scoring and data processing
- **Audit Dashboards**: Real-time monitoring of access logs and claims history

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity ^0.8.24, OpenZeppelin, Hardhat |
| **Orchestration** | Chainlink CRE (Go/TypeScript workflows) |
| **Cross-Chain** | Chainlink CCIP |
| **AI/ML** | OpenAI-compatible API, TensorFlow.js |
| **Backend** | Node.js, Express, TypeScript |
| **Frontend** | Next.js 14, React, TailwindCSS, thirdweb |
| **Storage** | IPFS (Pinata), Filecoin |
| **Identity** | World ID (IDKit), Verifiable Credentials |
| **Testing** | Hardhat, Chai, Jest, Tenderly Virtual TestNets |
| **Deployment** | Ethereum Sepolia, Polygon Amoy |

---

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **Git**
- **MetaMask** or compatible Web3 wallet
- **Testnet ETH** (Sepolia) — via [faucets.chain.link](https://faucets.chain.link)
- **Testnet LINK** — via [faucets.chain.link](https://faucets.chain.link)
- **CRE CLI** — `curl -sSL https://cre.chain.link/install.sh | bash`

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/mediCaRE.git
cd mediCaRE

# Install smart contract dependencies
cd contracts && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..

# Copy environment variables
cp .env.example .env
# Fill in your API keys and private key
```

---

## Smart Contracts

All contracts are in the `contracts/` directory:

| Contract | Purpose |
|----------|---------|
| `EHRStorage.sol` | Stores encrypted record hashes, manages patient permissions |
| `InsurancePolicy.sol` | ERC-721 policy NFTs with claim logic and premium adjustment |
| `SupplyChain.sol` | ERC-1155 pharmaceutical batch tracking with IoT data |
| `CredentialRegistry.sol` | Verifiable credential storage for healthcare providers |
| `Governance.sol` | DAO governance with token-weighted voting |

### Compile & Test

```bash
cd contracts
npx hardhat compile
npx hardhat test
```

### Deploy

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

---

## CRE Workflows

Workflows are defined in `cre-workflows/` using Chainlink CRE YAML syntax:

| Workflow | Description |
|----------|-------------|
| `record_upload.yaml` | Triggered on EHR upload → AI summarization → on-chain storage |
| `consent.yaml` | Verifies patient consent and provider credentials |
| `insurance_claim.yaml` | Risk scoring via Confidential Compute → automated payout |
| `supply_chain.yaml` | IoT sensor monitoring → counterfeit detection |
| `crosschain.yaml` | CCIP-based cross-chain insurance settlement |
| `worldid.yaml` | World ID proof verification → attestation issuance |

---

## Backend

The backend (`backend/`) is a TypeScript/Express server:

```bash
cd backend
npm run dev
```

### API Endpoints

See [docs/api.md](docs/api.md) for full API documentation.

---

## Frontend

The frontend (`frontend/`) is a Next.js application:

```bash
cd frontend
npm run dev
```

Access at `http://localhost:3000`.

---

## Deployment

### Testnet Deployment

```bash
# Deploy contracts
cd contracts && npx hardhat run scripts/deploy.ts --network sepolia

# Seed sample data
npx hardhat run scripts/seed_data.ts --network sepolia
```

### Tenderly Virtual TestNet

The project is configured for Tenderly Virtual TestNets. See deployment instructions in [docs/architecture.md](docs/architecture.md).

---

## Testing

```bash
# Smart contracts
cd contracts && npx hardhat test

# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## Demo & Testnet Links

- **Sepolia Contracts**: _Deployed contract addresses will be listed here after deployment_
- **Tenderly Dashboard**: _Link will be added after Virtual TestNet setup_
- **CCIP Explorer**: [ccip.chain.link](https://ccip.chain.link)

---

## Prize Track Eligibility

| Track | How mediCaRE Qualifies |
|-------|----------------------|
| **CRE & AI** | AI models orchestrated by CRE for EHR summarization, risk scoring, anomaly detection |
| **Privacy** | Confidential HTTP for FHIR data, Confidential Compute for risk scoring |
| **Risk & Compliance** | Real-time patient monitoring, insurance fraud detection, audit logs |
| **DeFi & Tokenization** | Insurance NFTs, supply-chain tokens, cross-chain settlements |
| **World ID** | Patient/provider identity verification with proof-of-personhood |
| **Tenderly VTN** | All workflows tested and demonstrated on Virtual TestNets |

---

## Team

Built for the **Chainlink Convergence Hackathon 2026**.

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
