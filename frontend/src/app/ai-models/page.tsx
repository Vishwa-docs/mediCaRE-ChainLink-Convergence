"use client";

import { useState, useCallback } from "react";
import {
  Brain,
  Activity,
  FileText,
  Stethoscope,
  Loader2,
  Zap,
  Cpu,
  ShieldCheck,
  BarChart3,
  AlertTriangle,
  Thermometer,
  Heart,
  Wind,
  Droplets,
  Languages,
  Server,
  Lock,
  Database,
  TrendingUp,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { aiApi, visitApi } from "@/lib/api";

/* ─── helpers ──────────────────────────────────── */
function riskColor(score: number) {
  if (score < 3000) return "text-emerald-500";
  if (score < 6000) return "text-amber-500";
  return "text-red-500";
}
function riskBg(score: number) {
  if (score < 3000) return "bg-emerald-500";
  if (score < 6000) return "bg-amber-500";
  return "bg-red-500";
}
function riskLabel(score: number) {
  if (score < 3000) return "Low Risk";
  if (score < 6000) return "Medium Risk";
  return "High Risk";
}

const METRICS = ["HEART_RATE", "BLOOD_PRESSURE", "TEMPERATURE", "SPO2", "RESPIRATORY_RATE"] as const;
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

const INPUT_CLS =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-border dark:bg-surface dark:text-white";
const CARD_CLS =
  "rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-border dark:bg-surface";
const BTN_CLS =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50";

/* ─── page ─────────────────────────────────────── */
export default function AIModelsPage() {
  /* risk scoring state */
  const [riskForm, setRiskForm] = useState({
    age: 45, bmi: 27.5, chronicConditions: 2, medicationCount: 3,
    priorClaims: 1, smokingStatus: false, exerciseHoursPerWeek: 3,
    systolicBP: 130, fastingGlucose: 105, cholesterol: 210, policyId: "",
  });
  const [riskResult, setRiskResult] = useState<{ riskScore: number; bps: number } | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  /* anomaly state */
  const [anomalyMetric, setAnomalyMetric] = useState<string>(METRICS[0]);
  const [anomalyValues, setAnomalyValues] = useState("72,74,73,120,75,71,73,74,150,72");
  const [anomalyResult, setAnomalyResult] = useState<any>(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);

  /* summarize state */
  const [ehrText, setEhrText] = useState(
    "Patient: Jane Doe, 52F. Diagnosed with type 2 diabetes (E11.9) in 2019. Current medications: Metformin 1000mg BID, Lisinopril 20mg daily. Recent labs: HbA1c 7.2%, fasting glucose 135 mg/dL, LDL 142 mg/dL. BMI 31.4. Reports occasional numbness in feet. Blood pressure 138/88. Allergies: Sulfonamides. Last eye exam: 08/2025 — mild non-proliferative diabetic retinopathy noted."
  );
  const [summaryLang, setSummaryLang] = useState("en");
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  /* visit summary state */
  const [visitTab, setVisitTab] = useState<"pre" | "post">("pre");
  const [visitAddress, setVisitAddress] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [visitLang, setVisitLang] = useState("en");
  const [visitResult, setVisitResult] = useState<any>(null);
  const [visitLoading, setVisitLoading] = useState(false);

  /* ── handlers ─────────────────────────────────── */
  const runRiskScore = useCallback(async () => {
    setRiskLoading(true);
    setRiskResult(null);
    try {
      const { policyId, ...payload } = riskForm;
      const body: any = { ...payload };
      if (policyId) body.policyId = Number(policyId);
      const { data } = await aiApi.riskScore(body);
      setRiskResult({ riskScore: data.riskScore ?? data.risk_score ?? data.score ?? 0, bps: data.basisPoints ?? data.bps ?? data.riskScore ?? 0 });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Risk scoring failed");
    } finally {
      setRiskLoading(false);
    }
  }, [riskForm]);

  const runAnomaly = useCallback(async () => {
    setAnomalyLoading(true);
    setAnomalyResult(null);
    try {
      const values = anomalyValues.split(",").map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));
      const timestamps = values.map((_, i) => Date.now() - (values.length - i) * 60_000);
      const { data } = await aiApi.detectAnomalies({ metric: anomalyMetric, values, timestamps });
      setAnomalyResult(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Anomaly detection failed");
    } finally {
      setAnomalyLoading(false);
    }
  }, [anomalyMetric, anomalyValues]);

  const runSummarize = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryResult(null);
    try {
      const { data } = await aiApi.summarize(ehrText, summaryLang);
      setSummaryResult(data.summary ?? data.text ?? JSON.stringify(data, null, 2));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Summarization failed");
    } finally {
      setSummaryLoading(false);
    }
  }, [ehrText, summaryLang]);

  const runVisit = useCallback(async () => {
    if (!visitAddress) { toast.error("Patient address is required"); return; }
    setVisitLoading(true);
    setVisitResult(null);
    try {
      if (visitTab === "pre") {
        const { data } = await visitApi.preVisitSummary({ patientAddress: visitAddress, language: visitLang });
        setVisitResult(data);
      } else {
        if (!visitNotes) { toast.error("Visit notes required for post-visit"); setVisitLoading(false); return; }
        const { data } = await visitApi.postVisitSummary({ patientAddress: visitAddress, visitNotes, language: visitLang });
        setVisitResult(data);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Visit summary generation failed");
    } finally {
      setVisitLoading(false);
    }
  }, [visitTab, visitAddress, visitNotes, visitLang]);

  /* ── render ───────────────────────────────────── */
  return (
    <div className="space-y-10 pb-12">
      {/* ── Hero ───────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-8 dark:from-primary/20 dark:via-accent/10">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="rounded-xl bg-gradient-to-br from-primary to-accent p-3 text-white shadow-lg">
            <Brain className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              mediCaRE AI Engine
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Four production AI models powering intelligent healthcare — from risk prediction to anomaly detection.
            </p>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "AI Models", value: "4", icon: <Cpu className="h-5 w-5" />, sub: "Production-ready" },
          { title: "LLM Backend", value: "GPT-4o", icon: <Sparkles className="h-5 w-5" />, sub: "Azure OpenAI" },
          { title: "Inference", value: "Real-time", icon: <Zap className="h-5 w-5" />, sub: "< 2 s latency" },
          { title: "Encryption", value: "AES-256", icon: <Lock className="h-5 w-5" />, sub: "GCM + IPFS" },
        ].map((s) => (
          <div key={s.title} className={CARD_CLS}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{s.title}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.sub}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3 text-primary dark:bg-primary/20 dark:text-primary-light">
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          Section 1 — Risk Scoring
         ═══════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={<BarChart3 className="h-5 w-5" />} title="Risk Scoring Model" badge="Logistic Regression" />
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {/* info */}
          <div className={CARD_CLS + " space-y-4"}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Model Details</h3>
            <InfoRow label="Algorithm" value="Logistic Regression (scikit-learn parity)" />
            <InfoRow label="Output" value="Risk score in basis points (0 – 10 000)" />
            <InfoRow label="On-chain" value="Adjusts premium via InsurancePolicy contract" />
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Features</p>
            <div className="flex flex-wrap gap-2">
              {["Age", "BMI", "Chronic Conditions", "Medication Count", "Prior Claims", "Smoking", "Exercise Freq", "Systolic BP", "Fasting Glucose", "Cholesterol"].map((f) => (
                <span key={f} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary dark:bg-primary/20 dark:text-primary-light">{f}</span>
              ))}
            </div>
          </div>

          {/* interactive */}
          <div className={CARD_CLS + " space-y-4"}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Try It</h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["age", "Age", "number"],
                ["bmi", "BMI", "number"],
                ["chronicConditions", "Chronic Cond.", "number"],
                ["medicationCount", "Medications", "number"],
                ["priorClaims", "Prior Claims", "number"],
                ["exerciseHoursPerWeek", "Exercise hrs/wk", "number"],
                ["systolicBP", "Systolic BP", "number"],
                ["fastingGlucose", "Fasting Glucose", "number"],
                ["cholesterol", "Cholesterol", "number"],
                ["policyId", "Policy ID (opt)", "text"],
              ] as const).map(([key, label, type]) => (
                <label key={key} className="space-y-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                  <input
                    type={type}
                    className={INPUT_CLS}
                    value={(riskForm as any)[key]}
                    onChange={(e) => setRiskForm((p) => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 col-span-2">
                <input
                  type="checkbox"
                  checked={riskForm.smokingStatus}
                  onChange={(e) => setRiskForm((p) => ({ ...p, smokingStatus: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Smoker</span>
              </label>
            </div>
            <button className={BTN_CLS} disabled={riskLoading} onClick={runRiskScore}>
              {riskLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              Calculate Risk
            </button>

            {riskResult && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-surface">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Risk Score</p>
                    <p className={`text-4xl font-extrabold ${riskColor(riskResult.bps)}`}>{riskResult.bps}<span className="text-lg font-normal"> bps</span></p>
                    <p className={`mt-1 text-sm font-semibold ${riskColor(riskResult.bps)}`}>{riskLabel(riskResult.bps)}</p>
                  </div>
                  {/* visual gauge */}
                  <div className="h-28 w-28">
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-gray-200 dark:stroke-gray-700" />
                      <circle
                        cx="18" cy="18" r="15.5" fill="none" strokeWidth="3"
                        strokeDasharray={`${(Math.min(riskResult.bps, 10000) / 10000) * 97.4} 97.4`}
                        strokeLinecap="round"
                        className={riskBg(riskResult.bps).replace("bg-", "stroke-")}
                      />
                    </svg>
                  </div>
                </div>
                {/* bar */}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className={`h-full rounded-full transition-all ${riskBg(riskResult.bps)}`} style={{ width: `${Math.min(riskResult.bps / 100, 100)}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                  <span>0</span><span>3 000</span><span>6 000</span><span>10 000</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          Section 2 — Anomaly Detection
         ═══════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={<AlertTriangle className="h-5 w-5" />} title="Anomaly Detection" badge="Z-Score" />
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className={CARD_CLS + " space-y-4"}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Model Details</h3>
            <InfoRow label="Algorithm" value="Z-Score statistical anomaly detection" />
            <InfoRow label="Threshold" value="|z| > 2 flagged as anomaly" />
            <InfoRow label="On-chain" value="Anomalies trigger CRE workflow alerts" />
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Supported Metrics</p>
            <div className="flex flex-wrap gap-2">
              {[
                { m: "HEART_RATE", icon: <Heart className="h-3 w-3" /> },
                { m: "BLOOD_PRESSURE", icon: <Activity className="h-3 w-3" /> },
                { m: "TEMPERATURE", icon: <Thermometer className="h-3 w-3" /> },
                { m: "SPO2", icon: <Droplets className="h-3 w-3" /> },
                { m: "RESPIRATORY_RATE", icon: <Wind className="h-3 w-3" /> },
              ].map(({ m, icon }) => (
                <span key={m} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent dark:bg-accent/20 dark:text-accent-light">
                  {icon} {m.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>

          <div className={CARD_CLS + " space-y-4"}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Try It</h3>
            <label className="space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Metric</span>
              <select className={INPUT_CLS} value={anomalyMetric} onChange={(e) => setAnomalyMetric(e.target.value)}>
                {METRICS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Values (comma-separated)</span>
              <textarea rows={2} className={INPUT_CLS} value={anomalyValues} onChange={(e) => setAnomalyValues(e.target.value)} placeholder="72,74,73,120,75..." />
            </label>
            <button className={BTN_CLS} disabled={anomalyLoading} onClick={runAnomaly}>
              {anomalyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Detect Anomalies
            </button>

            {anomalyResult && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-surface">
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {anomalyResult.anomalies?.length ?? 0} anomal{(anomalyResult.anomalies?.length ?? 0) === 1 ? "y" : "ies"} detected
                </p>
                <div className="flex flex-wrap gap-2">
                  {(anomalyResult.values ?? anomalyValues.split(",").map(Number)).map((v: number, i: number) => {
                    const isAnomaly = anomalyResult.anomalies?.some?.((a: any) => a.index === i || a.idx === i) ??
                                      anomalyResult.flagged?.includes?.(i) ?? false;
                    return (
                      <span
                        key={i}
                        className={`rounded-md px-2.5 py-1 text-xs font-mono font-semibold ${
                          isAnomaly
                            ? "bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800"
                            : "bg-gray-100 text-gray-700 dark:bg-surface dark:text-gray-300"
                        }`}
                      >
                        {v}
                      </span>
                    );
                  })}
                </div>
                {anomalyResult.stats && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>μ = {Number(anomalyResult.stats.mean).toFixed(1)}</span>
                    <span>σ = {Number(anomalyResult.stats.stdDev ?? anomalyResult.stats.std).toFixed(1)}</span>
                    <span>n = {anomalyResult.stats.count ?? anomalyResult.values?.length}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          Section 3 — EHR Summarization
         ═══════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={<FileText className="h-5 w-5" />} title="EHR Summarization" badge="GPT-4o" />
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className={CARD_CLS + " space-y-4"}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Model Details</h3>
            <InfoRow label="LLM" value="Azure OpenAI GPT-4o (2024-08-06)" />
            <InfoRow label="Purpose" value="Structured medical note summarization" />
            <InfoRow label="Languages" value="EN, ES, FR, DE, ZH, AR, HI" />
            <InfoRow label="Privacy" value="EHR encrypted AES-256-GCM, stored on IPFS" />
            <InfoRow label="On-chain" value="Summary hash anchored to EHRStorage contract" />
          </div>

          <div className={CARD_CLS + " space-y-4"}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Try It</h3>
            <label className="space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Medical Notes</span>
              <textarea rows={5} className={INPUT_CLS} value={ehrText} onChange={(e) => setEhrText(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Language</span>
              <select className={INPUT_CLS} value={summaryLang} onChange={(e) => setSummaryLang(e.target.value)}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            <button className={BTN_CLS} disabled={summaryLoading || !ehrText.trim()} onClick={runSummarize}>
              {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Summarize
            </button>

            {summaryResult && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-surface">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">AI Summary</p>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800 dark:prose-invert dark:text-gray-200">
                  {summaryResult}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          Section 4 — Visit Summary Generation
         ═══════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={<Stethoscope className="h-5 w-5" />} title="Visit Summary Generation" badge="GPT-4o" />
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className={CARD_CLS + " space-y-4"}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Model Details</h3>
            <InfoRow label="LLM" value="Azure OpenAI GPT-4o" />
            <InfoRow label="Pre-Visit" value="Contextual prep from on-chain EHR records" />
            <InfoRow label="Post-Visit" value="SOAP documentation from visit notes" />
            <InfoRow label="On-chain" value="Summary hash stored in EHRStorage" />
            <div className="mt-2 rounded-lg bg-accent/5 p-3 dark:bg-accent/10">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <strong className="text-accent dark:text-accent-light">Pre-Visit:</strong> retrieves patient EHR records from blockchain, generates overview of conditions, meds, labs, and focus areas.
              </p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <strong className="text-accent dark:text-accent-light">Post-Visit:</strong> takes clinician notes + on-chain history, produces SOAP note with billing codes, referrals, and follow-up plan.
              </p>
            </div>
          </div>

          <div className={CARD_CLS + " space-y-4"}>
            {/* Tabs */}
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-border dark:bg-surface">
              {(["pre", "post"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setVisitTab(t); setVisitResult(null); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    visitTab === t
                      ? "bg-white text-gray-900 shadow-sm dark:bg-surface dark:text-white"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {t === "pre" ? "Pre-Visit" : "Post-Visit"}
                </button>
              ))}
            </div>

            <label className="space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Patient Address</span>
              <input className={INPUT_CLS} placeholder="0x..." value={visitAddress} onChange={(e) => setVisitAddress(e.target.value)} />
            </label>

            {visitTab === "post" && (
              <label className="space-y-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Visit Notes</span>
                <textarea rows={4} className={INPUT_CLS} placeholder="Chief complaint, findings, plan..." value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} />
              </label>
            )}

            <label className="space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Language</span>
              <select className={INPUT_CLS} value={visitLang} onChange={(e) => setVisitLang(e.target.value)}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>

            <button className={BTN_CLS} disabled={visitLoading || !visitAddress.trim()} onClick={runVisit}>
              {visitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              Generate {visitTab === "pre" ? "Pre" : "Post"}-Visit Summary
            </button>

            {visitResult && (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-border dark:bg-surface">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {visitTab === "pre" ? "Pre-Visit" : "Post-Visit"} Summary
                </p>
                <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                  {typeof visitResult === "string" ? visitResult : JSON.stringify(visitResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          Section 5 — Architecture Overview
         ═══════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={<Server className="h-5 w-5" />} title="Model Architecture & Data Flow" badge="Overview" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <Sparkles className="h-6 w-6" />,
              title: "Azure OpenAI GPT-4o",
              lines: ["EHR summarization", "Visit summary (pre + post)", "Multi-language output", "Temperature 0.3 for precision"],
              chain: "Hash → EHRStorage",
            },
            {
              icon: <TrendingUp className="h-6 w-6" />,
              title: "Logistic Regression",
              lines: ["10-feature risk model", "Scikit-learn coefficient parity", "Sigmoid probability → bps", "Real-time inference"],
              chain: "bps → InsurancePolicy.adjustPremium",
            },
            {
              icon: <AlertTriangle className="h-6 w-6" />,
              title: "Z-Score Detection",
              lines: ["Statistical anomaly detector", "Threshold |z| > 2", "5 vital sign metrics", "Streaming-capable"],
              chain: "Flag → CRE Workflow Alert",
            },
            {
              icon: <Lock className="h-6 w-6" />,
              title: "IPFS + AES-256-GCM",
              lines: ["Client-side encryption", "IPFS content addressing", "CID stored on-chain", "Zero-knowledge compatible"],
              chain: "CID → EHRStorage.ipfsCid",
            },
          ].map((card) => (
            <div key={card.title} className={CARD_CLS + " flex flex-col justify-between space-y-3"}>
              <div>
                <div className="mb-3 inline-flex rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 p-2.5 text-primary dark:from-primary/20 dark:to-accent/20 dark:text-primary-light">
                  {card.icon}
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{card.title}</h4>
                <ul className="mt-2 space-y-1">
                  {card.lines.map((l) => (
                    <li key={l} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary dark:text-primary-light" /> {l}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md bg-primary/5 px-3 py-2 dark:bg-primary/10">
                <p className="text-[11px] font-medium text-primary dark:text-primary-light">
                  <Database className="mr-1 inline h-3 w-3" />
                  {card.chain}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* data-flow diagram (text) */}
        <div className={CARD_CLS + " mt-4"}>
          <h4 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">End-to-End Data Flow</h4>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
            {[
              { label: "Patient Input", color: "bg-primary/10 text-primary dark:text-primary-light" },
              { label: "→" },
              { label: "AES-256-GCM Encrypt", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
              { label: "→" },
              { label: "IPFS Storage", color: "bg-accent/10 text-accent dark:text-accent-light" },
              { label: "→" },
              { label: "AI Inference", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
              { label: "→" },
              { label: "On-Chain Anchor", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
              { label: "→" },
              { label: "Chainlink CCIP / CRE", color: "bg-primary/10 text-primary dark:text-primary-light" },
            ].map((step, i) =>
              step.color ? (
                <span key={i} className={`rounded-full px-3 py-1.5 ${step.color}`}>{step.label}</span>
              ) : (
                <span key={i} className="text-gray-400">→</span>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── sub-components ──────────────────────────── */
function SectionHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-primary/10 p-2 text-primary dark:bg-primary/20 dark:text-primary-light">{icon}</div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <span className="rounded-full bg-accent/10 px-3 py-0.5 text-xs font-semibold text-accent dark:bg-accent/20 dark:text-accent-light">{badge}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  );
}
