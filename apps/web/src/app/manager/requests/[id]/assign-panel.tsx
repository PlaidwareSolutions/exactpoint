"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Recommendation } from "@/lib/manager/recommendations";
import { assignRequest, setRequestStatus } from "@/lib/manager/schedule-actions";

/**
 * Explainable recommendations (spec §14) + manual override (Test L).
 * The customer never sees technician names; the owner always does.
 */
export function AssignPanel({
  requestId,
  requestStatus,
  recommendations,
  durationMinutes,
  technicians,
}: {
  requestId: string;
  requestStatus: string;
  recommendations: Recommendation[];
  durationMinutes: number;
  technicians: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [overrideTech, setOverrideTech] = useState("");
  const [overrideStart, setOverrideStart] = useState("");

  if (requestStatus === "converted") {
    return (
      <section className="rounded-xl border border-line bg-white p-5 text-sm text-slate">
        This request has been scheduled — see the calendar.
      </section>
    );
  }

  async function run(fn: () => Promise<{ ok: boolean; error?: string; warnings?: string[] }>) {
    setBusy(true);
    setMessage(null);
    setWarnings([]);
    const result = await fn();
    setBusy(false);
    if (result.ok) {
      setWarnings(result.warnings ?? []);
      router.refresh();
    } else {
      setMessage(result.error ?? "Something went wrong.");
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-navy">Schedule this request</h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => setRequestStatus({ requestId, to: "declined" }))}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate hover:border-point"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => setRequestStatus({ requestId, to: "spam" }))}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate hover:border-point"
          >
            Spam
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{message}</p>
      )}
      {warnings.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Scheduled with warnings: {warnings.join(" · ")}
        </p>
      )}

      <h3 className="mt-4 text-sm font-bold uppercase tracking-wider text-slate">
        Recommended
      </h3>
      {recommendations.length === 0 ? (
        <p className="mt-2 text-sm text-slate">
          No feasible slots found in the booking horizon — use the manual
          override below or adjust technician schedules.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {recommendations.map((rec, i) => (
            <li
              key={`${rec.technicianId}-${rec.startIso}`}
              className="rounded-lg border border-line p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold text-navy">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: rec.color ?? "#94a3b8" }}
                  />
                  {i + 1}. {rec.technicianName} — {rec.label}
                  <span className="text-xs font-bold text-slate">
                    score {rec.totalScore}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      assignRequest({
                        requestId,
                        technicianId: rec.technicianId,
                        startIso: rec.startIso,
                        endIso: rec.endIso,
                        override: false,
                      }),
                    )
                  }
                  className="rounded-lg bg-point px-4 py-1.5 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {rec.reasons.map((reason) => (
                  <li
                    key={reason.key}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      reason.value >= 0 ? "bg-mist text-slate" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {reason.label} ({reason.value > 0 ? "+" : ""}
                    {reason.value})
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-5 text-sm font-bold uppercase tracking-wider text-slate">
        Manual override
      </h3>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-navy">
          Technician
          <select
            value={overrideTech}
            onChange={(e) => setOverrideTech(e.target.value)}
            className="mt-1 block rounded-lg border border-line bg-white px-3 py-2"
          >
            <option value="">Choose…</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-navy">
          Start (local)
          <input
            type="datetime-local"
            value={overrideStart}
            onChange={(e) => setOverrideStart(e.target.value)}
            className="mt-1 block rounded-lg border border-line bg-white px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={busy || !overrideTech || !overrideStart}
          onClick={() => {
            const start = new Date(overrideStart);
            const end = new Date(start.getTime() + durationMinutes * 60_000);
            void run(() =>
              assignRequest({
                requestId,
                technicianId: overrideTech,
                startIso: start.toISOString(),
                endIso: end.toISOString(),
                override: true,
                note: "assigned via manual override",
              }),
            );
          }}
          className="rounded-lg border border-navy px-4 py-2 text-sm font-bold text-navy hover:bg-navy hover:text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Assign manually"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate">
        Overrides are allowed when hard constraints hold (skill, no
        double-booking, travel feasibility) and are recorded in the audit trail.
      </p>
    </section>
  );
}
