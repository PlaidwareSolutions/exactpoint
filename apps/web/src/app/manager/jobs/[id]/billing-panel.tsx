"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS, SERVICE_AGREEMENT, formatCents, subtotalCents, taxCents } from "@exactpoint/domain";
import type { EmailDeliveryStatus, NotificationStatus } from "@exactpoint/domain";
import { decideEstimateAction, emailQuote, saveEstimate } from "@/lib/manager/billing-actions";
import { PaymentLedger, type LedgerInvoice } from "@/components/billing/payment-ledger";

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

export interface RevisionData {
  id: string;
  revision: number;
  kind: "quote" | "change_order";
  status: "presented" | "superseded" | "approved" | "declined";
  taxRateBps: number;
  diagnosticFeeCents: number;
  notes: string | null;
  createdAt: string;
  decidedAt: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  items: { kind: string; description: string; quantity: number; unitPriceCents: number }[];
}

export interface BillingData {
  workOrderId: string;
  estimate: {
    id: string;
    status: string;
    currentRevisionId: string | null;
    approvedRevisionId: string | null;
  } | null;
  currentRevision: RevisionData | null;
  approvedRevision: RevisionData | null;
  revisions: RevisionData[];
  invoices: (LedgerInvoice & { diagnosticFeeCents: number })[];
  quoteEmail: QuoteEmailInfo | null;
}

const inputCls = "rounded-lg border border-line px-2 py-1.5 text-sm";

function toRows(items: RevisionData["items"]): ItemRow[] {
  return items.length > 0
    ? items.map((i) => ({
        kind: i.kind as ItemRow["kind"],
        description: i.description,
        quantity: i.quantity,
        unitPrice: (i.unitPriceCents / 100).toFixed(2),
      }))
    : [{ kind: "labor", description: "", quantity: 1, unitPrice: "" }];
}

const whenFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Quote (revisions + change orders) → decision → invoice → payments ledger
 * (spec §42, §85–86).
 */
