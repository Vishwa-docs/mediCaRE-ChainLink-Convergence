# mediCaRE — Backend API

Express.js / TypeScript API server providing AI, blockchain, FHIR, IPFS, and World ID services.

## Tech Stack

- **Express.js** + **TypeScript**
- **ethers.js v6** — blockchain interaction
- **Azure OpenAI (GPT-4o)** — AI summarization
- **Zod** — request validation
- **Winston** — structured logging
- **JWT** — authentication
- **Helmet / CORS** — security headers

## Key Services

| Service | File | Description |
|---------|------|-------------|
| Blockchain | `blockchain.ts` | Contract interaction via ethers.js |
| AI Summarizer | `ai/summarizer.ts` | Pre/post visit summary generation |
| Risk Scorer | `ai/risk_scorer.ts` | Logistic regression insurance risk |
| Anomaly Detector | `ai/anomaly_detector.ts` | Z-score IoT anomaly detection |
| IPFS | `ipfs.ts` | Pinata pinning + AES-256-GCM encryption |
| FHIR | `fhir.ts` | HL7 FHIR R4 integration |
| World ID | `worldid.ts` | Proof-of-personhood verification |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/ehr/upload` | Upload encrypted EHR to IPFS |
| POST | `/api/insurance/create-policy` | Create insurance policy |
| POST | `/api/insurance/file-claim` | File insurance claim |
| POST | `/api/supply/create-batch` | Create supply chain batch |
| POST | `/api/credentials/issue` | Issue provider credential |
| POST | `/api/ai/summarize` | General AI summarization |
| POST | `/api/ai/pre-visit-summary` | Pre-visit preparation summary |
| POST | `/api/ai/post-visit-summary` | Post-visit documentation summary |
| POST | `/api/ai/worldid/verify` | World ID proof verification |

Full reference: [../docs/api.md](../docs/api.md)

## Setup

```bash
npm install
cp .env.example .env    # Configure API keys
npm run dev             # http://localhost:3001
```

## Testing

```bash
npm test    # 50 tests (Jest)
```

## Security

- Three-tier rate limiting (global, per-IP, per-endpoint)
- Helmet security headers
- CORS policy
- Zod input validation on all endpoints
- JWT authentication
- AES-256-GCM encryption for health data
