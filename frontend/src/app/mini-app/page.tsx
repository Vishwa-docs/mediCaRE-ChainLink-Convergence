"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Heart,
  FileText,
  Clock,
  Shield,
  CheckCircle,
  Bell,
  Pill,
  Calendar,
  ChevronRight,
  Activity,
  User,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useContract } from "@/hooks/useContract";
import { useWalletAddress } from "@/hooks/useContract";
import { useAuth } from "@/contexts/AuthContext";
import { ethers } from "ethers";

// ─── Types ──────────────────────────────────────────────────────────

interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  schedule: string;
  nextDose: string;
  taken: boolean;
}

interface HealthRecord {
  id: string;
  type: string;
  date: string;
  provider: string;
  summary: string;
}

interface WellnessReminder {
  id: string;
  title: string;
  description: string;
  time: string;
  completed: boolean;
}

// ─── Sample medication/wellness data (local/user-managed) ───────────
const SAMPLE_MEDICATIONS: MedicationEntry[] = [
  { id: "1", name: "Metformin", dosage: "500mg", schedule: "Twice daily", nextDose: "6:00 PM", taken: false },
  { id: "2", name: "Lisinopril", dosage: "10mg", schedule: "Once daily", nextDose: "8:00 AM", taken: true },
  { id: "3", name: "Atorvastatin", dosage: "20mg", schedule: "Bedtime", nextDose: "10:00 PM", taken: false },
];

const SAMPLE_REMINDERS: WellnessReminder[] = [
  { id: "1", title: "Blood pressure check", description: "Record morning BP", time: "8:00 AM", completed: true },
  { id: "2", title: "30-min walk", description: "Daily exercise goal", time: "12:00 PM", completed: false },
  { id: "3", title: "Glucose reading", description: "Pre-dinner check", time: "5:30 PM", completed: false },
  { id: "4", title: "Hydration goal", description: "8 glasses of water", time: "All day", completed: false },
];

// ─── Components ─────────────────────────────────────────────────────

function VerificationBanner({ verified, onVerify, loading }: { verified: boolean; onVerify: () => void; loading?: boolean }) {
  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
        <CheckCircle className="h-5 w-5 flex-shrink-0" />
        <span className="font-medium">World ID Verified</span>
        <span className="ml-auto text-xs text-emerald-500">Proof-of-personhood active</span>
      </div>
    );
  }

  return (
    <button
      onClick={onVerify}
      disabled={loading}
      className="flex w-full items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary active:bg-primary/15 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" /> : <Shield className="h-5 w-5 flex-shrink-0" />}
      <span className="font-medium">{loading ? "Verifying…" : "Verify with World ID"}</span>
      <ChevronRight className="ml-auto h-4 w-4" />
    </button>
  );
}

