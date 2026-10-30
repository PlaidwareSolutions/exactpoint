import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import pg from "pg";
import { loadEnv } from "@exactpoint/config";
import { createDb } from "../client";
import { runMigrations } from "../migrate";
import { notifications } from "../schema";
import {
  applyDeliveryEvent,
  enqueueEmail,
  enqueueEmailOnce,
  latestNotificationFor,
  markNotification,
} from "./notifications";

const env = loadEnv();
const testUrl = env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("notification queue: idempotent enqueue + delivery events", () => {
  const handle = createDb(testUrl);
  const db = handle.db;
  const entity = { type: "estimate", id: "11111111-1111-4111-8111-111111111111" };
  const base = {
    template: "quote_issued",
    recipient: "quote-test@example.com",
    payload: { firstName: "Q" },
  };

  beforeAll(async () => {
    const admin = new pg.Pool({ connectionString: testUrl, max: 1 });
    await admin.query(
      "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;",
    );
    await admin.end();
    await runMigrations(testUrl);
  }, 60_000);

  afterAll(async () => {
    await handle.pool.end();
  });

  it("enqueueEmail stores the entity link and returns the id", async () => {
    const { id } = await enqueueEmail(db, { ...base, entity: { type: "invoice", id: "inv-1" } });
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id));
    expect(row).toMatchObject({ status: "pending", entityType: "invoice", entityId: "inv-1" });
  });

  it("enqueueEmailOnce queues once, then reports pending/recent instead of duplicating", async () => {
    const first = await enqueueEmailOnce(db, { ...base, entity });
    expect(first.queued).toBe(true);

    const second = await enqueueEmailOnce(db, { ...base, entity });
    expect(second).toEqual({ queued: false, notificationId: first.notificationId, reason: "pending" });

    await markNotification(db, first.notificationId, { ok: true, providerId: "resend-msg-1" });
    const [sent] = await db.select().from(notifications).where(eq(notifications.id, first.notificationId));
    expect(sent).toMatchObject({ status: "sent", providerMessageId: "resend-msg-1", error: null });
    expect(sent!.sentAt).toBeInstanceOf(Date);

    const third = await enqueueEmailOnce(db, { ...base, entity });
    expect(third).toEqual({ queued: false, notificationId: first.notificationId, reason: "recent" });

    const fourth = await enqueueEmailOnce(db, { ...base, entity, dedupeWindowSeconds: 0 });
    expect(fourth.queued).toBe(true);
    expect(fourth.notificationId).not.toBe(first.notificationId);

    const latest = await latestNotificationFor(db, { entityType: entity.type, entityId: entity.id, template: "quote_issued" });
    expect(latest?.id).toBe(fourth.notificationId);

    // A different template for the same entity is independent.
    const other = await enqueueEmailOnce(db, { ...base, template: "invoice_issued", entity });
    expect(other.queued).toBe(true);
  });

  it("concurrent enqueueEmailOnce calls produce a single row", async () => {
    const e = { type: "estimate", id: "22222222-2222-4222-8222-222222222222" };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => enqueueEmailOnce(db, { ...base, entity: e })),
    );
    expect(results.filter((r) => r.queued)).toHaveLength(1);
    expect(new Set(results.map((r) => r.notificationId)).size).toBe(1);
  });

  it("markNotification records failures", async () => {
    const { id } = await enqueueEmail(db, base);
    await markNotification(db, id, { ok: false, error: "resend 422: nope" });
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id));
    expect(row).toMatchObject({ status: "failed", error: "resend 422: nope", providerMessageId: null });
  });

  it("applyDeliveryEvent matches on the provider id and never downgrades", async () => {
    const { id } = await enqueueEmail(db, base);
    await markNotification(db, id, { ok: true, providerId: "resend-msg-2" });

    expect(await applyDeliveryEvent(db, { providerMessageId: "nope", event: "delivered" })).toBe("unknown");
    expect(await applyDeliveryEvent(db, { providerMessageId: "resend-msg-2", event: "delivered" })).toBe("updated");
    // A late "sent" must not overwrite "delivered"; a repeat "delivered" is harmless.
    expect(await applyDeliveryEvent(db, { providerMessageId: "resend-msg-2", event: "sent" })).toBe("ignored");
    expect(await applyDeliveryEvent(db, { providerMessageId: "resend-msg-2", event: "delivered" })).toBe("updated");
    let [row] = await db.select().from(notifications).where(eq(notifications.id, id));
    expect(row!.deliveryStatus).toBe("delivered");

    const when = new Date("2026-10-30T15:00:00Z");
    expect(
      await applyDeliveryEvent(db, {
        providerMessageId: "resend-msg-2",
        event: "complained",
        detail: "marked as spam",
        occurredAt: when,
      }),
    ).toBe("updated");
    [row] = await db.select().from(notifications).where(eq(notifications.id, id));
    expect(row).toMatchObject({ deliveryStatus: "complained", deliveryDetail: "marked as spam" });
    expect(row!.deliveryUpdatedAt?.toISOString()).toBe(when.toISOString());
  });
});
