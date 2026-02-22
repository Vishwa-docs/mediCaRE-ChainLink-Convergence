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
  0: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  1: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  2: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  3: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  4: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

const MOCK_EVENTS: BatchEvent[] = [
  { timestamp: Date.now() / 1000 - 600, status: 1, location: "Distribution Center — Chicago, IL", notes: "Loaded onto refrigerated truck. Temperature: 4°C, Humidity: 45%" },
  { timestamp: Date.now() / 1000 - 43200, status: 1, location: "Regional Warehouse — Indianapolis, IN", notes: "Quality check passed. All IoT sensors nominal." },
  { timestamp: Date.now() / 1000 - 172800, status: 1, location: "Manufacturing Facility — Detroit, MI", notes: "Shipped via cold-chain logistics partner" },
  { timestamp: Date.now() / 1000 - 259200, status: 0, location: "Manufacturing Facility — Detroit, MI", notes: "Batch created. 10,000 units of Amoxicillin 500mg produced and packaged." },
];

interface BatchTimelineProps {
  batchId?: number;
  drugName?: string;
  events?: BatchEvent[];
}

export default function BatchTimeline({
  batchId = 78,
  drugName = "Amoxicillin 500mg",
  events = MOCK_EVENTS,
}: BatchTimelineProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Batch #{batchId} Timeline
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{drugName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Thermometer className="h-4 w-4 text-blue-500" /> 4°C
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Droplets className="h-4 w-4 text-cyan-500" /> 45%
          </div>
          <Badge variant="info">IoT Monitored</Badge>
        </div>
      </div>

      <div className="relative pl-8">
        {/* Timeline line */}
        <div className="absolute left-3.5 top-2 h-[calc(100%-1rem)] w-0.5 bg-gray-200 dark:bg-gray-700" />

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
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {STATUS_LABEL[event.status]}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(event.timestamp * 1000).toLocaleString()}
                </span>
              </div>
              <p className="mb-1 text-sm text-blue-600 dark:text-blue-400">{event.location}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{event.notes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