function MedicationCard({
  med,
  onToggle,
}: {
  med: MedicationEntry;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-border bg-white dark:bg-surface p-4 shadow-sm">
      <button
        onClick={() => onToggle(med.id)}
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
          med.taken
            ? "bg-emerald-100 text-emerald-600"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        {med.taken ? (
          <CheckCircle className="h-5 w-5" />
        ) : (
          <Pill className="h-5 w-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${med.taken ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}>
          {med.name} — {med.dosage}
        </p>
        <p className="text-xs text-gray-500">
          {med.schedule} · Next: {med.nextDose}
        </p>
      </div>
    </div>
  );
}

function RecordCard({ record }: { record: HealthRecord }) {
  const typeColors: Record<string, string> = {
    LAB: "bg-primary/15 text-primary",
    IMAGING: "bg-purple-100 text-purple-700",
    PRESCRIPTION: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="rounded-xl border border-gray-100 dark:border-border bg-white dark:bg-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            typeColors[record.type] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          {record.type}
        </span>
        <span className="text-xs text-gray-400">{record.date}</span>
      </div>
      <p className="text-sm text-gray-800 dark:text-gray-200">{record.summary}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{record.provider}</p>
    </div>
  );
}

function ReminderItem({
  reminder,
  onToggle,
}: {
  reminder: WellnessReminder;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(reminder.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 dark:border-border bg-white dark:bg-surface p-3 text-left shadow-sm active:bg-gray-50 dark:active:bg-surface"
    >
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
          reminder.completed
            ? "bg-emerald-100 text-emerald-600"
            : "bg-orange-100 text-orange-600"
        }`}
      >
        {reminder.completed ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${reminder.completed ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}>
          {reminder.title}
        </p>
        <p className="text-xs text-gray-500">{reminder.time}</p>
      </div>
    </button>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function MiniAppPage() {
  const [tab, setTab] = useState<"meds" | "records" | "wellness">("meds");
  const { isWorldIDVerified, simulateWorldID, user } = useAuth();
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [medications, setMedications] = useState(SAMPLE_MEDICATIONS);
  const [reminders, setReminders] = useState(SAMPLE_REMINDERS);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [policyCount, setPolicyCount] = useState(0);

  const ehrContract = useContract("EHRStorage");
  const insuranceContract = useContract("InsurancePolicy");
  const address = useWalletAddress();

  // Fetch real on-chain records
  const fetchRecords = useCallback(async () => {
    if (!address) { setLoadingRecords(false); return; }
    setLoadingRecords(true);
    try {
      const recordIds = await ehrContract.read<bigint[]>("getPatientRecords", address);
      const ids = recordIds ? Array.from(recordIds).map(Number) : [];
      const recordPromises = ids.slice(0, 10).map((id) =>
        ehrContract.read<any>("getRecord", id).catch(() => null)
      );
      const results = await Promise.all(recordPromises);
      const items: HealthRecord[] = results
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .map((r) => ({
          id: String(Number(r.recordId ?? r[0])),
          type: r.recordType ?? r[4] ?? "GENERAL",
          date: new Date(Number(r.createdAt ?? r[5]) * 1000).toLocaleDateString(),
          provider: `0x${(r.patient ?? r[1] ?? "").toString().slice(2, 10)}...`,
          summary: `On-chain record #${Number(r.recordId ?? r[0])} — ${r.recordType ?? r[4] ?? "Medical Record"}`,
        }));
      setRecords(items);

      // Also get policy count
      const policies = await insuranceContract.read<bigint>("totalPolicies").catch(() => BigInt(0));
      setPolicyCount(Number(policies));
    } catch {
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [ehrContract, insuranceContract, address]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // World ID verify via auth context (dev-mode simulated endpoint)
  const handleVerifyWorldID = async () => {
    setVerifyLoading(true);
    try {
      await simulateWorldID();
    } catch {
      // toast handled upstream
    } finally {
      setVerifyLoading(false);
    }
  };

  const toggleMed = (id: string) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, taken: !m.taken } : m)),
    );
  };

  const toggleReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r)),
    );
  };

  const medsTaken = medications.filter((m) => m.taken).length;
  const remindersCompleted = reminders.filter((r) => r.completed).length;

  const tabs = [
    { key: "meds" as const, label: "Medications", icon: Pill },
    { key: "records" as const, label: "Records", icon: FileText },
    { key: "wellness" as const, label: "Wellness", icon: Activity },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50 dark:bg-background">
      {/* ── Header ──────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-border bg-white/90 dark:bg-surface/90 px-4 pb-3 pt-safe-top backdrop-blur-md">
        <div className="flex items-center gap-3 pt-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              medi<span className="text-primary">CaRE</span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Your health, on-chain</p>
          </div>
          <div className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-surface">
            <User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────── */}
      <main className="flex-1 space-y-4 px-4 py-4">
        {/* Verification banner */}
        <VerificationBanner verified={isWorldIDVerified} onVerify={handleVerifyWorldID} loading={verifyLoading} />

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white dark:bg-surface p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-primary">
              {medsTaken}/{medications.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Meds taken</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-surface p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {records.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Records</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-surface p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {policyCount}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Policies</p>
          </div>
        </div>

        {/* Upcoming alert */}
        {medications.some((m) => !m.taken) && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Upcoming medication</p>
              <p className="text-xs text-amber-600">
                {medications.find((m) => !m.taken)?.name} —{" "}
                {medications.find((m) => !m.taken)?.nextDose}
              </p>
            </div>
          </div>
        )}

        {/* Tab content */}
        {tab === "meds" && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Today&apos;s Medications
            </h2>
            {medications.map((med) => (
              <MedicationCard key={med.id} med={med} onToggle={toggleMed} />
            ))}
          </section>
        )}

        {tab === "records" && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              On-Chain Records
            </h2>
            {loadingRecords ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="ml-2 text-sm text-gray-500">Loading from chain...</span>
              </div>
            ) : records.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No records yet. Upload records from the Health Records page.</p>
            ) : records.map((rec) => (
              <RecordCard key={rec.id} record={rec} />
            ))}
          </section>
        )}

        {tab === "wellness" && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Wellness Reminders
            </h2>
            {reminders.map((rem) => (
              <ReminderItem
                key={rem.id}
                reminder={rem}
                onToggle={toggleReminder}
              />
            ))}
          </section>
        )}
      </main>

      {/* ── Bottom Tab Bar ──────────────────────── */}
      <nav className="sticky bottom-0 z-30 border-t border-gray-200 dark:border-border bg-white dark:bg-surface pb-safe-bottom">
        <div className="flex justify-around py-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors ${
                tab === key
                  ? "font-semibold text-primary"
                  : "text-gray-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
