"use client";

import { Clock, CheckCircle, XCircle, Banknote } from "lucide-react";
import Badge from "@/components/shared/Badge";
import type { InsuranceClaim, ClaimStatus as ClaimStatusEnum } from "@/types";

const STATUS_CONFIG: Record<
  ClaimStatusEnum,
  { label: string; variant: "warning" | "info" | "danger" | "success"; icon: React.ReactNode }
> = {
  0: { label: "Pending", variant: "warning", icon: <Clock className="h-4 w-4" /> },
  1: { label: "Approved", variant: "info", icon: <CheckCircle className="h-4 w-4" /> },
  2: { label: "Rejected", variant: "danger", icon: <XCircle className="h-4 w-4" /> },
  3: { label: "Paid", variant: "success", icon: <Banknote className="h-4 w-4" /> },
};

interface ClaimStatusProps {
  claims?: InsuranceClaim[];
}

export default function ClaimStatus({ claims = [] }: ClaimStatusProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-surface">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-border">
        <h3 className="font-semibold text-gray-900 dark:text-white">Claims Status</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-border dark:bg-surface/50 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Claim</th>
              <th className="px-4 py-3">Policy</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {claims.map((claim) => {
              const cfg = STATUS_CONFIG[claim.status];
              return (
                <tr key={claim.claimId} className="transition-colors hover:bg-gray-50 dark:hover:bg-surface">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-white">
                    #{claim.claimId}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-400">
                    Policy #{claim.policyId}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-white">
                    ${Number(claim.amount).toLocaleString()}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-gray-500 dark:text-gray-400">
                    {claim.description}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(claim.timestamp * 1000).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={cfg.variant}>
                      <span className="flex items-center gap-1">
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
