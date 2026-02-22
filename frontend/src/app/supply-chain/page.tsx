"use client";

import { useState } from "react";
import { Plus, Truck, Package, CheckCircle, AlertTriangle } from "lucide-react";
import BatchTracker from "@/components/supply/BatchTracker";
import BatchTimeline from "@/components/supply/BatchTimeline";
import Modal from "@/components/shared/Modal";
import Button from "@/components/shared/Button";
import StatCard from "@/components/shared/StatCard";
import type { SupplyBatch } from "@/types";
import toast from "react-hot-toast";

export default function SupplyChainPage() {
  const [selectedBatch, setSelectedBatch] = useState<SupplyBatch | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ drugName: "", lotNumber: "", quantity: "", expiryDate: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulated
    await new Promise((r) => setTimeout(r, 1500));
    toast.success("Batch created on-chain (ERC-1155)");
    setShowCreate(false);
    setFormData({ drugName: "", lotNumber: "", quantity: "", expiryDate: "" });
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
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Create Batch
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Batches" value="89" icon={<Package className="h-6 w-6" />} trend={{ value: 3.1, positive: true }} />
        <StatCard title="In Transit" value="23" icon={<Truck className="h-6 w-6" />} />
        <StatCard title="Delivered" value="58" icon={<CheckCircle className="h-6 w-6" />} />
        <StatCard title="Flagged/Recalled" value="8" icon={<AlertTriangle className="h-6 w-6" />} trend={{ value: 1.2, positive: false }} />
      </div>

      {/* Content */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="xl:col-span-1">
          <BatchTracker onSelectBatch={(batch) => setSelectedBatch(batch)} />
        </div>
        <div className="xl:col-span-1">
          <BatchTimeline
            batchId={selectedBatch?.batchId}
            drugName={selectedBatch?.drugName}
          />
        </div>
      </div>

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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button className="flex-1" type="submit">
              Create On-Chain
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
