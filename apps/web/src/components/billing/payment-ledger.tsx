"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BUSINESS,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCents,
} from "@exactpoint/domain";
import { emailReceipt, recordPaymentAction } from "@/lib/manager/billing-actions";

/** Serialised ledger row for the client. */
export interface LedgerRow {
  id: string;
  kind: "payment" | "refund";
  amountCents: number;
  method: string;
  reference: string | null;
  note: string | null;
  receiptNumber: string;
  receivedAt: string;
}

export interface LedgerInvoice {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  payments: LedgerRow[];
}

const inputCls = "rounded-lg border border-line px-2 py-1.5 text-sm";

export const STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  partially_paid: "bg-amber-50 text-amber-700",
  void: "bg-mist text-slate",
  unpaid: "bg-point/10 text-point",
};

export function InvoiceStatusChip({ status, className = "" }: { status: string; className?: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[status] ?? STATUS_TONE.unpaid} ${className}`}
      data-testid="invoice-status"
    >
      {INVOICE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  month: "short",
  day: "numeric",
  year: "numeric",
});

function todayYmd(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Payment history + "Record payment" form for one invoice (spec §42).
 * Used on the job's billing panel and on the invoice page.
 */
export function PaymentLedger({
  invoice,
  compact = false,
}: {
  invoice: LedgerInvoice;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"payment" | "refund">("payment");
  const [amount, setAmount] = useState((invoice.balanceCents / 100).toFixed(2));
  const [method, setMethod] = useState("zelle");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [receivedOn, setReceivedOn] = useState(todayYmd());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const isVoid = invoice.status === "void";
  const canPay = !isVoid && invoice.balanceCents > 0;
  const canRefund = !isVoid && invoice.paidCents > 0;

  function startForm(nextKind: "payment" | "refund") {
    setKind(nextKind);
    setAmount(((nextKind === "payment" ? invoice.balanceCents : invoice.paidCents) / 100).toFixed(2));
    setReference("");
    setNote("");
    setReceivedOn(todayYmd());
    setMessage(null);
    setOpen(true);
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    const result = await recordPaymentAction({
      invoiceId: invoice.id,
      kind,
      amount,
      method,
      reference,
      note,
      receivedOn,
    });
    setBusy(false);
    if (result.ok) {
      const paidInFull = result.status === "paid";
      setMessage({
        ok: true,
        text: `${kind === "refund" ? "Refund" : "Payment"} recorded — receipt ${result.receiptNumber}${
          paidInFull ? ". Paid in full." : ` · balance ${formatCents(result.balanceCents ?? 0)}`
        }${result.warnings?.length ? ` (${result.warnings[0]})` : ""}`,
      });
      setOpen(false);
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.error });
    }
  }

  return (
    <div className="space-y-3" data-testid={`ledger-${invoice.number}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-slate">
          Total <strong className="tabular-nums text-navy">{formatCents(invoice.totalCents)}</strong>
        </span>
        <span className="text-slate">
          Paid <strong className="tabular-nums text-navy">{formatCents(invoice.paidCents)}</strong>
        </span>
        <span className="text-slate">
          Balance{" "}
          <strong className={`tabular-nums ${invoice.balanceCents > 0 ? "text-point" : "text-emerald-700"}`}>
            {formatCents(Math.max(0, invoice.balanceCents))}
          </strong>
        </span>
        <InvoiceStatusChip status={invoice.status} />
      </div>

      {invoice.payments.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white text-sm">
          {invoice.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                <span className={`font-bold tabular-nums ${p.kind === "refund" ? "text-red-700" : "text-navy"}`}>
                  {p.kind === "refund" ? "−" : ""}
                  {formatCents(p.amountCents)}
                </span>{" "}
                <span className="text-slate">
                  {p.kind === "refund" ? "refund" : "payment"} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  {p.reference ? ` · ref ${p.reference}` : ""} · {dateFmt.format(new Date(p.receivedAt))}
                </span>
                {p.note && !compact && <span className="block text-xs text-slate">{p.note}</span>}
              </span>
              <span className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate">{p.receiptNumber}</span>
                <a
                  href={`/manager/invoices/${invoice.id}/receipts/${p.id}`}
                  className="font-bold text-navy hover:text-point"
                >
                  Print receipt
                </a>
                <ResendReceipt paymentId={p.id} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
          data-testid="ledger-message"
        >
          {message.text}
        </p>
      )}

      {!open && (canPay || canRefund) && (
        <div className="flex flex-wrap gap-2">
          {canPay && (
            <button
              type="button"
              onClick={() => startForm("payment")}
              className="rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep"
            >
              Record payment
            </button>
          )}
          {canRefund && (
            <button
              type="button"
              onClick={() => startForm("refund")}
              className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-slate hover:border-point"
            >
              Record refund
            </button>
          )}
        </div>
      )}

      {open && (
        <form
          className="space-y-2 rounded-lg border border-line bg-mist p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-sm font-bold text-navy">
            {kind === "refund" ? "Record a refund" : "Record a payment"}
            <span className="ml-2 font-normal text-slate">
              {kind === "refund"
                ? `up to ${formatCents(invoice.paidCents)} received`
                : `balance ${formatCents(invoice.balanceCents)}`}
            </span>
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate">
              Amount ($)
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} block w-28`}
                aria-label="Amount"
                required
              />
            </label>
            <label className="text-xs font-semibold text-slate">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={`${inputCls} block`}
                aria-label="Method"
              >
                <option value="zelle">Zelle</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate">
              Reference
              <input
                placeholder={method === "check" ? "Check #" : method === "zelle" ? "Confirmation" : "Optional"}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={`${inputCls} block w-32`}
                aria-label="Reference"
              />
            </label>
            <label className="text-xs font-semibold text-slate">
              Date
              <input
                type="date"
                value={receivedOn}
                max={todayYmd()}
                onChange={(e) => setReceivedOn(e.target.value)}
                className={`${inputCls} block`}
                aria-label="Date received"
              />
            </label>
          </div>
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${inputCls} w-full`}
            aria-label="Note"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-soft disabled:opacity-50"
            >
              {busy ? "Saving…" : kind === "refund" ? "Save refund" : "Save payment"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-slate hover:text-navy"
            >
              Cancel
            </button>
            <span className="text-xs text-slate">A receipt is emailed automatically when the customer has an email.</span>
          </div>
        </form>
      )}
    </div>
  );
}

function ResendReceipt({ paymentId }: { paymentId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [text, setText] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const result = await emailReceipt(paymentId);
          if (result.ok) {
            setState("done");
            setText(result.warnings?.[0] ?? "Receipt emailed.");
          } else {
            setState("error");
            setText(result.error);
          }
        }}
        className="font-bold text-navy hover:text-point disabled:opacity-50"
      >
        Email receipt
      </button>
      {text && (
        <span className={state === "error" ? "text-red-700" : "text-emerald-700"}>{text}</span>
      )}
    </>
  );
}
