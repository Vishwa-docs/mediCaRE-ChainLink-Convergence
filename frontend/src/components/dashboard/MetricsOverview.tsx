"use client";

import { useEffect, useState } from "react";
import { FileText, Shield, Truck, AlertCircle, BadgeCheck, Vote, Loader2 } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import { useContract } from "@/hooks/useContract";
import type { DashboardMetrics } from "@/types";

export default function MetricsOverview() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const ehrContract = useContract("EHRStorage");
  const insuranceContract = useContract("InsurancePolicy");
  const supplyContract = useContract("SupplyChain");
  const credContract = useContract("CredentialRegistry");
  const govContract = useContract("Governance");

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const [records, policies, batches, creds, proposals] = await Promise.allSettled([
          ehrContract.read<bigint>("totalRecords"),
          insuranceContract.read<bigint>("totalPolicies"),
          supplyContract.read<bigint>("totalBatches"),
          credContract.read<bigint>("totalCredentials"),
          govContract.read<bigint>("totalProposals"),
        ]);
        setMetrics({
          totalRecords: records.status === "fulfilled" ? Number(records.value) : 0,
          activePolicies: policies.status === "fulfilled" ? Number(policies.value) : 0,
          supplyBatches: batches.status === "fulfilled" ? Number(batches.value) : 0,
          pendingClaims: 0, // requires indexer for pending count
          verifiedCredentials: creds.status === "fulfilled" ? Number(creds.value) : 0,
          activeProposals: proposals.status === "fulfilled" ? Number(proposals.value) : 0,
        });
      } catch {
        setMetrics({
          totalRecords: 0, activePolicies: 0, supplyBatches: 0,
          pendingClaims: 0, verifiedCredentials: 0, activeProposals: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [ehrContract, insuranceContract, supplyContract, credContract, govContract]);

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-gray-500">Loading on-chain metrics...</span>
      </div>
    );
  }

  const cards = [
    {
      title: "Total Records",
      value: metrics.totalRecords.toLocaleString(),
      icon: <FileText className="h-6 w-6" />,
    },
    {
      title: "Active Policies",
      value: metrics.activePolicies.toLocaleString(),
      icon: <Shield className="h-6 w-6" />,
    },
    {
      title: "Supply Batches",
      value: metrics.supplyBatches.toLocaleString(),
      icon: <Truck className="h-6 w-6" />,
    },
    {
      title: "Pending Claims",
      value: metrics.pendingClaims.toLocaleString(),
      icon: <AlertCircle className="h-6 w-6" />,
    },
    {
      title: "Verified Credentials",
      value: metrics.verifiedCredentials.toLocaleString(),
      icon: <BadgeCheck className="h-6 w-6" />,
    },
    {
      title: "Active Proposals",
      value: metrics.activeProposals.toLocaleString(),
      icon: <Vote className="h-6 w-6" />,
      subtitle: "Governance",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}
