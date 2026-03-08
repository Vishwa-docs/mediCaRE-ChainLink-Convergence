import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request when available
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("medicare_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── EHR ──────────────────────────────────────────
export const ehrApi = {
  upload: (formData: FormData) =>
    api.post("/api/ehr/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getRecords: (patient: string) =>
    api.get(`/api/ehr/${patient}`),
  summarize: (recordId: number) =>
    api.post(`/api/ehr/summarize/${recordId}`),
  grantAccess: (patient: string, provider: string) =>
    api.post("/api/ehr/access/grant", { patient, provider }),
  revokeAccess: (patient: string, provider: string) =>
    api.post("/api/ehr/access/revoke", { patient, provider }),
};

// ── Insurance ────────────────────────────────────
export const insuranceApi = {
  createPolicy: (data: { holder: string; coverageAmount: string; premiumAmount: string; durationDays: number }) =>
    api.post("/api/insurance/create-policy", data),
  getPolicies: (holder: string) =>
    api.get(`/api/insurance/policies/${holder}`),
  submitClaim: (data: { policyId: number; amount: string; description: string }) =>
    api.post("/api/insurance/submit-claim", data),
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
  }) => api.post("/api/supply/create-batch", data),
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
  summarize: (ehrText: string, language?: string) =>
    api.post("/api/ai/summarize", { ehrText, language }),
  riskScore: (data: { age: number; bmi: number; chronicConditions: number; medicationCount: number; priorClaims: number; smokingStatus: boolean; exerciseHoursPerWeek: number; systolicBP: number; fastingGlucose: number; cholesterol: number }) =>
    api.post("/api/ai/risk-score", data),
  detectAnomalies: (data: { metric: string; values: number[]; timestamps: number[] }) =>
    api.post("/api/ai/anomaly-detect", data),
};

// ── Visit Summaries ──────────────────────────────
export const visitApi = {
  preVisitSummary: (data: { patientAddress: string; language?: string }) =>
    api.post("/api/ai/pre-visit-summary", data),
  postVisitSummary: (data: { patientAddress: string; visitNotes: string; language?: string }) =>
    api.post("/api/ai/post-visit-summary", data),
};

// ── Analytics ────────────────────────────────────
export const analyticsApi = {
  getMetrics: (windowMinutes = 60) =>
    api.get(`/api/analytics/metrics?window=${windowMinutes}`),
  getEvents: (limit = 50) =>
    api.get(`/api/analytics/events?limit=${limit}`),
  track: (data: { event: string; category: string; actor?: string; properties?: Record<string, string | number | boolean> }) =>
    api.post("/api/analytics/track", data),
};

// ── Health Check ─────────────────────────────────
export const healthApi = {
  check: () => api.get("/api/health"),
};

export default api;
