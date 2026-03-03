"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";

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

// ─── Mock Data ──────────────────────────────────────────────────────

const MOCK_MEDICATIONS: MedicationEntry[] = [
  {
    id: "med-1",
    name: "Metformin",
    dosage: "500mg",
    schedule: "Twice daily",
    nextDose: "2:00 PM",
    taken: true,
  },
  {
    id: "med-2",
    name: "Lisinopril",
    dosage: "10mg",
    schedule: "Once daily",
    nextDose: "8:00 AM",
    taken: true,
  },
  {
    id: "med-3",
    name: "Atorvastatin",
    dosage: "20mg",
    schedule: "Once daily (evening)",
    nextDose: "9:00 PM",
    taken: false,
  },
];

const MOCK_RECORDS: HealthRecord[] = [
  {
    id: "rec-1",
    type: "LAB",
    date: "2026-02-28",
    provider: "Dr. Smith",
    summary: "Blood panel — glucose within target, A1C improved to 6.8%.",
  },
  {
    id: "rec-2",
    type: "IMAGING",
    date: "2026-02-15",
    provider: "City Radiology",
    summary: "Chest X-ray — no abnormalities detected.",
  },
  {
    id: "rec-3",
    type: "PRESCRIPTION",
    date: "2026-02-10",
    provider: "Dr. Smith",
    summary: "Metformin renewed for 90 days, dosage unchanged.",
  },
];

const MOCK_REMINDERS: WellnessReminder[] = [
  {
    id: "rem-1",
    title: "Hydration Check",
    description: "Drink at least 8 glasses of water today",
    time: "Throughout the day",
    completed: false,
  },
  {
    id: "rem-2",
    title: "30-Min Walk",
    description: "Light exercise improves glucose metabolism",
    time: "5:00 PM",
    completed: false,
  },
  {
    id: "rem-3",
    title: "Blood Pressure",
    description: "Take your evening BP reading",
    time: "7:00 PM",
    completed: false,
  },
];

// ─── Components ─────────────────────────────────────────────────────

function VerificationBanner({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <CheckCircle className="h-5 w-5 flex-shrink-0" />
        <span className="font-medium">World ID Verified</span>
        <span className="ml-auto text-xs text-emerald-500">Proof-of-personhood active</span>
      </div>
    );
  }

  return (
    <button className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700 active:bg-blue-100">
      <Shield className="h-5 w-5 flex-shrink-0" />
      <span className="font-medium">Verify with World ID</span>
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
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
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
        <p className={`font-medium ${med.taken ? "text-gray-400 line-through" : "text-gray-900"}`}>
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
    LAB: "bg-blue-100 text-blue-700",
    IMAGING: "bg-purple-100 text-purple-700",
    PRESCRIPTION: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
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
      <p className="text-sm text-gray-800">{record.summary}</p>
      <p className="mt-1 text-xs text-gray-500">{record.provider}</p>
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
      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm active:bg-gray-50"
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
        <p className={`text-sm font-medium ${reminder.completed ? "text-gray-400 line-through" : "text-gray-900"}`}>
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
  const [verified, setVerified] = useState(false);
  const [medications, setMedications] = useState(MOCK_MEDICATIONS);
  const [reminders, setReminders] = useState(MOCK_REMINDERS);

  // Simulate World ID verification after mount (in production this would
  // come from the MiniKit SDK bridge)
  useEffect(() => {
    const timer = setTimeout(() => setVerified(true), 1500);
    return () => clearTimeout(timer);
  }, []);

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
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50">
      {/* ── Header ──────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 px-4 pb-3 pt-safe-top backdrop-blur-md">
        <div className="flex items-center gap-3 pt-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              medi<span className="text-blue-600">CaRE</span>
            </h1>
            <p className="text-xs text-gray-500">Your health, on-chain</p>
          </div>
          <div className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
            <User className="h-4 w-4 text-gray-600" />
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────── */}
      <main className="flex-1 space-y-4 px-4 py-4">
        {/* Verification banner */}
        <VerificationBanner verified={verified} />

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-600">
              {medsTaken}/{medications.length}
            </p>
            <p className="text-xs text-gray-500">Meds taken</p>
          </div>
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-purple-600">
              {MOCK_RECORDS.length}
            </p>
            <p className="text-xs text-gray-500">Records</p>
          </div>
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">
              {remindersCompleted}/{reminders.length}
            </p>
            <p className="text-xs text-gray-500">Tasks</p>
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
            <h2 className="text-sm font-semibold text-gray-700">
              Today&apos;s Medications
            </h2>
            {medications.map((med) => (
              <MedicationCard key={med.id} med={med} onToggle={toggleMed} />
            ))}
          </section>
        )}

        {tab === "records" && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Recent Records
            </h2>
            {MOCK_RECORDS.map((rec) => (
              <RecordCard key={rec.id} record={rec} />
            ))}
          </section>
        )}

        {tab === "wellness" && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
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
      <nav className="sticky bottom-0 z-30 border-t border-gray-200 bg-white pb-safe-bottom">
        <div className="flex justify-around py-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors ${
                tab === key
                  ? "font-semibold text-blue-600"
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
