"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Vote, CheckCircle, XCircle, Zap, Loader2 } from "lucide-react";
import ProposalCard from "@/components/governance/ProposalCard";
import VotePanel from "@/components/governance/VotePanel";
import Modal from "@/components/shared/Modal";
import Button from "@/components/shared/Button";
import StatCard from "@/components/shared/StatCard";
import Badge from "@/components/shared/Badge";
import { useContract } from "@/hooks/useContract";
import type { Proposal } from "@/types";
import toast from "react-hot-toast";

export default function GovernancePage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVote, setShowVote] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [tab, setTab] = useState<"active" | "past">("active");
  const [formData, setFormData] = useState({ description: "", proposalType: "0" });
  const [creating, setCreating] = useState(false);

  const govContract = useContract("Governance");

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const count = await govContract.read<bigint>("totalProposals");
      const n = Number(count);
      const proposalPromises = Array.from({ length: n }, (_, i) =>
        govContract.read<any>("getProposal", i).catch(() => null)
      );
      const proposalResults = await Promise.all(proposalPromises);
      const items: Proposal[] = proposalResults
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => ({
          proposalId: Number(p.proposalId ?? p[0]),
          proposer: p.proposer ?? p[1],
          description: p.description ?? p[2],
          forVotes: (p.forVotes ?? p[3]).toString(),
          againstVotes: (p.againstVotes ?? p[4]).toString(),
          startTime: Number(p.startTime ?? p[5]),
          endTime: Number(p.endTime ?? p[6]),
          executed: p.executed ?? p[7],
          cancelled: p.cancelled ?? p[8],
          proposalType: Number(p.proposalType ?? p[9]),
        }));
      setProposals(items);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [govContract]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const activeProposals = proposals.filter(
    (p) => !p.executed && !p.cancelled && p.endTime * 1000 > Date.now()
  );
  const pastProposals = proposals.filter(
    (p) => p.executed || p.cancelled || p.endTime * 1000 <= Date.now()
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const target = "0x0000000000000000000000000000000000000000";
      const callData = "0x";
      await govContract.write(
        "createProposal",
        formData.description,
        parseInt(formData.proposalType),
        target,
        callData,
      );
      toast.success("Proposal created on-chain!");
      setShowCreate(false);
      setFormData({ description: "", proposalType: "0" });
      fetchProposals(); // refresh
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create proposal");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Governance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            DAO governance with token-weighted voting and configurable quorum
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New Proposal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active Proposals" value={activeProposals.length} icon={<Vote className="h-6 w-6" />} />
        <StatCard title="Total Proposals" value={proposals.length} icon={<Vote className="h-6 w-6" />} />
        <StatCard title="Executed" value={pastProposals.filter((p) => p.executed).length} icon={<Zap className="h-6 w-6" />} />
        <StatCard title="Passed" value={pastProposals.filter((p) => BigInt(p.forVotes) > BigInt(p.againstVotes)).length} icon={<CheckCircle className="h-6 w-6" />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-border dark:bg-surface">
        {(["active", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
              ${
                tab === t
                  ? "bg-white text-gray-900 shadow-sm dark:bg-surface dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
          >
            {t === "active" ? (
              <span className="flex items-center justify-center gap-2">
                Active <Badge variant="info">{activeProposals.length}</Badge>
              </span>
            ) : (
              "Past Proposals"
            )}
          </button>
        ))}
      </div>

      {/* Proposals grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(tab === "active" ? activeProposals : pastProposals).map((proposal) => (
          <ProposalCard
            key={proposal.proposalId}
            proposal={proposal}
            onVote={(id) => {
              setSelectedProposal(proposals.find((p) => p.proposalId === id) || null);
              setShowVote(true);
            }}
          />
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-500">Loading proposals from chain...</span>
        </div>
      ) : (tab === "active" ? activeProposals : pastProposals).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center dark:border-border dark:bg-surface">
          <XCircle className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            {tab === "active" ? "No active proposals" : "No past proposals"}
          </p>
        </div>
      ) : null}

      {/* Vote modal */}
      <Modal open={showVote} onClose={() => setShowVote(false)} title="Cast Your Vote">
        {selectedProposal && (
          <VotePanel
            proposalId={selectedProposal.proposalId}
            description={selectedProposal.description}
            onClose={() => setShowVote(false)}
          />
        )}
      </Modal>

      {/* Create proposal modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Proposal">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Proposal Type</label>
            <select
              value={formData.proposalType}
              onChange={(e) => setFormData({ ...formData, proposalType: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-border dark:bg-surface dark:text-white"
            >
              <option value="0">Parameter Change</option>
              <option value="1">Risk Threshold</option>
              <option value="2">Data Sharing</option>
              <option value="3">Protocol Upgrade</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Describe your proposal…"
              required
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="flex-1" type="submit" disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : "Submit Proposal"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
