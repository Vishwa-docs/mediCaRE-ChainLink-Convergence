"use client";

import { useState } from "react";
import {
  FlaskConical,
  Search,
  Shield,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import ProgressPipeline from "@/components/shared/ProgressPipeline";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────

interface TrialMatch {
  matchId: string;
  eligibilityScore: number;
  matchedCriteria: string[];
}

interface TrialResult {
  trialId: string;
  title: string;
  eligibleCount: number;
  totalScreened: number;
  matches: TrialMatch[];
  onChainTxHash: string;
}

// ── Demo data ──────────────────────────────────

const DEMO_TRIALS = [
  {
    id: "NCT-2024-DM-001",
    title: "Novel GLP-1 Agonist for Type 2 Diabetes Management",
    institution: "Stanford Medical Center",
    status: "Recruiting",
    criteria: "Age 35-65, Type 2 Diabetes, HbA1c > 7.0",
    participants: 150,
  },
  {
    id: "NCT-2024-CV-042",
    title: "AI-Guided Hypertension Treatment Protocol",
    institution: "Mayo Clinic Research",
    status: "Recruiting",
    criteria: "Age 40-75, Hypertension Stage 2, No prior cardiac events",
    participants: 200,
  },
  {
    id: "NCT-2024-ON-089",
    title: "Immunotherapy Combination for Early-Stage Breast Cancer",
    institution: "Johns Hopkins Oncology",
    status: "Upcoming",
    criteria: "Adult females, Stage I-II breast cancer, BRCA1/2 negative",
    participants: 100,
  },
];

const DEMO_MATCH_RESULT: TrialResult = {
  trialId: "NCT-2024-DM-001",
  title: "Novel GLP-1 Agonist for Type 2 Diabetes Management",
  eligibleCount: 23,
  totalScreened: 156,
  matches: [
    { matchId: "a1b2c3d4e5f6", eligibilityScore: 94, matchedCriteria: ["Age range", "Diagnosis", "HbA1c level"] },
    { matchId: "f6e5d4c3b2a1", eligibilityScore: 88, matchedCriteria: ["Age range", "Diagnosis", "BMI range"] },
    { matchId: "1234abcd5678", eligibilityScore: 82, matchedCriteria: ["Age range", "Diagnosis"] },
  ],
  onChainTxHash: "0x7890abcdef1234567890abcdef1234567890abcd",
};

// ── Page Component ─────────────────────────────

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<"trials" | "consent" | "data">("trials");
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<TrialResult | null>(null);
  const [consentStatus, setConsentStatus] = useState(false);

  type StepStatus = "pending" | "active" | "completed" | "failed";
  interface PipelineStep { id: string; label: string; status: StepStatus }

  const initialSteps: PipelineStep[] = [
    { id: "verify", label: "Verify researcher credentials", status: "pending" },
    { id: "consent", label: "Check patient research consent", status: "pending" },
    { id: "fetch", label: "Fetch profiles via Confidential HTTP", status: "pending" },
    { id: "evaluate", label: "LLM eligibility evaluation (TEE)", status: "pending" },
    { id: "record", label: "Record anonymous results on-chain", status: "pending" },
  ];

  const [matchSteps, setMatchSteps] = useState<PipelineStep[]>(initialSteps);

  const handleMatch = async (_trialId: string) => {
    setMatching(true);
    setMatchResult(null);

    // Animate the pipeline
    const steps: PipelineStep[] = initialSteps.map((s) => ({ ...s }));
    for (let i = 0; i < steps.length; i++) {
      steps[i] = { ...steps[i], status: "active" };
      setMatchSteps([...steps]);
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
      steps[i] = { ...steps[i], status: "completed" };
      setMatchSteps([...steps]);
    }

    setMatchResult(DEMO_MATCH_RESULT);
    setMatching(false);
    toast.success(`Found ${DEMO_MATCH_RESULT.eligibleCount} eligible patients`);

    // Reset steps after delay
    setTimeout(() => {
      setMatchSteps(initialSteps.map((s) => ({ ...s, status: "pending" as StepStatus })));
    }, 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
          <FlaskConical className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Research & Clinical Trials
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Zero-knowledge trial matching &middot; Data monetization &middot; IRB compliance
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: "trials" as const, label: "Trial Matching", icon: <Search className="h-4 w-4" /> },
          { id: "consent" as const, label: "Research Consent", icon: <Shield className="h-4 w-4" /> },
          { id: "data" as const, label: "Data Monetization", icon: <FileText className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Trials Tab ─── */}
      {activeTab === "trials" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Trial list */}
          <div className="lg:col-span-2 space-y-4">
            {DEMO_TRIALS.map((trial) => (
              <Card key={trial.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {trial.title}
                      </h3>
                      <Badge variant={trial.status === "Recruiting" ? "success" : "info"}>
                        {trial.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{trial.institution}</p>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Criteria:</span> {trial.criteria}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      <Users className="mr-1 inline h-3 w-3" />
                      Target: {trial.participants} participants &middot; ID: {trial.id}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleMatch(trial.id)}
                    disabled={matching}
                    className="shrink-0"
                  >
                    {matching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Match Patients"
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pipeline + Results */}
          <div className="space-y-4">
            <ProgressPipeline
              steps={matchSteps}
              title="ZK Trial Matching Pipeline"
            />

            {matchResult && (
              <Card>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Match Results
                </h4>
                <div className="grid grid-cols-2 gap-3 text-center mb-4">
                  <div className="rounded-lg bg-emerald-50 py-2 dark:bg-emerald-900/20">
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                      {matchResult.eligibleCount}
                    </p>
                    <p className="text-xs text-gray-500">Eligible</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 py-2 dark:bg-gray-800/50">
                    <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                      {matchResult.totalScreened}
                    </p>
                    <p className="text-xs text-gray-500">Screened</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-2">Top anonymized matches:</p>
                {matchResult.matches.map((m) => (
                  <div key={m.matchId} className="mb-2 rounded border border-gray-100 px-3 py-2 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-500">{m.matchId}</span>
                      <Badge variant="success">{m.eligibilityScore}%</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.matchedCriteria.map((c) => (
                        <Badge key={c} variant="info">{c}</Badge>
                      ))}
                    </div>
                  </div>
                ))}

                <p className="mt-2 truncate text-xs text-gray-400 font-mono">
                  Tx: {matchResult.onChainTxHash}
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Consent Tab ─── */}
      {activeTab === "consent" && (
        <div className="max-w-xl">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Research Data Sharing Consent
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              By opting in, your anonymized medical data may be used to match you
              with clinical trials and contribute to medical research. Your identity
              is never revealed — only a zero-knowledge eligibility proof is shared.
            </p>

            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                {consentStatus ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Research Consent
                  </p>
                  <p className="text-xs text-gray-500">
                    {consentStatus ? "You are opted in to research matching" : "Currently opted out"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setConsentStatus(!consentStatus);
                  toast.success(
                    consentStatus
                      ? "Research consent revoked on-chain"
                      : "Research consent granted on-chain"
                  );
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  consentStatus ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    consentStatus ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                What gets shared:
              </h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                  Anonymized diagnosis codes (ICD-10)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                  De-identified demographics (age range, sex)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                  Lab value ranges (not exact values)
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 text-red-400 shrink-0" />
                  <span className="text-gray-400">Name, address, or wallet address — NEVER shared</span>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      )}

      {/* ── Data Monetization Tab ─── */}
      {activeTab === "data" && (
        <div className="max-w-2xl">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Opt-in Data Monetization
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Earn tokens when researchers access your anonymized data. All processing
              happens in Chainlink CRE Confidential Compute (TEE) — your raw data is
              never exposed.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-primary/5 px-4 py-4 text-center dark:bg-primary/10">
                <p className="text-2xl font-bold text-primary">3</p>
                <p className="text-xs text-gray-500">Data Requests</p>
              </div>
              <div className="rounded-xl bg-emerald-50 px-4 py-4 text-center dark:bg-emerald-900/20">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">$12.50</p>
                <p className="text-xs text-gray-500">Earned</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-4 text-center dark:bg-gray-800/50">
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">156</p>
                <p className="text-xs text-gray-500">Records Shared</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Payments processed via CCIP cross-chain settlement
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
