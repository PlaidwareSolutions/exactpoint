"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer } from "@/lib/manager/customer-actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy focus:border-point focus:outline-none";
const labelCls = "block text-sm font-semibold text-navy";

export function EditCustomerForm({
  customerId,
  initial,
}: {
  customerId: string;
  initial: { firstName: string; lastName: string; phone: string; email: string; notes: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-navy hover:border-point"
      >
        Edit details
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-xl border border-line bg-white p-4">
      {message && (
        <p
          className={`mb-3 rounded-lg px-3 py-2 text-sm font-semibold ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          First name
          <input className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </label>
        <label className={labelCls}>
          Last name
          <input className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </label>
        <label className={labelCls}>
          Phone
          <input className={inputCls} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className={labelCls}>
          Email
          <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
      </div>
      <label className={`${labelCls} mt-3`}>
        Notes
        <textarea className={`${inputCls} min-h-16`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const result = await updateCustomer(customerId, form);
            setBusy(false);
            if (result.ok) {
              setMessage({ ok: true, text: "Saved." });
              router.refresh();
            } else {
              setMessage({ ok: false, text: result.error });
            }
          }}
          className="rounded-lg bg-point px-5 py-2 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-slate"
        >
          Close
        </button>
      </div>
      <p className="mt-2 text-xs text-slate">
        Addresses aren&apos;t edited here — they&apos;re validated and mapped.
        For a new address, use ＋ New Booking and it will attach to this customer.
      </p>
    </div>
  );
}
