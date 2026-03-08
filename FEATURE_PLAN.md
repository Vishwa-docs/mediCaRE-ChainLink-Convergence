# mediCaRE — FINAL PRIORITIZED FEATURE PLAN

> **Total Features: 27** | Primary: CRE & AI + Privacy | Backup: Risk & Compliance + DeFi & Tokenization | Sponsors: World ID + Tenderly + thirdweb

---

## 1. FINAL FEATURE LIST

### Track A — CRE & AI Features (11 features)

| # | Feature | Tracks | Layer | Extend vs New | Priority |
|---|---------|--------|-------|---------------|----------|
| A1 | **Multi-Agent AI Claim Adjudication** | CRE&AI, Autonomous Agents | CRE Workflow + Backend AI + Frontend | **NEW** CRE workflow `claim-adjudicator/` with 3-agent swarm (Triage, Medical Coding/CPT, Fraud Detection). **EXTEND** existing `insurance-claim/` workflow trigger, `risk.ts` AI module, InsurancePolicy.sol claims lifecycle | **MUST** |
| A2 | **AI Medical Historian** | CRE&AI | CRE Workflow + Backend AI + Frontend | **NEW** CRE workflow `medical-historian/` (cron/HTTP trigger → fetch 10 years of records → concatenate → LLM 1-page summary). **EXTEND** `summarizer.ts`, `visitSummary.ts`, EHRStorage.sol (add `longitudinalSummaryHash` field) | **MUST** |
| A3 | **AI-Generated Smart Consent** | CRE&AI, Privacy | Backend AI + Frontend | **NEW** backend AI module `consent-nlp.ts` (NLP parses plain English consent → structured on-chain policy params). **EXTEND** EHRStorage.sol `grantAccess()` to accept structured consent structs, frontend Records page | **MUST** |
| A4 | **BFT Consensus on AI Outputs** | CRE&AI | CRE Workflow | **EXTEND** existing CRE workflows (`insurance-claim`, `claim-adjudicator`) to use `runtime.runInNodeMode` + `consensusMedianAggregation` for multi-node AI inference. No new contract needed — result is a verified score written on-chain | **MUST** |
| A5 | **Explainable AI Audit Trails** | CRE&AI, Risk&Compliance | Backend AI + Contract + Frontend | **NEW** backend module `explainability.ts` (generates structured JSON reasoning for every AI decision). **EXTEND** InsurancePolicy.sol (add `explanationHash` to Claim struct), Audit Log frontend page | **MUST** |
| A6 | **Autonomous IRB Agent** | CRE&AI, Autonomous Agents | CRE Workflow + Backend AI | **NEW** CRE workflow `irb-agent/` (HTTP trigger → receive research proposal → LLM checks against ethical guidelines → outputs compliance score). **EXTEND** Governance.sol (add `ResearchProposal` struct + `IRBScoreRecorded` event) | **SHOULD** |
| A7 | **IoT Vitals Anomaly Detection** | CRE&AI, Risk&Compliance | CRE Workflow + Backend AI | **NEW** CRE workflow `vitals-monitor/` (cron trigger → fetch wearable API data → `anomaly.ts` model → write alert on-chain). **EXTEND** `anomaly.ts`, EHRStorage.sol (add emergency alert event) | **SHOULD** |
| A8 | **Doctor Credential Verification via CRE** | CRE&AI | CRE Workflow + Backend | **EXTEND** existing `consent/` workflow and `worldid/` workflow to add a step that calls a mock government medical registry API via Confidential HTTP before granting credential. **EXTEND** CredentialRegistry.sol (already has 8 types + `verifyCredential`) | **SHOULD** |
| A9 | **Claim-Ready Documentation Bundling** | CRE&AI | Backend AI + CRE Workflow | **EXTEND** `summarizer.ts` to output structured claim packet (ICD/CPT codes, procedures, dates). **EXTEND** `record-upload/` workflow to produce bundled output hash. No new contract needed — uses existing InsurancePolicy claim fields | **SHOULD** |
| A10 | **Dynamic Premium Adjustments** | CRE&AI, DeFi&Tokenization | CRE Workflow + Contract | **NEW** CRE workflow `premium-adjuster/` (cron trigger → aggregate patient risk data → call `adjustPremium()` on InsurancePolicy.sol). **EXTEND** InsurancePolicy.sol (already has `adjustPremium` + `riskScore`) | **MUST** |
| A11 | **AI Visit Summary Enhancement** | CRE&AI | Backend AI + Frontend | **EXTEND** existing `visitSummary.ts` to add medication timeline, red-flag highlighting, patient-friendly discharge summary. **EXTEND** Visit Summary frontend page with structured output display | **SHOULD** |

