"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuoteDraft } from "@/lib/manager/billing-actions";

/** Quote-first entry: price a job before anything is scheduled. */
export function CreateQuoteButton({
  customerId,
  addressId,
}: {
  customerId: string;
  addressId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!addressId) {
    return (
      <span
        className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-slate"
        title="Add a service address first (book them once via ＋ New Booking)"
      >
        Create quote (needs an address)
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await createQuoteDraft(customerId, addressId);
          setBusy(false);
          if (result.ok && result.workOrderId) {
            router.push(`/manager/quotes/${result.workOrderId}`);
          } else if (!result.ok) {
            setError(result.error);
          }
        }}
        className="rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create quote"}
      </button>
      {error && <span className="text-xs font-semibold text-red-700">{error}</span>}
    </span>
  );
}
