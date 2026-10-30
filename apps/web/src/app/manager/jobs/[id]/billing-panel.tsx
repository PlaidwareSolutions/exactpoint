"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS, formatCents, subtotalCents, taxCents } from "@exactpoint/domain";
import type { EmailDeliveryStatus, NotificationStatus } from "@exactpoint/domain";
import {
  decideEstimateAction,
  emailQuote,
  recordPaymentAction,
  saveEstimate,
} from "@/lib/manager/billing-actions";

interface ItemRow {
  kind: "part" | "labor" | "other";
  description: string;
  quantity: number;
  unitPrice: string; // dollars in the input
}

/** Latest "Email quote" send and what the email provider reported about it. */
export interface QuoteEmailInfo {
  status: NotificationStatus;
  delivery: EmailDeliveryStatus | null;
  deliveryDetail: string | null;
  recipient: string;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveryUpdatedAt: string | null;
}

export interface BillingData {
  workOrderId: string;
  estimate: {
    id: string;
    status: string;
    taxRateBps: number;
    diagnosticFeeCents: number;
    notes: string | null;
  } | null;
  items: { kind: string; description: string; quantity: number; unitPriceCents: number }[];
  invoices: {
    id: string;
    number: string;
    status: string;
    totalCents: number;
    diagnosticFeeCents: number;
    paymentMethod: string | null;
  }[];
  quoteEmail: QuoteEmailInfo | null;
}

const inputCls = "rounded-lg border border-line px-2 py-1.5 text-sm";

