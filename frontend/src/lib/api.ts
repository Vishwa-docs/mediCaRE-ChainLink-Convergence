import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ── EHR ──────────────────────────────────────────
export const ehrApi = {
  upload: (formData: FormData) =>
    api.post("/api/ehr/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getRecords: (patient: string) =>
    api.get(`/api/ehr/records/${patient}`),
  summarize: (recordId: number) =>
    api.post(`/api/ehr/summarize/${recordId}`),
  grantAccess: (patient: string, provider: string) =>
    api.post("/api/ehr/access/grant", { patient, provider }),
  revokeAccess: (patient: string, provider: string) =>
    api.post("/api/ehr/access/revoke", { patient, provider }),
};

// ── Insurance ────────────────────────────────────
export const insuranceApi = {
  getPolicies: (holder: string) =>
    api.get(`/api/insurance/policies/${holder}`),
  submitClaim: (data: { policyId: number; amount: string; description: string }) =>
    api.post("/api/insurance/claims", data),
  getClaims: (holder: string) =>
    api.get(`/api/insurance/claims/${holder}`),
};

// ── Supply Chain ─────────────────────────────────
export const supplyApi = {
  createBatch: (data: {
    drugName: string;
    lotNumber: string;
    quantity: number;
    expiryDate: number;
  }) => api.post("/api/supply/batch", data),
  getBatch: (batchId: number) =>
    api.get(`/api/supply/batch/${batchId}`),
  getAllBatches: () => api.get("/api/supply/batches"),
  updateStatus: (batchId: number, status: number) =>
    api.post(`/api/supply/batch/${batchId}/status`, { status }),
  verify: (batchId: number) =>
    api.get(`/api/supply/batch/${batchId}/verify`),
};

// ── Credentials ──────────────────────────────────
export const credentialApi = {
  issue: (data: {
    subject: string;
    credentialType: number;
    credentialHash: string;
    expiryDate: number;
  }) => api.post("/api/credentials/issue", data),
  getBySubject: (subject: string) =>
    api.get(`/api/credentials/subject/${subject}`),
  verify: (credentialId: number) =>
    api.get(`/api/credentials/verify/${credentialId}`),
  revoke: (credentialId: number) =>
    api.post(`/api/credentials/revoke/${credentialId}`),
};

// ── AI ───────────────────────────────────────────
export const aiApi = {
  summarize: (recordId: number) =>
    api.post("/api/ai/summarize", { recordId }),
  riskScore: (policyId: number) =>
    api.post("/api/ai/risk-score", { policyId }),
};

export default api;
