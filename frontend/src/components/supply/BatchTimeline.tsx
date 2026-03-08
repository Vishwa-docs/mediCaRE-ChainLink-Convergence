"use client";

import { Package, Truck, CheckCircle, AlertTriangle, RotateCcw, Thermometer, Droplets } from "lucide-react";
import Badge from "@/components/shared/Badge";
import type { BatchEvent, BatchStatus } from "@/types";

const STATUS_ICON: Record<BatchStatus, React.ReactNode> = {
  0: <Package className="h-5 w-5" />,
  1: <Truck className="h-5 w-5" />,
  2: <CheckCircle className="h-5 w-5" />,
  3: <AlertTriangle className="h-5 w-5" />,
  4: <RotateCcw className="h-5 w-5" />,
};

const STATUS_LABEL: Record<BatchStatus, string> = {
  0: "Created",
  1: "In Transit",
  2: "Delivered",
  3: "Flagged",
  4: "Recalled",
};

const STATUS_COLOR: Record<BatchStatus, string> = {
  0: "bg-gray-100 text-gray-600 dark:bg-surface dark:text-gray-300",
  1: "bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary-light",
  2: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  3: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  4: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

interface BatchTimelineProps {
  batchId?: number;
  drugName?: string;
  events?: BatchEvent[];
}

export default function BatchTimeline({
  batchId,
  drugName,
  events = [],
}: BatchTimelineProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Batch #{batchId} Timeline
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{drugName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Thermometer className="h-4 w-4 text-primary" /> 4°C
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Droplets className="h-4 w-4 text-cyan-500" /> 45%
          </div>
          <Badge variant="info">IoT Monitored</Badge>
        </div>
      </div>

      <div className="relative pl-8">
        {/* Timeline line */}
        <div className="absolute left-3.5 top-2 h-[calc(100%-1rem)] w-0.5 bg-gray-200 dark:bg-surface" />

        {events.map((event, idx) => (
          <div key={idx} className="relative mb-8 last:mb-0">
            {/* Timeline dot */}
            <div
              className={`absolute -left-8 flex h-7 w-7 items-center justify-center rounded-full ${
                STATUS_COLOR[event.status]
              }`}
            >
              {STATUS_ICON[event.status]}
            </div>

            {/* Content */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-surface/50">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {STATUS_LABEL[event.status]}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(event.timestamp * 1000).toLocaleString()}
                </span>
              </div>
              <p className="mb-1 text-sm text-primary dark:text-primary-light">{event.location}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{event.notes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
