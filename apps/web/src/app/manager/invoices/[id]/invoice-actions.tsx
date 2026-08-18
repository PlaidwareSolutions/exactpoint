"use client";

import { useState } from "react";
import { emailInvoice } from "@/lib/manager/billing-actions";

/** Print / email controls on the invoice page. Hidden when printing. */
export function InvoiceActions({
  invoiceId,
  customerEmail,
}: {
  invoiceId: string;
  customerEmail: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="mx-auto mb-4 flex max-w-2xl flex-wrap items-center gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-soft"
      >
        Print / Save PDF
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const result = await emailInvoice(invoiceId);
          setBusy(false);
          setMessage(
            result.ok
              ? { ok: true, text: `Invoice emailed to ${customerEmail}.` }
              : { ok: false, text: result.error },
          );
        }}
        className="rounded-lg bg-point px-5 py-2.5 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
        title={customerEmail ? `Send to ${customerEmail}` : "No email on file"}
      >
        {busy ? "Sending…" : "Email invoice to customer"}
      </button>
      {message && (
        <span
          className={`text-sm font-semibold ${message.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
