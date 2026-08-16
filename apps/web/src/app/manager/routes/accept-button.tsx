"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptRoute } from "@/lib/manager/route-actions";

export function AcceptRouteButton(props: {
  technicianId: string;
  routeDate: string;
  order: { appointmentId: string; travelMinutesFromPrevious: number | null }[];
  totalTravelMinutes: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-2">
      {error && <p className="mb-1 text-xs font-semibold text-red-700">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await acceptRoute(props);
          setBusy(false);
          if (result.ok) router.refresh();
          else setError(result.error);
        }}
        className="rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
      >
        {busy ? "Saving…" : "Accept optimization"}
      </button>
    </div>
  );
}
