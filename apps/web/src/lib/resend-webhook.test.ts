import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseResendEvent, verifySvixSignature } from "./resend-webhook";

const secret = `whsec_${randomBytes(24).toString("base64")}`;
const sign = (id: string, timestamp: string, body: string, s = secret) =>
  `v1,${createHmac("sha256", Buffer.from(s.slice(6), "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64")}`;

describe("verifySvixSignature", () => {
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
  const nowMs = 1_800_000_000_000;
  const timestamp = String(Math.floor(nowMs / 1000));

  it("accepts a correctly signed, fresh payload", () => {
    expect(
      verifySvixSignature({ secret, id: "msg_1", timestamp, signature: sign("msg_1", timestamp, body), body, nowMs }),
    ).toBe(true);
  });

  it("accepts when one of several listed signatures matches", () => {
    const signature = `v1,${Buffer.alloc(32).toString("base64")} ${sign("msg_1", timestamp, body)}`;
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp, signature, body, nowMs })).toBe(true);
  });

  it("rejects a tampered body, wrong secret, or wrong id", () => {
    const signature = sign("msg_1", timestamp, body);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp, signature, body: body + " ", nowMs })).toBe(false);
    expect(verifySvixSignature({ secret: "whsec_AAAA", id: "msg_1", timestamp, signature, body, nowMs })).toBe(false);
    expect(verifySvixSignature({ secret, id: "msg_2", timestamp, signature, body, nowMs })).toBe(false);
  });

  it("rejects stale timestamps and missing headers", () => {
    const old = String(Math.floor(nowMs / 1000) - 3600);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: old, signature: sign("msg_1", old, body), body, nowMs })).toBe(false);
    expect(verifySvixSignature({ secret, id: null, timestamp, signature: sign("msg_1", timestamp, body), body, nowMs })).toBe(false);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp, signature: null, body, nowMs })).toBe(false);
  });
});

describe("parseResendEvent", () => {
  it("maps delivery events and carries bounce detail", () => {
    expect(
      parseResendEvent({
        type: "email.bounced",
        created_at: "2026-10-30T15:00:00.000Z",
        data: { email_id: "e1", bounce: { type: "Permanent", subType: "General", message: "No such mailbox" } },
      }),
    ).toEqual({
      event: "bounced",
      emailId: "e1",
      detail: "Permanent/General: No such mailbox",
      occurredAt: new Date("2026-10-30T15:00:00.000Z"),
    });
    expect(parseResendEvent({ type: "email.delivered", data: { email_id: "e2" } })).toMatchObject({
      event: "delivered",
      emailId: "e2",
    });
    expect(parseResendEvent({ type: "email.failed", data: { email_id: "e3", failed: { reason: "Blocked" } } })).toMatchObject({
      event: "failed",
      detail: "Blocked",
    });
  });

  it("ignores untracked or malformed events", () => {
    expect(parseResendEvent({ type: "email.opened", data: { email_id: "e1" } })).toBeNull();
    expect(parseResendEvent({ type: "email.delivered", data: {} })).toBeNull();
    expect(parseResendEvent("nope")).toBeNull();
  });
});