---

### Track B — Privacy Features (6 features)

| # | Feature | Tracks | Layer | Extend vs New | Priority |
|---|---------|--------|-------|---------------|----------|
| B1 | **Confidential EHR Orchestration via FHIR** | Privacy, CRE&AI | CRE Workflow + Backend Service | **EXTEND** existing `consent/` and `record-upload/` workflows to use Confidential HTTP for FHIR server calls inside TEE. **EXTEND** `fhir.ts` service (already exists). Secrets injected via CRE secrets management | **MUST** |
| B2 | **Paramedic Glass-Break Emergency Failsafe** | Privacy | CRE Workflow + Contract + Frontend | **NEW** CRE workflow `emergency-access/` (time-locked trigger → bypass consent → fetch blood type/allergies → return to paramedic → immutable audit trail). **EXTEND** EHRStorage.sol (add `emergencyAccess()` with `EmergencyAccessGranted` event + mandatory reason code) | **MUST** |
| B3 | **Zero-Knowledge Clinical Trial Matching** | Privacy | CRE Workflow + Backend | **NEW** CRE workflow `trial-matcher/` (pharma posts trial criteria → CRE fetches patient profiles confidentially → LLM evaluates eligibility → posts only `isEligible` boolean on-chain). **EXTEND** Governance.sol (add `TrialRegistered` event) | **SHOULD** |
| B4 | **Immutable HIPAA/GDPR Audit Trails** | Privacy, Risk&Compliance | Contract + Backend + Frontend | **EXTEND** all existing contracts to emit richer audit events (accessor hash, timestamp, purpose, data category). **EXTEND** Audit Log frontend page with filters, timeline, and export. **EXTEND** backend `analytics.ts` to index audit events | **MUST** |
| B5 | **Granular RBAC with Healthcare Roles** | Privacy | Contract + Backend | **EXTEND** existing `AccessManager.sol` utility to define healthcare-specific roles (Patient, AttendingPhysician, Auditor, InsuranceProvider, Researcher, Paramedic). **EXTEND** all 5 existing contracts to use new role modifiers | **MUST** |
| B6 | **Revocable Access with Key Rotation** | Privacy | CRE Workflow + Backend + Contract | **EXTEND** EHRStorage.sol `revokeAccess()` (already exists) to emit `AccessRevoked` event that triggers a **NEW** CRE workflow `key-rotation/` (rotates off-chain encryption keys, re-encrypts IPFS content, updates CID hash on-chain) | **NICE-TO-HAVE** |

---

### Track C — Risk & Compliance Features (4 features)

