"use client";

import { useState } from "react";
import Button from "@/components/shared/Button";
import toast from "react-hot-toast";

interface ClaimFormProps {
  policyIds?: number[];
  onSubmit?: (data: { policyId: number; amount: string; description: string }) => Promise<void>;
}

export default function ClaimForm({ policyIds = [1, 2, 3, 5, 8], onSubmit }: ClaimFormProps) {
  const [policyId, setPolicyId] = useState(policyIds[0] || 1);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return toast.error("Please fill all fields");

    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit({ policyId, amount, description });
      } else {
        await new Promise((r) => setTimeout(r, 2000));
      }
      toast.success(`Claim submitted for Policy #${policyId}`);
      setAmount("");
      setDescription("");
    } catch {
      toast.error("Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Submit New Claim</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Policy
          </label>
          <select
            value={policyId}
            onChange={(e) => setPolicyId(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {policyIds.map((id) => (
              <option key={id} value={id}>
                Policy #{id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Claim Amount (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-7 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the medical service or procedure…"
            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <Button type="submit" loading={submitting} className="w-full">
          Submit Claim On-Chain
        </Button>
      </form>
    </div>
  );
}
