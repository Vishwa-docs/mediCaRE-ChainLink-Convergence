"use client";

import Badge from "@/components/shared/Badge";
import Card from "@/components/shared/Card";

interface HealthPassportData {
  tokenId?: number;
  patientName: string;
  bloodType: string;
  allergies: string[];
  currentMedications: { name: string; dosage: string }[];
  emergencyContacts: { name: string; phone: string; relationship: string }[];
  criticalConditions: string[];
  doNotResuscitate: boolean;
  organDonor: boolean;
  lastUpdated: string;
  chainSynced?: string[];
}

interface HealthPassportCardProps {
  passport: HealthPassportData;
  className?: string;
  compact?: boolean;
}

export default function HealthPassportCard({
  passport,
  className = "",
  compact = false,
}: HealthPassportCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-white to-emerald-50 p-6 shadow-lg dark:from-primary/10 dark:via-surface dark:to-emerald-900/10 ${className}`}
    >
      {/* NFT Badge */}
      <div className="absolute right-4 top-4">
        <Badge variant="purple">
          ERC-721 #{passport.tokenId ?? "—"}
        </Badge>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-900/30">
          🏥
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Emergency Health Passport
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Dynamic NFT &middot; Cross-Chain via CCIP
          </p>
        </div>
      </div>

      {/* Vitals grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Blood type — always prominent */}
        <div className="col-span-1 rounded-lg bg-red-50 px-4 py-3 dark:bg-red-900/20">
          <p className="text-xs font-medium uppercase text-red-500">Blood Type</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">
            {passport.bloodType}
          </p>
        </div>

        {/* Flags */}
        <div className="col-span-1 flex flex-col gap-1 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">DNR</span>
            <Badge variant={passport.doNotResuscitate ? "danger" : "success"}>
              {passport.doNotResuscitate ? "Yes" : "No"}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Organ Donor</span>
            <Badge variant={passport.organDonor ? "success" : "default"}>
              {passport.organDonor ? "Yes" : "No"}
            </Badge>
          </div>
        </div>
      </div>

      {!compact && (
        <>
          {/* Allergies */}
          {passport.allergies.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase text-amber-600 dark:text-amber-400">
                ⚠ Allergies
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {passport.allergies.map((a) => (
                  <Badge key={a} variant="warning">{a}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Current medications */}
          {passport.currentMedications.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase text-gray-500">Current Medications</p>
              <div className="mt-1 space-y-1">
                {passport.currentMedications.map((med, i) => (
                  <p key={i} className="text-sm text-gray-700 dark:text-gray-300">
                    {med.name} — <span className="text-gray-500">{med.dosage}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Critical conditions */}
          {passport.criticalConditions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase text-red-500">Critical Conditions</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {passport.criticalConditions.map((c) => (
                  <Badge key={c} variant="danger">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Emergency contacts */}
          {passport.emergencyContacts.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase text-gray-500">Emergency Contacts</p>
              <div className="mt-1 space-y-1">
                {passport.emergencyContacts.map((c, i) => (
                  <p key={i} className="text-sm text-gray-700 dark:text-gray-300">
                    {c.name} ({c.relationship}) — <span className="font-mono text-xs">{c.phone}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Chain sync status */}
          {passport.chainSynced && passport.chainSynced.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">Synced to:</span>
              {passport.chainSynced.map((chain) => (
                <Badge key={chain} variant="info">{chain}</Badge>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-right text-xs text-gray-400">
        Updated: {new Date(passport.lastUpdated).toLocaleDateString()}
      </p>
    </div>
  );
}
