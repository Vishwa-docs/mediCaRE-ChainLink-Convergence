"use client";

import { Shield, Calendar, DollarSign, TrendingUp } from "lucide-react";
import Badge from "@/components/shared/Badge";
import type { InsurancePolicy } from "@/types";

interface PolicyCardProps {
  policy: InsurancePolicy;
  onClick?: () => void;
}

export default function PolicyCard({ policy, onClick }: PolicyCardProps) {
  const expired = policy.expiryDate * 1000 < Date.now();
  const daysLeft = Math.max(0, Math.ceil((policy.expiryDate * 1000 - Date.now()) / 86_400_000));
  const riskPercent = (policy.riskScore / 100).toFixed(1);

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800
        ${expired ? "border-red-200 dark:border-red-800" : "border-gray-200 dark:border-gray-700"}`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Policy #{policy.policyId}</p>
            <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
              {policy.holder}
            </p>
          </div>
        </div>
        <Badge variant={policy.isActive && !expired ? "success" : "danger"}>
          {expired ? "Expired" : policy.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Coverage</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              ${Number(policy.coverageAmount).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Premium</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              ${Number(policy.premiumAmount).toLocaleString()}/mo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Expires</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {expired ? "Expired" : `${daysLeft} days`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Risk Score</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{riskPercent}%</p>
          </div>
        </div>
      </div>

      {/* Risk bar */}
      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${
              policy.riskScore > 7000
                ? "bg-red-500"
                : policy.riskScore > 4000
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${policy.riskScore / 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
