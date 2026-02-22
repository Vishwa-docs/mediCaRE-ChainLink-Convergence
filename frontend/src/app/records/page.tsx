"use client";

import { useState } from "react";
import RecordUploader from "@/components/records/RecordUploader";
import RecordList from "@/components/records/RecordList";
import SummaryViewer from "@/components/records/SummaryViewer";
import Modal from "@/components/shared/Modal";
import type { EHRRecord } from "@/types";

export default function RecordsPage() {
  const [showSummary, setShowSummary] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<EHRRecord | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Health Records</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage patient electronic health records stored on IPFS with on-chain access control
        </p>
      </div>

      {/* Upload + Access management grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <RecordUploader />

          {/* Access management */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Access Control
            </h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Grant or revoke provider access to your health records.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Dr. Johnson</p>
                  <p className="font-mono text-xs text-gray-500 dark:text-gray-400">0x4a2b…f3c8</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  Granted
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">City Hospital Lab</p>
                  <p className="font-mono text-xs text-gray-500 dark:text-gray-400">0x8d5e…a7b2</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  Granted
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Dr. Patel</p>
                  <p className="font-mono text-xs text-gray-500 dark:text-gray-400">0x1c9f…d4e6</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  Revoked
                </span>
              </div>
            </div>
            <div className="mt-4">
              <input
                type="text"
                placeholder="Enter provider address to grant access…"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <button className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Grant Access
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <RecordList
            onViewRecord={(record) => {
              setSelectedRecord(record);
            }}
            onSummarize={(record) => {
              setSelectedRecord(record);
              setShowSummary(true);
            }}
          />
        </div>
      </div>

      {/* AI Summary modal */}
      <Modal
        open={showSummary}
        onClose={() => setShowSummary(false)}
        title="AI Clinical Summary"
        size="lg"
      >
        <SummaryViewer
          recordId={selectedRecord?.recordId}
          onGenerate={() => {}}
        />
      </Modal>
    </div>
  );
}
