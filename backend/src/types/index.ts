// ─── Core domain types for the mediCaRE backend ────────────────────────────

/** Roles recognised by the platform. */
export enum UserRole {
  PATIENT = "PATIENT",
  PROVIDER = "PROVIDER",
  INSURER = "INSURER",
  MANUFACTURER = "MANUFACTURER",
  DISTRIBUTOR = "DISTRIBUTOR",
  PHARMACY = "PHARMACY",
  ADMIN = "ADMIN",
}

/** Risk classification returned by the scoring engine. */
export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

/** Anomaly severity classification. */
export enum AnomalySeverity {
  NORMAL = "NORMAL",
  WARNING = "WARNING",
  ALERT = "ALERT",
  CRITICAL = "CRITICAL",
}

/** Vital-sign metric types supported by anomaly detection. */
export enum VitalMetric {
  HEART_RATE = "HEART_RATE",
  SYSTOLIC_BP = "SYSTOLIC_BP",
  DIASTOLIC_BP = "DIASTOLIC_BP",
  BLOOD_GLUCOSE = "BLOOD_GLUCOSE",
  TEMPERATURE = "TEMPERATURE",
  OXYGEN_SATURATION = "OXYGEN_SATURATION",
}

// ─── EHR ────────────────────────────────────────────────────────────────────

export interface EHRRecord {
  recordId: string;
  patientAddress: string;
  ipfsCid: string;
  aiSummaryCid?: string;
  recordType: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface EHRSummary {
  patientId: string;
  diagnoses: string[];
  medications: Medication[];
  allergies: string[];
  procedures: string[];
  redFlags: string[];
  narrative: string;
  language: string;
  generatedAt: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  startDate?: string;
  endDate?: string;
}

// ─── Insurance ──────────────────────────────────────────────────────────────

export enum ClaimStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PAID = "PAID",
}

export interface InsurancePolicy {
  policyId: string;
  holder: string;
  coverageAmount: string;
  premiumAmount: string;
  expiryDate: number;
  isActive: boolean;
  riskScore: number;
}

export interface InsuranceClaim {
  claimId: string;
  policyId: string;
  claimant: string;
  amount: string;
  reason: string;
  status: ClaimStatus;
  evidenceCid: string;
  submittedAt: number;
}

// ─── Supply Chain ───────────────────────────────────────────────────────────

export enum BatchStatus {
  CREATED = "CREATED",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED",
  FLAGGED = "FLAGGED",
  RECALLED = "RECALLED",
}

export interface SupplyBatch {
  batchId: string;
  manufacturer: string;
  lotNumber: string;
  drugName: string;
  manufactureDate: number;
  expiryDate: number;
  quantity: number;
  status: BatchStatus;
}

export interface IoTReading {
  sensorId: string;
  batchId: string;
  timestamp: number;
  temperature?: number;
  humidity?: number;
  latitude?: number;
  longitude?: number;
}

// ─── Credentials ────────────────────────────────────────────────────────────

export enum CredentialType {
  LICENSE = "LICENSE",
  BOARD_CERT = "BOARD_CERT",
  SPECIALTY = "SPECIALTY",
  DEA = "DEA",
  NPI = "NPI",
  CME = "CME",
  FELLOWSHIP = "FELLOWSHIP",
  OTHER = "OTHER",
}

export interface Credential {
  credentialId: string;
  credentialHash: string;
  issuer: string;
  subject: string;
  credentialType: CredentialType;
  issuanceDate: number;
  expiryDate: number;
  isValid: boolean;
}

// ─── AI ─────────────────────────────────────────────────────────────────────

export interface RiskInput {
  age: number;
  bmi: number;
  chronicConditions: number;
  medicationCount: number;
  priorClaims: number;
  smokingStatus: boolean;
  exerciseHoursPerWeek: number;
  systolicBP: number;
  fastingGlucose: number;
  cholesterol: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  computedAt: string;
}

export interface RiskFactor {
  name: string;
  weight: number;
  contribution: number;
  description: string;
}

export interface AnomalyInput {
  metric: VitalMetric;
  values: number[];
  timestamps: number[];
}

export interface AnomalyResult {
  metric: VitalMetric;
  isAnomaly: boolean;
  severity: AnomalySeverity;
  zScore: number;
  latestValue: number;
  mean: number;
  stdDev: number;
  recommendations: string[];
  analyzedAt: string;
}

// ─── FHIR ───────────────────────────────────────────────────────────────────

export interface FHIRPatient {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  address?: string;
  phone?: string;
}

export interface FHIRCondition {
  id: string;
  code: string;
  display: string;
  clinicalStatus: string;
  onsetDate?: string;
}

export interface FHIRMedicationRequest {
  id: string;
  medicationName: string;
  dosage: string;
  status: string;
  authoredOn?: string;
}

export interface FHIRObservation {
  id: string;
  code: string;
  display: string;
  value: number | string;
  unit: string;
  effectiveDate: string;
}

export interface FHIRPatientBundle {
  patient: FHIRPatient;
  conditions: FHIRCondition[];
  medications: FHIRMedicationRequest[];
  observations: FHIRObservation[];
}

// ─── World ID ───────────────────────────────────────────────────────────────

export interface WorldIDProof {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  signal?: string;
}

export interface WorldIDVerifyResult {
  verified: boolean;
  nullifierHash: string;
  action: string;
  verifiedAt: string;
}

// ─── IoT Oracle ─────────────────────────────────────────────────────────────

export interface SensorThresholds {
  temperatureMin: number;
  temperatureMax: number;
  humidityMin: number;
  humidityMax: number;
}

export interface ThresholdBreach {
  sensorId: string;
  metric: string;
  value: number;
  threshold: number;
  direction: "above" | "below";
  timestamp: number;
}

// ─── API ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  pageSize: number;
  total: number;
}

/** JWT payload structure. */
export interface JWTPayload {
  sub: string;
  role: UserRole;
  address: string;
  iat?: number;
  exp?: number;
}

/** Multer-compatible file reference. */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
