"use client";

import { useCallback, useMemo, useState } from "react";
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

/** Wallet-connected browser provider (for writes + reads). */
function getBrowserProvider() {
  if (typeof window !== "undefined" && (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum) {
    return new ethers.BrowserProvider(
      (window as unknown as { ethereum: ethers.Eip1193Provider }).ethereum
    );
  }
  return null;
}

/** Read-only JSON-RPC provider using the configured RPC URL (no wallet needed). */
function getReadOnlyProvider(): ethers.JsonRpcProvider | null {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpcUrl) return null;
  return new ethers.JsonRpcProvider(rpcUrl);
}

/** Returns the best available provider: wallet first, then read-only RPC fallback. */
function getProvider() {
  return getBrowserProvider() ?? getReadOnlyProvider();
}

export function useContract(name: ContractName) {
  const read = useCallback(
    async <T = unknown>(method: string, ...args: unknown[]): Promise<T> => {
      const provider = getProvider();
      if (!provider) throw new Error("No provider available — connect wallet or set NEXT_PUBLIC_RPC_URL");
      const contract = new ethers.Contract(CONTRACTS[name], ABI_MAP[name], provider);
      const result = await contract[method](...args);
      return result as T;
    },
    [name]
  );

  const write = useCallback(
    async (method: string, ...args: unknown[]) => {
      const provider = getBrowserProvider();
      if (!provider) throw new Error("No wallet connected — connect MetaMask to sign transactions");
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACTS[name], ABI_MAP[name], signer);
      const tx = await contract[method](...args);
      const receipt = await tx.wait();
      return receipt;
    },
    [name]
  );

  return useMemo(() => ({ read, write }), [read, write]);
}

export function useWalletAddress() {
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    // Try browser wallet first (MetaMask, etc.)
    const browserProvider = getBrowserProvider();
    if (browserProvider) {
      try {
        const signer = await browserProvider.getSigner();
        const addr = await signer.getAddress();
        setAddress(addr);
        return addr;
      } catch {
        // Browser wallet refused or unavailable — fall through
      }
    }

    // Fall back to demo address for read-only mode
    const demoAddr = process.env.NEXT_PUBLIC_DEMO_ADDRESS;
    if (demoAddr) {
      setAddress(demoAddr);
      return demoAddr;
    }

    return null;
  }, []);

  return { address, connect };
}
