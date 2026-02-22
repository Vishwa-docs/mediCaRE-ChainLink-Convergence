"use client";

import { useState, useCallback } from "react";
import { ehrApi, insuranceApi, supplyApi, credentialApi, aiApi } from "@/lib/api";
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

  const fetchRecords = useCallback(async (patient: string) => {
    setLoading(true);
    try {
      const res = await ehrApi.getRecords(patient);
      setRecords(res.data.records ?? res.data ?? []);
    } catch {
      /* silently fail – mock data will be used */
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadRecord = useCallback(async (formData: FormData) => {
    setLoading(true);
    try {
      const res = await ehrApi.upload(formData);
      return res.data;
    } finally {
      setLoading(false);
    }
  }, []);

  const summarize = useCallback(async (recordId: number) => {
    const res = await aiApi.summarize(recordId);
    return res.data;
  }, []);

  return { records, loading, fetchRecords, uploadRecord, summarize };
}

export function useInsurance() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPolicies = useCallback(async (holder: string) => {
    setLoading(true);
    try {
      const res = await insuranceApi.getPolicies(holder);
      setPolicies(res.data.policies ?? res.data ?? []);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClaims = useCallback(async (holder: string) => {
    setLoading(true);
    try {
      const res = await insuranceApi.getClaims(holder);
      setClaims(res.data.claims ?? res.data ?? []);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  const submitClaim = useCallback(
    async (data: { policyId: number; amount: string; description: string }) => {
      setLoading(true);
      try {
        const res = await insuranceApi.submitClaim(data);
        return res.data;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { policies, claims, loading, fetchPolicies, fetchClaims, submitClaim };
}

export function useSupplyChain() {
  const [batches, setBatches] = useState<SupplyBatch[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplyApi.getAllBatches();
      setBatches(res.data.batches ?? res.data ?? []);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  const createBatch = useCallback(
    async (data: { drugName: string; lotNumber: string; quantity: number; expiryDate: number }) => {
      setLoading(true);
      try {
        const res = await supplyApi.createBatch(data);
        return res.data;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { batches, loading, fetchBatches, createBatch };
}

export function useCredentials() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCredentials = useCallback(async (subject: string) => {
    setLoading(true);
    try {
      const res = await credentialApi.getBySubject(subject);
      setCredentials(res.data.credentials ?? res.data ?? []);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  const issueCredential = useCallback(
    async (data: { subject: string; credentialType: number; credentialHash: string; expiryDate: number }) => {
      setLoading(true);
      try {
        const res = await credentialApi.issue(data);
        return res.data;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { credentials, loading, fetchCredentials, issueCredential };
}
