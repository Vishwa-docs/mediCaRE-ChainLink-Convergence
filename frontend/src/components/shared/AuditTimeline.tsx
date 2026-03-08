"use client";

import Badge from "@/components/shared/Badge";

interface AuditEvent {
  id: string;
  type: "RECORD_CREATE" | "CONSENT_GRANT" | "CONSENT_REVOKE" | "AI_DECISION" | "EMERGENCY_ACCESS" | "CROSS_CHAIN_PAYOUT" | "KEY_ROTATION" | "DATA_ACCESS";
  actor: string;
  subject: string;
  description: string;
  timestamp: string;
  txHash?: string;
  metadata?: Record<string, string>;
}

interface AuditTimelineProps {
  events: AuditEvent[];
  className?: string;
  maxDisplay?: number;
  onExport?: () => void;
}

const typeConfig: Record<AuditEvent["type"], { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple"; icon: string }> = {
  RECORD_CREATE: { label: "Record Created", variant: "info", icon: "📋" },
  CONSENT_GRANT: { label: "Consent Granted", variant: "success", icon: "✅" },
  CONSENT_REVOKE: { label: "Consent Revoked", variant: "warning", icon: "🔒" },
  AI_DECISION: { label: "AI Decision", variant: "purple", icon: "🤖" },
  EMERGENCY_ACCESS: { label: "Emergency Access", variant: "danger", icon: "🚨" },
  CROSS_CHAIN_PAYOUT: { label: "Cross-Chain Payout", variant: "info", icon: "🔗" },
  KEY_ROTATION: { label: "Key Rotation", variant: "default", icon: "🔑" },
  DATA_ACCESS: { label: "Data Access", variant: "default", icon: "📊" },
};

export default function AuditTimeline({
  events,
  className = "",
  maxDisplay = 20,
  onExport,
}: AuditTimelineProps) {
  const displayed = events.slice(0, maxDisplay);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-6 dark:border-border dark:bg-surface ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Audit Trail
        </h3>
        {onExport && (
          <button
            onClick={onExport}
            className="text-xs text-primary hover:text-primary-dark dark:text-primary-light"
          >
            Export CSV
          </button>
        )}
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-4">
          {displayed.map((event) => {
            const cfg = typeConfig[event.type] ?? typeConfig.DATA_ACCESS;
            return (
              <div key={event.id} className="relative flex gap-4 pl-10">
                {/* Dot on timeline */}
                <div className="absolute left-2.5 top-1.5 flex h-3 w-3 items-center justify-center">
                  <div className={`h-3 w-3 rounded-full border-2 border-white dark:border-surface ${
                    event.type === "EMERGENCY_ACCESS" ? "bg-red-500" :
                    event.type === "AI_DECISION" ? "bg-purple-500" :
                    event.type === "CONSENT_GRANT" ? "bg-emerald-500" :
                    "bg-primary"
                  }`} />
                </div>

                <div className="flex-1 min-w-0 rounded-lg border border-gray-100 px-4 py-3 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cfg.icon}</span>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    <span className="ml-auto text-xs text-gray-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                    {event.description}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span>Actor: {event.actor.slice(0, 8)}...{event.actor.slice(-4)}</span>
                    {event.txHash && (
                      <span className="font-mono">
                        Tx: {event.txHash.slice(0, 10)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {events.length > maxDisplay && (
        <p className="mt-4 text-center text-xs text-gray-400">
          Showing {maxDisplay} of {events.length} events
        </p>
      )}
    </div>
  );
}
