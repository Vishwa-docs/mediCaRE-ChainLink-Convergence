import { z } from "zod";
import { VitalMetric } from "../types";

/** Ethereum address (0x-prefixed, 42 chars). */
export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum address");

/** Positive integer ID. */
export const idSchema = z.coerce.number().int().positive();

// ─── EHR ────────────────────────────────────────────────────────────────────

export const ehrUploadSchema = z.object({
  patientAddress: addressSchema,
  recordType: z.string().min(1).max(50),
  /** Base64-encoded file content (for JSON-body uploads). */
  fileContent: z.string().optional(),
});

export const ehrSummarizeSchema = z.object({
  ehrText: z.string().min(10).max(100_000),
  language: z.string().min(2).max(10).default("en"),
});

// ─── Insurance ──────────────────────────────────────────────────────────────

export const createPolicySchema = z.object({
  holder: addressSchema,
  coverageAmount: z.string().min(1),
  premiumAmount: z.string().min(1),
  durationDays: z.number().int().positive().max(3650),
  riskScore: z.number().int().nonnegative().optional(),
});

export const submitClaimSchema = z.object({
  policyId: z.coerce.number().int().nonnegative(),
  amount: z.string().min(1),
  description: z.string().min(5).max(2000),
});

// ─── Supply Chain ───────────────────────────────────────────────────────────

export const createBatchSchema = z.object({
  drugName: z.string().min(1).max(200),
  lotNumber: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  expiryDate: z.number().int().positive(),
  manufactureDate: z.number().int().positive().optional(),
});

export const verifyBatchSchema = z.object({
  batchId: z.coerce.number().int().nonnegative(),
  lotNumber: z.string().min(1).max(100),
});

// ─── Credentials ────────────────────────────────────────────────────────────

export const issueCredentialSchema = z.object({
  subject: addressSchema,
  credentialType: z.number().int().min(0).max(7),
  credentialHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid bytes32 hash"),
  issuanceDate: z.number().int().nonnegative().optional(),
  expiryDate: z.number().int().nonnegative(),
});

// ─── AI ─────────────────────────────────────────────────────────────────────

export const riskScoreSchema = z.object({
  age: z.number().int().positive().max(150),
  bmi: z.number().positive().max(100),
  chronicConditions: z.number().int().nonnegative().max(50),
  medicationCount: z.number().int().nonnegative().max(100),
  priorClaims: z.number().int().nonnegative(),
  smokingStatus: z.boolean(),
  exerciseHoursPerWeek: z.number().nonnegative().max(168),
  systolicBP: z.number().positive().max(300),
  fastingGlucose: z.number().positive().max(1000),
  cholesterol: z.number().positive().max(1000),
  policyId: z.coerce.number().int().nonnegative().optional(),
});

export const anomalyDetectSchema = z.object({
  metric: z.nativeEnum(VitalMetric),
  values: z.array(z.number()).min(5).max(10_000),
  timestamps: z.array(z.number()).min(5).max(10_000),
});

// ─── World ID ───────────────────────────────────────────────────────────────

export const worldIdVerifySchema = z.object({
  merkle_root: z.string().min(1),
  nullifier_hash: z.string().min(1),
  proof: z.string().min(1),
  signal: z.string().optional(),
});

// ─── Auth ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  address: addressSchema,
  signature: z.string().min(1),
  message: z.string().min(1),
});

// ─── Visit Summaries ────────────────────────────────────────────────────────

export const preVisitSummarySchema = z.object({
  patientAddress: addressSchema,
  language: z.string().min(2).max(10).default("en"),
});

export const postVisitSummarySchema = z.object({
  patientAddress: addressSchema,
  visitNotes: z.string().min(10).max(100_000),
  language: z.string().min(2).max(10).default("en"),
});

/**
 * Helper that validates `data` against a Zod schema.
 * Throws a descriptive error on failure.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    const err = new Error(`Validation failed — ${messages}`);
    (err as any).statusCode = 400;
    throw err;
  }
  return result.data;
}
