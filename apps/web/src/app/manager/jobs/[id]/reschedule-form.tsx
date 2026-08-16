"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reassignAction } from "@/lib/manager/schedule-actions";

/** Cross-day reschedule / technician change; conflicts are DB-rejected. */
export function RescheduleForm({
  appointmentId,
  currentTechnicianId,
  durationMinutes,
  startLocalValue,
  technicians,
}: {
  appointmentId: string;
  currentTechnicianId: string | null;
  durationMinutes: number;
  /** Current scheduled start formatted for datetime-local in business tz. */
  startLocalValue: string;
  technicians: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [technicianId, setTechnicianId] = useState(currentTechnicianId ?? "");
  const [start, setStart] = useState(startLocalValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-bold text-navy">Reschedule</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
        <label className="font-semibold text-navy">
          Technician
          <select
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            className="mt-1 block rounded-lg border border-line px-3 py-2"
          >
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="font-semibold text-navy">
          New start (local)
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 block rounded-lg border border-line px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={busy || !technicianId || !start}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const result = await reassignAction({
              appointmentId,
              technicianId,
              startIso: new Date(start).toISOString(),
              durationMinutes,
            });
            setBusy(false);
            if (result.ok) {
              setMessage({ ok: true, text: "Rescheduled." });
              router.refresh();
            } else {
              setMessage({ ok: false, text: result.error });
            }
          }}
          className="rounded-lg bg-navy px-4 py-2 font-bold text-white hover:bg-navy-soft disabled:opacity-50"
        >
          {busy ? "Moving…" : "Move appointment"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}
      <p className="mt-1 text-xs text-slate">
        Moves that would double-book the technician are rejected. The customer
        window follows the new time — let the customer know before moving a
        confirmed appointment.
      </p>
    </section>
  );
}
