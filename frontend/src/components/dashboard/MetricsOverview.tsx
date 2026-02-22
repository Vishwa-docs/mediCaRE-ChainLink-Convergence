"use client";

import { FileText, Shield, Truck, AlertCircle, BadgeCheck, Vote } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import type { DashboardMetrics } from "@/types";

const DEFAULT_METRICS: DashboardMetrics = {
  totalRecords: 1_247,
  activePolicies: 328,
  supplyBatches: 89,
  pendingClaims: 14,
  verifiedCredentials: 56,
  activeProposals: 3,
};

interface MetricsOverviewProps {
  metrics?: DashboardMetrics;
}

export default function MetricsOverview({ metrics = DEFAULT_METRICS }: MetricsOverviewProps) {
  const cards = [
    {
      title: "Total Records",
      value: metrics.totalRecords.toLocaleString(),
      icon: <FileText className="h-6 w-6" />,
      trend: { value: 12.5, positive: true },
    },
    {
      title: "Active Policies",
      value: metrics.activePolicies.toLocaleString(),
      icon: <Shield className="h-6 w-6" />,
      trend: { value: 8.2, positive: true },
    },
    {
      title: "Supply Batches",
      value: metrics.supplyBatches.toLocaleString(),
      icon: <Truck className="h-6 w-6" />,
      trend: { value: 3.1, positive: true },
    },
    {
      title: "Pending Claims",
      value: metrics.pendingClaims.toLocaleString(),
      icon: <AlertCircle className="h-6 w-6" />,
      trend: { value: 2.4, positive: false },
    },
    {
      title: "Verified Credentials",
      value: metrics.verifiedCredentials.toLocaleString(),
      icon: <BadgeCheck className="h-6 w-6" />,
      trend: { value: 5.7, positive: true },
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
