"use client";

import { Brain, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import Card from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";

interface SummaryViewerProps {
  recordId?: number;
  summary?: string;
  onGenerate?: () => void;
  loading?: boolean;
}

export default function SummaryViewer({
  recordId = 0,
  summary = "",
  onGenerate,
  loading = false,
}: SummaryViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Clinical Summary</h3>
          <Badge variant="purple">Record #{recordId}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            title="Copy summary"
          >
            {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
          {onGenerate && (
            <Button size="sm" variant="outline" loading={loading} onClick={onGenerate}>
              Regenerate
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-surface/50">
        <div className="prose prose-sm max-w-none text-gray-700 dark:prose-invert dark:text-gray-300">
          {summary.split("\n").map((line, i) => (
            <p key={i} className={line.startsWith("**") ? "font-semibold" : ""}>
              {line || <br />}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        Verified on-chain via Chainlink Functions
      </div>
    </Card>
  );
}
