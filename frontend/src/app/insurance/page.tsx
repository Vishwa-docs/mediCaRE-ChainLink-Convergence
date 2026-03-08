"use client";

import { useState, useEffect } from "react";
import PolicyCard from "@/components/insurance/PolicyCard";
import ClaimForm from "@/components/insurance/ClaimForm";
import ClaimStatus from "@/components/insurance/ClaimStatus";
import type { InsurancePolicy } from "@/types";
import { DollarSign, TrendingUp, Shield, AlertCircle, Loader2 } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import { useInsurance } from "@/hooks/useApi";
import { useWalletAddress } from "@/hooks/useContract";

export default function InsurancePage() {
  const [tab, setTab] = useState<"policies" | "claims">("policies");
  const { policies, claims, loading, error, fetchPolicies, fetchClaims } = useInsurance();
  const { address, connect } = useWalletAddress();

  useEffect(() => {
    const init = async () => {
      const addr = await connect();
      if (addr) {
        fetchPolicies(addr);
        fetchClaims(addr);
      }
    };
    init();
  }, [connect, fetchPolicies, fetchClaims]);

  const activePolicies = policies.filter((p) => p.isActive);
  const totalCoverage = policies.reduce((sum, p) => sum + Number(p.coverageAmount), 0);
  const avgRisk = policies.length > 0
    ? policies.reduce((sum, p) => sum + p.riskScore, 0) / policies.length / 100
    : 0;
  const pendingClaims = claims.filter((c) => c.status === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insurance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage ERC-721 insurance policies and claims with AI-powered risk scoring
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Policies"
          value={activePolicies.length}
          icon={<Shield className="h-6 w-6" />}
        />
        <StatCard
          title="Total Coverage"
          value={`$${(totalCoverage / 1000).toFixed(0)}K`}
          icon={<DollarSign className="h-6 w-6" />}
        />
        <StatCard
          title="Avg. Risk Score"
          value={`${avgRisk.toFixed(1)}%`}
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <StatCard
          title="Pending Claims"
          value={pendingClaims}
          icon={<AlertCircle className="h-6 w-6" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-border dark:bg-surface">
        {(["policies", "claims"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
              ${
                tab === t
                  ? "bg-white text-gray-900 shadow-sm dark:bg-surface dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
          >
            {t === "policies" ? "Policies" : "Claims"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-gray-500">Loading from blockchain...</span>
        </div>
      )}

      {!loading && tab === "policies" ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {policies.length > 0 ? (
            policies.map((policy) => (
              <PolicyCard key={policy.policyId} policy={policy} />
            ))
          ) : (
            <p className="col-span-full text-center text-sm text-gray-400">No policies found. Create one on-chain to get started.</p>
          )}
        </div>
      ) : !loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ClaimForm policyIds={activePolicies.map((p) => p.policyId)} />
          </div>
          <div className="lg:col-span-2">
            <ClaimStatus claims={claims.length > 0 ? claims : undefined} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
