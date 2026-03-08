"use client";

import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";

interface AgentStatus {
  name: string;
  role: string;
  status: "pending" | "running" | "complete" | "error";
  recommendation?: "APPROVE" | "REJECT" | "FLAG_FOR_REVIEW";
  confidence?: number;
  reasoning?: string[];
  riskScore?: number;
  duration?: number;
}

interface AdjudicatorSwarmProps {
  agents: [AgentStatus, AgentStatus, AgentStatus];
  consensusResult?: {
    recommendation: "APPROVE" | "REJECT" | "FLAG_FOR_REVIEW";
    score: number;
    explanationHash?: string;
  };
  claimId?: number;
  className?: string;
}

const recBadge: Record<string, "success" | "danger" | "warning"> = {
  APPROVE: "success",
  REJECT: "danger",
  FLAG_FOR_REVIEW: "warning",
};

export default function AdjudicatorSwarm({
  agents,
  consensusResult,
  claimId,
  className = "",
}: AdjudicatorSwarmProps) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Multi-Agent Claim Adjudication
          </h3>
          {claimId != null && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Claim #{claimId} &middot; 3-Agent BFT Swarm
            </p>
          )}
        </div>
        {consensusResult && (
          <Badge variant={recBadge[consensusResult.recommendation] ?? "default"}>
            {consensusResult.recommendation.replace(/_/g, " ")}
          </Badge>
        )}
      </div>

      {/* Three-column agent display */}
      <div className="grid grid-cols-3 gap-3">
        {agents.map((agent, idx) => (
          <div
            key={idx}
            className={`rounded-lg border p-4 text-center transition-colors ${
              agent.status === "running"
                ? "border-primary/50 bg-primary/5"
                : agent.status === "complete"
                ? "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                : agent.status === "error"
                ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                : "border-gray-100 dark:border-gray-800"
            }`}
          >
            {/* Agent icon */}
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg dark:bg-gray-800">
              {idx === 0 ? "🏥" : idx === 1 ? "📋" : "🔍"}
            </div>

            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {agent.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {agent.role}
            </p>

            {/* Status */}
            <div className="mt-3">
              {agent.status === "running" ? (
                <div className="flex items-center justify-center gap-1">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <span className="text-xs text-primary">Analyzing...</span>
                </div>
              ) : agent.status === "complete" && agent.recommendation ? (
                <>
                  <Badge variant={recBadge[agent.recommendation] ?? "default"}>
                    {agent.recommendation.replace(/_/g, " ")}
                  </Badge>
                  {agent.confidence != null && (
                    <p className="mt-1 text-xs text-gray-500">
                      Confidence: {(agent.confidence / 100).toFixed(0)}%
                    </p>
                  )}
                </>
              ) : agent.status === "error" ? (
                <Badge variant="danger">Error</Badge>
              ) : (
                <span className="text-xs text-gray-400">Waiting...</span>
              )}
            </div>

            {/* Reasoning bullets */}
            {agent.reasoning && agent.reasoning.length > 0 && (
              <ul className="mt-2 space-y-1 text-left">
                {agent.reasoning.slice(0, 3).map((r, i) => (
                  <li key={i} className="text-xs text-gray-500 dark:text-gray-400">
                    &bull; {r}
                  </li>
                ))}
              </ul>
            )}

            {agent.duration != null && (
              <p className="mt-2 text-xs text-gray-400">
                {(agent.duration / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        ))}
      </div>

      {/* BFT Consensus */}
      {consensusResult && (
        <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              BFT Consensus Result
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {(consensusResult.score / 100).toFixed(0)}%
            </p>
          </div>
          {consensusResult.explanationHash && (
            <p className="mt-1 truncate text-xs text-gray-400 font-mono">
              Hash: {consensusResult.explanationHash}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
