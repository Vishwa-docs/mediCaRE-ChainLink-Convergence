"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Truck, Package, CheckCircle, AlertTriangle, Loader2, XCircle } from "lucide-react";
import BatchTracker from "@/components/supply/BatchTracker";
import BatchTimeline from "@/components/supply/BatchTimeline";
import Modal from "@/components/shared/Modal";
import Button from "@/components/shared/Button";
import StatCard from "@/components/shared/StatCard";
import { useContract } from "@/hooks/useContract";
import { ethers } from "ethers";
import type { SupplyBatch } from "@/types";
import toast from "react-hot-toast";

// Known keccak256 hashes from seeded demo data → readable names
const KNOWN_HASHES: Record<string, string> = {
  "0x78035f650329de00b6a6af69e3aed0036ecb4e1885f5275d515c91d5250ed297": "LOT-AMOX-2026-001",
  "0x8c8de3e10174c946a6cf750f21aea200da38a9cf0c7e2223daa20f350a8117cc": "Amoxicillin 500mg Capsules",
  "0x3c9353508a5ad635f588f181b2cd6b9e04422600a42fa73357673bf54e9af70e": "LOT-METF-2026-042",
  "0x8d58a062efbc6183c75add2af3333e3ac2b49c3d9ffb5f06f5d9ba1dc036d935": "Metformin 850mg Tablets",
  "0x2c61bec0805d324d50a967921fae9e1ad0bf89084f05f0dbd1f7c663112b3267": "LOT-INSL-2026-007",
  "0xb654d5eee63d420c9e0f32eb591bf70fe42dea8c5cbb0146942cc8281c24138c": "Insulin Glargine 100U/mL",
  "0x714071dd61893f967e3ec2761ec9dd73add5612e3e389391b55c43ea6db30772": "LOT-OMEP-2026-019",
  "0xedc2033fb488687885cd913573dabaa7409ab3e60ad2c167758e8eaf7d0eef34": "Omeprazole 20mg Delayed-Release",
};

