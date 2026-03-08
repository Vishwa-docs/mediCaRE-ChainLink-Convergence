"use client";

import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export default function StatCard({ title, value, subtitle, icon, trend, className = "" }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-surface ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
          {trend && (
            <p
              className={`mt-1 text-sm font-medium ${
                trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-3 text-primary dark:bg-primary/20 dark:text-primary-light">
          {icon}
        </div>
      </div>
    </div>
  );
}
