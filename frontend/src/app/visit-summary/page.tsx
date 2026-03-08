"use client";

import { useState } from "react";
import {
  Brain,
  FileText,
  ClipboardCheck,
  Stethoscope,
  AlertTriangle,
  Pill,
  Calendar,
  Shield,
  ArrowRight,
  Loader2,
  CheckCircle,
  Copy,
  Hash,
} from "lucide-react";

import { useVisitSummary } from "@/hooks/useApi";
import { useWalletAddress } from "@/hooks/useContract";

type Tab = "pre-visit" | "post-visit";

interface PreVisitData {
  patientOverview: string;
  activeConditions: string[];
  currentMedications: Array<{ name: string; dosage: string; frequency: string; since: string }>;
  allergies: string[];
  recentLabResults: Array<{ test: string; value: string; date: string; status: string }>;
  upcomingProcedures: string[];
  openIssues: string[];
  suggestedFocusAreas: string[];
  riskFactors: string[];
  immunizationStatus: string;
  lastVisitSummary: string;
  confidence: number;
  generatedAt: string;
  recordCount: number;
  blockchainVerified: boolean;
}

interface PostVisitData {
  visitDate: string;
  chiefComplaint: string;
  subjective: string;
  objective: { vitals: Record<string, string>; physicalExam: string; labResults: string };
  assessment: string[];
  plan: Array<{ action: string; details: string; timeline: string }>;
  medicationChanges: Array<{ medication: string; change: string; details: string }>;
  referrals: Array<{ specialty: string; reason: string; urgency: string }>;
  patientInstructions: string[];
  followUp: { timeframe: string; reason: string; tests: string[] };
  billingCodes: Array<{ code: string; description: string }>;
  redFlags: string[];
  confidence: number;
  generatedAt: string;
  blockchainVerified: boolean;
  summaryHash: string;
}

