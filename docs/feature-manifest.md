# mediCaRE — Feature Manifest

All implemented features organized by hackathon track.

---

## Track 1: CRE and AI

| # | Feature | Implementation |
|---|---------|---------------|
| 1 | Multi-Agent Claim Adjudicator | CRE workflow (`claim-adjudicator/`), backend AI module (`ai/claimAdjudicator.ts`), frontend component (`AdjudicatorSwarm.tsx`) |
| 2 | Medical Historian | CRE workflow (`medical-historian/`), backend AI module (`ai/medicalHistorian.ts`), frontend component (`LongitudinalSummary.tsx`) |
| 3 | AI Explainability Engine | Backend module (`ai/explainability.ts`), frontend component (`ExplainabilityPanel.tsx`), on-chain hash in `InsurancePolicy.sol` |
| 4 | NLP Consent Parser | Backend module (`ai/consentNlp.ts`), frontend component (`ConsentNlpInput.tsx`) |
| 5 | Vitals Monitor | CRE workflow (`vitals-monitor/`), cron-triggered wearable IoT anomaly detection |
| 6 | IRB Compliance Agent | CRE workflow (`irb-agent/`), research proposals in `Governance.sol` |
| 7 | Premium Adjuster | CRE workflow (`premium-adjuster/`), monthly cron, bounded adjustment |
| 8 | Pre/Post Visit AI Summarization | CRE workflows + backend AI module |

## Track 2: Privacy

| # | Feature | Implementation |
|---|---------|---------------|
| 9 | Emergency Glass-Break Access | CRE workflow (`emergency-access/`), routes (`emergency.routes.ts`), frontend page (`/emergency`) |
| 10 | ZK Clinical Trial Matching | CRE workflow (`trial-matcher/`), routes (`research.routes.ts`), frontend page (`/research`) |
| 11 | Automatic Key Rotation | CRE workflow (`key-rotation/`), EVM log trigger on AccessRevoked |
| 12 | Data Marketplace | CRE workflow (`data-marketplace/`), consent-gated, TEE anonymization |
| 13 | World ID ZKP Integration | `AccessManager.sol`, CRE worldid workflow, frontend verification |
| 14 | Confidential Compute | Used across claim-adjudicator, trial-matcher, data-marketplace, emergency-access workflows |

## Track 3: Risk and Compliance

| # | Feature | Implementation |
|---|---------|---------------|
| 15 | Fraud Monitor | CRE workflow (`fraud-monitor/`), graph-based anomaly detection, auto-pause |
| 16 | Treasury Health Dashboard | Backend service (`services/treasury.ts`), routes (`treasury.routes.ts`), frontend page (`/treasury`) |
| 17 | Immutable Audit Trail | Backend service (`services/audit.ts`), routes (`audit.routes.ts`), component (`AuditTimeline.tsx`) |
| 18 | IoT Supply Chain Monitoring | `SupplyChain.sol` + CRE supply-chain workflow |
| 19 | Progress Pipeline Visualization | Frontend component (`ProgressPipeline.tsx`), used in research and insurance pages |

## Track 4: DeFi and Tokenization

| # | Feature | Implementation |
|---|---------|---------------|
| 20 | ERC-721 Insurance NFTs | `InsurancePolicy.sol` with cross-chain payouts |
| 21 | ERC-1155 Supply Chain Tokens | `SupplyChain.sol` |
| 22 | CCIP Cross-Chain Settlement | CRE crosschain workflow + `recordCrossChainPayout()` on-chain |
| 23 | Dynamic Premium Pricing | CRE `premium-adjuster/` + `PremiumChart.tsx` component |
| 24 | Treasury Reserve Monitoring | `TreasuryWidget.tsx` + backend service + auto-pause in fraud-monitor |

## Cross-Cutting

| # | Feature | Implementation |
|---|---------|---------------|
| 25 | Role-Based UI | Frontend component (`RoleSelector.tsx`) with 6 healthcare roles |
| 26 | ABDM India API Integration | Backend service (`services/abdm.ts`), ABHA ID generation, consent flow |

## Authentication and Identity

| # | Feature | Implementation |
|---|---------|---------------|
| 27 | Supabase Auth Store | Cloud PostgreSQL with users, sessions, World ID verifications, audit log |
| 28 | JWT Authentication System | Backend routes (`routes/auth.routes.ts`), 7 endpoints |
| 29 | Login Page with Demo Accounts | Frontend `/login` page, 6 quick-login cards |
| 30 | Auth Context and Route Guard | Frontend `AuthContext.tsx`, `AuthGate` in layout, automatic redirect |
| 31 | World ID Verification | IDKit v4 widget + `@worldcoin/idkit-server` signing + CRE workflow |
| 32 | Auth Session CRE Workflow | CRE workflow (`auth-session/`), role permissions, JWT session builder |

---

## Priority Workflows for Demo

These workflows are the focus of the pitch video and should be demonstrated in order:

1. **Claim Adjudicator** — 3-agent BFT swarm, on-chain explainability, consensus visualization
2. **Emergency Glass-Break** — Countdown timer, immutable audit trail
3. **Trial Matcher** — ZK-style boolean result, TEE processing, consent-gated
4. **Fraud Monitor** — Graph anomaly detection, auto-pause, treasury integration
