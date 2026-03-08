"use client";

import { useState, useEffect } from "react";
import { FileText, Shield, Truck, AlertTriangle, Loader2, Inbox } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import { useContract } from "@/hooks/useContract";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const PIE_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#a855f7"];

// ── Page ─────────────────────────────────────────

export default function AnalyticsPage() {
  const [stats, setStats] = useState({ records: 0, claims: 0, batches: 0, credentials: 0 });
  const [claimBreakdown, setClaimBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const ehrContract = useContract("EHRStorage");
  const insuranceContract = useContract("InsurancePolicy");
  const supplyContract = useContract("SupplyChain");
  const credContract = useContract("CredentialRegistry");

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const [records, policies, batches, creds, totalClaims] = await Promise.allSettled([
          ehrContract.read<bigint>("totalRecords"),
          insuranceContract.read<bigint>("totalPolicies"),
          supplyContract.read<bigint>("totalBatches"),
          credContract.read<bigint>("totalCredentials"),
          insuranceContract.read<bigint>("totalClaims"),
        ]);

        setStats({
          records: records.status === "fulfilled" ? Number(records.value) : 0,
          claims: totalClaims.status === "fulfilled" ? Number(totalClaims.value) : 0,
          batches: batches.status === "fulfilled" ? Number(batches.value) : 0,
          credentials: creds.status === "fulfilled" ? Number(creds.value) : 0,
        });

        // Fetch claim breakdown
        if (totalClaims.status === "fulfilled") {
          const n = Number(totalClaims.value);
          const statusNames = ["Pending", "Approved", "Rejected", "Paid"];
          const counts: Record<string, number> = { Pending: 0, Approved: 0, Rejected: 0, Paid: 0 };
          const claimPromises = Array.from({ length: n }, (_, i) =>
            insuranceContract.read<any>("getClaim", i + 1).catch(() => null)
          );
          const claimResults = await Promise.all(claimPromises);
          for (const cl of claimResults) {
            if (!cl) continue;
            const st = Number(cl.status ?? cl[5]);
            counts[statusNames[st] || "Pending"]++;
          }
          setClaimBreakdown(Object.entries(counts).map(([name, value]) => ({ name, value })));
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    fetchStats();
  }, [ehrContract, insuranceContract, supplyContract, credContract]);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-500">Loading analytics from chain...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Platform-wide metrics fetched from on-chain data.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Records"
          value={stats.records.toLocaleString()}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="Total Claims"
          value={stats.claims.toLocaleString()}
          icon={<Shield className="h-5 w-5" />}
        />
        <StatCard
          title="Batches Tracked"
          value={stats.batches.toLocaleString()}
          icon={<Truck className="h-5 w-5" />}
        />
        <StatCard
          title="Credentials"
          value={stats.credentials.toLocaleString()}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {/* Row 1: Claim breakdown pie + bar */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Claim status pie */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Claim Status Breakdown</h3>
          <div className="h-72">
            {claimBreakdown.length === 0 || claimBreakdown.every((d) => d.value === 0) ? (
              <div className="flex h-full flex-col items-center justify-center">
                <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm text-gray-500">No claims to analyze</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={claimBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={((props: any) => `${String(props.name ?? "")} ${(Number(props.percent ?? 0) * 100).toFixed(0)}%`) as any}
                  >
                    {claimBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Claim bar chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Claims by Status</h3>
          <div className="h-72">
            {claimBreakdown.length === 0 || claimBreakdown.every((d) => d.value === 0) ? (
              <div className="flex h-full flex-col items-center justify-center">
                <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm text-gray-500">No claims data</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={claimBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Claims" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Time-series notice */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-border dark:bg-surface">
        <Inbox className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
        <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">Time-Series Analytics</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Historical trend charts (records over time, batch tracking, risk distribution) require
          an event indexer (e.g., The Graph subgraph). Current data is fetched live from on-chain state.
        </p>
      </div>
    </div>
  );
}
