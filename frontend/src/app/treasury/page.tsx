"use client";

import { useState, useEffect } from "react";
import {
  Vault,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Shield,
  Activity,
  DollarSign,
  Loader2,
} from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import TreasuryWidget from "@/components/dashboard/TreasuryWidget";
import toast from "react-hot-toast";

// ── Demo data ──────────────────────────────────

const DEMO_TREASURY = {
  totalReserves: 250000000,    // $2.5M in cents
  totalLiabilities: 180000000, // $1.8M
  healthScore: 82,
  payoutVelocity: 1500000,     // $15K/day
  isPaused: false,
  alertCount: 2,
  lastUpdated: new Date().toISOString(),
};

const DEMO_PAYOUTS = [
  { id: "p1", claimId: 45, amount: 250000, recipient: "0xHospital1...abc", chain: "Sepolia", status: "completed", date: "2024-01-15" },
  { id: "p2", claimId: 42, amount: 180000, recipient: "0xClinic2...def", chain: "Base Sepolia", status: "completed", date: "2024-01-14" },
  { id: "p3", claimId: 39, amount: 520000, recipient: "0xHospital3...ghi", chain: "Sepolia", status: "pending", date: "2024-01-14" },
  { id: "p4", claimId: 38, amount: 75000, recipient: "0xPharmacy1...jkl", chain: "Sepolia", status: "completed", date: "2024-01-13" },
  { id: "p5", claimId: 35, amount: 340000, recipient: "0xHospital2...mno", chain: "Base Sepolia", status: "completed", date: "2024-01-12" },
];

const DEMO_ALERTS = [
  {
    id: "a1",
    severity: "warning" as const,
    title: "Payout velocity increasing",
    description: "Daily payout rate has increased 23% over last 7 days. Coverage ratio may drop below 130% in 12 days.",
    timestamp: "2024-01-15T10:30:00Z",
  },
  {
    id: "a2",
    severity: "info" as const,
    title: "Cross-chain settlement pending",
    description: "3 CCIP settlements awaiting confirmation on Base Sepolia.",
    timestamp: "2024-01-15T09:15:00Z",
  },
];

const DEMO_RESERVE_HISTORY = [
  { date: "Jul", reserves: 220000000, liabilities: 160000000 },
  { date: "Aug", reserves: 235000000, liabilities: 165000000 },
  { date: "Sep", reserves: 240000000, liabilities: 170000000 },
  { date: "Oct", reserves: 255000000, liabilities: 172000000 },
  { date: "Nov", reserves: 248000000, liabilities: 175000000 },
  { date: "Dec", reserves: 245000000, liabilities: 178000000 },
  { date: "Jan", reserves: 250000000, liabilities: 180000000 },
];

// ── Page Component ─────────────────────────────