export function BillingPanel({ data }: { data: BillingData }) {
  const router = useRouter();
  const estimateStatus = data.estimate?.status ?? null;
  const current = data.currentRevision;
  const pendingChangeOrder =
    estimateStatus === "approved" && current?.kind === "change_order" && current.status === "presented";
  // Editor is open while the quote is undecided, while a change order awaits a
  // decision, or once the owner taps "Create change order" on an approved quote.
  const [draftingChangeOrder, setDraftingChangeOrder] = useState(false);
  const editing =
    !data.estimate || estimateStatus === "presented" || estimateStatus === "draft" || pendingChangeOrder || draftingChangeOrder;

  const seed = pendingChangeOrder || !draftingChangeOrder ? current : data.approvedRevision;
  const [items, setItems] = useState<ItemRow[]>(toRows(seed?.items ?? []));
  const [taxRate, setTaxRate] = useState(((seed?.taxRateBps ?? 825) / 100).toFixed(2));
  const [notes, setNotes] = useState(seed?.notes ?? "");
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

  const validItems = items.filter((i) => i.description.trim() && i.unitPrice !== "");
  const cents = validItems.map((i) => ({
    quantity: i.quantity,
    unitPriceCents: Math.round(Number(i.unitPrice) * 100),
  }));
  const sub = subtotalCents(cents);
  const tax = taxCents(sub, Math.round(Number(taxRate) * 100));

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setMessage(null);
    const result = await fn();
    setBusy(false);
    if (result.ok) {
      setDraftingChangeOrder(false);
      router.refresh();
    } else setMessage(result.error ?? "Something went wrong.");
  }

  const save = () =>
    run(() =>
      saveEstimate({
        workOrderId: data.workOrderId,
        items: validItems.map((i) => ({
          kind: i.kind,
          description: i.description,
          quantity: i.quantity,
          unitPriceCents: Math.round(Number(i.unitPrice) * 100),
        })),
        taxRateBps: Math.round(Number(taxRate) * 100),
        notes,
      }),
    );

  const saveLabel = !data.estimate
    ? "Save quote"
    : pendingChangeOrder
      ? "Update change order"
      : draftingChangeOrder
        ? "Save change order"
        : "Update quote";

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-navy">Quote &amp; invoice</h2>
        {current && (
          <span className="text-xs font-semibold text-slate" data-testid="revision-label">
            {pendingChangeOrder || draftingChangeOrder
              ? `Change order · revision ${draftingChangeOrder && !pendingChangeOrder ? current.revision + 1 : current.revision}`
              : `Revision ${current.revision}`}
            {current.revision > 1 && !draftingChangeOrder ? ` of ${data.revisions.length}` : ""}
          </span>
        )}
      </div>
      {message && (
        <p className="mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" data-testid="billing-error">
          {message}
        </p>
      )}

      {estimateStatus === "approved" && !editing && data.approvedRevision && (
        <div className="mt-3 rounded-lg bg-mist px-4 py-3 text-sm">
          <p className="text-slate">
            Quote <strong className="text-navy">approved</strong> (revision {data.approvedRevision.revision}) ·{" "}
            <strong className="tabular-nums text-navy">{formatCents(data.approvedRevision.totalCents)}</strong>{" "}
            incl. tax — invoice issued below.
          </p>
          <RevisionItems revision={data.approvedRevision} />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setItems(toRows(data.approvedRevision!.items));
              setTaxRate((data.approvedRevision!.taxRateBps / 100).toFixed(2));
              setNotes(data.approvedRevision!.notes ?? "");
              setMessage(null);
              setDraftingChangeOrder(true);
            }}
            className="mt-3 rounded-lg border border-point px-4 py-2 text-sm font-bold text-point hover:bg-point hover:text-white disabled:opacity-50"
          >
            Create change order
          </button>
          <p className="mt-2 text-xs text-slate">
            Found more work on site? A change order is a new revision the customer approves or
            declines on its own. The approved quote stays as-is until they say yes; on approval the
            invoice total updates and the balance moves with it.
          </p>
        </div>
      )}

      {estimateStatus === "declined" && current && (
        <div className="mt-3 rounded-lg bg-mist px-4 py-3 text-sm">
          <p className="text-slate">
            Quote <strong className="text-navy">declined</strong> (revision {current.revision}) — the
            invoice below is the diagnostic fee only. New work needs a new job.
          </p>
          <RevisionItems revision={current} />
        </div>
      )}

      {editing && (
        <>
          {pendingChangeOrder && (
            <p className="mt-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800" data-testid="change-order-banner">
              Change order awaiting the customer. Their approved quote (revision{" "}
              {data.approvedRevision?.revision}, {formatCents(data.approvedRevision?.totalCents ?? 0)}) stands
              until they approve this one.
            </p>
          )}
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
          <input
            placeholder="Notes for the customer (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} mt-2 w-full`}
            aria-label="Quote notes"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || cents.length === 0}
              onClick={save}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-soft disabled:opacity-50"
            >
              {saveLabel}
            </button>
            {draftingChangeOrder && !pendingChangeOrder && (
              <button
                type="button"
                onClick={() => setDraftingChangeOrder(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-slate hover:border-point"
              >
                Cancel
              </button>
            )}
            {data.estimate && current?.status === "presented" && !(draftingChangeOrder && !pendingChangeOrder) && (
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
                    setSendNote(result.warnings?.[0] ?? (pendingChangeOrder ? "Change order emailed." : "Quote emailed."));
                    router.refresh();
                  } else {
                    setMessage(result.error);
                  }
                }}
                className="rounded-lg border border-point px-4 py-2 text-sm font-bold text-point hover:bg-point hover:text-white disabled:opacity-50"
              >
                {data.quoteEmail
                  ? pendingChangeOrder
                    ? "Resend change order"
                    : "Resend quote"
                  : pendingChangeOrder
                    ? "Email change order to customer"
                    : "Email quote to customer"}
              </button>
            )}
            {sendNote && (
              <span className="self-center text-sm font-semibold text-emerald-700">{sendNote}</span>
            )}
            {data.estimate && current?.status === "presented" && !(draftingChangeOrder && !pendingChangeOrder) && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => decideEstimateAction({ estimateId: data.estimate!.id, decision: "approved" }))
                  }
                  className="rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
                >
                  {pendingChangeOrder ? "Customer approved change" : "Customer approved"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => decideEstimateAction({ estimateId: data.estimate!.id, decision: "declined" }))
                  }
                  className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-slate hover:border-point disabled:opacity-50"
                >
                  {pendingChangeOrder ? "Customer declined change" : "Customer declined"}
                </button>
              </>
            )}
          </div>
          {data.quoteEmail && !(draftingChangeOrder && !pendingChangeOrder) && (
            <QuoteEmailStatus email={data.quoteEmail} changeOrder={pendingChangeOrder} />
          )}
          <p className="mt-2 text-xs text-slate">
            {pendingChangeOrder || draftingChangeOrder ? (
              <>
                Every save is a new revision — re-send after changes. Approving the change rebuilds the
                invoice from it; declining leaves the approved quote and invoice untouched.
              </>
            ) : (
              <>
                Approved → the ${(current?.diagnosticFeeCents ?? 8000) / 100} diagnostic fee is waived and the
                invoice covers the quote. Declined → the invoice is the diagnostic fee only. Every save is a
                new revision — the customer should get the latest one, so re-send after changes. The quote
                email includes your{" "}
                <a href={SERVICE_AGREEMENT.path} target="_blank" rel="noopener" className="font-semibold text-point">
                  customer agreement
                </a>
                ; approving the quote accepts it.
              </>
            )}
          </p>
        </>
      )}

      {data.revisions.length > 1 && <RevisionHistory revisions={data.revisions} />}

      {data.invoices.length > 0 && (
        <ul className="mt-4 space-y-3">
          {data.invoices.map((inv) => (
            <li key={inv.id} className="rounded-lg bg-mist px-4 py-3 text-sm">
              <p className="mb-2 font-bold text-navy">
                <a href={`/manager/invoices/${inv.id}`} className="hover:text-point">
                  {inv.number}
                </a>
                {inv.diagnosticFeeCents > 0 && (
                  <span className="ml-1 font-normal text-slate">(diagnostic fee)</span>
                )}
              </p>
              <PaymentLedger invoice={inv} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RevisionItems({ revision }: { revision: RevisionData }) {
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-slate">
      {revision.items.map((i, idx) => (
        <li key={idx} className="flex justify-between gap-3">
          <span>
            {i.description} <span className="text-slate/70">×{i.quantity}</span>
          </span>
          <span className="tabular-nums">{formatCents(i.quantity * i.unitPriceCents)}</span>
        </li>
      ))}
      {revision.notes && <li className="pt-1 italic">{revision.notes}</li>}
    </ul>
  );
}

const REV_STATUS_LABEL: Record<RevisionData["status"], string> = {
  presented: "awaiting customer",
  superseded: "superseded",
  approved: "approved",
  declined: "declined",
};

/** Every revision the customer was ever shown, read-only — nothing is overwritten. */
function RevisionHistory({ revisions }: { revisions: RevisionData[] }) {
  return (
    <details className="mt-3 rounded-lg border border-line px-4 py-2 text-sm" data-testid="revision-history">
      <summary className="cursor-pointer font-semibold text-navy">
        Quote history · {revisions.length} revisions
      </summary>
      <ul className="mt-2 divide-y divide-line">
        {[...revisions].reverse().map((r) => (
          <li key={r.id} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-navy">
                Revision {r.revision}
                {r.kind === "change_order" && <span className="ml-1 font-normal text-slate">(change order)</span>}
              </span>
              <span className="text-xs text-slate">
                {REV_STATUS_LABEL[r.status]} · {whenFmt.format(new Date(r.decidedAt ?? r.createdAt))} ·{" "}
                <strong className="tabular-nums text-navy">{formatCents(r.totalCents)}</strong>
              </span>
            </div>
            <RevisionItems revision={r} />
          </li>
        ))}
      </ul>
    </details>
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

function QuoteEmailStatus({ email, changeOrder }: { email: QuoteEmailInfo; changeOrder: boolean }) {
  const d = describeQuoteEmail(email);
  const when = email.deliveryUpdatedAt ?? email.sentAt ?? email.createdAt;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm" data-testid="quote-email-status">
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${TONE_CLS[d.tone]}`}>{d.label}</span>
      <span className="text-slate">
        {changeOrder ? "Change order" : "Quote"} email to{" "}
        <strong className="text-navy">{email.recipient}</strong> · {whenFmt.format(new Date(when))}
      </span>
      {d.detail && <span className="basis-full text-xs text-slate">{d.detail}</span>}
    </p>
  );
}