| # | Feature | Tracks | Layer | Extend vs New | Priority |
|---|---------|--------|-------|---------------|----------|
| C1 | **Automated Fraud & Anomaly Detection** | Risk&Compliance, CRE&AI | CRE Workflow + Backend AI | **NEW** CRE workflow `fraud-monitor/` (cron trigger → scan recent claims → graph-based anomaly detection on billing frequencies per hospital → flag suspicious patterns → write RiskEvent on-chain). **EXTEND** `anomaly.ts`, InsurancePolicy.sol (add `ClaimFlagged` event) | **MUST** |
| C2 | **Insurance Treasury Reserve Monitor** | Risk&Compliance, DeFi&Tokenization | CRE Workflow + Contract | **EXTEND** `fraud-monitor/` workflow to include reserve-check step (read insurer stablecoin balance → if below threshold → auto-pause payouts via InsurancePolicy.sol `pausePayouts()`). **EXTEND** InsurancePolicy.sol (add `paused` state + `PayoutsPaused` event) | **SHOULD** |
| C3 | **ABDM API Compatibility Layer** | Risk&Compliance | Backend Service + CRE Workflow | **NEW** backend service `abdm.ts` (mock ABDM OAuth 2.0 + OTP flow, ABHA ID generation). **EXTEND** `worldid/` CRE workflow to optionally link ABHA ID as secondary identifier | **NICE-TO-HAVE** |
| C4 | **Multi-Signature Policy Governance** | Risk&Compliance | Contract | **EXTEND** Governance.sol to add multi-sig requirement for critical parameter changes (risk thresholds, payout limits). Add `MultiSigRequired` modifier and `SignatureCollected` event. No new contract — extends existing DAO | **SHOULD** |

---

### Track D — DeFi & Tokenization Features (3 features)

| # | Feature | Tracks | Layer | Extend vs New | Priority |
|---|---------|--------|-------|---------------|----------|
| D1 | **Cross-Chain Emergency Health Passports** | DeFi&Tokenization, Privacy | Contract + CRE Workflow | **NEW** contract `HealthPassport.sol` (dynamic NFT — blood type, allergies, emergency contacts). **EXTEND** `crosschain/` CRE workflow to sync passport NFT metadata across chains via CCIP | **SHOULD** |
| D2 | **Cross-Chain Treasury Settlement via CCIP** | DeFi&Tokenization | CRE Workflow + Contract | **EXTEND** existing `crosschain/` workflow (already handles CCIP bridge). Add treasury management logic — insurer funds on Chain A, hospitals paid on Chain B. **EXTEND** InsurancePolicy.sol (add `CrossChainPayoutInitiated` event) | **MUST** |
| D3 | **Opt-in Data Monetization** | DeFi&Tokenization, Privacy | CRE Workflow + Contract + Frontend | **EXTEND** Governance.sol (add `ResearchConsent` token minting for opt-in patients). **NEW** CRE workflow `data-marketplace/` (researcher requests data → CRE checks consent token → delivers anonymized data → tokenized payment via CCIP) | **NICE-TO-HAVE** |

---

### Track E — Sponsor Track Features (3 features)

| # | Feature | Tracks | Layer | Extend vs New | Priority |
|---|---------|--------|-------|---------------|----------|
| E1 | **World ID Sybil-Resistant Onboarding** | World ID + CRE | CRE Workflow + Contract + Frontend | **EXTEND** existing `worldid/` CRE workflow, `AccessManager.sol` (already gates with World ID), `worldid.ts` service. **EXTEND** frontend Mini App page for World App IDKit integration. Add nullifier hash recording to prevent duplicate registrations | **MUST** |
| E2 | **Tenderly Virtual TestNet Simulation** | Tenderly | Infrastructure + Docs | **EXTEND** existing Tenderly VNet deployment config. Create deterministic test scripts, Tenderly Dashboard public URLs, replay packages. Add `tenderly.config.ts` with fork configs for multi-chain (Ethereum fork + Base fork). Document `cre simulate` commands | **MUST** |
| E3 | **thirdweb Gasless Onboarding** | thirdweb | Frontend + Config | **EXTEND** existing `thirdweb.ts` lib config. Integrate thirdweb React SDK `ConnectButton`, smart accounts (ERC-4337), gasless transaction relaying. Patient-facing flows require zero gas knowledge | **SHOULD** |

---

## 2. NEW CONTRACTS NEEDED

