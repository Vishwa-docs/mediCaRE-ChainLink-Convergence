/**
 * @module abdm
 * @description ABDM API Compatibility Layer
 *
 * Mock implementation of India's Ayushman Bharat Digital Mission (ABDM)
 * API integration. Demonstrates enterprise compatibility with sovereign
 * national health infrastructure.
 *
 * Supports:
 *   - OAuth 2.0 authentication flow
 *   - OTP-based patient verification
 *   - ABHA (Ayushman Bharat Health Account) ID generation
 *   - ABHA-to-blockchain address linking
 */

import { createLogger } from "../utils/logging";

const log = createLogger("service:abdm");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ABDMSession {
  sessionId: string;
  accessToken: string;
  expiresAt: string;
  isActive: boolean;
}

export interface ABHAProfile {
  abhaId: string;
  abhaAddress: string; // e.g. "patient@abdm"
  name: string;
  dateOfBirth: string;
  gender: string;
  mobile: string;
  linkedBlockchainAddress?: string;
  verifiedAt: string;
}

export interface OTPRequest {
  type: "mobile" | "aadhaar";
  value: string;
  txnId: string;
}

export interface OTPVerification {
  txnId: string;
  otp: string;
  isValid: boolean;
}

// ─── Mock State ─────────────────────────────────────────────────────────────

const sessions: Map<string, ABDMSession> = new Map();
const abhaProfiles: Map<string, ABHAProfile> = new Map();
const otpStore: Map<string, string> = new Map(); // txnId → OTP

// Seed demo profiles
abhaProfiles.set("12-3456-7890-1234", {
  abhaId: "12-3456-7890-1234",
  abhaAddress: "rajesh.kumar@abdm",
  name: "Rajesh Kumar",
  dateOfBirth: "1985-03-15",
  gender: "M",
  mobile: "+91-98765XXXXX",
  linkedBlockchainAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  verifiedAt: "2026-02-20T10:00:00Z",
});

abhaProfiles.set("98-7654-3210-5678", {
  abhaId: "98-7654-3210-5678",
  abhaAddress: "priya.sharma@abdm",
  name: "Priya Sharma",
  dateOfBirth: "1992-07-22",
  gender: "F",
  mobile: "+91-87654XXXXX",
  verifiedAt: "2026-03-01T14:30:00Z",
});

// ─── Service Functions ──────────────────────────────────────────────────────

/**
 * Simulate ABDM OAuth 2.0 session creation.
 */
export function createSession(clientId: string, clientSecret: string): ABDMSession {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session: ABDMSession = {
    sessionId,
    accessToken: `abdm_tok_${Math.random().toString(36).slice(2)}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    isActive: true,
  };
  sessions.set(sessionId, session);
  log.info("ABDM session created", { sessionId });
  return session;
}

/**
 * Send OTP for patient verification.
 */
export function sendOtp(request: Omit<OTPRequest, "txnId">): OTPRequest {
  const txnId = `txn_${Date.now()}`;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(txnId, otp);
  log.info("OTP sent", { txnId, type: request.type, otp: "DEMO: " + otp });
  return { ...request, txnId };
}

/**
 * Verify OTP entered by patient.
 */
export function verifyOtp(txnId: string, otp: string): OTPVerification {
  const stored = otpStore.get(txnId);
  const isValid = stored === otp;
  if (isValid) otpStore.delete(txnId);
  log.info("OTP verification", { txnId, isValid });
  return { txnId, otp, isValid };
}

/**
 * Generate a new ABHA ID for a patient.
 */
export function generateAbhaId(name: string, dateOfBirth: string, gender: string, mobile: string): ABHAProfile {
  const segments = [
    Math.floor(10 + Math.random() * 90),
    Math.floor(1000 + Math.random() * 9000),
    Math.floor(1000 + Math.random() * 9000),
    Math.floor(1000 + Math.random() * 9000),
  ];
  const abhaId = segments.join("-");
  const abhaAddress = `${name.toLowerCase().replace(/\s+/g, ".")}@abdm`;

  const profile: ABHAProfile = {
    abhaId,
    abhaAddress,
    name,
    dateOfBirth,
    gender,
    mobile,
    verifiedAt: new Date().toISOString(),
  };

  abhaProfiles.set(abhaId, profile);
  log.info("ABHA ID generated", { abhaId, name });
  return profile;
}

/**
 * Link an ABHA ID to a blockchain address.
 */
export function linkBlockchainAddress(abhaId: string, blockchainAddress: string): ABHAProfile | null {
  const profile = abhaProfiles.get(abhaId);
  if (!profile) {
    log.warn("ABHA profile not found", { abhaId });
    return null;
  }
  profile.linkedBlockchainAddress = blockchainAddress;
  log.info("ABHA linked to blockchain", { abhaId, blockchainAddress });
  return profile;
}

/**
 * Retrieve an ABHA profile.
 */
export function getAbhaProfile(abhaId: string): ABHAProfile | null {
  return abhaProfiles.get(abhaId) ?? null;
}

/**
 * Search profiles by blockchain address.
 */
export function findByBlockchainAddress(address: string): ABHAProfile | null {
  for (const profile of abhaProfiles.values()) {
    if (profile.linkedBlockchainAddress?.toLowerCase() === address.toLowerCase()) {
      return profile;
    }
  }
  return null;
}
