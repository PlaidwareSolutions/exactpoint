import { and, desc, eq, sql } from "drizzle-orm";
import type { EmailDeliveryStatus } from "@exactpoint/domain";
import { EMAIL_DELIVERY_STATUSES } from "@exactpoint/domain";
import type { Database } from "../client";
import { notifications } from "../schema";

export interface EnqueueEmailInput {
  template: string;
  recipient: string;
  payload: Record<string, unknown>;
  /** What the email is about, so screens can show its delivery state later. */
  entity?: { type: string; id: string };
}

/** Queues an email for the worker to send (spec §57 — never blocks booking). */
export async function enqueueEmail(
  db: Database,
  input: EnqueueEmailInput,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(notifications)
    .values({
      channel: "email",
      template: input.template,
      recipient: input.recipient,
      payload: input.payload,
      entityType: input.entity?.type ?? null,
      entityId: input.entity?.id ?? null,
    })
    .returning({ id: notifications.id });
  return { id: row!.id };
}

export type EnqueueOnceResult =
  | { queued: true; notificationId: string }
  | { queued: false; notificationId: string; reason: "pending" | "recent" };

/**
 * Idempotent enqueue for owner-triggered emails (e.g. "Email quote"): a
 * second click while the previous one is still queued, or within the dedupe
 * window after it was sent, returns the existing row instead of a duplicate.
 * Concurrent clicks are serialised with a transaction-scoped advisory lock
 * on the entity.
 */
export async function enqueueEmailOnce(
  db: Database,
  input: EnqueueEmailInput & { entity: { type: string; id: string }; dedupeWindowSeconds?: number },
): Promise<EnqueueOnceResult> {
  const windowSeconds = input.dedupeWindowSeconds ?? 60;
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${input.entity.type}:${input.entity.id}:${input.template}`}))`,
    );
    const [latest] = await tx
      .select({ id: notifications.id, status: notifications.status, createdAt: notifications.createdAt })
      .from(notifications)
      .where(
        and(
          eq(notifications.entityType, input.entity.type),
          eq(notifications.entityId, input.entity.id),
          eq(notifications.template, input.template),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(1);
    if (latest?.status === "pending") {
      return { queued: false, notificationId: latest.id, reason: "pending" };
    }
    if (
      latest &&
      latest.status === "sent" &&
      Date.now() - latest.createdAt.getTime() < windowSeconds * 1000
    ) {
      return { queued: false, notificationId: latest.id, reason: "recent" };
    }
    const [row] = await tx
      .insert(notifications)
      .values({
        channel: "email",
        template: input.template,
        recipient: input.recipient,
        payload: input.payload,
        entityType: input.entity.type,
        entityId: input.entity.id,
      })
      .returning({ id: notifications.id });
    return { queued: true, notificationId: row!.id };
  });
}

/** Pending notifications for the worker, oldest first. */
export async function pendingNotifications(db: Database, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.status, "pending"))
    .orderBy(notifications.createdAt)
    .limit(limit);
}

/** Records the provider's answer; the message id is what delivery webhooks are matched on. */
export async function markNotification(
  db: Database,
  id: string,
  outcome: { ok: boolean; providerId?: string; error?: string },
): Promise<void> {
  await db
    .update(notifications)
    .set(
      outcome.ok
        ? {
            status: "sent",
            sentAt: new Date(),
            error: null,
            providerMessageId: outcome.providerId ?? null,
          }
        : { status: "failed", error: outcome.error?.slice(0, 500) ?? "unknown" },
    )
    .where(eq(notifications.id, id));
}

const DELIVERY_RANK: Record<EmailDeliveryStatus, number> = Object.fromEntries(
  EMAIL_DELIVERY_STATUSES.map((s, i) => [s, i]),
) as Record<EmailDeliveryStatus, number>;

export type DeliveryEventOutcome = "updated" | "ignored" | "unknown";

/**
 * Applies a provider delivery event (webhook) to the matching notification.
 * Later-ranked events win; an earlier-ranked event arriving late is ignored,
 * and the same event delivered twice is harmless.
 */
export async function applyDeliveryEvent(
  db: Database,
  input: {
    providerMessageId: string;
    event: EmailDeliveryStatus;
    detail?: string;
    occurredAt?: Date;
  },
): Promise<DeliveryEventOutcome> {
  const [row] = await db
    .select({ id: notifications.id, deliveryStatus: notifications.deliveryStatus })
    .from(notifications)
    .where(eq(notifications.providerMessageId, input.providerMessageId));
  if (!row) return "unknown";
  const current = row.deliveryStatus as EmailDeliveryStatus | null;
  if (current && DELIVERY_RANK[current] > DELIVERY_RANK[input.event]) return "ignored";
  await db
    .update(notifications)
    .set({
      deliveryStatus: input.event,
      deliveryDetail: input.detail?.slice(0, 500) ?? null,
      deliveryUpdatedAt: input.occurredAt ?? new Date(),
    })
    .where(eq(notifications.id, row.id));
  return "updated";
}

/** The most recent notification about an entity (optionally one template), for status display. */
export async function latestNotificationFor(
  db: Database,
  input: { entityType: string; entityId: string; template?: string },
) {
  const conditions = [
    eq(notifications.entityType, input.entityType),
    eq(notifications.entityId, input.entityId),
  ];
  if (input.template) conditions.push(eq(notifications.template, input.template));
  const [row] = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  return row ?? null;
}
