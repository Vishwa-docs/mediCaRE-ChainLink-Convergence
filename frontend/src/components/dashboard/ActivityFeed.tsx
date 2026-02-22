"use client";

import { FileText, Shield, Truck, BadgeCheck, Vote, ArrowUpRight } from "lucide-react";
import type { ActivityItem } from "@/types";

const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: "1",
    type: "record",
    title: "New EHR Record Uploaded",
    description: "Lab results for patient 0x7a3f…c2d1 added to IPFS",
    timestamp: Date.now() - 300_000,
    txHash: "0xabc123…",
  },
  {
    id: "2",
    type: "claim",
    title: "Insurance Claim Submitted",
    description: "Claim #42 for policy #15 — $2,500 diagnostic imaging",
    timestamp: Date.now() - 900_000,
    txHash: "0xdef456…",
  },
  {
    id: "3",
    type: "batch",
    title: "Batch Status Updated",
    description: "Batch #78 (Amoxicillin 500mg) marked as InTransit",
    timestamp: Date.now() - 1_800_000,
    txHash: "0xghi789…",
  },
  {
    id: "4",
    type: "credential",
    title: "Credential Verified",
    description: "Dr. Smith's board certification validated on-chain",
    timestamp: Date.now() - 3_600_000,
    txHash: "0xjkl012…",
  },
  {
    id: "5",
    type: "vote",
    title: "New Governance Vote",
    description: "Proposal #12: Update risk threshold to 7500 bps",
    timestamp: Date.now() - 7_200_000,
    txHash: "0xmno345…",
  },
  {
    id: "6",
    type: "proposal",
    title: "Proposal Created",
    description: "Protocol Upgrade: Enable cross-chain claims via CCIP",
    timestamp: Date.now() - 14_400_000,
    txHash: "0xpqr678…",
  },
  {
    id: "7",
    type: "record",
    title: "AI Summary Generated",
    description: "Chainlink Functions summarized record #1203 via GPT-4",
    timestamp: Date.now() - 28_800_000,
    txHash: "0xstu901…",
  },
];

const ICON_MAP: Record<ActivityItem["type"], React.ReactNode> = {
  record: <FileText className="h-4 w-4" />,
  claim: <Shield className="h-4 w-4" />,
  batch: <Truck className="h-4 w-4" />,
  credential: <BadgeCheck className="h-4 w-4" />,
  proposal: <Vote className="h-4 w-4" />,
  vote: <Vote className="h-4 w-4" />,
};

const COLOR_MAP: Record<ActivityItem["type"], string> = {
  record: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  claim: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  batch: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  credential: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  proposal: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  vote: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
}

export default function ActivityFeed({ activities = MOCK_ACTIVITIES }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">Live on-chain events</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {activities.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-750">
            <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${COLOR_MAP[item.type]}`}>
              {ICON_MAP[item.type]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {item.title}
                </p>
                <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                  {timeAgo(item.timestamp)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                {item.description}
              </p>
              {item.txHash && (
                <p className="mt-1 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                  {item.txHash} <ArrowUpRight className="h-3 w-3" />
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
