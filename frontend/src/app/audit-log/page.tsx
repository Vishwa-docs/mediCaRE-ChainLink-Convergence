"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  FileText,
  Shield,
  Truck,
  BadgeCheck,
  Vote,
  ExternalLink,
  Loader2,
  Copy,
  CheckCircle,
  Clock,
  Hash,
  Inbox,
} from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import { useContract } from "@/hooks/useContract";
import { ethers } from "ethers";
import { CONTRACTS } from "@/lib/contracts";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────

interface AuditEntry {
  id: string;
  contract: string;
  event: string;
  args: Record<string, string>;
  blockNumber: number;
  txHash: string;
  timestamp: number;
  category: "record" | "insurance" | "supply" | "credential" | "governance";
}

const CATEGORY_CONFIG: Record<
  AuditEntry["category"],
  { icon: React.ReactNode; color: string; label: string }
> = {
  record: {
    icon: <FileText className="h-4 w-4" />,
    color: "bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary-light",
    label: "EHR",
  },
  insurance: {
    icon: <Shield className="h-4 w-4" />,
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    label: "Insurance",
  },
  supply: {
    icon: <Truck className="h-4 w-4" />,
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    label: "Supply",
  },
  credential: {
    icon: <BadgeCheck className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
    label: "Credential",
  },
  governance: {
    icon: <Vote className="h-4 w-4" />,
    color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
    label: "Governance",
  },
};

