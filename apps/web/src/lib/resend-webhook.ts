import { createHmac, timingSafeEqual } from "node:crypto";
import type { EmailDeliveryStatus } from "@exactpoint/domain";

/**
 * Verifies a Resend webhook (Svix signing scheme) without an SDK:
 * base64(HMAC-SHA256(secret, `${svix-id}.${svix-timestamp}.${body}`)) must
 * match one of the space-separated `v1,<sig>` entries, and the timestamp
 * must be within tolerance to defeat replays.
 */
export function verifySvixSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): boolean {
  const { secret, id, timestamp, signature, body } = input;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - ts) > (input.toleranceSeconds ?? 300)) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  for (const entry of signature.split(/\s+/)) {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) continue;
    const candidate = Buffer.from(sig, "base64");
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}

const EVENT_MAP: Record<string, EmailDeliveryStatus> = {
  "email.sent": "sent",
  "email.delivery_delayed": "delivery_delayed",
  "email.delivered": "delivered",
  "email.failed": "failed",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

export interface ResendDeliveryEvent {
  event: EmailDeliveryStatus;
  emailId: string;
  detail?: string;
  occurredAt?: Date;
}

/**
 * Maps a Resend webhook payload to a delivery event. Returns null for events
 * we deliberately don't track (opens, clicks) or malformed payloads.
 */
export function parseResendEvent(payload: unknown): ResendDeliveryEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { type?: unknown; created_at?: unknown; data?: Record<string, unknown> };
  const event = typeof p.type === "string" ? EVENT_MAP[p.type] : undefined;
  const emailId = typeof p.data?.email_id === "string" ? p.data.email_id : null;
  if (!event || !emailId) return null;

  const bounce = p.data?.bounce as { message?: unknown; type?: unknown; subType?: unknown } | undefined;
  const failed = p.data?.failed as { reason?: unknown } | undefined;
  let detail: string | undefined;
  if (bounce && typeof bounce.message === "string") {
    const kind = [bounce.type, bounce.subType].filter((x) => typeof x === "string").join("/");
    detail = kind ? `${kind}: ${bounce.message}` : bounce.message;
  } else if (failed && typeof failed.reason === "string") {
    detail = failed.reason;
  }
  const occurredAt =
    typeof p.created_at === "string" && !Number.isNaN(Date.parse(p.created_at))
      ? new Date(p.created_at)
      : undefined;
  return { event, emailId, detail, occurredAt };
}
