import { NextResponse } from "next/server";
import { applyDeliveryEvent, getDb } from "@exactpoint/db";
import { parseResendEvent, verifySvixSignature } from "@/lib/resend-webhook";

/**
 * Resend delivery webhooks (email.delivered / bounced / complained …).
 * Public endpoint authenticated by the Svix signature (RESEND_WEBHOOK_SECRET);
 * records the event on the matching notification so the Manager can show
 * whether a quote or invoice actually reached the customer.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const body = await request.text();
  const valid = verifySvixSignature({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event = parseResendEvent(payload);
  if (!event) return NextResponse.json({ outcome: "ignored" });

  const outcome = await applyDeliveryEvent(getDb(), {
    providerMessageId: event.emailId,
    event: event.event,
    detail: event.detail,
    occurredAt: event.occurredAt,
  });
  // 200 even for unknown ids: Resend must not retry forever for messages we didn't send.
  return NextResponse.json({ outcome });
}
