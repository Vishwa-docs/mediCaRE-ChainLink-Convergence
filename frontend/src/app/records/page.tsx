"use client";

import { useState, useEffect } from "react";
import RecordUploader from "@/components/records/RecordUploader";
import RecordList from "@/components/records/RecordList";
import SummaryViewer from "@/components/records/SummaryViewer";
import Modal from "@/components/shared/Modal";
import { useEHR } from "@/hooks/useApi";
import { useWalletAddress, useContract } from "@/hooks/useContract";
import type { EHRRecord } from "@/types";

export default function RecordsPage() {
  const [showSummary, setShowSummary] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<EHRRecord | null>(null);
  const [providerAddr, setProviderAddr] = useState("");
  const [grantMsg, setGrantMsg] = useState("");

  const { records, loading, error, fetchRecords } = useEHR();
  const { address, connect } = useWalletAddress();
  const ehrContract = useContract("EHRStorage");

  // On mount, connect wallet and fetch records
  useEffect(() => {
    const init = async () => {
      const addr = await connect();
      if (addr) {
        fetchRecords(addr);
      }
    };
    init();
  }, [connect, fetchRecords]);

  const handleGrantAccess = async () => {
    if (!providerAddr) return;
    try {
      await ehrContract.write("grantAccess", providerAddr);
      setGrantMsg("Access granted successfully!");
      setProviderAddr("");
    } catch (err: unknown) {
      setGrantMsg(err instanceof Error ? err.message : "Failed to grant access");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Health Records</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage patient electronic health records stored on IPFS with on-chain access control
          </p>
          {address && (
            <p className="mt-1 font-mono text-xs text-gray-400">
              Connected: {address.slice(0, 6)}…{address.slice(-4)}
            </p>
          )}
        </div>
        {/* IPFS + Blockchain status pills */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" /> IPFS via Pinata
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> On-Chain (Sepolia)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> AES-256 GCM Encrypted
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          {error} — showing cached data if available
        </div>
      )}

      {/* Upload + Access management grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <RecordUploader />

          {/* Access management */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Access Control
            </h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Grant or revoke provider access to your health records via on-chain transactions.
            </p>
            {grantMsg && (
              <p className={`mb-3 rounded-lg p-2 text-xs ${grantMsg.includes("success") ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                {grantMsg}
              </p>
            )}
            <div className="mt-4">
              <input
                type="text"
                value={providerAddr}
                onChange={(e) => setProviderAddr(e.target.value)}
                placeholder="Enter provider address (0x…)"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
              />
              <button
                onClick={handleGrantAccess}
                disabled={!providerAddr}
                className="mt-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary disabled:opacity-50"
              >
                Grant Access
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <RecordList
            records={records.length > 0 ? records : undefined}
            onViewRecord={(record) => {
              setSelectedRecord(record);
            }}
            onSummarize={(record) => {
              setSelectedRecord(record);
              setShowSummary(true);
            }}
          />
          {loading && (
            <p className="mt-4 text-center text-sm text-gray-400">Loading records from blockchain...</p>
          )}
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