| Contract | Purpose | Lines (est.) | Extends |
|----------|---------|-------------|---------|
| **HealthPassport.sol** | Dynamic ERC-721 NFT storing emergency medical data (blood type, allergies, emergency contacts). CCIP-ready with cross-chain metadata sync. | ~250 | New standalone — uses AccessManager.sol |

**No other new contracts needed.** All other features extend the existing 6 contracts:
- `EHRStorage.sol` — add `emergencyAccess()`, `longitudinalSummaryHash`, richer audit events
- `InsurancePolicy.sol` — add `explanationHash` to Claim, `ClaimFlagged` event, `pausePayouts()`, `CrossChainPayoutInitiated`
- `CredentialRegistry.sol` — minor extensions for CRE-verified government registry checks
- `Governance.sol` — add `ResearchProposal` struct, multi-sig modifier, `ResearchConsent` token mint
- `SupplyChain.sol` — no significant changes needed
- `AccessManager.sol` — expand healthcare role enum (Paramedic, Researcher, Auditor)

---

## 3. NEW CRE WORKFLOWS NEEDED

| Workflow Directory | Trigger Type | Primary Track | New vs Extend |
|-------------------|-------------|---------------|---------------|
| `claim-adjudicator/` | EVM Log (ClaimSubmitted) | CRE&AI, Privacy | **NEW** — 3-agent swarm pipeline |
| `medical-historian/` | HTTP / Cron | CRE&AI | **NEW** — longitudinal record aggregation |
| `emergency-access/` | HTTP (time-locked) | Privacy | **NEW** — glass-break failsafe |
| `vitals-monitor/` | Cron | CRE&AI, Risk&Compliance | **NEW** — IoT anomaly detection |
| `irb-agent/` | HTTP | CRE&AI | **NEW** — autonomous ethics review |
| `premium-adjuster/` | Cron | CRE&AI, DeFi | **NEW** — dynamic premium recalculation |
| `fraud-monitor/` | Cron | Risk&Compliance | **NEW** — graph-based claim anomaly detection |
| `trial-matcher/` | HTTP | Privacy | **NEW** — ZK clinical trial eligibility |
| `key-rotation/` | EVM Log (AccessRevoked) | Privacy | **NEW** — encryption key rotation |
| `data-marketplace/` | HTTP | DeFi&Tokenization | **NEW** — opt-in research data pipeline |

**Existing workflows to extend (not new files):**
- `record-upload/` — add claim documentation bundling step
- `consent/` — add FHIR Confidential HTTP + doctor credential verification step
- `crosschain/` — add health passport sync + treasury settlement logic
- `worldid/` — add nullifier hash recording + ABDM linking
- `insurance-claim/` — add BFT consensus wrapper + explainability hash
- `supply-chain/` — no significant changes

---

## 4. BACKEND CHANGES

### New AI Modules (`backend/src/ai/`)

| Module | Purpose |
|--------|---------|
| `claimAdjudicator.ts` | Multi-agent swarm: triage classification, CPT/ICD code validation, fraud pattern scoring. Returns consensus verdict + explanation JSON |
| `consentNlp.ts` | NLP parser: plain English → structured consent parameters (provider, data category, purpose, duration) |
| `explainability.ts` | Generates structured reasoning JSON for every AI decision (bullet-point justifications, uncertainty flags, model provenance) |
| `medicalHistorian.ts` | Aggregates multi-year record fragments → LLM generates 1-page longitudinal clinical summary |

### New Services (`backend/src/services/`)

| Service | Purpose |
|---------|---------|
| `abdm.ts` | Mock ABDM API compatibility layer (OAuth 2.0, OTP, ABHA ID generation) |
| `audit.ts` | Audit trail indexer — listens to on-chain events, stores structured audit records, provides query API |
| `treasury.ts` | Insurance treasury monitor — reads reserve balances, computes health metrics, triggers pause alerts |

### New Routes (`backend/src/routes/`)

