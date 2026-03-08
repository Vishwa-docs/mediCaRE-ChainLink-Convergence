"use client";

import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";

interface TreasuryData {
  totalReserves: number;   // in USD cents
  totalLiabilities: number;
  healthScore: number;     // 0–100
  payoutVelocity: number;  // daily average in USD cents
  isPaused: boolean;
  alertCount: number;
  lastUpdated: string;
}

interface TreasuryWidgetProps {
  data: TreasuryData;
  className?: string;
  compact?: boolean;
}

export default function TreasuryWidget({
  data,
  className = "",
  compact = false,
}: TreasuryWidgetProps) {
  const coverageRatio = data.totalLiabilities > 0
    ? (data.totalReserves / data.totalLiabilities) * 100
    : 100;

  const daysOfRunway = data.payoutVelocity > 0
    ? Math.floor(data.totalReserves / data.payoutVelocity)
    : Infinity;

  const healthColor =
    data.healthScore >= 80 ? "text-emerald-600 dark:text-emerald-400" :
    data.healthScore >= 60 ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";

  const healthBg =
    data.healthScore >= 80 ? "bg-emerald-500" :
    data.healthScore >= 60 ? "bg-amber-500" :
    "bg-red-500";

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Treasury Health
        </h3>
        <div className="flex items-center gap-2">
          {data.isPaused && <Badge variant="danger">Paused</Badge>}
          {data.alertCount > 0 && (
            <Badge variant="warning">{data.alertCount} alerts</Badge>
          )}
        </div>
      </div>

      {/* Health score gauge */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-gray-100 dark:text-gray-800"
            />
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${data.healthScore} ${100 - data.healthScore}`}
              strokeLinecap="round"
              className={healthColor}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-bold ${healthColor}`}>
              {data.healthScore}
            </span>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            ${(data.totalReserves / 100).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Total reserves</p>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-800/50">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {coverageRatio.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500">Coverage</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-800/50">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              ${(data.payoutVelocity / 100).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Daily Payout</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-800/50">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {daysOfRunway === Infinity ? "∞" : daysOfRunway}d
            </p>
            <p className="text-xs text-gray-500">Runway</p>
          </div>
        </div>
      )}

      <p className="mt-3 text-right text-xs text-gray-400">
        Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
      </p>
    </Card>
  );
}
