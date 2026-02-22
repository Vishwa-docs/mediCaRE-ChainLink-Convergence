"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import Button from "@/components/shared/Button";
import toast from "react-hot-toast";

interface VotePanelProps {
  proposalId: number;
  description: string;
  onVote?: (proposalId: number, support: boolean) => Promise<void>;
  onClose?: () => void;
}

export default function VotePanel({ proposalId, description, onVote, onClose }: VotePanelProps) {
  const [support, setSupport] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (support === null) return toast.error("Please select For or Against");

    setSubmitting(true);
    try {
      if (onVote) {
        await onVote(proposalId, support);
      } else {
        await new Promise((r) => setTimeout(r, 2000));
      }
      toast.success(`Vote ${support ? "For" : "Against"} submitted for Proposal #${proposalId}`);
      onClose?.();
    } catch {
      toast.error("Vote failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Proposal #{proposalId}</p>
        <p className="mt-1 text-sm text-gray-900 dark:text-white">{description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setSupport(true)}
          className={`flex flex-col items-center gap-2 rounded-xl border-2 p-6 transition-colors
            ${
              support === true
                ? "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/20"
                : "border-gray-200 hover:border-emerald-300 dark:border-gray-600 dark:hover:border-emerald-600"
            }`}
        >
          <ThumbsUp
            className={`h-8 w-8 ${
              support === true
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-400"
            }`}
          />
          <span
            className={`text-sm font-medium ${
              support === true
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Vote For
          </span>
        </button>

        <button
          onClick={() => setSupport(false)}
          className={`flex flex-col items-center gap-2 rounded-xl border-2 p-6 transition-colors
            ${
              support === false
                ? "border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-900/20"
                : "border-gray-200 hover:border-red-300 dark:border-gray-600 dark:hover:border-red-600"
            }`}
        >
          <ThumbsDown
            className={`h-8 w-8 ${
              support === false
                ? "text-red-600 dark:text-red-400"
                : "text-gray-400"
            }`}
          />
          <span
            className={`text-sm font-medium ${
              support === false
                ? "text-red-700 dark:text-red-300"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Vote Against
          </span>
        </button>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" loading={submitting} onClick={handleSubmit} disabled={support === null}>
          Confirm Vote
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        Your vote weight is determined by your governance token balance at the time of voting.
      </p>
    </div>
  );
}
