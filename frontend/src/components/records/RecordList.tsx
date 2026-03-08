"use client";

import { useState } from "react";
import { Search, FileText, Eye, Brain, MoreVertical, Lock, Unlock, ExternalLink, Database } from "lucide-react";
import Badge from "@/components/shared/Badge";
import type { EHRRecord } from "@/types";

const TYPE_BADGE: Record<string, { label: string; variant: "info" | "success" | "warning" | "purple" | "danger" | "default" }> = {
  LAB: { label: "Lab", variant: "info" },
  IMAGING: { label: "Imaging", variant: "purple" },
  PRESCRIPTION: { label: "Rx", variant: "success" },
  CLINICAL_NOTE: { label: "Note", variant: "warning" },
  DISCHARGE: { label: "Discharge", variant: "danger" },
  OTHER: { label: "Other", variant: "default" },
};

interface RecordListProps {
  records?: EHRRecord[];
  onViewRecord?: (record: EHRRecord) => void;
  onSummarize?: (record: EHRRecord) => void;
}

export default function RecordList({ records = [], onViewRecord, onSummarize }: RecordListProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  const filtered = records.filter((r) => {
    const matchSearch =
      r.patient.toLowerCase().includes(search.toLowerCase()) ||
      r.recordType.toLowerCase().includes(search.toLowerCase()) ||
      String(r.recordId).includes(search);
    const matchType = filterType === "ALL" || r.recordType === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-surface">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 dark:border-border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Patient Records</h3>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search records…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary focus:outline-none dark:border-border dark:bg-surface dark:text-gray-200"
            >
              <option value="ALL">All Types</option>
              <option value="LAB">Lab</option>
              <option value="IMAGING">Imaging</option>
              <option value="PRESCRIPTION">Prescription</option>
              <option value="CLINICAL_NOTE">Clinical Note</option>
              <option value="DISCHARGE">Discharge</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500 dark:border-border dark:bg-surface/50 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">IPFS CID</th>
              <th className="px-4 py-3">AI Summary</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((record) => {
              const typeInfo = TYPE_BADGE[record.recordType] || TYPE_BADGE.OTHER;
              return (
                <tr key={record.recordId} className="transition-colors hover:bg-gray-50 dark:hover:bg-surface">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-white">
                    #{record.recordId}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {record.patient}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="font-mono text-xs text-gray-600 dark:text-gray-400" title={record.ipfsCidHash}>
                        {record.ipfsCidHash.length > 16
                          ? `${record.ipfsCidHash.slice(0, 8)}…${record.ipfsCidHash.slice(-6)}`
                          : record.ipfsCidHash}
                      </span>
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${record.ipfsCidHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-0.5 text-accent hover:text-primary"
                        title="View on IPFS Gateway"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {record.aiSummaryHash ? (
                      <Badge variant="success">Available</Badge>
                    ) : (
                      <Badge variant="default">Pending</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(record.createdAt * 1000).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {record.isActive ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Unlock className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <Lock className="h-3 w-3" /> Archived
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onViewRecord?.(record)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-700 dark:hover:text-primary-light"
                        title="View record"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onSummarize?.(record)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-purple-600 dark:hover:bg-gray-700 dark:hover:text-purple-400"
                        title="AI Summarize"
                      >
                        <Brain className="h-4 w-4" />
                      </button>
                      <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            No records found
          </div>
        )}
      </div>
    </div>
  );
}
