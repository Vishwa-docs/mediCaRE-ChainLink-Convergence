"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  CONTRACTS,
  EHR_ABI,
  INSURANCE_ABI,
  SUPPLY_ABI,
  CREDENTIAL_ABI,
  GOVERNANCE_ABI,
} from "@/lib/contracts";

type ContractName = keyof typeof CONTRACTS;

const ABI_MAP: Record<ContractName, string[]> = {
  EHRStorage: EHR_ABI,
  InsurancePolicy: INSURANCE_ABI,
  SupplyChain: SUPPLY_ABI,
  CredentialRegistry: CREDENTIAL_ABI,
  Governance: GOVERNANCE_ABI,
};

function getProvider() {
  if (typeof window !== "undefined" && (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum) {
    return new ethers.BrowserProvider(
      (window as unknown as { ethereum: ethers.Eip1193Provider }).ethereum
    );
  }
  return null;
}

export function useContract(name: ContractName) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getReadContract = useCallback(() => {
    const provider = getProvider();
    if (!provider) throw new Error("No wallet connected");
    return new ethers.Contract(CONTRACTS[name], ABI_MAP[name], provider);
  }, [name]);

  const getWriteContract = useCallback(async () => {
    const provider = getProvider();
    if (!provider) throw new Error("No wallet connected");
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACTS[name], ABI_MAP[name], signer);
  }, [name]);

  const read = useCallback(
    async <T = unknown>(method: string, ...args: unknown[]): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        const contract = getReadContract();
        const result = await contract[method](...args);
        return result as T;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Contract read failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getReadContract]
  );

  const write = useCallback(
    async (method: string, ...args: unknown[]) => {
      setLoading(true);
      setError(null);
      try {
        const contract = await getWriteContract();
        const tx = await contract[method](...args);
        const receipt = await tx.wait();
        return receipt;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getWriteContract]
  );

  return { read, write, loading, error };
}

export function useWalletAddress() {
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return null;
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    setAddress(addr);
    return addr;
  }, []);

  return { address, connect };
}