export default function TreasuryPage() {
  const [treasury, setTreasury] = useState(DEMO_TREASURY);
  const [checking, setChecking] = useState(false);

  const handleAnomalyCheck = async () => {
    setChecking(true);
    await new Promise((r) => setTimeout(r, 2000));
    setChecking(false);
    toast.success("Anomaly check complete — no critical issues found");
  };

  const togglePause = () => {
    setTreasury((prev) => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
    toast.success(
      treasury.isPaused ? "Payouts resumed" : "Payouts paused via CRE"
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Vault className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Insurance Treasury
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Reserve monitoring &middot; Anomaly detection &middot; Cross-chain settlement
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAnomalyCheck} disabled={checking}>
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Run Check
              </span>
            )}
          </Button>
          <Button
            onClick={togglePause}
            className={treasury.isPaused ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}
          >
            {treasury.isPaused ? (
              <span className="flex items-center gap-1 text-white">
                <PlayCircle className="h-4 w-4" />
                Resume
              </span>
            ) : (
              <span className="flex items-center gap-1 text-white">
                <PauseCircle className="h-4 w-4" />
                Pause
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Top metrics row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Reserves</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${(treasury.totalReserves / 100).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Activity className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Liabilities</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${(treasury.totalLiabilities / 100).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Coverage Ratio</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {((treasury.totalReserves / treasury.totalLiabilities) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <TrendingDown className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Daily Payout</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${(treasury.payoutVelocity / 100).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Reserve chart (left 2/3) ─── */}
        <div className="lg:col-span-2">
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Reserve vs. Liabilities (7-Month Trend)
            </h3>
            <div className="h-48 w-full">
              <svg viewBox="0 0 350 150" className="h-full w-full" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map((pct) => (
                  <line
                    key={pct}
                    x1="0" y1={150 * pct} x2="350" y2={150 * pct}
                    stroke="currentColor" strokeWidth="0.3"
                    className="text-gray-200 dark:text-gray-700"
                  />
                ))}

                {/* Reserves area */}
                <polygon
                  points={DEMO_RESERVE_HISTORY.map((d, i) => {
                    const x = (i / (DEMO_RESERVE_HISTORY.length - 1)) * 350;
                    const y = 150 - (d.reserves / 300000000) * 150;
                    return `${x},${y}`;
                  }).join(" ") + ` 350,150 0,150`}
                  className="fill-emerald-500/10"
                />

                {/* Reserves line */}
                <polyline
                  points={DEMO_RESERVE_HISTORY.map((d, i) => {
                    const x = (i / (DEMO_RESERVE_HISTORY.length - 1)) * 350;
                    const y = 150 - (d.reserves / 300000000) * 150;
                    return `${x},${y}`;
                  }).join(" ")}
                  fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />

                {/* Liabilities line */}
                <polyline
                  points={DEMO_RESERVE_HISTORY.map((d, i) => {
                    const x = (i / (DEMO_RESERVE_HISTORY.length - 1)) * 350;
                    const y = 150 - (d.liabilities / 300000000) * 150;
                    return `${x},${y}`;
                  }).join(" ")}
                  fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3"
                />
              </svg>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="h-0.5 w-4 bg-emerald-500 inline-block" /> Reserves
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-0.5 w-4 bg-amber-500 inline-block" style={{ borderTop: "2px dashed #f59e0b", height: 0 }} /> Liabilities
                </span>
              </div>
              <div className="flex gap-3 text-xs text-gray-400">
                {DEMO_RESERVE_HISTORY.map((d) => (
                  <span key={d.date}>{d.date}</span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Health Widget (right 1/3) ─── */}
        <TreasuryWidget data={treasury} />
      </div>

      {/* ── Alerts ─── */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Active Alerts
        </h3>
        {DEMO_ALERTS.length === 0 ? (
          <p className="text-sm text-gray-500">No active alerts</p>
        ) : (
          <div className="space-y-2">
            {DEMO_ALERTS.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                  alert.severity === "warning"
                    ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                    : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                }`}
              >
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
                  alert.severity === "warning" ? "text-amber-500" : "text-gray-400"
                }`} />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {alert.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {alert.description}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Recent Payouts ─── */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Recent Payouts
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Claim</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Amount</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Recipient</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Chain</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_PAYOUTS.map((payout) => (
                <tr key={payout.id} className="border-b border-gray-50 dark:border-gray-800">
                  <td className="py-2 font-mono text-gray-700 dark:text-gray-300">#{payout.claimId}</td>
                  <td className="py-2 font-medium text-gray-900 dark:text-white">
                    ${(payout.amount / 100).toLocaleString()}
                  </td>
                  <td className="py-2 font-mono text-xs text-gray-500">{payout.recipient}</td>
                  <td className="py-2">
                    <Badge variant={payout.chain.includes("Base") ? "purple" : "info"}>
                      {payout.chain}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <Badge variant={payout.status === "completed" ? "success" : "warning"}>
                      {payout.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-gray-500">{payout.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
