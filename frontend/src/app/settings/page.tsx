"use client";

import { useState } from "react";
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
} from "lucide-react";
import Button from "@/components/shared/Button";
import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const [worldIdVerified, setWorldIdVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const mockAddress = "0x7a3fB2c9e4D8A1F6b3E5c7d2a9f0B4e8C2d1A3f5";
  const shortAddress = `${mockAddress.slice(0, 6)}…${mockAddress.slice(-4)}`;

  const handleWorldIdVerify = async () => {
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 3000));
    setWorldIdVerified(true);
    setVerifying(false);
    toast.success("World ID verified successfully!");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(mockAddress);
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
            <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Connected Wallet</h3>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
                <p className="font-mono text-sm text-gray-900 dark:text-white">{shortAddress}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  title="Copy address"
                >
                  {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
                <a
                  href={`https://sepolia.etherscan.io/address/${mockAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
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
              <Badge variant="info">Sepolia Testnet</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">ETH Balance</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">1.245 ETH</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">LINK Balance</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">25.0 LINK</span>
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
            <Button className="w-full" variant="secondary" loading={verifying} onClick={handleWorldIdVerify}>
              <UserCheck className="h-4 w-4" />
              Verify with World ID
            </Button>
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
            {[
              { contract: "EHRStorage", roles: ["PROVIDER_ROLE"], active: true },
              { contract: "InsurancePolicy", roles: ["ADMIN_ROLE"], active: true },
              { contract: "SupplyChain", roles: ["DISTRIBUTOR_ROLE"], active: true },
              { contract: "CredentialRegistry", roles: ["ISSUER_ROLE"], active: false },
              { contract: "Governance", roles: ["EXECUTOR_ROLE"], active: false },
            ].map((item) => (
              <div
                key={item.contract}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.contract}</p>
                  <div className="mt-1 flex gap-1">
                    {item.roles.map((role) => (
                      <Badge key={role} variant={item.active ? "purple" : "default"}>
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Badge variant={item.active ? "success" : "default"}>
                  {item.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
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
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                IPFS Gateway
              </label>
              <input
                type="text"
                defaultValue="https://gateway.pinata.cloud/ipfs/"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Toggle application theme</p>
              </div>
              <button
                onClick={() => document.documentElement.classList.toggle("dark")}
                className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
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
