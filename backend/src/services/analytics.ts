import { createLogger } from "../utils/logging";

const log = createLogger("service:analytics");

// ─── Types ──────────────────────────────────────────────────────────

export enum EventCategory {
  RECORD = "record",
  INSURANCE = "insurance",
  SUPPLY_CHAIN = "supply_chain",
  CREDENTIAL = "credential",
  GOVERNANCE = "governance",
  AUTH = "auth",
  SYSTEM = "system",
}

export interface AnalyticsEvent {
  /** Event name — e.g. "record.created", "claim.submitted". */
  event: string;
  /** High-level category for grouping / filtering. */
  category: EventCategory;
  /** Actor address or user id (anonymised for HIPAA). */
  actor?: string;
  /** Arbitrary key–value properties. */
  properties?: Record<string, string | number | boolean>;
  /** ISO-8601 timestamp (defaults to now). */
  timestamp?: string;
}

interface AggregatedMetrics {
  totalEvents: number;
  byCategory: Record<string, number>;
  byEvent: Record<string, number>;
  windowStart: string;
  windowEnd: string;
}

// ─── In-memory Event Store (swap for ClickHouse / BigQuery in prod) ─

const _events: AnalyticsEvent[] = [];
const MAX_EVENTS = 50_000;

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Track an analytics event.
 *
 * Events are stored in-memory for the MVP. In production, push to an
 * analytics pipeline (Segment, Amplitude, or a self-hosted Plausible
 * instance).
 */
export function track(event: AnalyticsEvent): void {
  const enriched: AnalyticsEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  _events.push(enriched);

  // Ring-buffer: drop oldest events when the cap is exceeded.
  if (_events.length > MAX_EVENTS) {
    _events.splice(0, _events.length - MAX_EVENTS);
  }

  log.debug("Analytics event tracked", {
    event: enriched.event,
    category: enriched.category,
    actor: enriched.actor?.slice(0, 10),
  });
}

/**
 * Retrieve aggregated metrics for a specified time window.
 *
 * @param windowMinutes - Look-back window in minutes (default 60).
 */
export function getMetrics(windowMinutes = 60): AggregatedMetrics {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowMinutes * 60_000);

  const filtered = _events.filter((e) => {
    const ts = new Date(e.timestamp!);
    return ts >= windowStart && ts <= windowEnd;
  });

  const byCategory: Record<string, number> = {};
  const byEvent: Record<string, number> = {};

  for (const evt of filtered) {
    byCategory[evt.category] = (byCategory[evt.category] ?? 0) + 1;
    byEvent[evt.event] = (byEvent[evt.event] ?? 0) + 1;
  }

  return {
    totalEvents: filtered.length,
    byCategory,
    byEvent,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}

/**
 * Retrieve the most recent N events (for the admin dashboard).
 */
export function getRecentEvents(limit = 50): AnalyticsEvent[] {
  return _events.slice(-limit).reverse();
}

/**
 * Flush all stored events (useful in tests).
 */
export function flush(): void {
  _events.length = 0;
  log.info("Analytics event store flushed");
}

// ─── Convenience Trackers ───────────────────────────────────────────

export function trackRecordCreated(
  actor: string,
  recordId: number,
  recordType: string,
): void {
  track({
    event: "record.created",
    category: EventCategory.RECORD,
    actor,
    properties: { recordId, recordType },
  });
}

export function trackRecordUpdated(actor: string, recordId: number): void {
  track({
    event: "record.updated",
    category: EventCategory.RECORD,
    actor,
    properties: { recordId },
  });
}

export function trackPolicyCreated(
  actor: string,
  policyId: number,
  coverageAmount: number,
): void {
  track({
    event: "policy.created",
    category: EventCategory.INSURANCE,
    actor,
    properties: { policyId, coverageAmount },
  });
}

export function trackClaimSubmitted(
  actor: string,
  claimId: number,
  policyId: number,
  amount: number,
): void {
  track({
    event: "claim.submitted",
    category: EventCategory.INSURANCE,
    actor,
    properties: { claimId, policyId, amount },
  });
}

export function trackClaimProcessed(
  actor: string,
  claimId: number,
  approved: boolean,
): void {
  track({
    event: "claim.processed",
    category: EventCategory.INSURANCE,
    actor,
    properties: { claimId, approved },
  });
}

export function trackBatchCreated(
  actor: string,
  batchId: number,
  quantity: number,
): void {
  track({
    event: "batch.created",
    category: EventCategory.SUPPLY_CHAIN,
    actor,
    properties: { batchId, quantity },
  });
}

export function trackBatchFlagged(
  actor: string,
  batchId: number,
  reason: string,
): void {
  track({
    event: "batch.flagged",
    category: EventCategory.SUPPLY_CHAIN,
    actor,
    properties: { batchId, reason },
  });
}

export function trackCredentialIssued(
  actor: string,
  credentialId: number,
  credentialType: string,
): void {
  track({
    event: "credential.issued",
    category: EventCategory.CREDENTIAL,
    actor,
    properties: { credentialId, credentialType },
  });
}

export function trackProposalCreated(
  actor: string,
  proposalId: number,
): void {
  track({
    event: "proposal.created",
    category: EventCategory.GOVERNANCE,
    actor,
    properties: { proposalId },
  });
}

export function trackVoteCast(
  actor: string,
  proposalId: number,
  support: boolean,
): void {
  track({
    event: "vote.cast",
    category: EventCategory.GOVERNANCE,
    actor,
    properties: { proposalId, support },
  });
}

export function trackAuthentication(
  actor: string,
  method: "wallet" | "worldid",
  success: boolean,
): void {
  track({
    event: "auth.login",
    category: EventCategory.AUTH,
    actor,
    properties: { method, success },
  });
}
