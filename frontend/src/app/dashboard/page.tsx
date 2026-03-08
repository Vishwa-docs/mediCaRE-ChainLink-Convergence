"use client";

import { useState, useEffect } from "react";
import { FileText, Shield, Truck, Plus, ArrowRight, Loader2, Inbox, Database, Brain, Globe, Zap, Activity } from "lucide-react";
import Link from "next/link";
import MetricsOverview from "@/components/dashboard/MetricsOverview";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import Button from "@/components/shared/Button";
import { useContract } from "@/hooks/useContract";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const QUICK_ACTIONS = [
  { label: "Upload Record", icon: FileText, href: "/records", color: "bg-primary hover:bg-primary" },
  { label: "File Claim", icon: Shield, href: "/insurance", color: "bg-emerald-600 hover:bg-emerald-700" },
  { label: "Track Batch", icon: Truck, href: "/supply-chain", color: "bg-amber-600 hover:bg-amber-700" },
];

export default function DashboardPage() {
  const [claimData, setClaimData] = useState<{ status: string; count: number }[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const insuranceContract = useContract("InsurancePolicy");

  useEffect(() => {
    async function fetchClaimData() {
      setLoadingClaims(true);
      try {
        const total = await insuranceContract.read<bigint>("totalClaims");
        const n = Number(total);
        const statusCounts: Record<string, number> = { Pending: 0, Approved: 0, Paid: 0, Rejected: 0 };
        const statusNames = ["Pending", "Approved", "Rejected", "Paid"];
        const claimPromises = Array.from({ length: n }, (_, i) =>
          insuranceContract.read<any>("getClaim", i + 1).catch(() => null)
        );
        const claims = await Promise.all(claimPromises);
        for (const claim of claims) {
          if (!claim) continue;
          const status = Number(claim.status ?? claim[5]);
          const name = statusNames[status] || "Pending";
          statusCounts[name] = (statusCounts[name] || 0) + 1;
        }
        setClaimData(Object.entries(statusCounts).map(([status, count]) => ({ status, count })));
      } catch {
        setClaimData([]);
      } finally {
        setLoadingClaims(false);
      }
    }
    fetchClaimData();
  }, [insuranceContract]);
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Overview of your healthcare platform activity
          </p>
        </div>
        <div className="flex gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.label} href={action.href}>
              <Button size="sm" className={action.color}>
                <Plus className="h-4 w-4" />
                {action.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <MetricsOverview />

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Records trend — requires event indexer, show placeholder */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Records Over Time</h3>
            <Link href="/records" className="flex items-center gap-1 text-xs text-primary hover:text-primary dark:text-primary-light">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Time-series data requires an event indexer</p>
            <p className="mt-1 text-xs text-gray-400">Use the Records page to view current on-chain records</p>
          </div>
        </div>

        {/* Claims by status — fetched from contract */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Claims by Status</h3>
            <Link href="/insurance" className="flex items-center gap-1 text-xs text-primary hover:text-primary dark:text-primary-light">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-64">
            {loadingClaims ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : claimData.length === 0 || claimData.every((d) => d.count === 0) ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No claims data available</p>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={claimData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "none",
                    borderRadius: "8px",
                    color: "#f9fafb",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed />

      {/* Integration Status */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Platform Integration Status</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Chainlink Functions", desc: "AI summarization & risk scoring", icon: Brain, status: "active", color: "text-primary" },
            { label: "IPFS via Pinata", desc: "Encrypted EHR storage", icon: Database, status: "active", color: "text-accent" },
            { label: "Chainlink Automation", desc: "Policy expiry & IoT monitoring", icon: Zap, status: "active", color: "text-emerald-500" },
            { label: "Chainlink CCIP", desc: "Cross-chain messaging", icon: Globe, status: "ready", color: "text-purple-500" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-border dark:bg-surface/50">
              <div className={`mt-0.5 ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                  <span className={`h-2 w-2 rounded-full ${item.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
