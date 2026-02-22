"use client";

import { useState } from "react";
import { Plus, Vote, CheckCircle, XCircle, Zap } from "lucide-react";
import ProposalCard from "@/components/governance/ProposalCard";
import VotePanel from "@/components/governance/VotePanel";
import Modal from "@/components/shared/Modal";
import Button from "@/components/shared/Button";
import StatCard from "@/components/shared/StatCard";
import Badge from "@/components/shared/Badge";
import type { Proposal } from "@/types";
import toast from "react-hot-toast";

const MOCK_PROPOSALS: Proposal[] = [
  {
    proposalId: 12,
    proposer: "0x7a3f…c2d1",
    description: "Update risk threshold from 5000 to 7500 basis points for insurance policy underwriting to accommodate higher-risk pools.",
    forVotes: "145000",
    againstVotes: "32000",
    startTime: Date.now() / 1000 - 172800,
    endTime: Date.now() / 1000 + 432000,
    executed: false,
    cancelled: false,
    proposalType: 1,
  },
  {
    proposalId: 11,
    proposer: "0x9b2e…d4f3",
    description: "Enable cross-chain claims processing via Chainlink CCIP for policies on Arbitrum and Optimism.",
    forVotes: "230000",
    againstVotes: "18000",
    startTime: Date.now() / 1000 - 345600,
    endTime: Date.now() / 1000 + 259200,
    executed: false,
    cancelled: false,
    proposalType: 3,
  },
  {
    proposalId: 10,
    proposer: "0x5c1d…e8a2",
    description: "Introduce anonymized data sharing protocol for research institutions with patient consent via World ID.",
    forVotes: "89000",
    againstVotes: "67000",
    startTime: Date.now() / 1000 - 518400,
    endTime: Date.now() / 1000 + 86400,
    executed: false,
    cancelled: false,
    proposalType: 2,
  },
  {
    proposalId: 9,
    proposer: "0x2d4f…a1b3",
    description: "Reduce minimum quorum from 10% to 5% of total token supply for faster governance decision-making.",
    forVotes: "310000",
    againstVotes: "120000",
    startTime: Date.now() / 1000 - 1209600,
    endTime: Date.now() / 1000 - 604800,
    executed: true,
    cancelled: false,
    proposalType: 0,
  },
  {
    proposalId: 8,
    proposer: "0x6e7g…b5c4",
    description: "Upgrade SupplyChain contract to support multi-hop batch transfers for international pharmaceutical shipments.",
    forVotes: "56000",
    againstVotes: "189000",
    startTime: Date.now() / 1000 - 2592000,
    endTime: Date.now() / 1000 - 1987200,
    executed: false,
    cancelled: false,
    proposalType: 3,
  },
];

export default function GovernancePage() {
  const [showVote, setShowVote] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [tab, setTab] = useState<"active" | "past">("active");
  const [formData, setFormData] = useState({ description: "", proposalType: "0" });

  const activeProposals = MOCK_PROPOSALS.filter(
    (p) => !p.executed && !p.cancelled && p.endTime * 1000 > Date.now()
  );
  const pastProposals = MOCK_PROPOSALS.filter(
    (p) => p.executed || p.cancelled || p.endTime * 1000 <= Date.now()
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await new Promise((r) => setTimeout(r, 1500));
    toast.success("Proposal created on-chain");
    setShowCreate(false);
    setFormData({ description: "", proposalType: "0" });
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
        <StatCard title="Total Proposals" value={MOCK_PROPOSALS.length} icon={<Vote className="h-6 w-6" />} />
        <StatCard title="Executed" value={pastProposals.filter((p) => p.executed).length} icon={<Zap className="h-6 w-6" />} />
        <StatCard title="Participation Rate" value="68.4%" icon={<CheckCircle className="h-6 w-6" />} trend={{ value: 4.2, positive: true }} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
        {(["active", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
              ${
                tab === t
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
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
              setSelectedProposal(MOCK_PROPOSALS.find((p) => p.proposalId === id) || null);
              setShowVote(true);
            }}
          />
        ))}
      </div>

      {(tab === "active" ? activeProposals : pastProposals).length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-800">
          <XCircle className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            {tab === "active" ? "No active proposals" : "No past proposals"}
          </p>
        </div>
      )}

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
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="flex-1" type="submit">Submit Proposal</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
