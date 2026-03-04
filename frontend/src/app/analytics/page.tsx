"use client";

import { FileText, Shield, Truck, AlertTriangle } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Mock data ────────────────────────────────────

const RECORDS_OVER_TIME = [
  { month: "Sep '25", records: 820 },
  { month: "Oct '25", records: 910 },
  { month: "Nov '25", records: 1045 },
  { month: "Dec '25", records: 980 },
  { month: "Jan '26", records: 1120 },
  { month: "Feb '26", records: 1247 },
];

const CLAIMS_PROCESSED = [
  { month: "Sep '25", pending: 8, approved: 14, rejected: 3, paid: 22 },
  { month: "Oct '25", pending: 12, approved: 18, rejected: 2, paid: 26 },
  { month: "Nov '25", pending: 6, approved: 21, rejected: 5, paid: 31 },
  { month: "Dec '25", pending: 15, approved: 16, rejected: 4, paid: 28 },
  { month: "Jan '26", pending: 10, approved: 22, rejected: 1, paid: 34 },
  { month: "Feb '26", pending: 14, approved: 23, rejected: 7, paid: 38 },
];

const BATCH_TRACKING = [
  { month: "Sep '25", created: 12, inTransit: 8, delivered: 10, flagged: 1 },
  { month: "Oct '25", created: 15, inTransit: 11, delivered: 13, flagged: 0 },
  { month: "Nov '25", created: 11, inTransit: 9, delivered: 14, flagged: 2 },
  { month: "Dec '25", created: 18, inTransit: 14, delivered: 12, flagged: 1 },
  { month: "Jan '26", created: 22, inTransit: 17, delivered: 19, flagged: 0 },
  { month: "Feb '26", created: 19, inTransit: 13, delivered: 20, flagged: 3 },
];

const RISK_DISTRIBUTION = [
  { range: "0–2 000", count: 312, fill: "#22c55e" },
  { range: "2 001–4 000", count: 198, fill: "#84cc16" },
  { range: "4 001–6 000", count: 127, fill: "#eab308" },
  { range: "6 001–8 000", count: 64, fill: "#f97316" },
  { range: "8 001–10 000", count: 18, fill: "#ef4444" },
];

const PIE_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#a855f7"];
const CLAIM_PIE = [
  { name: "Pending", value: 14 },
  { name: "Approved", value: 23 },
  { name: "Rejected", value: 7 },
  { name: "Paid", value: 89 },
];

// ── Page ─────────────────────────────────────────

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Platform-wide metrics and trends across records, claims, and supply chain.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Records"
          value="6 122"
          icon={<FileText className="h-5 w-5" />}
          trend={{ value: 10.2, positive: true }}
        />
        <StatCard
          title="Claims Processed"
          value="133"
          icon={<Shield className="h-5 w-5" />}
          trend={{ value: 18.4, positive: true }}
        />
        <StatCard
          title="Batches Tracked"
          value="97"
          icon={<Truck className="h-5 w-5" />}
          trend={{ value: 5.1, positive: true }}
        />
        <StatCard
          title="Active Alerts"
          value="7"
          icon={<AlertTriangle className="h-5 w-5" />}
          trend={{ value: 42.9, positive: false }}
        />
      </div>

      {/* Row 1: Records & Claims over time */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Records over time */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Records Created Over Time</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={RECORDS_OVER_TIME}>
                <defs>
                  <linearGradient id="recordsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="records"
                  stroke="#3b82f6"
                  fill="url(#recordsGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Claims processed (stacked bar) */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Claims Processed</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CLAIMS_PROCESSED}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="paid" stackId="a" fill="#22c55e" name="Paid" />
                <Bar dataKey="approved" stackId="a" fill="#3b82f6" name="Approved" />
                <Bar dataKey="pending" stackId="a" fill="#eab308" name="Pending" />
                <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Rejected" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Supply chain batches & Risk distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Supply chain batches */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Supply Chain Batches</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={BATCH_TRACKING}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} name="Created" />
                <Line type="monotone" dataKey="inTransit" stroke="#eab308" strokeWidth={2} name="In Transit" />
                <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} name="Delivered" />
                <Line type="monotone" dataKey="flagged" stroke="#ef4444" strokeWidth={2} name="Flagged" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk score distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Risk Score Distribution</h3>
          <div className="grid h-72 grid-cols-2 gap-4">
            {/* Bar breakdown */}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RISK_DISTRIBUTION} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="range" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" name="Policies">
                  {RISK_DISTRIBUTION.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Claim status pie */}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={CLAIM_PIE}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    ((props: any) => `${String(props.name ?? "")} ${(Number(props.percent ?? 0) * 100).toFixed(0)}%`) as any}
                >
                  {CLAIM_PIE.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
