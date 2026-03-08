"use client";

import Card from "@/components/shared/Card";

interface PremiumDataPoint {
  date: string;
  premium: number;
  riskScore: number;
}

interface PremiumChartProps {
  data: PremiumDataPoint[];
  policyId?: number;
  className?: string;
}

export default function PremiumChart({
  data,
  policyId,
  className = "",
}: PremiumChartProps) {
  if (data.length === 0) {
    return (
      <Card className={className}>
        <p className="text-sm text-gray-500">No premium history available</p>
      </Card>
    );
  }

  const maxPremium = Math.max(...data.map((d) => d.premium));
  const minPremium = Math.min(...data.map((d) => d.premium));
  const maxRisk = Math.max(...data.map((d) => d.riskScore));

  const latestPremium = data[data.length - 1].premium;
  const previousPremium = data.length > 1 ? data[data.length - 2].premium : latestPremium;
  const changePercent = previousPremium > 0
    ? ((latestPremium - previousPremium) / previousPremium) * 100
    : 0;

  // Simple SVG bar chart
  const chartWidth = 100;
  const chartHeight = 60;
  const barWidth = chartWidth / data.length;

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Premium History
          </h3>
          {policyId != null && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Policy #{policyId}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            ${(latestPremium / 100).toFixed(2)}
          </p>
          <p className={`text-xs font-medium ${
            changePercent > 0 ? "text-red-500" : changePercent < 0 ? "text-emerald-500" : "text-gray-400"
          }`}>
            {changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}% from last period
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-32 w-full">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full" preserveAspectRatio="none">
          {/* Premium bars */}
          {data.map((point, idx) => {
            const barHeight = maxPremium > 0
              ? ((point.premium - minPremium) / (maxPremium - minPremium || 1)) * chartHeight * 0.8
              : 0;
            return (
              <rect
                key={idx}
                x={idx * barWidth + barWidth * 0.15}
                y={chartHeight - barHeight - 2}
                width={barWidth * 0.7}
                height={Math.max(barHeight, 1)}
                rx={1}
                className="fill-primary/60"
              />
            );
          })}

          {/* Risk score line overlay */}
          <polyline
            points={data
              .map((point, idx) => {
                const x = idx * barWidth + barWidth / 2;
                const y = maxRisk > 0
                  ? chartHeight - (point.riskScore / maxRisk) * chartHeight * 0.85 - 2
                  : chartHeight - 2;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded bg-primary/60" />
          <span>Premium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-4 bg-amber-500" />
          <span>Risk Score</span>
        </div>
      </div>

      {/* Date range */}
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </Card>
  );
}
