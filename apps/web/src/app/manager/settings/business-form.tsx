"use client";

import { useState } from "react";
import { updateBusinessSettings } from "@/lib/manager/settings-actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy focus:border-point focus:outline-none";
const labelCls = "block text-sm font-semibold text-navy";

export function BusinessSettingsForm({
  initial,
}: {
  initial: {
    phone: string;
    email: string;
    diagnosticFeeCents: number;
    laborWarrantyMonths: number;
    legalName: string;
    timezone: string;
  };
}) {
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [fee, setFee] = useState(String(initial.diagnosticFeeCents / 100));
  const [warranty, setWarranty] = useState(String(initial.laborWarrantyMonths));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="max-w-xl rounded-xl border border-line bg-white p-5">
      {message && (
        <p className="mb-3 rounded-lg bg-mist px-4 py-2 text-sm font-semibold text-navy">{message}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Phone
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className={labelCls}>
          Email
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={labelCls}>
          Diagnostic fee ($)
          <input className={inputCls} type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className={labelCls}>
          Labor warranty (months)
          <input className={inputCls} type="number" min={0} value={warranty} onChange={(e) => setWarranty(e.target.value)} />
        </label>
      </div>
      <p className="mt-3 text-xs text-slate">
        Legal name: {initial.legalName} · Timezone: {initial.timezone}. Hours are
        managed per-technician under Team.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await updateBusinessSettings({
            phone,
            email,
            diagnosticFeeCents: Math.round(Number(fee) * 100),
            laborWarrantyMonths: Number(warranty),
          });
          setBusy(false);
          setMessage(result.ok ? "Saved." : result.error);
        }}
        className="mt-4 rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
      >
        Save
      </button>
    </section>
  );
}
