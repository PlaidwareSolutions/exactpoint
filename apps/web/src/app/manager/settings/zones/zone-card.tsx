"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addZoneZip, removeZoneZip, updateZone } from "@/lib/manager/settings-actions";

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function ZoneCard({
  zone,
  zips,
}: {
  zone: {
    id: string;
    name: string;
    color: string;
    isActive: boolean;
    priority: number;
    preferredDays: number[];
  };
  zips: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(zone);
  const [newZip, setNewZip] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await updateZone(zone.id, {
      name: form.name,
      color: form.color,
      isActive: form.isActive,
      priority: form.priority,
      preferredDays: form.preferredDays,
    });
    setBusy(false);
    setMessage(result.ok ? "Saved." : result.error);
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value })}
          className="size-8 rounded"
          aria-label="Zone color"
        />
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="flex-1 rounded-lg border border-line px-3 py-1.5 font-bold text-navy"
        />
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="size-4 accent-point"
          />
          Active
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate">
        Preferred days:
        {DAY_NAMES.map((name, day) => (
          <button
            key={day}
            type="button"
            onClick={() =>
              setForm({
                ...form,
                preferredDays: form.preferredDays.includes(day)
                  ? form.preferredDays.filter((d) => d !== day)
                  : [...form.preferredDays, day],
              })
            }
            className={`rounded-full px-2 py-1 ${
              form.preferredDays.includes(day)
                ? "bg-navy text-white"
                : "bg-mist text-slate"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {zips.map((zip) => (
          <span
            key={zip}
            className="group flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-navy"
          >
            {zip}
            <button
              type="button"
              aria-label={`Remove ${zip}`}
              onClick={async () => {
                await removeZoneZip(zone.id, zip);
                router.refresh();
              }}
              className="text-slate hover:text-red-600"
            >
              ×
            </button>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <input
            value={newZip}
            onChange={(e) => setNewZip(e.target.value)}
            placeholder="Add ZIP"
            className="w-20 rounded-full border border-line px-2.5 py-1 text-xs"
          />
          <button
            type="button"
            onClick={async () => {
              if (!newZip) return;
              const result = await addZoneZip(zone.id, newZip.trim());
              setMessage(result.ok ? null : result.error);
              if (result.ok) {
                setNewZip("");
                router.refresh();
              }
            }}
            className="rounded-full bg-point px-2.5 py-1 text-xs font-bold text-white"
          >
            +
          </button>
        </span>
      </div>

      {message && <p className="mt-2 text-xs font-semibold text-red-700">{message}</p>}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-3 rounded-lg bg-navy px-4 py-1.5 text-xs font-bold text-white hover:bg-navy-soft disabled:opacity-50"
      >
        Save zone
      </button>
    </section>
  );
}
