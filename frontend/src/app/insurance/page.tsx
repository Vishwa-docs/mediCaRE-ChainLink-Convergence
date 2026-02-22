"use client";

import { useState } from "react";
import PolicyCard from "@/components/insurance/PolicyCard";
import ClaimForm from "@/components/insurance/ClaimForm";
import ClaimStatus from "@/components/insurance/ClaimStatus";
import type { InsurancePolicy } from "@/types";
import { DollarSign, TrendingUp, Shield, AlertCircle } from "lucide-react";
import StatCard from "@/components/shared/StatCard";

const MOCK_POLICIES: InsurancePolicy[] = [
  { policyId: 1, holder: "0x7a3f…c2d1", coverageAmount: "50000", premiumAmount: "250", expiryDate: Date.now() / 1000 + 15768000, isActive: true, riskScore: 3200 },
  { policyId: 2, holder: "0x9b2e…d4f3", coverageAmount: "100000", premiumAmount: "480", expiryDate: Date.now() / 1000 + 23652000, isActive: true, riskScore: 5100 },
  { policyId: 3, holder: "0x5c1d…e8a2", coverageAmount: "25000", premiumAmount: "120", expiryDate: Date.now() / 1000 + 7884000, isActive: true, riskScore: 2100 },
  { policyId: 5, holder: "0x2d4f…a1b3", coverageAmount: "75000", premiumAmount: "380", expiryDate: Date.now() / 1000 - 604800, isActive: false, riskScore: 7800 },
  { policyId: 8, holder: "0x6e7g…b5c4", coverageAmount: "150000", premiumAmount: "720", expiryDate: Date.now() / 1000 + 31536000, isActive: true, riskScore: 4500 },
  { policyId: 12, holder: "0x8h9i…d6e5", coverageAmount: "30000", premiumAmount: "145", expiryDate: Date.now() / 1000 + 10512000, isActive: true, riskScore: 1800 },
];

export default function InsurancePage() {
  const [tab, setTab] = useState<"policies" | "claims">("policies");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insurance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage ERC-721 insurance policies and claims with AI-powered risk scoring
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Policies"
          value={MOCK_POLICIES.filter((p) => p.isActive).length}
          icon={<Shield className="h-6 w-6" />}
          trend={{ value: 8.2, positive: true }}
        />
        <StatCard
          title="Total Coverage"
          value={`$${(MOCK_POLICIES.reduce((sum, p) => sum + Number(p.coverageAmount), 0) / 1000).toFixed(0)}K`}
          icon={<DollarSign className="h-6 w-6" />}
        />
        <StatCard
          title="Avg. Risk Score"
          value={`${(MOCK_POLICIES.reduce((sum, p) => sum + p.riskScore, 0) / MOCK_POLICIES.length / 100).toFixed(1)}%`}
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <StatCard
          title="Pending Claims"
          value="14"
          icon={<AlertCircle className="h-6 w-6" />}
          trend={{ value: 2.4, positive: false }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
        {(["policies", "claims"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
              ${
                tab === t
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
          >
            {t === "policies" ? "Policies" : "Claims"}
          </button>
        ))}
      </div>

      {tab === "policies" ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {MOCK_POLICIES.map((policy) => (
            <PolicyCard key={policy.policyId} policy={policy} />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ClaimForm policyIds={MOCK_POLICIES.filter((p) => p.isActive).map((p) => p.policyId)} />
          </div>
          <div className="lg:col-span-2">
            <ClaimStatus />
          </div>
        </div>
      )}
    </div>
  );
}
