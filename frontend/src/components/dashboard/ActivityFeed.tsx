"use client";

import { FileText, Shield, Truck, BadgeCheck, Vote, ArrowUpRight, Inbox } from "lucide-react";
import type { ActivityItem } from "@/types";

const ICON_MAP: Record<ActivityItem["type"], React.ReactNode> = {
  record: <FileText className="h-4 w-4" />,
  claim: <Shield className="h-4 w-4" />,
  batch: <Truck className="h-4 w-4" />,
  credential: <BadgeCheck className="h-4 w-4" />,
  proposal: <Vote className="h-4 w-4" />,
  vote: <Vote className="h-4 w-4" />,
};

const COLOR_MAP: Record<ActivityItem["type"], string> = {
  record: "bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary-light",
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

export default function ActivityFeed({ activities = [] }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-surface">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-border">
        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">Live on-chain events</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No recent activity yet</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Activity will appear here as you interact with contracts</p>
          </div>
        ) : (
        activities.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-surface">
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
                <p className="mt-1 flex items-center gap-1 text-xs text-primary dark:text-primary-light">
                  {item.txHash} <ArrowUpRight className="h-3 w-3" />
                </p>
              )}
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  );
}
