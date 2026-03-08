# mediCaRE — API Documentation

> **Version:** 1.0.0  
> **Base URL:** `https://medicare-backend-production-861b.up.railway.app/api`  
> **Last Updated:** 2026-03-09

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Common Response Format](#common-response-format)
5. [Error Handling](#error-handling)
6. [Endpoints](#endpoints)
   - [Health Check](#health-check)
   - [EHR Module](#ehr-module)
   - [Insurance Module](#insurance-module)
   - [Supply Chain Module](#supply-chain-module)
   - [Credentials Module](#credentials-module)
   - [AI Module](#ai-module)
   - [World ID Module](#world-id-module)

---

## Overview

The mediCaRE backend exposes a RESTful JSON API built on Express.js. All endpoints are prefixed with `/api` and organized by domain module. The server accepts `application/json` request bodies (up to 10 MB) and `multipart/form-data` for file uploads.

### Technology Stack

| Component | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Security | Helmet (HTTP headers), CORS, express-rate-limit |
| Validation | Zod schemas |
| Blockchain | ethers.js v6 |
| Storage | Pinata (IPFS) |
| AI | OpenAI-compatible LLM API |
| Logging | Winston + Morgan |

---

## Authentication

The API uses **JSON Web Tokens (JWT)** for authenticated endpoints.

### Obtaining a Token

Tokens are issued upon successful World ID verification or wallet signature authentication.

### Using a Token

Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### Token Properties

| Property | Value |
|---|---|
| Algorithm | HS256 |
| Expiry | 24 hours (configurable via `JWT_EXPIRES_IN`) |
| Secret | Server-side `JWT_SECRET` environment variable |

### Unauthenticated Endpoints

The following endpoints do not require authentication:

- `GET /api/health`
- `GET /api/credentials/verify/:hash` (public credential verification)
- `POST /api/worldid/verify` (identity verification)

---

## Rate Limiting

The API enforces rate limits to prevent abuse:

| Scope | Window | Max Requests | Applies To |
|---|---|---|---|
| **Global API** | 15 minutes | 100 | All `/api/*` endpoints |
| **AI Endpoints** | 1 minute | 10 | `/api/ai/summarize`, `/api/ai/risk-score`, `/api/ai/anomaly-detect` |
| **Auth Endpoints** | 15 minutes | 20 | `/api/worldid/verify` |

### Rate Limit Headers

Responses include standard rate limit headers:

```
RateLimit-Limit: 100
RateLimit-Remaining: 97
RateLimit-Reset: 1709136000
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": "Too many requests — please try again later",
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Status Code:** `429 Too Many Requests`

---

## Common Response Format

All API responses follow a consistent envelope format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Human-readable error message",
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

## Error Handling

| Status Code | Meaning | Example |
|---|---|---|
| `200` | Success | Record retrieved, verification complete |
| `201` | Created | Policy created, credential issued |
| `400` | Bad Request | Invalid input, missing required fields |
| `401` | Unauthorized | Missing or invalid JWT |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `429` | Rate Limited | Too many requests |
| `500` | Internal Server Error | Blockchain transaction failure, AI service error |
| `503` | Service Unavailable | Blockchain node unreachable |

---

## Endpoints

---

### Health Check

#### `GET /api/health`

Returns service health information including blockchain connectivity status.

**Authentication:** None

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "medicare-backend",
    "version": "1.0.0",
    "uptime": 3672.45,
    "blockchain": {
      "connected": true,
      "blockNumber": 7284561,
      "signerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
    },
    "memory": {
      "rss": 85262336,
      "heapTotal": 42598400,
      "heapUsed": 38291456,
      "external": 2105896,
      "arrayBuffers": 106496
    }
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `503` | Service startup failure |

---

### EHR Module

#### `POST /api/ehr/upload`

Upload an Electronic Health Record to IPFS and register its hash on-chain.

**Authentication:** Required (JWT)

**Content-Type:** `multipart/form-data` or `application/json`

**Request Body (multipart):**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes* | EHR file to upload (max 10 MB) |
| `patientAddress` | string | Yes | Patient's Ethereum address |
| `recordType` | string | Yes | Record category (e.g., `"LAB"`, `"IMAGING"`, `"PRESCRIPTION"`) |

**Request Body (JSON alternative):**

```json
{
  "patientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "recordType": "LAB",
  "fileContent": "base64EncodedFileContent..."
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "recordId": "0",
    "cid": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    "cidHash": "0xa7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "blockNumber": 7284562
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | No file or fileContent provided; invalid patient address |
| `500` | IPFS upload failure; blockchain transaction reverted |

---

#### `GET /api/ehr/:patientAddress`

Retrieve all record IDs and metadata for a given patient.

**Authentication:** Required (JWT)

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `patientAddress` | string | Patient's Ethereum address |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "recordId": "0",
      "patient": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      "ipfsCidHash": "0xa7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
      "aiSummaryHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "recordType": "LAB",
      "createdAt": 1740500000,
      "updatedAt": 1740500000,
      "isActive": true
    },
    {
      "recordId": "1",
      "patient": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
      "ipfsCidHash": "0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      "aiSummaryHash": "0xc3c4733ec8affd06cf9e9ff50ffc6bcd2ec85a6170004bb709669c31de94391a",
      "recordType": "IMAGING",
      "createdAt": 1740400000,
      "updatedAt": 1740450000,
      "isActive": true
    }
  ],
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

#### `POST /api/ehr/summarize`

Submit raw EHR text for AI-powered clinical summarization.

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "ehrText": "Patient: John Doe, Age: 45. Chief complaint: persistent chest pain for 3 days. History of hypertension (diagnosed 2020). Current medications: Lisinopril 10mg daily, Aspirin 81mg. Recent labs: Total cholesterol 245 mg/dL (H), LDL 165 mg/dL (H), HbA1c 6.8%. BP at visit: 148/92...",
  "language": "en"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `ehrText` | string | Yes | — | Raw EHR content (plain text, HL7, or JSON) |
| `language` | string | No | `"en"` | ISO 639-1 language code for output |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "patientId": "unknown",
    "diagnoses": [
      "Essential hypertension (I10)",
      "Hyperlipidemia (E78.5)",
      "Pre-diabetes (R73.03)"
    ],
    "medications": [
      {
        "name": "Lisinopril",
        "dosage": "10mg",
        "frequency": "once daily",
        "startDate": "2020",
        "endDate": null
      },
      {
        "name": "Aspirin",
        "dosage": "81mg",
        "frequency": "once daily",
        "startDate": null,
        "endDate": null
      }
    ],
    "allergies": [],
    "procedures": [],
    "redFlags": [
      "Persistent chest pain requiring cardiac workup",
      "Elevated LDL cholesterol at 165 mg/dL",
      "HbA1c 6.8% indicates pre-diabetes progression risk",
      "Uncontrolled hypertension (148/92)"
    ],
    "narrative": "45-year-old male presenting with 3-day persistent chest pain on a background of known hypertension and newly identified hyperlipidemia and pre-diabetes. Current antihypertensive regimen appears suboptimal with BP 148/92. Cardiac evaluation and statin initiation recommended.",
    "language": "en",
    "processedAt": "2026-02-25T10:30:00.000Z"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Missing `ehrText` field |
| `429` | AI rate limit exceeded (10 req/min) |
| `500` | LLM service timeout or error |

---

### Insurance Module

#### `POST /api/insurance/create-policy`

Create a new insurance policy represented as an ERC-721 NFT. The initial premium is collected from the holder in stablecoin.

**Authentication:** Required (JWT, Admin)

**Request Body:**

```json
{
  "holder": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "coverageAmount": "100000000000",
  "premiumAmount": "5000000000",
  "durationDays": 365,
  "riskScore": 2500
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `holder` | string | Yes | Policyholder's Ethereum address |
| `coverageAmount` | string | Yes | Maximum payout in stablecoin units (6 decimals for USDC) |
| `premiumAmount` | string | Yes | Periodic premium in stablecoin units |
| `durationDays` | number | Yes | Policy duration in days |
| `riskScore` | number | Yes | Initial risk score (0–10,000 basis points) |

**Response (201):**

```json
{
  "success": true,
  "data": {
    "policyId": "0",
    "holder": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "coverageAmount": "100000000000",
    "premiumAmount": "5000000000",
    "expiryDate": 1772036000,
    "transactionHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "blockNumber": 7284563
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Invalid holder address, zero coverage/premium, risk score > 10,000 |
| `500` | Insufficient stablecoin allowance; blockchain transaction reverted |

---

#### `POST /api/insurance/submit-claim`

Submit an insurance claim against an existing active policy.

**Authentication:** Required (JWT, Policyholder)

**Request Body:**

```json
{
  "policyId": 0,
  "amount": "25000000000",
  "reason": "Emergency cardiac catheterization and stent placement",
  "evidenceCid": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `policyId` | number | Yes | ID of the policy to claim against |
| `amount` | string | Yes | Requested payout amount in stablecoin units |
| `reason` | string | Yes | Human-readable description of the claim |
| `evidenceCid` | string | Yes | IPFS CID of supporting medical documentation |

**Response (201):**

```json
{
  "success": true,
  "data": {
    "claimId": "0",
    "policyId": 0,
    "amount": "25000000000",
    "reason": "Emergency cardiac catheterization and stent placement",
    "transactionHash": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
    "blockNumber": 7284564
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Invalid policyId, zero amount, missing reason |
| `500` | Policy not active, policy expired, claim exceeds coverage, not policyholder |

---

#### `GET /api/insurance/policy/:policyId`

Retrieve details of an insurance policy by ID.

**Authentication:** Required (JWT)

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `policyId` | number | Insurance policy identifier |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "policyId": "0",
    "holder": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "coverageAmount": "100000000000",
    "premiumAmount": "5000000000",
    "expiryDate": 1772036000,
    "isActive": true,
    "riskScore": 2500
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Invalid policy ID format |
| `500` | Policy not found on-chain |

---

### Supply Chain Module

#### `POST /api/supply/create-batch`

Create a new pharmaceutical supply-chain batch (mints ERC-1155 tokens to the manufacturer).

**Authentication:** Required (JWT, Manufacturer)

**Request Body:**

```json
{
  "drugName": "Amoxicillin 500mg Capsules",
  "lotNumber": "LOT-2026-AMX-0001",
  "quantity": 10000,
  "expiryDate": 1803572000
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `drugName` | string | Yes | Name of the pharmaceutical product |
| `lotNumber` | string | Yes | Manufacturer lot/serial number |
| `quantity` | number | Yes | Number of units in the batch |
| `expiryDate` | number | Yes | Unix timestamp of product expiry |

**Response (201):**

```json
{
  "success": true,
  "data": {
    "batchId": "0",
    "lotNumber": "LOT-2026-AMX-0001",
    "drugName": "Amoxicillin 500mg Capsules",
    "quantity": 10000,
    "expiryDate": 1803572000,
    "transactionHash": "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    "blockNumber": 7284565
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Zero quantity; missing drug name or lot number |
| `500` | Expiry date before manufacture date; transaction reverted |

---

#### `GET /api/supply/batch/:batchId`

Retrieve details of a supply-chain batch including its current status.

**Authentication:** Required (JWT)

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `batchId` | number | Batch identifier |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "batchId": "0",
    "manufacturer": "0x1234567890abcdef1234567890abcdef12345678",
    "lotNumber": "0x8c3e5a9d7f2b1e4a6c8d0f3b5e7a9c1d3f5b7e9a1c3d5f7b9e1a3c5d7f9b1e",
    "manufactureDate": 1740500000,
    "expiryDate": 1803572000,
    "quantity": 10000,
    "status": "IN_TRANSIT",
    "drugNameHash": "0x4a2b8c9e1f3d5a7b9c1e3f5a7b9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Batch Status Values:**

| Status | Description |
|---|---|
| `CREATED` | Batch minted by manufacturer; not yet shipped |
| `IN_TRANSIT` | Batch transferred to a distributor |
| `DELIVERED` | Batch received by a pharmacy |
| `FLAGGED` | Batch flagged as suspicious (potential counterfeit or condition breach) |
| `RECALLED` | Batch recalled by manufacturer or admin |

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Invalid batch ID format |
| `500` | Batch not found on-chain |

---

#### `POST /api/supply/verify`

Verify the authenticity of a supply-chain batch by cross-checking its lot number hash against on-chain records.

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "batchId": 0,
  "lotNumber": "LOT-2026-AMX-0001"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `batchId` | number | Yes | Batch to verify |
| `lotNumber` | string | Yes | Claimed lot number to check against on-chain hash |

**Response (200) — Authentic:**

```json
{
  "success": true,
  "data": {
    "batchId": 0,
    "isAuthentic": true,
    "isFlagged": false,
    "status": "IN_TRANSIT",
    "manufacturer": "0x1234567890abcdef1234567890abcdef12345678",
    "expiryDate": 1803572000,
    "message": "Batch verified as authentic."
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Response (200) — Counterfeit Warning:**

```json
{
  "success": true,
  "data": {
    "batchId": 0,
    "isAuthentic": false,
    "isFlagged": false,
    "status": "IN_TRANSIT",
    "manufacturer": "0x1234567890abcdef1234567890abcdef12345678",
    "expiryDate": 1803572000,
    "message": "WARNING: Lot number does not match on-chain record. Potential counterfeit."
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Response (200) — Flagged:**

```json
{
  "success": true,
  "data": {
    "batchId": 0,
    "isAuthentic": true,
    "isFlagged": true,
    "status": "FLAGGED",
    "manufacturer": "0x1234567890abcdef1234567890abcdef12345678",
    "expiryDate": 1803572000,
    "message": "Batch is authentic but has been flagged — do not dispense."
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### Credentials Module

#### `POST /api/credentials/issue`

Issue a verifiable credential for a healthcare provider. The credential document hash is stored on-chain.

**Authentication:** Required (JWT, Issuer)

**Request Body:**

```json
{
  "subject": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "credentialType": 0,
  "credentialHash": "0xa7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
  "expiryDate": 1803572000
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `subject` | string | Yes | Provider's Ethereum address |
| `credentialType` | number | Yes | Credential type enum value (see table below) |
| `credentialHash` | string | Yes | Keccak-256 hash of the off-chain credential document |
| `expiryDate` | number | Yes | Unix timestamp of expiry (0 for permanent) |

**Credential Types:**

| Value | Type | Description |
|---|---|---|
| `0` | LICENSE | Medical license |
| `1` | BOARD_CERT | Board certification |
| `2` | SPECIALTY | Specialty certification |
| `3` | DEA | DEA registration |
| `4` | NPI | National Provider Identifier |
| `5` | CME | Continuing Medical Education |
| `6` | FELLOWSHIP | Fellowship completion |
| `7` | OTHER | Other credential types |

**Response (201):**

```json
{
  "success": true,
  "data": {
    "credentialId": "0",
    "subject": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "credentialType": "LICENSE",
    "credentialHash": "0xa7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
    "expiryDate": 1803572000,
    "transactionHash": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "blockNumber": 7284566
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Invalid subject address, zero hash, invalid type |
| `500` | Credential with same hash already exists; caller lacks ISSUER_ROLE |

---

#### `GET /api/credentials/verify/:hash`

Verify a credential's validity by its document hash. This is a public endpoint — anyone can verify a provider's credentials.

**Authentication:** None

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `hash` | string | Bytes32 credential document hash (e.g., `0xa7ff...434a`) |

**Response (200) — Valid:**

```json
{
  "success": true,
  "data": {
    "credentialHash": "0xa7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
    "isValid": true,
    "credentialId": "0",
    "issuer": "0x1234567890abcdef1234567890abcdef12345678",
    "subject": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "credentialType": "LICENSE",
    "issuanceDate": 1740500000,
    "expiryDate": 1803572000,
    "message": "Credential is valid and on-chain."
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Response (200) — Invalid / Not Found:**

```json
{
  "success": true,
  "data": {
    "credentialHash": "0xdeadbeef00000000000000000000000000000000000000000000000000000000",
    "isValid": false,
    "message": "Credential not found or has been revoked."
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Invalid hash format (must be `0x` + 64 hex characters) |

---

### AI Module

#### `POST /api/ai/summarize`

Standalone EHR summarization endpoint. Uses an OpenAI-compatible LLM to extract structured clinical data from raw EHR text.

**Authentication:** Required (JWT)

**Rate Limit:** 10 requests per minute

**Request Body:**

```json
{
  "ehrText": "Patient: Jane Smith, 62F. PMH: Type 2 Diabetes (2018), CKD Stage 3 (2022). Medications: Metformin 1000mg BID, Insulin Glargine 20U QHS, Losartan 50mg daily. Allergies: Sulfa drugs, Penicillin. Recent labs: Creatinine 1.8 mg/dL, eGFR 38, HbA1c 8.2%, K+ 5.6 mEq/L...",
  "language": "en"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `ehrText` | string | Yes | — | Raw EHR content |
| `language` | string | No | `"en"` | ISO 639-1 code for output language |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "patientId": "unknown",
    "diagnoses": [
      "Type 2 Diabetes Mellitus (E11)",
      "Chronic Kidney Disease Stage 3 (N18.3)"
    ],
    "medications": [
      {
        "name": "Metformin",
        "dosage": "1000mg",
        "frequency": "twice daily",
        "startDate": "2018",
        "endDate": null
      },
      {
        "name": "Insulin Glargine",
        "dosage": "20 units",
        "frequency": "nightly",
        "startDate": null,
        "endDate": null
      },
      {
        "name": "Losartan",
        "dosage": "50mg",
        "frequency": "once daily",
        "startDate": null,
        "endDate": null
      }
    ],
    "allergies": ["Sulfa drugs", "Penicillin"],
    "procedures": [],
    "redFlags": [
      "Hyperkalemia (K+ 5.6 mEq/L) — risk of cardiac arrhythmia",
      "HbA1c 8.2% indicates poor glycemic control",
      "eGFR 38 — consider nephrology referral for CKD progression",
      "Metformin may need dose adjustment with eGFR < 45"
    ],
    "narrative": "62-year-old female with poorly controlled Type 2 Diabetes and progressive CKD Stage 3. Critical finding of hyperkalemia (K+ 5.6) requires urgent evaluation. Metformin dose may need reduction given declining renal function (eGFR 38).",
    "language": "en",
    "processedAt": "2026-02-25T10:30:00.000Z"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

#### `POST /api/ai/risk-score`

Compute a risk score for an insurance claim or patient profile using a logistic regression model.

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "age": 55,
  "bmi": 31.2,
  "chronicConditions": 2,
  "medicationCount": 5,
  "priorClaims": 1,
  "smokingStatus": false,
  "exerciseHoursPerWeek": 3,
  "systolicBP": 142,
  "fastingGlucose": 118,
  "cholesterol": 235
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `age` | number | Yes | Patient age in years |
| `bmi` | number | Yes | Body Mass Index |
| `chronicConditions` | number | Yes | Count of chronic conditions |
| `medicationCount` | number | Yes | Number of current medications |
| `priorClaims` | number | Yes | Number of prior insurance claims |
| `smokingStatus` | boolean | Yes | Whether the patient smokes |
| `exerciseHoursPerWeek` | number | Yes | Weekly exercise hours |
| `systolicBP` | number | Yes | Systolic blood pressure (mmHg) |
| `fastingGlucose` | number | Yes | Fasting glucose level (mg/dL) |
| `cholesterol` | number | Yes | Total cholesterol (mg/dL) |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "score": 62,
    "level": "HIGH",
    "factors": [
      {
        "name": "chronicConditions",
        "weight": 0.8,
        "contribution": 0.5333,
        "description": "Chronic conditions significantly increase risk"
      },
      {
        "name": "bmi",
        "weight": 0.35,
        "contribution": 0.42,
        "description": "BMI above normal range increases risk"
      },
      {
        "name": "priorClaims",
        "weight": 0.6,
        "contribution": 0.2,
        "description": "Prior claims history increases risk"
      },
      {
        "name": "systolicBP",
        "weight": 0.08,
        "contribution": 0.088,
        "description": "Elevated blood pressure increases risk"
      }
    ],
    "computedAt": "2026-02-25T10:30:00.000Z"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Risk Levels:**

| Score Range | Level |
|---|---|
| 0–25 | `LOW` |
| 26–50 | `MODERATE` |
| 51–75 | `HIGH` |
| 76–100 | `CRITICAL` |

---

#### `POST /api/ai/anomaly-detect`

Run anomaly detection on a time-series of vital signs using Z-score analysis.

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "patientId": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "vitalSigns": [
    {
      "timestamp": 1740500000,
      "heartRate": 72,
      "systolicBP": 120,
      "diastolicBP": 80,
      "glucose": 95,
      "spo2": 98,
      "temperature": 36.6
    },
    {
      "timestamp": 1740503600,
      "heartRate": 75,
      "systolicBP": 122,
      "diastolicBP": 82,
      "glucose": 102,
      "spo2": 97,
      "temperature": 36.7
    },
    {
      "timestamp": 1740507200,
      "heartRate": 118,
      "systolicBP": 165,
      "diastolicBP": 105,
      "glucose": 245,
      "spo2": 91,
      "temperature": 38.4
    }
  ],
  "sensitivity": "medium"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `patientId` | string | Yes | — | Patient identifier |
| `vitalSigns` | array | Yes | — | Time-series array of vital sign readings |
| `sensitivity` | string | No | `"medium"` | Detection sensitivity: `"low"`, `"medium"`, `"high"` |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "patientId": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "anomalyDetected": true,
    "anomalies": [
      {
        "timestamp": 1740507200,
        "metric": "heartRate",
        "value": 118,
        "zScore": 3.2,
        "severity": "HIGH",
        "message": "Heart rate significantly elevated"
      },
      {
        "timestamp": 1740507200,
        "metric": "systolicBP",
        "value": 165,
        "zScore": 2.8,
        "severity": "HIGH",
        "message": "Systolic blood pressure critically elevated"
      },
      {
        "timestamp": 1740507200,
        "metric": "glucose",
        "value": 245,
        "zScore": 4.1,
        "severity": "CRITICAL",
        "message": "Glucose level critically elevated"
      },
      {
        "timestamp": 1740507200,
        "metric": "spo2",
        "value": 91,
        "zScore": -2.5,
        "severity": "MODERATE",
        "message": "Blood oxygen saturation below normal"
      }
    ],
    "summary": "Multiple critical anomalies detected in latest readings. Immediate clinical review recommended.",
    "analyzedAt": "2026-02-25T10:30:00.000Z"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

---

### World ID Module

#### `GET /api/auth/worldid/sign-request`

Get a signed RP context for the IDKit v4 widget. Returns the `rp_context` object containing a server-signed nonce required to open the World ID verification widget.

**Authentication:** Required (JWT)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "app_id": "app_cf4f67cc7a208b56b418fdc252b16aa5",
    "action": "medicare-identity",
    "rp_context": {
      "rp_id": "rp_b7d23880474f70ae",
      "nonce": "0x00e1e889...",
      "created_at": 1773003569,
      "expires_at": 1773003869,
      "signature": "0xa5d249..."
    }
  }
}
```

#### `POST /api/auth/worldid/verify`

Verify a World ID zero-knowledge proof to establish proof-of-personhood.

**Authentication:** Required (JWT)

**Request Body:**

```json
{
  "merkle_root": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "nullifier_hash": "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
  "proof": "0x...",
  "action": "verify-human",
  "signal": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `merkle_root` | string | Yes | Merkle root of the World ID identity set |
| `nullifier_hash` | string | Yes | Unique hash preventing double-signalling |
| `proof` | string | Yes | Zero-knowledge proof bytes |
| `action` | string | Yes | Action identifier (must match app configuration) |
| `signal` | string | No | Optional signal (typically the user's wallet address) |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "verified": true,
    "nullifier_hash": "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    "message": "World ID proof verified successfully"
  },
  "timestamp": "2026-02-25T10:30:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Missing required proof fields |
| `500` | Proof verification failed; World ID API unreachable |

---

## Environment Variables

The backend requires the following environment variables (see `.env.example`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | Server listen port |
| `NODE_ENV` | No | `development` | Environment mode |
| `LOG_LEVEL` | No | `debug` | Winston log level |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `JWT_EXPIRES_IN` | No | `24h` | Token expiry duration |
| `RPC_URL` | Yes | — | Ethereum RPC endpoint |
| `PRIVATE_KEY` | Yes | — | Deployer/signer private key |
| `CHAIN_ID` | No | `11155111` | Target chain ID |
| `EHR_STORAGE_ADDRESS` | Yes | — | Deployed EHRStorage contract address |
| `INSURANCE_POLICY_ADDRESS` | Yes | — | Deployed InsurancePolicy contract address |
| `SUPPLY_CHAIN_ADDRESS` | Yes | — | Deployed SupplyChain contract address |
| `CREDENTIAL_REGISTRY_ADDRESS` | Yes | — | Deployed CredentialRegistry contract address |
| `GOVERNANCE_ADDRESS` | Yes | — | Deployed Governance contract address |
| `PINATA_API_KEY` | Yes | — | Pinata IPFS API key |
| `PINATA_SECRET_KEY` | Yes | — | Pinata IPFS secret key |
| `PINATA_GATEWAY` | No | `https://gateway.pinata.cloud/ipfs` | Pinata gateway URL |
| `LLM_API_URL` | No | `https://api.openai.com/v1/chat/completions` | LLM API endpoint |
| `LLM_API_KEY` | Yes | — | LLM API key |
| `LLM_MODEL` | No | `gpt-4o-mini` | LLM model identifier |
| `FHIR_BASE_URL` | No | `https://hapi.fhir.org/baseR4` | FHIR R4 server URL |
| `WORLDID_APP_ID` | Yes | — | World ID application ID |
| `WORLDID_ACTION` | No | `verify-human` | World ID action identifier |
| `WORLDID_RP_ID` | Yes | — | World ID Relying Party ID (from developer portal) |
| `WORLDID_SIGNING_KEY` | Yes | — | ECDSA private key for signing RP context |
| `ENCRYPTION_KEY` | Yes | — | AES-256 encryption key (hex) |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |

---

*This document is part of the mediCaRE project documentation suite. See also: [Architecture Documentation](architecture.md) · [Governance Documentation](governance.md)*