| Route File | Endpoints |
|-----------|-----------|
| `audit.routes.ts` | `GET /api/audit/trail/:entityId`, `GET /api/audit/search`, `GET /api/audit/export` |
| `emergency.routes.ts` | `POST /api/emergency/glass-break`, `GET /api/emergency/access-log` |
| `research.routes.ts` | `POST /api/research/trial-match`, `POST /api/research/data-request`, `GET /api/research/consent-status` |
| `treasury.routes.ts` | `GET /api/treasury/reserves`, `GET /api/treasury/health`, `POST /api/treasury/pause` |

### Existing Backend Extensions

| File | Changes |
|------|---------|
| `ai/risk.ts` | Add fraud-pattern graph analysis, hospital billing frequency scoring |
| `ai/anomaly.ts` | Add IoT vitals anomaly detection (heart rate, blood glucose thresholds) |
| `ai/summarizer.ts` | Add claim-bundle generation (ICD/CPT extraction), patient-friendly discharge summary |
| `ai/visitSummary.ts` | Add medication timeline, red-flag highlighting, structured output |
| `services/blockchain.ts` | Add HealthPassport.sol ABI + interaction methods, new InsurancePolicy methods |
| `services/fhir.ts` | Expand FHIR resource types (DiagnosticReport, Observation, MedicationStatement) |
| `services/worldid.ts` | Add nullifier hash deduplication, ABDM ID linking |
| `services/ipfs.ts` | Add key rotation support, re-encryption flow |
| `routes/insurance.routes.ts` | Add adjudicator swarm endpoint, premium adjustment trigger, treasury status |
| `routes/ehr.routes.ts` | Add longitudinal summary request, emergency access endpoint |
| `routes/credential.routes.ts` | Add government registry verification trigger |

---

## 5. FRONTEND CHANGES

### New Pages (`frontend/src/app/`)

| Route | Purpose |
|-------|---------|
| `/emergency` | Glass-break emergency access panel — paramedic enters patient ID, reason code, gets blood type/allergies with countdown timer UI |
| `/research` | Clinical trial matching + data monetization dashboard — patients see opt-in toggles, researchers see anonymized query interface |
| `/treasury` | Insurance treasury health dashboard — reserve levels, payout velocity, pause status, yield (conceptual) |

### Existing Page Enhancements

| Page | Changes |
|------|---------|
| `/dashboard` | Add role-based conditional rendering (Patient / Doctor / Insurer / Admin). Health passport NFT card. Quick-action buttons for common workflows |
| `/records` | Add "Smart Consent" NLP input (plain English → structured policy). Longitudinal summary request button. Emergency access history |
| `/visit-summary` | Enhanced AI output display: medication timeline, red-flag badges, patient-friendly toggle, downloadable PDF |
| `/insurance` | Multi-agent adjudication status panel with step-by-step progress (Triage → Coding → Fraud → Verdict). Explainability panel showing AI reasoning. Dynamic premium history chart |
| `/credentials` | CRE-verified government registry badge. Credential verification status with blockchain confirmation |
| `/audit-log` | Rich filterable timeline: consent events, access events, AI decisions, emergency access. Export to CSV. HIPAA/GDPR compliance indicators |
| `/analytics` | Treasury reserve charts. Fraud detection heatmap. Claim processing velocity metrics |
| `/contract-health` | Tenderly VNet integration — link to dashboard, transaction traces, fork status |
| `/governance` | Multi-sig proposal flow. IRB agent compliance score display. Research proposal submission |
| `/mini-app` | World ID proof flow with IDKit. Gasless transaction demo via thirdweb |
| `/settings` | Data monetization opt-in toggles. Key rotation trigger. ABDM ID linking |
| `/supply-chain` | No major changes — already comprehensive |
| `/ai-models` | Add model provenance display, BFT consensus visualization |

### New Components (`frontend/src/components/`)

