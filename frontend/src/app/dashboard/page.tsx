"use client";

import { FileText, Shield, Truck, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import MetricsOverview from "@/components/dashboard/MetricsOverview";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import Button from "@/components/shared/Button";
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

const MONTHLY_DATA = [
  { month: "Sep", records: 820, claims: 31, batches: 12 },
  { month: "Oct", records: 910, claims: 28, batches: 15 },
  { month: "Nov", records: 1045, claims: 35, batches: 11 },
  { month: "Dec", records: 980, claims: 42, batches: 18 },
  { month: "Jan", records: 1120, claims: 38, batches: 22 },
  { month: "Feb", records: 1247, claims: 45, batches: 19 },
];

const CLAIM_DATA = [
  { status: "Pending", count: 14 },
  { status: "Approved", count: 23 },
  { status: "Paid", count: 89 },
  { status: "Rejected", count: 7 },
];

const QUICK_ACTIONS = [
  { label: "Upload Record", icon: FileText, href: "/records", color: "bg-blue-600 hover:bg-blue-700" },
  { label: "File Claim", icon: Shield, href: "/insurance", color: "bg-emerald-600 hover:bg-emerald-700" },
  { label: "Track Batch", icon: Truck, href: "/supply-chain", color: "bg-amber-600 hover:bg-amber-700" },
];

export default function DashboardPage() {
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
        {/* Records trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Records Over Time</h3>
            <Link href="/records" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MONTHLY_DATA}>
                <defs>
                  <linearGradient id="colorRecords" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
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
                <Area
                  type="monotone"
                  dataKey="records"
                  stroke="#2563eb"
                  fillOpacity={1}
                  fill="url(#colorRecords)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Claims by status */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Claims by Status</h3>
            <Link href="/insurance" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CLAIM_DATA}>
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
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed />
    </div>
  );
}
