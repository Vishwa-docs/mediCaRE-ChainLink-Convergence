"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  Copy,
  Database,
  Activity,
  Server,
  Zap,
} from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import { CONTRACTS } from "@/lib/contracts";
import { useContract } from "@/hooks/useContract";
import { ethers } from "ethers";
import toast from "react-hot-toast";

interface ContractStatus {
  name: string;
  address: string;
  deployed: boolean;
  totalCount: number | null;
  countLabel: string;
  codeSize: number;
  loading: boolean;
  error: string | null;
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ContractHealthPage() {
  const [statuses, setStatuses] = useState<ContractStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendHealth, setBackendHealth] = useState<{
    status: string;
    latency: number;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const ehrContract = useContract("EHRStorage");
  const insuranceContract = useContract("InsurancePolicy");
  const supplyContract = useContract("SupplyChain");
  const credContract = useContract("CredentialRegistry");
  const govContract = useContract("Governance");

  const checkHealth = useCallback(async () => {
    setLoading(true);

    // Check backend
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const start = Date.now();
      const res = await fetch(`${apiUrl}/api/health`);
      const latency = Date.now() - start;
      const data = await res.json();
      setBackendHealth({ status: data.status || "ok", latency });
    } catch {
      setBackendHealth({ status: "error", latency: -1 });
    }

    // Check each contract
    const contracts: {
      name: string;
      address: string;
      contract: ReturnType<typeof useContract>;
      countFn: string;
      countLabel: string;
    }[] = [
      { name: "EHRStorage", address: CONTRACTS.EHRStorage, contract: ehrContract, countFn: "totalRecords", countLabel: "Records" },
      { name: "InsurancePolicy", address: CONTRACTS.InsurancePolicy, contract: insuranceContract, countFn: "totalPolicies", countLabel: "Policies" },
      { name: "SupplyChain", address: CONTRACTS.SupplyChain, contract: supplyContract, countFn: "totalBatches", countLabel: "Batches" },
      { name: "CredentialRegistry", address: CONTRACTS.CredentialRegistry, contract: credContract, countFn: "totalCredentials", countLabel: "Credentials" },
      { name: "Governance", address: CONTRACTS.Governance, contract: govContract, countFn: "totalProposals", countLabel: "Proposals" },
    ];

    const results: ContractStatus[] = [];

    for (const c of contracts) {
      const status: ContractStatus = {
        name: c.name,
        address: c.address,
        deployed: false,
        totalCount: null,
        countLabel: c.countLabel,
        codeSize: 0,
        loading: false,
        error: null,
      };

      try {
        // Use read-only JSON-RPC provider (no wallet needed)
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
        let provider: ethers.Provider | null = null;

        const w = window as unknown as { ethereum?: ethers.Eip1193Provider };
        if (w.ethereum) {
          provider = new ethers.BrowserProvider(w.ethereum);
        } else if (rpcUrl) {
          provider = new ethers.JsonRpcProvider(rpcUrl);
        }

        if (provider) {
          const code = await provider.getCode(c.address);
          status.deployed = code !== "0x";
          status.codeSize = Math.floor((code.length - 2) / 2); // bytes
        }

        if (status.deployed) {
          const count = await c.contract.read<bigint>(c.countFn);
          status.totalCount = Number(count);
        }
      } catch (err: unknown) {
        status.error = err instanceof Error ? err.message : "Failed to check";
      }

      results.push(status);
    }

    setStatuses(results);
    setLoading(false);
  }, [ehrContract, insuranceContract, supplyContract, credContract, govContract]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    toast.success("Address copied!");
    setTimeout(() => setCopied(null), 2000);
  };

  const allDeployed = statuses.length > 0 && statuses.every((s) => s.deployed);
  const deployedCount = statuses.filter((s) => s.deployed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contract Health</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time status of all deployed smart contracts and backend services
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={checkHealth} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Check Status
        </Button>
      </div>

      {/* Overall status */}
      <div
        className={`flex items-center gap-3 rounded-xl border p-4 ${
          loading
            ? "border-gray-200 bg-gray-50 dark:border-border dark:bg-surface"
            : allDeployed
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
            : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
        }`}
      >
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : allDeployed ? (
          <CheckCircle className="h-6 w-6 text-emerald-600" />
        ) : (
          <XCircle className="h-6 w-6 text-amber-600" />
        )}
        <div>
          <p className={`font-medium ${loading ? "text-gray-700" : allDeployed ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
            {loading ? "Checking system health..." : allDeployed ? "All Systems Operational" : `${deployedCount}/5 Contracts Deployed`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {statuses.length > 0 && `${statuses.reduce((sum, s) => sum + (s.totalCount || 0), 0).toLocaleString()} total on-chain entities`}
          </p>
        </div>
      </div>

      {/* Backend status */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 dark:bg-primary/25">
              <Server className="h-5 w-5 text-primary dark:text-primary-light" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Backend API</p>
              <p className="text-xs text-gray-500">Express.js + TypeScript</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {backendHealth ? (
              <>
                <Badge variant={backendHealth.status === "ok" ? "success" : "danger"}>
                  {backendHealth.status === "ok" ? "Healthy" : "Unreachable"}
                </Badge>
                {backendHealth.latency > 0 && (
                  <span className="text-xs text-gray-500">{backendHealth.latency}ms</span>
                )}
              </>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>
        </div>
      </Card>

      {/* Contracts grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-gray-500">Verifying contracts on-chain...</span>
          </div>
        ) : (
          statuses.map((status) => (
            <Card key={status.name}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      status.deployed
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                    }`}
                  >
                    {status.deployed ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{status.name}</p>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-gray-500">{formatAddress(status.address)}</span>
                      <button onClick={() => handleCopy(status.address)} className="text-gray-400 hover:text-gray-600">
                        {copied === status.address ? (
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <Badge variant={status.deployed ? "success" : "danger"}>
                  {status.deployed ? "Live" : "Not Found"}
                </Badge>
              </div>

              {status.deployed && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Database className="h-3.5 w-3.5" /> {status.countLabel}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {status.totalCount !== null ? status.totalCount.toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Zap className="h-3.5 w-3.5" /> Bytecode
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {(status.codeSize / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              )}

              {status.error && (
                <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {status.error}
                </p>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Contract addresses reference */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Deployment Reference</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-border dark:text-gray-400">
              <tr>
                <th className="pb-2 pr-4">Contract</th>
                <th className="pb-2 pr-4">Address</th>
                <th className="pb-2">Network</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-border">
              {Object.entries(CONTRACTS).map(([name, address]) => (
                <tr key={name}>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{name}</td>
                  <td className="py-2 pr-4">
                    <span className="font-mono text-xs text-gray-500">{address}</span>
                  </td>
                  <td className="py-2">
                    <Badge variant="info">Tenderly VNet</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