export default function VisitSummaryPage() {
  const [tab, setTab] = useState<Tab>("pre-visit");
  const [patientAddr, setPatientAddr] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [preVisitData, setPreVisitData] = useState<PreVisitData | null>(null);
  const [postVisitData, setPostVisitData] = useState<PostVisitData | null>(null);
  const [copied, setCopied] = useState(false);

  const { loading, error, generatePreVisit, generatePostVisit } = useVisitSummary();
  const { address, connect } = useWalletAddress();

  const handlePreVisit = async () => {
    if (!patientAddr) return;
    try {
      const result = await generatePreVisit(patientAddr);
      setPreVisitData(result?.data ?? result);
    } catch {
      // error handled by hook
    }
  };

  const handlePostVisit = async () => {
    if (!patientAddr || !visitNotes) return;
    try {
      const result = await generatePostVisit(patientAddr, visitNotes);
      setPostVisitData(result?.data ?? result);
    } catch {
      // error handled by hook
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "critical": return "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400";
      case "abnormal": return "text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400";
      default: return "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400";
    }
  };

  const urgencyColor = (urgency: string) => {
    switch (urgency) {
      case "emergent": return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
      case "urgent": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
      default: return "bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary-light";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Visit Summarization
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          AI-powered pre-visit preparation and post-visit documentation — backed by blockchain verification
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex space-x-1 rounded-xl bg-gray-100 p-1 dark:bg-surface">
        <button
          onClick={() => setTab("pre-visit")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "pre-visit"
              ? "bg-white text-primary shadow dark:bg-surface dark:text-primary-light"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          <Stethoscope className="h-4 w-4" />
          Pre-Visit Summary
        </button>
        <button
          onClick={() => setTab("post-visit")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "post-visit"
              ? "bg-white text-primary shadow dark:bg-surface dark:text-primary-light"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          Post-Visit Summary
        </button>
      </div>

      {/* Patient Address Input */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Patient Ethereum Address
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={patientAddr}
            onChange={(e) => setPatientAddr(e.target.value)}
            placeholder="0x..."
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
          />
          {!address && (
            <button
              onClick={async () => {
                const addr = await connect();
                if (addr) setPatientAddr(addr);
              }}
              className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-surface dark:text-gray-300 dark:hover:bg-white/10"
            >
              Use My Wallet
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ─── PRE-VISIT TAB ─────────────────────────────────────────────── */}
      {tab === "pre-visit" && (
        <div className="space-y-6">
          <button
            onClick={handlePreVisit}
            disabled={loading || !patientAddr}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            {loading ? "Analyzing on-chain records..." : "Generate Pre-Visit Summary"}
          </button>

          {preVisitData && (
            <div className="space-y-4">
              {/* Confidence & metadata bar */}
              <div className="flex items-center gap-4 rounded-lg bg-primary/10 px-4 py-3 dark:bg-primary/20">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary dark:text-primary-light" />
                  <span className="text-xs font-medium text-primary dark:text-primary-light">
                    Blockchain Verified
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">|</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {preVisitData.recordCount} records analyzed
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">|</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Confidence: {(preVisitData.confidence * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">|</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Generated: {new Date(preVisitData.generatedAt).toLocaleString()}
                </span>
              </div>

              {/* Patient Overview */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                  Patient Overview
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{preVisitData.patientOverview}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Active Conditions */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Active Conditions
                  </h3>
                  {preVisitData.activeConditions.length > 0 ? (
                    <ul className="space-y-2">
                      {preVisitData.activeConditions.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">No active conditions recorded</p>
                  )}
                </div>

                {/* Current Medications */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <Pill className="h-4 w-4 text-primary" />
                    Current Medications
                  </h3>
                  {preVisitData.currentMedications.length > 0 ? (
                    <div className="space-y-3">
                      {preVisitData.currentMedications.map((m, i) => (
                        <div key={i} className="rounded-lg bg-gray-50 p-3 dark:bg-surface/50">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{m.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {m.dosage} · {m.frequency} · Since: {m.since}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No medications recorded</p>
                  )}
                </div>

                {/* Allergies */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    Allergies
                  </h3>
                  {preVisitData.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {preVisitData.allergies.map((a, i) => (
                        <span key={i} className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No known allergies</p>
                  )}
                </div>

                {/* Recent Lab Results */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <FileText className="h-4 w-4 text-purple-500" />
                    Recent Lab Results
                  </h3>
                  {preVisitData.recentLabResults.length > 0 ? (
                    <div className="space-y-2">
                      {preVisitData.recentLabResults.map((r, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-surface/50">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{r.test}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{r.date}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{r.value}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(r.status)}`}>
                              {r.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No recent lab results</p>
                  )}
                </div>
              </div>

              {/* Suggested Focus Areas */}
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-6 dark:border-primary/30 dark:bg-primary/20">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-primary dark:text-primary-light">
                  <Brain className="h-4 w-4" />
                  AI-Suggested Focus Areas for This Visit
                </h3>
                {preVisitData.suggestedFocusAreas.length > 0 ? (
                  <ul className="space-y-2">
                    {preVisitData.suggestedFocusAreas.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-primary dark:text-primary-light">
                        <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-primary dark:text-primary-light">No specific focus areas identified</p>
                )}
              </div>

              {/* Risk Factors */}
              {preVisitData.riskFactors.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    Risk Factors
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {preVisitData.riskFactors.map((r, i) => (
                      <span key={i} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── POST-VISIT TAB ────────────────────────────────────────────── */}
      {tab === "post-visit" && (
        <div className="space-y-6">
          {/* Visit Notes Input */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Physician Visit Notes
            </label>
            <textarea
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              rows={8}
              placeholder="Enter the physician's visit notes here. Include chief complaint, examination findings, assessment, and plan..."
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white"
            />
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              The AI will structure these notes into a SOAP-format document with billing codes,
              medication changes, referrals, and patient instructions — all verified on-chain.
            </p>
          </div>

          <button
            onClick={handlePostVisit}
            disabled={loading || !patientAddr || !visitNotes}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
            {loading ? "Generating documentation..." : "Generate Post-Visit Summary"}
          </button>

          {postVisitData && (
            <div className="space-y-4">
              {/* Hash & verification bar */}
              <div className="flex flex-wrap items-center gap-4 rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    On-Chain Verified
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3 text-gray-400" />
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    {postVisitData.summaryHash?.slice(0, 20)}…
                  </span>
                  <button
                    onClick={() => handleCopy(postVisitData.summaryHash)}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                  >
                    {copied ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Confidence: {(postVisitData.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Chief Complaint + Subjective */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  Visit on {postVisitData.visitDate}
                </h3>
                <div className="mb-4">
                  <span className="text-xs font-medium uppercase text-gray-400">Chief Complaint</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{postVisitData.chiefComplaint}</p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase text-gray-400">Subjective (S)</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{postVisitData.subjective}</p>
                </div>
              </div>

              {/* Objective */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Objective (O)</h3>
                {Object.keys(postVisitData.objective.vitals).length > 0 && (
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {Object.entries(postVisitData.objective.vitals).map(([key, val]) => (
                      <div key={key} className="rounded-lg bg-gray-50 p-3 text-center dark:bg-surface/50">
                        <p className="text-xs uppercase text-gray-400">{key}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{val}</p>
                      </div>
                    ))}
                  </div>
                )}
                {postVisitData.objective.physicalExam && (
                  <div className="mb-3">
                    <span className="text-xs font-medium uppercase text-gray-400">Physical Exam</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{postVisitData.objective.physicalExam}</p>
                  </div>
                )}
                {postVisitData.objective.labResults && (
                  <div>
                    <span className="text-xs font-medium uppercase text-gray-400">Lab Results</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{postVisitData.objective.labResults}</p>
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Assessment */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Assessment (A)</h3>
                  <ul className="space-y-2">
                    {postVisitData.assessment.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary dark:bg-primary/25 dark:text-primary-light">
                          {i + 1}
                        </span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Plan */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Plan (P)</h3>
                  <div className="space-y-3">
                    {postVisitData.plan.map((p, i) => (
                      <div key={i} className="rounded-lg bg-gray-50 p-3 dark:bg-surface/50">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{p.action}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.details}</p>
                        {p.timeline && (
                          <p className="mt-1 text-xs text-primary dark:text-primary-light">
                            <Calendar className="mr-1 inline h-3 w-3" />
                            {p.timeline}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Medication Changes */}
              {postVisitData.medicationChanges.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <Pill className="h-4 w-4 text-purple-500" />
                    Medication Changes
                  </h3>
                  <div className="space-y-2">
                    {postVisitData.medicationChanges.map((m, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-surface/50">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{m.medication}</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{m.details}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          m.change === "started" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : m.change === "stopped" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          : m.change === "modified" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          : "bg-gray-100 text-gray-700 dark:bg-surface dark:text-gray-300"
                        }`}>
                          {m.change}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Referrals */}
              {postVisitData.referrals.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Referrals</h3>
                  <div className="space-y-2">
                    {postVisitData.referrals.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-surface/50">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{r.specialty}</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{r.reason}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${urgencyColor(r.urgency)}`}>
                          {r.urgency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Patient Instructions */}
              {postVisitData.patientInstructions.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-900/20">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                    <ClipboardCheck className="h-4 w-4" />
                    Patient Instructions
                  </h3>
                  <ul className="space-y-2">
                    {postVisitData.patientInstructions.map((inst, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        {inst}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red Flags */}
              {postVisitData.redFlags.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    Red Flags — Seek Immediate Care If:
                  </h3>
                  <ul className="space-y-2">
                    {postVisitData.redFlags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-300">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Follow-Up */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                  <Calendar className="h-4 w-4 text-primary" />
                  Follow-Up Plan
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <span className="text-xs uppercase text-gray-400">Timeframe</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {postVisitData.followUp.timeframe || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-gray-400">Reason</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {postVisitData.followUp.reason || "Routine follow-up"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-gray-400">Pre-Visit Tests</span>
                    {postVisitData.followUp.tests.length > 0 ? (
                      <ul className="space-y-1">
                        {postVisitData.followUp.tests.map((t, i) => (
                          <li key={i} className="text-sm text-gray-700 dark:text-gray-300">• {t}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400">None specified</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Billing Codes */}
              {postVisitData.billingCodes.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Suggested Billing Codes</h3>
                  <div className="flex flex-wrap gap-2">
                    {postVisitData.billingCodes.map((b, i) => (
                      <span key={i} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs dark:bg-surface">
                        <span className="font-mono font-medium text-gray-900 dark:text-white">{b.code}</span>
                        <span className="ml-1 text-gray-500 dark:text-gray-400">— {b.description}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