| Component | Purpose |
|-----------|---------|
| `shared/ProgressPipeline.tsx` | Rotating progress bar with step labels for multi-step blockchain/AI workflows |
| `shared/ExplainabilityPanel.tsx` | Displays AI reasoning as structured bullet points with confidence scores |
| `shared/AuditTimeline.tsx` | Vertical timeline component for audit trail events |
| `shared/ConsentNlpInput.tsx` | Text input with NLP parsing preview ("Only let Dr. Smith see cardiology for 2 weeks" → structured params) |
| `insurance/AdjudicatorSwarm.tsx` | 3-column panel showing Triage / Coding / Fraud agent status and verdicts |
| `insurance/PremiumChart.tsx` | Line chart showing premium history over time with risk score overlay |
| `records/HealthPassportCard.tsx` | NFT-styled card showing emergency medical data |
| `records/LongitudinalSummary.tsx` | Expandable 1-page clinical summary with section anchors |
| `dashboard/TreasuryWidget.tsx` | Mini dashboard widget showing reserve health, payout capacity |
| `layout/RoleSelector.tsx` | Role-based view switching (Patient / Doctor / Insurer / Admin) |

---

## 6. FEATURES TO SKIP

| Feature from Requirements | Reason to Skip |
|--------------------------|----------------|
| **Federated Learning AI DAO** | Too complex for hackathon scope — requires actual federated learning infrastructure, model weight aggregation, and staking mechanics. Would dilute focus from CRE&AI |
| **Tokenized Yield Vault (Aave/Compound integration)** | Overly complex DeFi integration that diverts from healthcare focus. Instead, we represent the *concept* via treasury reserve monitoring + yield display (mock data). Judges care about healthcare, not yield farming |
| **Automated Prescription Fulfillment** | Requires real pharmacy API integration outside hackathon scope. Would clutter the demo flow without adding track value |
| **Decentralized Messaging** | Not core to any prize track. Adds scope without differentiation. Can be mentioned as future work |
| **Rewards and Wellness Incentives** | Token incentives are tangential to CRE&AI and Privacy tracks. Not enough time to design tokenomics properly |
| **Sustainability / Carbon Tracking** | Unrelated to healthcare hackathon tracks. Pure scope dilution |
| **Language Localization** | Nice-to-have that doesn't score points in any track. Can be added post-hackathon |
| **Research and AI Model Marketplace** | Too ambitious — requires marketplace infrastructure, payment flows, model hosting. ZK Trial Matching covers the research angle more elegantly |
| **Proof-of-Reserves (full DeFi implementation)** | Replaced by simpler Treasury Reserve Monitor (C2) which achieves the same demo value |
| **CoverageToken (separate ERC-20/ERC-1155)** | InsurancePolicy.sol already represents policies as ERC-721 NFTs. A separate coverage token adds confusion without value |

---

## 7. IMPLEMENTATION PRIORITY ORDER

### Phase 1 — MUST (Core Demo Flow) — 12 features
These form the end-to-end demo: Patient → Doctor → Claim → AI → Payout

1. **B5** Granular RBAC (foundation for all role-based flows)
2. **E1** World ID Sybil-Resistant Onboarding (identity layer)
3. **B1** Confidential EHR Orchestration via FHIR (privacy backbone)
4. **A2** AI Medical Historian (headline CRE&AI feature)
5. **A1** Multi-Agent Claim Adjudication (headline Autonomous Agents feature)
6. **A4** BFT Consensus on AI Outputs (differentiator for CRE track)
7. **A5** Explainable AI Audit Trails (links AI → compliance)
8. **B4** Immutable HIPAA/GDPR Audit Trails (privacy track anchor)
9. **A10** Dynamic Premium Adjustments (CRE Cron showcase)
10. **D2** Cross-Chain Treasury Settlement via CCIP (DeFi backup + CCIP usage)
11. **C1** Automated Fraud & Anomaly Detection (Risk track anchor)
12. **E2** Tenderly Virtual TestNet Simulation (sponsor track + demo credibility)

