"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  Shield,
  Activity,
  Phone,
  Heart,
  Loader2,
} from "lucide-react";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import HealthPassportCard from "@/components/records/HealthPassportCard";
import AuditTimeline from "@/components/shared/AuditTimeline";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────

interface EmergencyAccessResult {
  granted: boolean;
  bloodType: string;
  allergies: string[];
  currentMedications: { name: string; dosage: string }[];
  emergencyContacts: { name: string; phone: string; relationship: string }[];
  criticalConditions: string[];
  doNotResuscitate: boolean;
  organDonor: boolean;
  auditTxHash: string;
  expiresAt: string;
}

// ── Demo data ──────────────────────────────────

const DEMO_REASON_CODES = [
  { code: "CARDIAC_ARREST", label: "Cardiac Arrest", icon: "🫀" },
  { code: "ANAPHYLAXIS", label: "Anaphylaxis", icon: "💉" },
  { code: "TRAUMA", label: "Trauma / Accident", icon: "🚑" },
  { code: "UNCONSCIOUS", label: "Unconscious Patient", icon: "😶" },
  { code: "OTHER", label: "Other Emergency", icon: "🏥" },
];

const DEMO_RESULT: EmergencyAccessResult = {
  granted: true,
  bloodType: "O+",
  allergies: ["Penicillin", "Latex", "Sulfa drugs"],
  currentMedications: [
    { name: "Metformin", dosage: "500mg twice daily" },
    { name: "Lisinopril", dosage: "10mg once daily" },
    { name: "Atorvastatin", dosage: "20mg at bedtime" },
  ],
  emergencyContacts: [
    { name: "Jane Doe", phone: "+1-555-0123", relationship: "Spouse" },
    { name: "John Doe Jr.", phone: "+1-555-0456", relationship: "Son" },
  ],
  criticalConditions: ["Type 2 Diabetes", "Hypertension"],
  doNotResuscitate: false,
  organDonor: true,
  auditTxHash: "0xabc123def456789...immutable_audit_trail",
  expiresAt: new Date(Date.now() + 900000).toISOString(),
};

const DEMO_AUDIT_EVENTS = [
  {
    id: "ea-1",
    type: "EMERGENCY_ACCESS" as const,
    actor: "0xParamedic1234567890abcdef",
    subject: "0xPatient1234567890abcdef",
    description: "Glass-break emergency access — Cardiac Arrest. Blood type, allergies, medications retrieved.",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    txHash: "0xabc123def456789...",
  },
  {
    id: "ea-2",
    type: "EMERGENCY_ACCESS" as const,
    actor: "0xParamedic9876543210fedcba",
    subject: "0xPatient5678901234abcdef",
    description: "Glass-break emergency access — Unconscious Patient. Full emergency passport accessed.",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    txHash: "0xdef456789abc123...",
  },
];

// ── Page Component ─────────────────────────────

export default function EmergencyPage() {
  const [patientId, setPatientId] = useState("");
  const [reasonCode, setReasonCode] = useState("CARDIAC_ARREST");
  const [reasonText, setReasonText] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [result, setResult] = useState<EmergencyAccessResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleGlassBreak = async () => {
    if (!patientId) return toast.error("Enter patient address");
    if (!reasonText) return toast.error("Enter reason for emergency access");

    setRequesting(true);
    try {
      // Simulate CRE emergency-access workflow call
      await new Promise((r) => setTimeout(r, 2500));
      setResult(DEMO_RESULT);
      setCountdown(900); // 15 min

      toast.success("Emergency access granted — 15 minute window");

      // Start countdown timer
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 0) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      toast.error("Emergency access denied");
    } finally {
      setRequesting(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Emergency Glass-Break Access
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bypass consent for life-threatening emergencies &middot; Immutable audit trail via CRE
          </p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              This action bypasses patient consent
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Every glass-break is recorded on-chain with an immutable audit trail.
              Misuse will trigger automatic compliance review. Only use in genuine
              life-threatening emergencies where patient is unable to grant consent.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Left: Request Form ─── */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Request Emergency Access
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Patient Address
              </label>
              <input
                type="text"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Emergency Type
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DEMO_REASON_CODES.map((reason) => (
                  <button
                    key={reason.code}
                    onClick={() => setReasonCode(reason.code)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      reasonCode === reason.code
                        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span>{reason.icon}</span>
                    <span className="text-xs">{reason.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason for Access
              </label>
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Describe the emergency situation..."
                rows={3}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>

            <Button
              onClick={handleGlassBreak}
              disabled={requesting}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {requesting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Requesting via CRE...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Trigger Glass-Break Access
                </span>
              )}
            </Button>
          </div>
        </Card>

        {/* ── Right: Result / Passport ─── */}
        <div className="space-y-4">
          {countdown !== null && countdown > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Access window expires in
                </span>
              </div>
              <span className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300">
                {formatCountdown(countdown)}
              </span>
            </div>
          )}

          {result ? (
            <HealthPassportCard
              passport={{
                tokenId: 42,
                patientName: "Patient (Emergency)",
                bloodType: result.bloodType,
                allergies: result.allergies,
                currentMedications: result.currentMedications,
                emergencyContacts: result.emergencyContacts,
                criticalConditions: result.criticalConditions,
                doNotResuscitate: result.doNotResuscitate,
                organDonor: result.organDonor,
                lastUpdated: new Date().toISOString(),
                chainSynced: ["Sepolia", "Base Sepolia"],
              }}
            />
          ) : (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <Heart className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No active emergency access
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Use the form to trigger glass-break access
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* ── Audit History ─── */}
      <AuditTimeline
        events={DEMO_AUDIT_EVENTS}
        onExport={() => toast.success("Audit trail exported")}
      />
    </div>
  );
}
