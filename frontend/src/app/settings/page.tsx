"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Wallet,
  Globe,
  UserCheck,
  Shield,
  CheckCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Button from "@/components/shared/Button";
import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";
import { useWalletAddress, useContract } from "@/hooks/useContract";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { IDKitRequestWidget, type IDKitResult } from "@worldcoin/idkit";
import { deviceLegacy } from "@worldcoin/idkit-core";
import { authApiClient } from "@/lib/authApi";

// Role constants (keccak256 hashes from contracts)
const ROLES = {
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
  PROVIDER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("PROVIDER_ROLE")),
  ADMIN_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE")),
  DISTRIBUTOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE")),
  ISSUER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE")),
  EXECUTOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes("EXECUTOR_ROLE")),
};

interface RoleCheck {
  contract: string;
  roleLabel: string;
  roleHash: string;
  active: boolean | null; // null = loading
}

export default function SettingsPage() {
  const [worldIdVerified, setWorldIdVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [idkitOpen, setIdkitOpen] = useState(false);
  const [rpContext, setRpContext] = useState<{
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [roleChecks, setRoleChecks] = useState<RoleCheck[]>([]);
  const { address, connect } = useWalletAddress();

  const ehrContract = useContract("EHRStorage");
  const insuranceContract = useContract("InsurancePolicy");
  const supplyContract = useContract("SupplyChain");
  const credentialContract = useContract("CredentialRegistry");
  const governanceContract = useContract("Governance");

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    async function fetchBalance() {
      if (!address || typeof window === "undefined") return;
      try {
        const w = window as unknown as { ethereum?: ethers.Eip1193Provider };
        if (!w.ethereum) return;
        const provider = new ethers.BrowserProvider(w.ethereum);
        const bal = await provider.getBalance(address);
        setEthBalance(ethers.formatEther(bal));
      } catch {
        setEthBalance("—");
      }
    }
    fetchBalance();
  }, [address]);

  // Check on-chain roles
  useEffect(() => {
    if (!address) return;

    const checks: { contract: string; roleLabel: string; roleHash: string; contractRef: ReturnType<typeof useContract> }[] = [
      { contract: "EHRStorage", roleLabel: "PROVIDER_ROLE", roleHash: ROLES.PROVIDER_ROLE, contractRef: ehrContract },
      { contract: "EHRStorage", roleLabel: "DEFAULT_ADMIN", roleHash: ROLES.DEFAULT_ADMIN_ROLE, contractRef: ehrContract },
      { contract: "InsurancePolicy", roleLabel: "ADMIN_ROLE", roleHash: ROLES.ADMIN_ROLE, contractRef: insuranceContract },
      { contract: "SupplyChain", roleLabel: "DISTRIBUTOR_ROLE", roleHash: ROLES.DISTRIBUTOR_ROLE, contractRef: supplyContract },
      { contract: "CredentialRegistry", roleLabel: "ISSUER_ROLE", roleHash: ROLES.ISSUER_ROLE, contractRef: credentialContract },
      { contract: "Governance", roleLabel: "EXECUTOR_ROLE", roleHash: ROLES.EXECUTOR_ROLE, contractRef: governanceContract },
    ];

    const fetchRoles = async () => {
      const results: RoleCheck[] = await Promise.all(
        checks.map(async (c) => {
          try {
            const hasRole = await c.contractRef.read("hasRole", c.roleHash, address);
            return { contract: c.contract, roleLabel: c.roleLabel, roleHash: c.roleHash, active: Boolean(hasRole) };
          } catch {
            // Contract may not have hasRole (try DEFAULT_ADMIN as fallback)
            return { contract: c.contract, roleLabel: c.roleLabel, roleHash: c.roleHash, active: false };
          }
        })
      );
      setRoleChecks(results);
    };

    fetchRoles();
  }, [address, ehrContract, insuranceContract, supplyContract, credentialContract, governanceContract]);

  const displayAddress = address || "Not connected";
  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected";

  /** Fetch a signed rp_context from the backend, then open IDKit widget */
  const handleWorldIdVerify = useCallback(async () => {
    setVerifying(true);
    try {
      const resp = await authApiClient.getWorldIdSignRequest();
      const data = resp.data?.data;
      if (!data?.rp_context) throw new Error("Failed to get RP context");
      setRpContext(data.rp_context);
      setIdkitOpen(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to start World ID verification");
      setVerifying(false);
    }
  }, []);

  /** Called when IDKit proof is ready — send to backend for verification */
  const handleIdKitSuccess = useCallback(async (result: IDKitResult) => {
    try {
      // Extract the first v3 response (legacy mode)
      if (result.protocol_version === "3.0" && result.responses?.[0]) {
        const resp = result.responses[0];
        await authApiClient.verifyWorldID({
          merkle_root: (resp as any).merkle_root || "",
          nullifier_hash: (resp as any).nullifier || "",
          proof: typeof (resp as any).proof === "string" ? (resp as any).proof : "",
          signal: address || "",
        });
      } else if (result.protocol_version === "4.0" && result.responses?.[0]) {
        // V4 proof — send proof array as JSON
        const resp = result.responses[0];
        await authApiClient.verifyWorldID({
          merkle_root: "",
          nullifier_hash: (resp as any).nullifier || "",
          proof: JSON.stringify((resp as any).proof),
          signal: address || "",
        });
      } else {
        // Fallback: simulate for demo
        await authApiClient.simulateWorldID();
      }
      setWorldIdVerified(true);
      toast.success("World ID verified successfully!");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Verification failed on backend");
    } finally {
      setVerifying(false);
      setIdkitOpen(false);
    }
  }, [address]);

  /** Fallback: simulate World ID for demo / when World App not available */
  const handleSimulateWorldId = useCallback(async () => {
    setVerifying(true);
    try {
      await authApiClient.simulateWorldID();
      setWorldIdVerified(true);
      toast.success("World ID simulated for demo!");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Simulation failed");
    } finally {
      setVerifying(false);
    }
  }, []);

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your account, identity verification, and roles
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Wallet info */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary dark:text-primary-light" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Connected Wallet</h3>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-surface/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
                <p className="font-mono text-sm text-gray-900 dark:text-white">{shortAddress}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  title="Copy address"
                >
                  {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
                <a
                  href={`https://dashboard.tenderly.co/explorer/vnet/tx/${displayAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  title="View on Etherscan"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Network</span>
              <Badge variant="info">Tenderly VNet</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">ETH Balance</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {ethBalance !== null ? `${Number(ethBalance).toFixed(4)} ETH` : <Loader2 className="h-4 w-4 animate-spin" />}
              </span>
            </div>
          </div>
        </Card>

        {/* World ID */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">World ID Verification</h3>
          </div>

          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Verify your identity with World ID for Sybil-resistant access to sensitive operations
            like record creation and governance voting.
          </p>

          <div
            className={`mb-4 rounded-lg border p-4 ${
              worldIdVerified
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
            }`}
          >
            <div className="flex items-center gap-2">
              {worldIdVerified ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Identity Verified
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      World ID proof stored on-chain
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      Not Verified
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Some features require World ID verification
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {!worldIdVerified && (
            <div className="space-y-2">
              <Button className="w-full" variant="secondary" loading={verifying} onClick={handleWorldIdVerify}>
                <UserCheck className="h-4 w-4" />
                Verify with World ID
              </Button>
              <button
                onClick={handleSimulateWorldId}
                disabled={verifying}
                className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
              >
                Demo: Simulate verification (no World App needed)
              </button>
            </div>
          )}

          {/* IDKit v4 Widget — only renders when rpContext is ready */}
          {rpContext && (
            <IDKitRequestWidget
              app_id={process.env.NEXT_PUBLIC_WORLDID_APP_ID as `app_${string}` || "app_cf4f67cc7a208b56b418fdc252b16aa5"}
              action={process.env.NEXT_PUBLIC_WORLDID_ACTION || "medicare-identity"}
              preset={deviceLegacy({ signal: address || "" })}
              rp_context={rpContext}
              allow_legacy_proofs={true}
              open={idkitOpen}
              onOpenChange={(open) => {
                setIdkitOpen(open);
                if (!open) setVerifying(false);
              }}
              onSuccess={handleIdKitSuccess}
              onError={(errorCode) => {
                toast.error(`World ID error: ${errorCode}`);
                setVerifying(false);
                setIdkitOpen(false);
              }}
              autoClose
            />
          )}
        </Card>

        {/* Role Management */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Role Management</h3>
          </div>

          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Your assigned roles across mediCaRE smart contracts. Roles determine what actions you can perform.
          </p>

          <div className="space-y-3">
            {(roleChecks.length > 0
              ? /* Group by contract */
                Object.entries(
                  roleChecks.reduce<Record<string, RoleCheck[]>>((acc, r) => {
                    (acc[r.contract] ||= []).push(r);
                    return acc;
                  }, {})
                ).map(([contract, roles]) => (
                  <div
                    key={contract}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-border"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{contract}</p>
                      <div className="mt-1 flex gap-1">
                        {roles.map((r) => (
                          <Badge key={r.roleLabel} variant={r.active ? "purple" : "default"}>
                            {r.roleLabel}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant={roles.some((r) => r.active) ? "success" : "default"}>
                      {roles.some((r) => r.active) ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))
              : /* Loading skeleton */
                [1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex animate-pulse items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-border"
                  >
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                    <div className="h-5 w-14 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                ))
            )}
          </div>
        </Card>

        {/* Configuration */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Configuration</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Backend API URL
              </label>
              <input
                type="text"
                defaultValue="http://localhost:3001"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                IPFS Gateway
              </label>
              <input
                type="text"
                defaultValue="https://gateway.pinata.cloud/ipfs/"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-border">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Toggle application theme</p>
              </div>
              <button
                onClick={() => document.documentElement.classList.toggle("dark")}
                className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
              >
                Toggle
              </button>
            </div>
          </div>

          <Button variant="outline" className="mt-4 w-full">
            Save Configuration
          </Button>
        </Card>
      </div>
    </div>
  );
}
