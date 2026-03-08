"use client";

import { useState } from "react";
import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";

interface TimelineEvent {
  date: string;
  type: string;
  description: string;
  provider?: string;
  icdCodes?: string[];
}

interface MedicationInteraction {
  drug1: string;
  drug2: string;
  severity: "mild" | "moderate" | "severe";
  description: string;
}

interface LongitudinalData {
  patientAddress?: string;
  generatedAt: string;
  recordCount: number;
  timelineSpanYears: number;
  summary: string;
  timeline: TimelineEvent[];
  activeMedications: string[];
  chronicConditions: string[];
  allergies: string[];
  redFlags: string[];
  medicationInteractions: MedicationInteraction[];
  summaryHash?: string;
}

interface LongitudinalSummaryProps {
  data: LongitudinalData;
  className?: string;
}

export default function LongitudinalSummary({
  data,
  className = "",
}: LongitudinalSummaryProps) {
  const [activeSection, setActiveSection] = useState<string>("summary");

  const sections = [
    { id: "summary", label: "Summary", icon: "📋" },
    { id: "timeline", label: "Timeline", icon: "📅" },
    { id: "medications", label: "Medications", icon: "💊" },
    { id: "conditions", label: "Conditions", icon: "🩺" },
    { id: "flags", label: "Red Flags", icon: "🚩" },
  ];

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Longitudinal Clinical Summary
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {data.recordCount} records &middot; {data.timelineSpanYears} year span &middot;
            Generated {new Date(data.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="purple">AI-Generated</Badge>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-2 dark:border-gray-700 overflow-x-auto">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeSection === section.id
                ? "bg-primary/10 text-primary dark:text-primary-light"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <span>{section.icon}</span>
            {section.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="mt-4">
        {activeSection === "summary" && (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {data.summary}
            </p>
          </div>
        )}

        {activeSection === "timeline" && (
          <div className="relative space-y-3 pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
            {data.timeline.map((event, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-4 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary dark:border-surface" />
                <div className="rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{event.type}</Badge>
                    <span className="text-xs text-gray-400">{event.date}</span>
                    {event.provider && (
                      <span className="ml-auto text-xs text-gray-500">{event.provider}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    {event.description}
                  </p>
                  {event.icdCodes && event.icdCodes.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {event.icdCodes.map((code) => (
                        <Badge key={code} variant="default">{code}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === "medications" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Active Medications ({data.activeMedications.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.activeMedications.map((med) => (
                  <Badge key={med} variant="info">{med}</Badge>
                ))}
              </div>
            </div>

            {data.medicationInteractions.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
                  ⚠ Drug Interactions ({data.medicationInteractions.length})
                </h4>
                <div className="space-y-2">
                  {data.medicationInteractions.map((interaction, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Badge variant={
                        interaction.severity === "severe" ? "danger" :
                        interaction.severity === "moderate" ? "warning" : "default"
                      }>
                        {interaction.severity}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {interaction.drug1} + {interaction.drug2}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {interaction.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "conditions" && (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Chronic Conditions
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.chronicConditions.map((c) => (
                  <Badge key={c} variant="warning">{c}</Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Known Allergies
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.allergies.map((a) => (
                  <Badge key={a} variant="danger">{a}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === "flags" && (
          <div>
            {data.redFlags.length > 0 ? (
              <div className="space-y-2">
                {data.redFlags.map((flag, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20"
                  >
                    <span className="mt-0.5 text-red-500">🚩</span>
                    <p className="text-sm text-red-700 dark:text-red-400">{flag}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No red flags detected.</p>
            )}
          </div>
        )}
      </div>

      {/* Hash footer */}
      {data.summaryHash && (
        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
          <p className="truncate text-xs text-gray-400 font-mono">
            On-chain hash: {data.summaryHash}
          </p>
        </div>
      )}
    </Card>
  );
}