function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ts: number): string {
  if (ts === 0) return "—";
  const diff = Date.now() - ts * 1000;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Main ───────────────────────────────────────

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    const results: AuditEntry[] = [];

    try {
      const w = window as unknown as { ethereum?: ethers.Eip1193Provider };
      if (!w.ethereum) {
        setLoading(false);
        return;
      }
      const provider = new ethers.BrowserProvider(w.ethereum);

      // Define event scanners
      const scanners: {
        address: string;
        abi: string[];
        category: AuditEntry["category"];
        contract: string;
      }[] = [
        {
          address: CONTRACTS.EHRStorage,
          abi: [
            "event RecordAdded(uint256 indexed recordId, address indexed patient, string recordType)",
            "event AccessGranted(address indexed patient, address indexed provider)",
            "event AccessRevoked(address indexed patient, address indexed provider)",
          ],
          category: "record",
          contract: "EHRStorage",
        },
        {
          address: CONTRACTS.InsurancePolicy,
          abi: [
            "event PolicyMinted(uint256 indexed policyId, address indexed holder)",
            "event ClaimSubmitted(uint256 indexed claimId, uint256 indexed policyId)",
            "event ClaimStatusChanged(uint256 indexed claimId, uint8 newStatus)",
          ],
          category: "insurance",
          contract: "InsurancePolicy",
        },
        {
          address: CONTRACTS.SupplyChain,
          abi: [
            "event BatchCreated(uint256 indexed batchId, address indexed manufacturer)",
            "event BatchStatusUpdated(uint256 indexed batchId, uint8 newStatus)",
          ],
          category: "supply",
          contract: "SupplyChain",
        },
        {
          address: CONTRACTS.CredentialRegistry,
          abi: [
            "event CredentialIssued(uint256 indexed credentialId, address indexed subject)",
            "event CredentialRevoked(uint256 indexed credentialId)",
          ],
          category: "credential",
          contract: "CredentialRegistry",
        },
        {
          address: CONTRACTS.Governance,
          abi: [
            "event ProposalCreated(uint256 indexed proposalId, address indexed proposer)",
            "event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)",
            "event ProposalExecuted(uint256 indexed proposalId)",
          ],
          category: "governance",
          contract: "Governance",
        },
      ];

      // Scan events in parallel
      const blockNumber = await provider.getBlockNumber();
      const fromBlock = Math.max(0, blockNumber - 10000); // Last ~10k blocks

      const allPromises = scanners.map(async (scanner) => {
        try {
          const iface = new ethers.Interface(scanner.abi);
          const contract = new ethers.Contract(scanner.address, scanner.abi, provider);
          
          for (const eventFragment of iface.fragments) {
            if (eventFragment.type !== "event") continue;
            try {
              const evName = (eventFragment as ethers.EventFragment).name;
              const eventFilter = contract.filters[evName]?.();
              if (!eventFilter) continue;
              
              const logs = await provider.getLogs({
                ...eventFilter,
                fromBlock,
                toBlock: "latest",
              });

              for (const log of logs) {
                try {
                  const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                  if (!parsed) continue;

                  const args: Record<string, string> = {};
                  parsed.fragment.inputs.forEach((input, i) => {
                    const val = parsed.args[i];
                    args[input.name] = typeof val === "bigint" ? val.toString() : String(val);
                  });

                  results.push({
                    id: `${log.transactionHash}-${log.index}`,
                    contract: scanner.contract,
                    event: parsed.name,
                    args,
                    blockNumber: log.blockNumber,
                    txHash: log.transactionHash,
                    timestamp: 0, // We'll try to fetch block timestamps
                    category: scanner.category,
                  });
                } catch {
                  // skip unparseable logs
                }
              }
            } catch {
              // skip events that fail to query
            }
          }
        } catch {
          // skip contracts that fail
        }
      });

      await Promise.allSettled(allPromises);

      // Sort by block number descending
      results.sort((a, b) => b.blockNumber - a.blockNumber);

      // Try to fetch timestamps for top entries
      const uniqueBlocks = [...new Set(results.slice(0, 50).map((r) => r.blockNumber))];
      const blockTimestamps = new Map<number, number>();
      
      await Promise.allSettled(
        uniqueBlocks.map(async (bn) => {
          try {
            const block = await provider.getBlock(bn);
            if (block) blockTimestamps.set(bn, block.timestamp);
          } catch {
            // ignore
          }
        })
      );

      for (const entry of results) {
        entry.timestamp = blockTimestamps.get(entry.blockNumber) || 0;
      }

      setEntries(results);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const filtered = entries.filter((e) => {
    const matchFilter = filter === "all" || e.category === filter;
    const matchSearch =
      !search ||
      e.event.toLowerCase().includes(search.toLowerCase()) ||
      e.txHash.toLowerCase().includes(search.toLowerCase()) ||
      e.contract.toLowerCase().includes(search.toLowerCase()) ||
      Object.values(e.args).some((v) => v.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    toast.success("Tx hash copied!");
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Immutable on-chain event history across all mediCaRE contracts
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="info">{entries.length} events</Badge>
          <Button size="sm" variant="outline" onClick={() => fetchAuditLogs()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search events, tx hashes, addresses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {["all", "record", "insurance", "supply", "credential", "governance"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                filter === cat
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-surface dark:text-gray-300"
              }`}
            >
              {cat === "all" ? "All" : CATEGORY_CONFIG[cat as AuditEntry["category"]].label}
            </button>
          ))}
        </div>
      </div>

      {/* Events list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-500">Scanning on-chain events...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center dark:border-border dark:bg-surface">
          <Inbox className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            {entries.length === 0
              ? "No events found. Interact with contracts to generate audit trail."
              : "No events match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-border dark:bg-surface">
          <div className="divide-y divide-gray-100 dark:divide-border">
            {filtered.slice(0, 100).map((entry) => {
              const cfg = CATEGORY_CONFIG[entry.category];
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-surface"
                >
                  <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.event}
                        </p>
                        <Badge variant="default">{entry.contract}</Badge>
                      </div>
                      <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                        {entry.timestamp ? timeAgo(entry.timestamp) : `Block #${entry.blockNumber}`}
                      </span>
                    </div>

                    {/* Event args */}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(entry.args).map(([key, val]) => (
                        <span key={key} className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium text-gray-600 dark:text-gray-300">{key}:</span>{" "}
                          {val.startsWith("0x") ? formatAddress(val) : val}
                        </span>
                      ))}
                    </div>

                    {/* Tx hash */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <Hash className="h-3 w-3 text-gray-400" />
                      <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                        {formatAddress(entry.txHash)}
                      </span>
                      <button
                        onClick={() => handleCopy(entry.txHash)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {copiedHash === entry.txHash ? (
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <Clock className="ml-2 h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-400">Block #{entry.blockNumber}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length > 100 && (
            <div className="border-t border-gray-200 px-6 py-3 text-center text-xs text-gray-500 dark:border-border dark:text-gray-400">
              Showing first 100 of {filtered.length} events
            </div>
          )}
        </div>
      )}
    </div>
  );
}