### Phase 2 — SHOULD (Track Strengtheners) — 10 features
These deepen track coverage and add polish

13. **A3** AI-Generated Smart Consent
14. **B2** Paramedic Glass-Break Emergency Failsafe
15. **A6** Autonomous IRB Agent
16. **A7** IoT Vitals Anomaly Detection
17. **A8** Doctor Credential Verification via CRE
18. **A9** Claim-Ready Documentation Bundling
19. **A11** AI Visit Summary Enhancement
20. **E3** thirdweb Gasless Onboarding
21. **D1** Cross-Chain Emergency Health Passports
22. **C4** Multi-Signature Policy Governance

### Phase 3 — NICE-TO-HAVE (Bonus Points) — 5 features
Add if time permits

23. **B3** Zero-Knowledge Clinical Trial Matching
24. **C2** Insurance Treasury Reserve Monitor
25. **D3** Opt-in Data Monetization
26. **B6** Revocable Access with Key Rotation
27. **C3** ABDM API Compatibility Layer

---

## 8. TRACK COVERAGE MATRIX

| Track | Prize | Features Covering It | Confidence |
|-------|-------|---------------------|------------|
| **CRE & AI** | $17,000 | A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, B1 | **Very High** — 12 features with deep CRE integration |
| **Autonomous Agents** | $5,000 | A1 (Multi-Agent Swarm), A6 (IRB Agent), A7 (Vitals Monitor), A10 (Premium Adjuster), C1 (Fraud Monitor) | **High** — 5 autonomous agent workflows |
| **Privacy** | $16,000 | B1, B2, B3, B4, B5, B6, A3, A5, D3 | **Very High** — Confidential HTTP, TEE, ZK, RBAC |
| **Risk & Compliance** | $16,000 | C1, C2, C3, C4, B4, A5, A7 | **High** — Fraud detection, audit trails, reserve checks |
| **DeFi & Tokenization** | $16,000 | D1, D2, D3, A10 | **Medium** — Cross-chain settlement, NFT passports, tokenized policies |
| **World ID + CRE** | $5,000 | E1, B5 | **High** — Deep ZKP integration for patient/provider identity |
| **Tenderly** | $5,000 | E2 | **High** — Full VNet deployment with replay packages |
| **thirdweb** | $5,000 | E3 | **Medium** — Gasless onboarding via smart accounts |

**Maximum addressable prize pool: $85,000**

---

## 9. DEMO FLOW (README 3-4 Priority Workflows)

### Workflow 1: Patient Journey
Patient signs up → World ID verification → Smart consent in plain English → View longitudinal AI summary → Opt-in to research

### Workflow 2: Doctor Journey  
Doctor logs in → Verified credentials → Request patient records (CRE consent check) → AI visit summary → Submit insurance claim

### Workflow 3: Claim Adjudication Journey
Claim filed → CRE triggers 3-agent swarm (Triage → CPT Coding → Fraud Check) → BFT consensus → Explainable verdict → Cross-chain CCIP payout

### Workflow 4: Emergency Access Journey
Paramedic triggers glass-break → Time-locked CRE bypass → Blood type/allergies retrieved → Immutable audit trail recorded → Patient notified

---

## 10. KEY TECHNICAL DIFFERENTIATORS FOR JUDGES

1. **Multi-Agent AI Swarm** — Not just one LLM; three specialized agents with BFT consensus
2. **Confidential Compute** — PHI never touches the blockchain; only ZK attestations
3. **CRE Orchestration** — Every major workflow uses triggers, Confidential HTTP, EVM read/write, and secrets
4. **Cross-Chain Settlement** — CCIP bridges payout from insurer chain to hospital chain
5. **Glass-Break Failsafe** — Novel emergency access pattern with cryptographic audit trail
6. **Smart Consent NLP** — Plain English → on-chain policy (unique in healthcare DApps)
7. **Full Tenderly Verification** — Every transaction reproducible with explorer links
