"use client";

import { useState, useCallback } from "react";
import { ehrApi, insuranceApi, supplyApi, credentialApi, aiApi, visitApi, healthApi } from "@/lib/api";
import type {
  EHRRecord,
  InsurancePolicy,
  InsuranceClaim,
  SupplyBatch,
  Credential,
} from "@/types";

export function useEHR() {
  const [records, setRecords] = useState<EHRRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async (patient: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ehrApi.getRecords(patient);
      const data = res.data?.data?.records ?? res.data?.data ?? res.data?.records ?? res.data ?? [];
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch records";
      setError(msg);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadRecord = useCallback(async (formData: FormData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ehrApi.upload(formData);
      return res.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const summarize = useCallback(async (ehrText: string, language?: string) => {
    const res = await aiApi.summarize(ehrText, language);
    return res.data;
  }, []);

  return { records, loading, error, fetchRecords, uploadRecord, summarize };
}

export function useInsurance() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async (holder: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await insuranceApi.getPolicies(holder);
      const data = res.data?.data?.policies ?? res.data?.data ?? res.data?.policies ?? res.data ?? [];
      setPolicies(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch policies";
      setError(msg);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClaims = useCallback(async (holder: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await insuranceApi.getClaims(holder);
      const data = res.data?.data?.claims ?? res.data?.data ?? res.data?.claims ?? res.data ?? [];
      setClaims(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch claims";
      setError(msg);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitClaim = useCallback(
    async (data: { policyId: number; amount: string; description: string }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await insuranceApi.submitClaim(data);
        return res.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Claim submission failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { policies, claims, loading, error, fetchPolicies, fetchClaims, submitClaim };
}

export function useSupplyChain() {
  const [batches, setBatches] = useState<SupplyBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supplyApi.getAllBatches();
      const data = res.data?.data?.batches ?? res.data?.data ?? res.data?.batches ?? res.data ?? [];
      setBatches(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch batches";
      setError(msg);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createBatch = useCallback(
    async (data: { drugName: string; lotNumber: string; quantity: number; expiryDate: number }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await supplyApi.createBatch(data);
        return res.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Batch creation failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { batches, loading, error, fetchBatches, createBatch };
}

export function useCredentials() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredentials = useCallback(async (subject: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await credentialApi.getBySubject(subject);
      const data = res.data?.data?.credentials ?? res.data?.data ?? res.data?.credentials ?? res.data ?? [];
      setCredentials(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch credentials";
      setError(msg);
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const issueCredential = useCallback(
    async (data: { subject: string; credentialType: number; credentialHash: string; expiryDate: number }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await credentialApi.issue(data);
        return res.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Credential issuance failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { credentials, loading, error, fetchCredentials, issueCredential };
}

export function useVisitSummary() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePreVisit = useCallback(async (patientAddress: string, language?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await visitApi.preVisitSummary({ patientAddress, language });
      return res.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Pre-visit summary failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generatePostVisit = useCallback(async (patientAddress: string, visitNotes: string, language?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await visitApi.postVisitSummary({ patientAddress, visitNotes, language });
      return res.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Post-visit summary failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, generatePreVisit, generatePostVisit };
}

export function useBackendHealth() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      const res = await healthApi.check();
      setConnected(res.status === 200);
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  return { connected, checking, checkHealth };
}