/** Estimate → decision → invoice → payment (spec §85–86). */
export function BillingPanel({ data }: { data: BillingData }) {
  const router = useRouter();
  const decided = data.estimate?.status === "approved" || data.estimate?.status === "declined";
  const [items, setItems] = useState<ItemRow[]>(
    data.items.length > 0
      ? data.items.map((i) => ({
          kind: i.kind as ItemRow["kind"],
          description: i.description,
          quantity: i.quantity,
          unitPrice: (i.unitPriceCents / 100).toFixed(2),
        }))
      : [{ kind: "labor", description: "", quantity: 1, unitPrice: "" }],
  );
  const [taxRate, setTaxRate] = useState(((data.estimate?.taxRateBps ?? 825) / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sendNote, setSendNote] = useState<string | null>(null);

  // While a quote email is queued or awaiting the provider's delivery
  // report, re-read the page every few seconds so the status chip updates.
  useEffect(() => {
    const email = data.quoteEmail;
    if (!email) return;
    const awaiting =
      email.status === "pending" ||
      (email.status === "sent" &&
        (email.delivery === null || email.delivery === "sent" || email.delivery === "delivery_delayed"));
    if (!awaiting) return;
    if (Date.now() - new Date(email.createdAt).getTime() > 10 * 60_000) return;
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [data.quoteEmail, router]);

  const cents = items
    .filter((i) => i.description.trim() && i.unitPrice !== "")
    .map((i) => ({ quantity: i.quantity, unitPriceCents: Math.round(Number(i.unitPrice) * 100) }));
  const sub = subtotalCents(cents);
  const tax = taxCents(sub, Math.round(Number(taxRate) * 100));

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setMessage(null);
    const result = await fn();
    setBusy(false);
    if (result.ok) router.refresh();
    else setMessage(result.error ?? "Something went wrong.");
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-bold text-navy">Quote &amp; invoice</h2>
      {message && (
        <p className="mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{message}</p>
      )}

      {!decided && (
        <>
          <div className="mt-3 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={item.kind}
                  onChange={(e) =>
                    setItems(items.map((x, j) => (j === i ? { ...x, kind: e.target.value as ItemRow["kind"] } : x)))
                  }
                  className={inputCls}
                >
                  <option value="part">Part</option>
                  <option value="labor">Labor</option>
                  <option value="other">Other</option>
                </select>
                <input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) =>
                    setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))
                  }
                  className={`${inputCls} min-w-44 flex-1`}
                />
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    setItems(items.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))
                  }
                  className={`${inputCls} w-16`}
                  aria-label="Quantity"
                />
                <span className="text-sm text-slate">×&nbsp;$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={item.unitPrice}
                  onChange={(e) =>
                    setItems(items.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))
                  }
                  className={`${inputCls} w-24`}
                  aria-label="Unit price"
                />
                <button
                  type="button"
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                  className="text-sm text-slate hover:text-red-600"
                  aria-label="Remove line"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setItems([...items, { kind: "part", description: "", quantity: 1, unitPrice: "" }])}
              className="font-semibold text-point"
            >
              + Add line
            </button>
            <label className="ml-auto flex items-center gap-1 font-semibold text-navy">
              Tax %
              <input
                type="number"
                min={0}
                step="0.25"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className={`${inputCls} w-20`}
              />
            </label>
            <span className="tabular-nums text-slate">
              Subtotal {formatCents(sub)} · Tax {formatCents(tax)} ·{" "}
              <strong className="text-navy">Total {formatCents(sub + tax)}</strong>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || cents.length === 0}
              onClick={() =>
                run(() =>
                  saveEstimate({
                    workOrderId: data.workOrderId,
                    items: items
                      .filter((i) => i.description.trim() && i.unitPrice !== "")
                      .map((i) => ({
                        kind: i.kind,
                        description: i.description,
                        quantity: i.quantity,
                        unitPriceCents: Math.round(Number(i.unitPrice) * 100),
                      })),
                    taxRateBps: Math.round(Number(taxRate) * 100),
                  }),
                )
              }
              className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-soft disabled:opacity-50"
            >
              {data.estimate ? "Update quote" : "Save quote"}
            </button>
            {data.estimate && (
              <button
                type="button"
                disabled={busy || data.quoteEmail?.status === "pending"}
                onClick={async () => {
                  setBusy(true);
                  setMessage(null);
                  setSendNote(null);
                  const result = await emailQuote(data.estimate!.id);
                  setBusy(false);
                  if (result.ok) {
                    setSendNote(result.warnings?.[0] ?? "Quote emailed.");
                    router.refresh();
                  } else {
                    setMessage(result.error);
                  }
                }}
                className="rounded-lg border border-point px-4 py-2 text-sm font-bold text-point hover:bg-point hover:text-white disabled:opacity-50"
              >
                {data.quoteEmail ? "Resend quote" : "Email quote to customer"}
              </button>
            )}
            {sendNote && (
              <span className="self-center text-sm font-semibold text-emerald-700">{sendNote}</span>
            )}
            {data.estimate && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => decideEstimateAction({ estimateId: data.estimate!.id, decision: "approved" }))
                  }
                  className="rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
                >
                  Customer approved
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => decideEstimateAction({ estimateId: data.estimate!.id, decision: "declined" }))
                  }
                  className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-slate hover:border-point disabled:opacity-50"
                >
                  Customer declined
                </button>
              </>
            )}
          </div>
          {data.quoteEmail && <QuoteEmailStatus email={data.quoteEmail} />}
          <p className="mt-2 text-xs text-slate">
            Approved → the ${(data.estimate?.diagnosticFeeCents ?? 8000) / 100} diagnostic fee is
            waived and the invoice covers the quote. Declined → the invoice is the
            diagnostic fee only.
          </p>
        </>
      )}

      {decided && (
        <p className="mt-2 text-sm text-slate">
          Quote <strong className="text-navy">{data.estimate!.status}</strong> — invoice issued below.
        </p>
      )}

      {data.invoices.length > 0 && (
        <ul className="mt-4 space-y-2">
          {data.invoices.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist px-4 py-3 text-sm"
            >
              <span className="font-bold text-navy">
                <a href={`/manager/invoices/${inv.id}`} className="hover:text-point">
                  {inv.number}
                </a>{" "}
                · {formatCents(inv.totalCents)}
                {inv.diagnosticFeeCents > 0 && (
                  <span className="ml-1 font-normal text-slate">(diagnostic fee)</span>
                )}
              </span>
              {inv.status === "paid" ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  Paid · {inv.paymentMethod}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {(["zelle", "cash", "check"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => recordPaymentAction({ invoiceId: inv.id, method }))}
                      className="rounded-lg border border-line bg-white px-3 py-1 text-xs font-bold text-navy hover:border-point disabled:opacity-50"
                    >
                      Paid by {method}
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const TONE_CLS = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-red-50 text-red-700",
  muted: "bg-mist text-slate",
} as const;

/** Plain-language delivery state for the owner (spec §57 — honest wording, no guessing). */
function describeQuoteEmail(email: QuoteEmailInfo): {
  label: string;
  tone: keyof typeof TONE_CLS;
  detail?: string | null;
} {
  if (email.status === "failed") return { label: "Failed to send", tone: "bad", detail: email.error };
  if (email.status === "pending") return { label: "Sending…", tone: "muted" };
  switch (email.delivery) {
    case "delivered":
      return { label: "Delivered", tone: "ok" };
    case "bounced":
      return { label: "Bounced — address rejected it", tone: "bad", detail: email.deliveryDetail };
    case "complained":
      return { label: "Marked as spam by the recipient", tone: "bad" };
    case "failed":
      return { label: "Delivery failed", tone: "bad", detail: email.deliveryDetail };
    case "delivery_delayed":
      return { label: "Delayed — their mailbox isn't accepting yet", tone: "warn" };
    default:
      return { label: "Sent — awaiting delivery confirmation", tone: "muted" };
  }
}

const whenFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function QuoteEmailStatus({ email }: { email: QuoteEmailInfo }) {
  const d = describeQuoteEmail(email);
  const when = email.deliveryUpdatedAt ?? email.sentAt ?? email.createdAt;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm" data-testid="quote-email-status">
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${TONE_CLS[d.tone]}`}>{d.label}</span>
      <span className="text-slate">
        Quote email to <strong className="text-navy">{email.recipient}</strong> · {whenFmt.format(new Date(when))}
      </span>
      {d.detail && <span className="basis-full text-xs text-slate">{d.detail}</span>}
    </p>
  );
}
