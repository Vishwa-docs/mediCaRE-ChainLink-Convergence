import axios from "axios";
import config from "../config";
import { createLogger } from "../utils/logging";

const log = createLogger("service:notifications");

// ─── Types ──────────────────────────────────────────────────────────

export enum NotificationChannel {
  EMAIL = "email",
  WEBHOOK = "webhook",
}

export enum NotificationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface NotificationPayload {
  /** Unique idempotency key (prevents duplicate sends). */
  idempotencyKey: string;
  /** The notification channel. */
  channel: NotificationChannel;
  /** Target (email address or webhook URL). */
  recipient: string;
  /** Subject / title line. */
  subject: string;
  /** Body content (plain-text or markdown). */
  body: string;
  /** Priority level (affects retry policy). */
  priority: NotificationPriority;
  /** Optional key–value metadata attached to the notification. */
  metadata?: Record<string, string>;
}

export interface NotificationResult {
  success: boolean;
  notificationId: string;
  channel: NotificationChannel;
  sentAt: string;
  error?: string;
}

// ─── Dedup Store (in-memory for MVP; swap for Redis in production) ──

const _sentKeys = new Set<string>();

function isDuplicate(key: string): boolean {
  if (_sentKeys.has(key)) return true;
  _sentKeys.add(key);
  // Prevent unbounded growth by pruning to last 10 000 keys.
  if (_sentKeys.size > 10_000) {
    const first = _sentKeys.values().next().value;
    if (first) _sentKeys.delete(first);
  }
  return false;
}

// ─── Email (SMTP / Transactional API) ───────────────────────────────

async function sendEmail(payload: NotificationPayload): Promise<NotificationResult> {
  const notifId = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  log.info("Sending email notification", {
    id: notifId,
    to: payload.recipient,
    subject: payload.subject,
    priority: payload.priority,
  });

  // In production, integrate with SendGrid / SES / Resend:
  //   await axios.post("https://api.sendgrid.com/v3/mail/send", { ... },
  //     { headers: { Authorization: `Bearer ${config.notifications.apiKey}` } });

  // For the prototype, we log and return a stub result.
  const result: NotificationResult = {
    success: true,
    notificationId: notifId,
    channel: NotificationChannel.EMAIL,
    sentAt: new Date().toISOString(),
  };

  log.info("Email notification sent", { id: notifId });
  return result;
}

// ─── Webhook ────────────────────────────────────────────────────────

async function sendWebhook(payload: NotificationPayload): Promise<NotificationResult> {
  const notifId = `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  log.info("Sending webhook notification", {
    id: notifId,
    url: payload.recipient,
    subject: payload.subject,
  });

  try {
    const body = {
      id: notifId,
      subject: payload.subject,
      body: payload.body,
      priority: payload.priority,
      metadata: payload.metadata ?? {},
      timestamp: new Date().toISOString(),
    };

    await axios.post(payload.recipient, body, {
      headers: { "Content-Type": "application/json" },
      timeout: 10_000,
    });

    const result: NotificationResult = {
      success: true,
      notificationId: notifId,
      channel: NotificationChannel.WEBHOOK,
      sentAt: new Date().toISOString(),
    };

    log.info("Webhook notification delivered", { id: notifId });
    return result;
  } catch (err: any) {
    log.error("Webhook delivery failed", {
      id: notifId,
      error: err.message,
      status: err?.response?.status,
    });

    return {
      success: false,
      notificationId: notifId,
      channel: NotificationChannel.WEBHOOK,
      sentAt: new Date().toISOString(),
      error: err.message,
    };
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Send a notification through the specified channel.
 *
 * - Deduplicates based on `idempotencyKey`.
 * - Retries critical notifications up to 3 times on transient failures.
 */
export async function sendNotification(
  payload: NotificationPayload,
): Promise<NotificationResult> {
  // Idempotency check
  if (isDuplicate(payload.idempotencyKey)) {
    log.warn("Duplicate notification suppressed", {
      key: payload.idempotencyKey,
    });
    return {
      success: true,
      notificationId: `dup-${payload.idempotencyKey}`,
      channel: payload.channel,
      sentAt: new Date().toISOString(),
    };
  }

  const MAX_RETRIES = payload.priority === NotificationPriority.CRITICAL ? 3 : 1;
  let lastResult: NotificationResult | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      switch (payload.channel) {
        case NotificationChannel.EMAIL:
          lastResult = await sendEmail(payload);
          break;
        case NotificationChannel.WEBHOOK:
          lastResult = await sendWebhook(payload);
          break;
        default:
          throw new Error(`Unsupported channel: ${payload.channel}`);
      }

      if (lastResult.success) return lastResult;
    } catch (err: any) {
      log.warn(`Notification attempt ${attempt}/${MAX_RETRIES} failed`, {
        key: payload.idempotencyKey,
        error: err.message,
      });
    }

    // Exponential backoff between retries.
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }

  return (
    lastResult ?? {
      success: false,
      notificationId: `fail-${payload.idempotencyKey}`,
      channel: payload.channel,
      sentAt: new Date().toISOString(),
      error: "All retries exhausted",
    }
  );
}

// ─── Convenience Helpers ────────────────────────────────────────────

/** Notify a patient that a new record has been added. */
export async function notifyRecordCreated(
  patientEmail: string,
  recordId: number,
  recordType: string,
  providerName: string,
): Promise<NotificationResult> {
  return sendNotification({
    idempotencyKey: `record-created-${recordId}`,
    channel: NotificationChannel.EMAIL,
    recipient: patientEmail,
    subject: `New ${recordType} record added to your health profile`,
    body: [
      `Hello,`,
      ``,
      `A new ${recordType} record (#${recordId}) has been added to your mediCaRE health profile by ${providerName}.`,
      ``,
      `You can view the record in the mediCaRE app or World mini-app.`,
      ``,
      `— mediCaRE`,
    ].join("\n"),
    priority: NotificationPriority.NORMAL,
    metadata: { recordId: String(recordId), recordType },
  });
}

/** Notify a policyholder that a claim status has changed. */
export async function notifyClaimStatusChange(
  holderEmail: string,
  claimId: number,
  policyId: number,
  newStatus: string,
): Promise<NotificationResult> {
  return sendNotification({
    idempotencyKey: `claim-status-${claimId}-${newStatus}`,
    channel: NotificationChannel.EMAIL,
    recipient: holderEmail,
    subject: `Insurance claim #${claimId} — ${newStatus}`,
    body: [
      `Hello,`,
      ``,
      `Your insurance claim #${claimId} (policy #${policyId}) has been updated to: **${newStatus}**.`,
      ``,
      `Log in to the mediCaRE dashboard for full details.`,
      ``,
      `— mediCaRE`,
    ].join("\n"),
    priority:
      newStatus === "Approved" || newStatus === "Paid"
        ? NotificationPriority.HIGH
        : NotificationPriority.NORMAL,
    metadata: {
      claimId: String(claimId),
      policyId: String(policyId),
      status: newStatus,
    },
  });
}

/** Send a supply-chain alert webhook for a flagged/recalled batch. */
export async function notifySupplyChainAlert(
  webhookUrl: string,
  batchId: number,
  alertType: "flagged" | "recalled",
  reason: string,
): Promise<NotificationResult> {
  return sendNotification({
    idempotencyKey: `supply-alert-${batchId}-${alertType}`,
    channel: NotificationChannel.WEBHOOK,
    recipient: webhookUrl,
    subject: `Batch #${batchId} ${alertType}`,
    body: reason,
    priority: NotificationPriority.CRITICAL,
    metadata: { batchId: String(batchId), alertType },
  });
}
