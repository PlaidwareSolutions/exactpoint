"use client";

import { useState } from "react";
import { updateSchedulingSettings } from "@/lib/manager/settings-actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy focus:border-point focus:outline-none";
const labelCls = "block text-sm font-semibold text-navy";

export function SchedulingSettingsForm({
  initial,
}: {
  initial: {
    bookingHorizonDays: number;
    slotGranularityMinutes: number;
    bufferMinutes: number;
    sameDayCutoff: string;
    holdMinutes: number;
    weights: Record<string, number>;
  };
}) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="max-w-3xl rounded-xl border border-line bg-white p-5">
      {message && (
        <p className="mb-3 rounded-lg bg-mist px-4 py-2 text-sm font-semibold text-navy">{message}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelCls}>
          Booking horizon (days)
          <input className={inputCls} type="number" min={1} max={60} value={form.bookingHorizonDays} onChange={(e) => setForm({ ...form, bookingHorizonDays: Number(e.target.value) })} />
        </label>
        <label className={labelCls}>
          Slot granularity (min)
          <input className={inputCls} type="number" min={15} max={120} step={15} value={form.slotGranularityMinutes} onChange={(e) => setForm({ ...form, slotGranularityMinutes: Number(e.target.value) })} />
        </label>
        <label className={labelCls}>
          Buffer (min)
          <input className={inputCls} type="number" min={0} max={120} value={form.bufferMinutes} onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })} />
        </label>
        <label className={labelCls}>
          Same-day cutoff
          <input className={inputCls} type="time" value={form.sameDayCutoff} onChange={(e) => setForm({ ...form, sameDayCutoff: e.target.value })} />
        </label>
        <label className={labelCls}>
          Slot hold (min)
          <input className={inputCls} type="number" min={1} max={60} value={form.holdMinutes} onChange={(e) => setForm({ ...form, holdMinutes: Number(e.target.value) })} />
        </label>
      </div>

      <h2 className="mt-5 font-bold text-navy">Recommendation weights</h2>
      <p className="mt-1 text-xs text-slate">
        Positive values reward a quality; negative values penalize. These tune
        how strongly the scheduler prefers one valid option over another — hard
        constraints are never affected.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Object.entries(form.weights).map(([key, value]) => (
          <label key={key} className="block text-xs font-semibold text-navy">
            {key.replace(/([A-Z])/g, " $1").toLowerCase()}
            <input
              className={inputCls}
              type="number"
              step={0.5}
              value={value}
              onChange={(e) =>
                setForm({
                  ...form,
                  weights: { ...form.weights, [key]: Number(e.target.value) },
                })
              }
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await updateSchedulingSettings(form);
          setBusy(false);
          setMessage(result.ok ? "Saved — new weights apply to the next recommendation." : result.error);
        }}
        className="mt-4 rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
      >
        Save
      </button>
    </section>
  );
}
