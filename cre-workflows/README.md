# mediCaRE — CRE Workflows

Chainlink Compute Runtime Environment (CRE) workflows orchestrating the mediCaRE platform's decentralized operations.

## Workflows

| Workflow | Directory | Trigger | Description |
|----------|-----------|---------|-------------|
| **Record Upload** | `record-upload/` | HTTP | Encrypts EHR → uploads to IPFS → registers CID on-chain |
| **Consent** | `consent/` | HTTP | Validates credentials → fetches authorized data via Confidential HTTP |
| **Insurance Claim** | `insurance-claim/` | HTTP | Risk scoring via Confidential Compute → automated claim decision |
| **Supply Chain** | `supply-chain/` | Cron/HTTP | IoT anomaly detection → batch flagging/recall |
| **Cross-Chain** | `crosschain/` | HTTP | CCIP token/message bridging across chains |
| **World ID** | `worldid/` | HTTP | World ID API verification → on-chain attestation |

## Chainlink Capabilities Used

| Capability | Workflows |
|-----------|-----------|
| **HTTP Trigger** | All workflows |
| **Confidential HTTP** | Record Upload, Consent, World ID |
| **Confidential Compute** | Insurance Claim (risk scoring) |
| **EVM Read** | Consent, Supply Chain |
| **EVM Write** | Record Upload, Insurance Claim, Supply Chain, World ID |
| **Cron Trigger** | Supply Chain (periodic monitoring) |
| **CCIP Send** | Cross-Chain |
| **Data Feed** | Supply Chain (price/condition data) |

## Structure

Each workflow contains:
- `main.ts` — Workflow definition with capability declarations
- `config.ts` — Configuration (contract addresses, DON IDs, chain selectors)
- `types.ts` — TypeScript interfaces

## Key Integration: World ID + CRE

The `worldid/` workflow (340 lines) demonstrates a novel integration:
1. HTTP trigger receives World ID proof
2. Confidential HTTP calls World ID API (keys never exposed to nodes)
3. DON reaches consensus on verification result
4. EVM Write records attestation on-chain via AccessManager
