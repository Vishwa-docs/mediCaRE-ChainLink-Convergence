"use client";

import { useState } from "react";
import { Search, Truck, Package, AlertTriangle, CheckCircle, RotateCcw, MapPin } from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import type { SupplyBatch, BatchStatus as BatchStatusEnum } from "@/types";

const STATUS_CONFIG: Record<
  BatchStatusEnum,
  { label: string; variant: "default" | "info" | "success" | "warning" | "danger"; icon: React.ReactNode }
> = {
  0: { label: "Created", variant: "default", icon: <Package className="h-4 w-4" /> },
  1: { label: "In Transit", variant: "info", icon: <Truck className="h-4 w-4" /> },
  2: { label: "Delivered", variant: "success", icon: <CheckCircle className="h-4 w-4" /> },
  3: { label: "Flagged", variant: "warning", icon: <AlertTriangle className="h-4 w-4" /> },
  4: { label: "Recalled", variant: "danger", icon: <RotateCcw className="h-4 w-4" /> },
};

const MOCK_BATCHES: SupplyBatch[] = [
  { batchId: 78, manufacturer: "0xPharma…1a2b", lotNumber: "LOT-2026-001", manufactureDate: Date.now() / 1000 - 604800, expiryDate: Date.now() / 1000 + 31536000, quantity: 10000, status: 1, drugName: "Amoxicillin 500mg" },
  { batchId: 77, manufacturer: "0xMedCo…3c4d", lotNumber: "LOT-2026-002", manufactureDate: Date.now() / 1000 - 1209600, expiryDate: Date.now() / 1000 + 15768000, quantity: 5000, status: 2, drugName: "Lisinopril 10mg" },
  { batchId: 76, manufacturer: "0xPharma…1a2b", lotNumber: "LOT-2025-089", manufactureDate: Date.now() / 1000 - 2592000, expiryDate: Date.now() / 1000 + 23652000, quantity: 20000, status: 0, drugName: "Atorvastatin 40mg" },
  { batchId: 75, manufacturer: "0xBioGen…5e6f", lotNumber: "LOT-2025-088", manufactureDate: Date.now() / 1000 - 5184000, expiryDate: Date.now() / 1000 + 7884000, quantity: 2500, status: 3, drugName: "Insulin Glargine 100U/mL" },
  { batchId: 74, manufacturer: "0xMedCo…3c4d", lotNumber: "LOT-2025-087", manufactureDate: Date.now() / 1000 - 7776000, expiryDate: Date.now() / 1000 + 7884000, quantity: 15000, status: 4, drugName: "Metformin 1000mg" },
  { batchId: 73, manufacturer: "0xPharma…1a2b", lotNumber: "LOT-2025-086", manufactureDate: Date.now() / 1000 - 10368000, expiryDate: Date.now() / 1000 + 15768000, quantity: 8000, status: 2, drugName: "Omeprazole 20mg" },
];

interface BatchTrackerProps {
  batches?: SupplyBatch[];
  onSelectBatch?: (batch: SupplyBatch) => void;
}

export default function BatchTracker({ batches = MOCK_BATCHES, onSelectBatch }: BatchTrackerProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<number>(-1);
  const [verifyId, setVerifyId] = useState("");

  const filtered = batches.filter((b) => {
    const matchSearch =
      b.drugName.toLowerCase().includes(search.toLowerCase()) ||
      b.lotNumber.toLowerCase().includes(search.toLowerCase()) ||
      String(b.batchId).includes(search);
    const matchStatus = statusFilter === -1 || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* Verification bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Enter Batch ID to verify…"
              value={verifyId}
              onChange={(e) => setVerifyId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <Button variant="secondary">Verify Authenticity</Button>
        </div>
      </div>

      {/* Batch list */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Pharmaceutical Batches</h3>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search batches…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              >
                <option value={-1}>All Status</option>
                <option value={0}>Created</option>
                <option value={1}>In Transit</option>
                <option value={2}>Delivered</option>
                <option value={3}>Flagged</option>
                <option value={4}>Recalled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Drug</th>
                <th className="px-4 py-3">Lot #</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Manufacturer</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((batch) => {
                const cfg = STATUS_CONFIG[batch.status];
                return (
                  <tr
                    key={batch.batchId}
                    onClick={() => onSelectBatch?.(batch)}
                    className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-750"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-white">
                      #{batch.batchId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                      {batch.drugName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {batch.lotNumber}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                      {batch.quantity.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {batch.manufacturer}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(batch.expiryDate * 1000).toLocaleDateString()}
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
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No batches found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
