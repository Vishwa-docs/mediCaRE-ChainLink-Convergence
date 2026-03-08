"use client";

import { useState } from "react";
import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";

interface Reason {
  factor: string;
  weight: number;
  direction: "positive" | "negative" | "neutral";
  description: string;
}

interface ExplanationData {
  decisionType: string;
  modelName: string;
  modelVersion: string;
  confidence: number; // 0-100
  recommendation: string;
  reasons: Reason[];
  uncertaintyFlags: string[];
  timestamp: string;
  explanationHash?: string;
}

interface ExplainabilityPanelProps {
  explanation: ExplanationData;
  className?: string;
  showHash?: boolean;
}

export default function ExplainabilityPanel({
  explanation,
  className = "",
  showHash = true,
}: ExplainabilityPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const confidenceColor =
    explanation.confidence >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : explanation.confidence >= 60
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  const confidenceBg =
    explanation.confidence >= 80
      ? "bg-emerald-500"
      : explanation.confidence >= 60
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            AI Explanation
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {explanation.decisionType} &middot; {explanation.modelName} v{explanation.modelVersion}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${confidenceColor}`}>
            {explanation.confidence}%
          </p>
          <p className="text-xs text-gray-400">confidence</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={`h-full rounded-full ${confidenceBg}`} style={{ width: `${explanation.confidence}%` }} />
      </div>

      {/* Recommendation */}
      <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Recommendation
        </p>
        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
          {explanation.recommendation}
        </p>
      </div>

      {/* Key factors */}
      <div className="mt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          <span>Key Factors ({explanation.reasons.length})</span>
          <svg
            className={`h-4 w-4 transform transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {explanation.reasons.map((reason, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
              >
                <span className="mt-0.5">
                  {reason.direction === "positive" ? (
                    <span className="text-emerald-500">+</span>
                  ) : reason.direction === "negative" ? (
                    <span className="text-red-500">&minus;</span>
                  ) : (
                    <span className="text-gray-400">&bull;</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {reason.factor}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {reason.description}
                  </p>
                </div>
                <Badge variant={reason.direction === "positive" ? "success" : reason.direction === "negative" ? "danger" : "default"}>
                  {(reason.weight * 100).toFixed(0)}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Uncertainty flags */}
      {explanation.uncertaintyFlags.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            ⚠ Uncertainty Flags
          </p>
          <ul className="mt-1 space-y-1">
            {explanation.uncertaintyFlags.map((flag, idx) => (
              <li key={idx} className="text-xs text-amber-600 dark:text-amber-300">
                &bull; {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hash */}
      {showHash && explanation.explanationHash && (
        <p className="mt-3 truncate text-xs text-gray-400 font-mono">
          Hash: {explanation.explanationHash}
        </p>
      )}
    </Card>
  );
}
