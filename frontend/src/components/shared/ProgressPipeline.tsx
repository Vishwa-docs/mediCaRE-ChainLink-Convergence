"use client";

import { useEffect, useState } from "react";

interface Step {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
  detail?: string;
  duration?: number; // ms
}

interface ProgressPipelineProps {
  steps: Step[];
  title?: string;
  className?: string;
  animated?: boolean;
}

export default function ProgressPipeline({
  steps,
  title,
  className = "",
  animated = true,
}: ProgressPipelineProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const idx = steps.findIndex((s) => s.status === "active");
    if (idx >= 0) setActiveIdx(idx);
  }, [steps]);

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface ${className}`}>
      {title && (
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </h3>
      )}

      {/* Progress bar */}
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-700 ${
            animated ? "animate-pulse" : ""
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
              step.status === "active"
                ? "bg-primary/10 dark:bg-primary/20"
                : step.status === "completed"
                ? "bg-emerald-50 dark:bg-emerald-900/20"
                : step.status === "failed"
                ? "bg-red-50 dark:bg-red-900/20"
                : "bg-transparent"
            }`}
          >
            {/* Step indicator */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              {step.status === "completed" ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : step.status === "active" ? (
                <div className="relative flex h-6 w-6 items-center justify-center">
                  <div className="absolute h-6 w-6 animate-ping rounded-full bg-primary/30" />
                  <div className="h-4 w-4 rounded-full bg-primary" />
                </div>
              ) : step.status === "failed" ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
              )}
            </div>

            {/* Label + detail */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  step.status === "active"
                    ? "text-primary dark:text-primary-light"
                    : step.status === "completed"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : step.status === "failed"
                    ? "text-red-700 dark:text-red-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {step.label}
              </p>
              {step.detail && (
                <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                  {step.detail}
                </p>
              )}
            </div>

            {/* Duration */}
            {step.duration != null && step.status === "completed" && (
              <span className="text-xs text-gray-400">
                {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-right text-xs text-gray-400">
        {completedCount}/{steps.length} steps completed
      </p>
    </div>
  );
}