/** Safely decode a bytes32 value — tries decodeBytes32String first, then known hash lookup, then truncated hex */
function safeDecodeBytes32(value: string): string {
  try {
    const decoded = ethers.decodeBytes32String(value);
    if (decoded) return decoded;
  } catch {
    // Not an encoded string — check known hashes
  }
  if (KNOWN_HASHES[value]) return KNOWN_HASHES[value];
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export default function SupplyChainPage() {
  const [batches, setBatches] = useState<SupplyBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<SupplyBatch | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ drugName: "", lotNumber: "", quantity: "", expiryDate: "" });
  const [creating, setCreating] = useState(false);
  const [showFlag, setShowFlag] = useState(false);
  const [showRecall, setShowRecall] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [recallReason, setRecallReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const supplyContract = useContract("SupplyChain");

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const count = await supplyContract.read<bigint>("totalBatches");
      const n = Number(count);
      const batchPromises = Array.from({ length: n }, (_, i) =>
        supplyContract.read<any>("getBatch", i).catch(() => null)
      );
      const batchResults = await Promise.all(batchPromises);
      const items: SupplyBatch[] = batchResults
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map((b) => ({
          batchId: Number(b.batchId ?? b[0]),
          manufacturer: b.manufacturer ?? b[1],
          lotNumber: safeDecodeBytes32(b.lotNumber ?? b[2]),
          manufactureDate: Number(b.manufactureDate ?? b[3]),
          expiryDate: Number(b.expiryDate ?? b[4]),
          quantity: Number(b.quantity ?? b[5]),
          status: Number(b.status ?? b[6]),
          drugName: safeDecodeBytes32(b.drugNameHash ?? b[7]),
        }));
      setBatches(items);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [supplyContract]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const inTransit = batches.filter((b) => b.status === 1).length;
  const delivered = batches.filter((b) => b.status === 2).length;
  const flaggedOrRecalled = batches.filter((b) => b.status === 3 || b.status === 4).length;

  const handleFlag = async () => {
    if (!selectedBatch || !flagReason.trim()) return;
    setActionLoading(true);
    try {
      await supplyContract.write("flagBatch", selectedBatch.batchId, flagReason);
      toast.success("Batch flagged successfully!");
      setShowFlag(false);
      setFlagReason("");
      fetchBatches();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to flag batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecall = async () => {
    if (!selectedBatch || !recallReason.trim()) return;
    setActionLoading(true);
    try {
      await supplyContract.write("recallBatch", selectedBatch.batchId, recallReason);
      toast.success("Batch recalled successfully!");
      setShowRecall(false);
      setRecallReason("");
      fetchBatches();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to recall batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedBatch) return;
    setActionLoading(true);
    try {
      await supplyContract.write("verifyBatch", selectedBatch.batchId);
      toast.success("Batch verified successfully!");
      fetchBatches();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to verify batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const lotHash = ethers.encodeBytes32String(formData.lotNumber.slice(0, 31));
      const drugHash = ethers.encodeBytes32String(formData.drugName.slice(0, 31));
      const expiryTimestamp = Math.floor(new Date(formData.expiryDate).getTime() / 1000);
      const manufactureTimestamp = Math.floor(Date.now() / 1000);
      await supplyContract.write(
        "createBatch",
        lotHash,
        manufactureTimestamp,
        expiryTimestamp,
        parseInt(formData.quantity),
        drugHash,
      );
      toast.success("Batch created on-chain!");
      setShowCreate(false);
      setFormData({ drugName: "", lotNumber: "", quantity: "", expiryDate: "" });
      fetchBatches();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Supply Chain</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track pharmaceutical batches with ERC-1155 tokens and IoT monitoring
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedBatch && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFlag(true)}
                disabled={actionLoading}
                className="border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/50 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
              >
                <AlertTriangle className="h-4 w-4" /> Flag Batch
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRecall(true)}
                disabled={actionLoading}
                className="border-red-400 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
              >
                <XCircle className="h-4 w-4" /> Recall Batch
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerify}
                disabled={actionLoading}
                className="border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
              >
                <CheckCircle className="h-4 w-4" /> Verify Batch
              </Button>
            </>
          )}
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Create Batch
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Batches" value={batches.length} icon={<Package className="h-6 w-6" />} />
        <StatCard title="In Transit" value={inTransit} icon={<Truck className="h-6 w-6" />} />
        <StatCard title="Delivered" value={delivered} icon={<CheckCircle className="h-6 w-6" />} />
        <StatCard title="Flagged/Recalled" value={flaggedOrRecalled} icon={<AlertTriangle className="h-6 w-6" />} />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-500">Loading batches from chain...</span>
        </div>
      ) : (
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="xl:col-span-1">
          <BatchTracker batches={batches} onSelectBatch={(batch) => setSelectedBatch(batch)} />
        </div>
        <div className="xl:col-span-1">
          <BatchTimeline
            batchId={selectedBatch?.batchId}
            drugName={selectedBatch?.drugName}
          />
        </div>
      </div>
      )}

      {/* Create batch modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Batch">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Drug Name</label>
            <input
              type="text"
              value={formData.drugName}
              onChange={(e) => setFormData({ ...formData, drugName: e.target.value })}
              placeholder="e.g. Amoxicillin 500mg"
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Lot Number</label>
            <input
              type="text"
              value={formData.lotNumber}
              onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
              placeholder="e.g. LOT-2026-003"
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="10000"
                min="1"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button className="flex-1" type="submit" disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : "Create On-Chain"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Flag batch modal */}
      <Modal open={showFlag} onClose={() => { setShowFlag(false); setFlagReason(""); }} title="Flag Batch">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Flag batch <span className="font-semibold text-gray-900 dark:text-white">#{selectedBatch?.batchId}</span> ({selectedBatch?.drugName}) as suspicious.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Describe the reason for flagging this batch..."
              rows={3}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setShowFlag(false); setFlagReason(""); }}>
              Cancel
            </Button>
            <Button
              className="flex-1 border-amber-400 bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700"
              onClick={handleFlag}
              disabled={actionLoading || !flagReason.trim()}
            >
              {actionLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Flagging...</> : <><AlertTriangle className="h-4 w-4" /> Confirm Flag</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Recall batch modal */}
      <Modal open={showRecall} onClose={() => { setShowRecall(false); setRecallReason(""); }} title="Recall Batch">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Recall batch <span className="font-semibold text-gray-900 dark:text-white">#{selectedBatch?.batchId}</span> ({selectedBatch?.drugName}). This action is critical.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
            <textarea
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              placeholder="Describe the reason for recalling this batch..."
              rows={3}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setShowRecall(false); setRecallReason(""); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleRecall}
              disabled={actionLoading || !recallReason.trim()}
            >
              {actionLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Recalling...</> : <><XCircle className="h-4 w-4" /> Confirm Recall</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
