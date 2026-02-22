"use client";

import { Clock, CheckCircle, XCircle, Zap, Ban } from "lucide-react";
import Badge from "@/components/shared/Badge";
import { ProposalTypeLabels } from "@/types";
import type { Proposal, ProposalStatus } from "@/types";

const STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; variant: "info" | "success" | "danger" | "purple" | "default"; icon: React.ReactNode }
> = {
  0: { label: "Active", variant: "info", icon: <Clock className="h-3.5 w-3.5" /> },
  1: { label: "Succeeded", variant: "success", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  2: { label: "Defeated", variant: "danger", icon: <XCircle className="h-3.5 w-3.5" /> },
  3: { label: "Executed", variant: "purple", icon: <Zap className="h-3.5 w-3.5" /> },
  4: { label: "Cancelled", variant: "default", icon: <Ban className="h-3.5 w-3.5" /> },
};

interface ProposalCardProps {
  proposal: Proposal;
  onVote?: (proposalId: number) => void;
}

function getStatus(p: Proposal): ProposalStatus {
  if (p.cancelled) return 4;
  if (p.executed) return 3;
  if (p.endTime * 1000 < Date.now()) {
    const totalFor = BigInt(p.forVotes);
    const totalAgainst = BigInt(p.againstVotes);
    return totalFor > totalAgainst ? 1 : 2;
  }
  return 0;
}

export default function ProposalCard({ proposal, onVote }: ProposalCardProps) {
  const status = getStatus(proposal);
  const cfg = STATUS_CONFIG[status];
  const forVotes = Number(proposal.forVotes);
  const againstVotes = Number(proposal.againstVotes);
  const totalVotes = forVotes + againstVotes;
  const forPercent = totalVotes > 0 ? (forVotes / totalVotes) * 100 : 50;
  const timeLeft = Math.max(0, proposal.endTime * 1000 - Date.now());
  const hoursLeft = Math.floor(timeLeft / 3_600_000);
  const daysLeft = Math.floor(hoursLeft / 24);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={cfg.variant}>
            <span className="flex items-center gap-1">
              {cfg.icon}
              {cfg.label}
            </span>
          </Badge>
          <Badge variant="default">{ProposalTypeLabels[proposal.proposalType]}</Badge>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">#{proposal.proposalId}</span>
      </div>

      <p className="mb-4 text-sm text-gray-900 dark:text-white">{proposal.description}</p>

      {/* Vote bar */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-emerald-600 dark:text-emerald-400">
            For: {forVotes.toLocaleString()}
          </span>
          <span className="text-red-600 dark:text-red-400">
            Against: {againstVotes.toLocaleString()}
          </span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="bg-emerald-500 transition-all" style={{ width: `${forPercent}%` }} />
          <div className="bg-red-500 transition-all" style={{ width: `${100 - forPercent}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {status === 0 ? (
            daysLeft > 0 ? (
              <span>{daysLeft}d {hoursLeft % 24}h remaining</span>
            ) : (
              <span>{hoursLeft}h remaining</span>
            )
          ) : (
            <span>Ended {new Date(proposal.endTime * 1000).toLocaleDateString()}</span>
          )}
        </div>
        {status === 0 && onVote && (
          <button
            onClick={() => onVote(proposal.proposalId)}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Vote
          </button>
        )}
      </div>

      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
        <p className="font-mono text-xs text-gray-400 dark:text-gray-500">
          Proposer: {proposal.proposer}
        </p>
      </div>
    </div>
  );
}
