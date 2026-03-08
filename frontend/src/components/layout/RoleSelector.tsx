"use client";

import { useState } from "react";

type Role = "patient" | "doctor" | "insurer" | "admin" | "paramedic" | "researcher";

interface RoleSelectorProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  className?: string;
}

const roleConfig: Record<Role, { label: string; icon: string; description: string; color: string }> = {
  patient: {
    label: "Patient",
    icon: "🧑",
    description: "View records, manage consent, file claims",
    color: "bg-emerald-500",
  },
  doctor: {
    label: "Doctor",
    icon: "👨‍⚕️",
    description: "Access records, write summaries, verify credentials",
    color: "bg-blue-500",
  },
  insurer: {
    label: "Insurer",
    icon: "🏦",
    description: "Process claims, manage treasury, view analytics",
    color: "bg-purple-500",
  },
  admin: {
    label: "Admin",
    icon: "⚙️",
    description: "Governance, role management, system config",
    color: "bg-gray-700",
  },
  paramedic: {
    label: "Paramedic",
    icon: "🚑",
    description: "Emergency access, health passports",
    color: "bg-red-500",
  },
  researcher: {
    label: "Researcher",
    icon: "🔬",
    description: "Clinical trials, data requests, IRB submissions",
    color: "bg-amber-500",
  },
};

export default function RoleSelector({
  currentRole,
  onRoleChange,
  className = "",
}: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const current = roleConfig[currentRole];

  return (
    <div className={`relative ${className}`}>
      {/* Current role button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-surface dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <svg
          className={`ml-1 h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-surface">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Switch Role (Demo)
            </p>
            {(Object.entries(roleConfig) as [Role, typeof roleConfig[Role]][]).map(
              ([role, config]) => (
                <button
                  key={role}
                  onClick={() => {
                    onRoleChange(role);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    role === currentRole
                      ? "bg-primary/10 dark:bg-primary/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.color} text-white text-sm`}>
                    {config.icon}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${
                      role === currentRole ? "text-primary" : "text-gray-800 dark:text-gray-200"
                    }`}>
                      {config.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {config.description}
                    </p>
                  </div>
                  {role === currentRole && (
                    <svg className="ml-auto h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
