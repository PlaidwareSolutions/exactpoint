"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAppointmentStatus } from "@/lib/manager/schedule-actions";
import { techComplete } from "@/lib/tech/actions";

const TRANSITIONS = [
  "confirmed",
  "en_route",
  "arrived",
  "in_progress",
  "waiting_part",
  "follow_up_required",
  "customer_declined",
  "cancelled",
  "no_show",
] as const;

export function StatusControls({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState("");

  if (status === "completed") {
    return (
      <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-slate">
        Job completed — warranty recorded above.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-bold text-navy">Update status</h2>
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {TRANSITIONS.filter((t) => t !== status).map((t) => (
          <button
            key={t}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await setAppointmentStatus({ appointmentId, to: t });
              setBusy(false);
              if (result.ok) router.refresh();
              else setError(result.error);
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-navy hover:border-point disabled:opacity-50"
          >
            {t.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex-1 text-sm font-semibold text-navy">
          Complete — what was repaired?
          <input
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="e.g. Replaced igniter — oven heating again"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={busy || issue.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const result = await techComplete({ appointmentId, issueRepaired: issue });
            setBusy(false);
            if (result.ok) router.refresh();
            else setError(result.error);
          }}
          className="rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
        >
          Complete job
        </button>
      </div>
      <p className="mt-2 text-xs text-slate">
        Cancelling, declining, or no-show frees the technician&apos;s reserved
        time. Completing records the labor warranty.
      </p>
    </section>
  );
}
