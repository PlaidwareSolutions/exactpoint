"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { blockTimeAction } from "@/lib/manager/schedule-actions";

/** Block a technician's time or the whole company (spec §27). */
export function BlockTimeButton({
  ymd,
  technicians,
}: {
  ymd: string;
  technicians: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [technicianId, setTechnicianId] = useState<string>("");
  const [start, setStart] = useState(`${ymd}T12:00`);
  const [end, setEnd] = useState(`${ymd}T13:00`);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:border-point"
      >
        Block time
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="font-semibold text-navy">
          Who
          <select
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            className="mt-1 block rounded-lg border border-line px-3 py-2"
          >
            <option value="">Whole company</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="font-semibold text-navy">
          From
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 block rounded-lg border border-line px-3 py-2"
          />
        </label>
        <label className="font-semibold text-navy">
          To
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 block rounded-lg border border-line px-3 py-2"
          />
        </label>
        <label className="flex-1 font-semibold text-navy">
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. supplier run, vehicle service"
            className="mt-1 block w-full rounded-lg border border-line px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const result = await blockTimeAction({
              technicianId: technicianId || null,
              startIso: new Date(start).toISOString(),
              endIso: new Date(end).toISOString(),
              reason,
            });
            setBusy(false);
            if (result.ok) {
              setMessage(
                result.conflicts
                  ? `Blocked — ${result.conflicts} technician(s) skipped due to existing appointments.`
                  : "Blocked.",
              );
              router.refresh();
            } else {
              setMessage(result.error);
            }
          }}
          className="rounded-lg bg-navy px-4 py-2 font-bold text-white hover:bg-navy-soft disabled:opacity-50"
        >
          {busy ? "Blocking…" : "Block"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-3 py-2 font-semibold text-slate"
        >
          Close
        </button>
      </div>
      {message && <p className="mt-2 text-sm font-semibold text-navy">{message}</p>}
      <p className="mt-1 text-xs text-slate">
        Blocked time disappears from public booking availability immediately.
        Times are your local timezone.
      </p>
    </div>
  );
}
