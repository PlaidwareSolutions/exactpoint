"use client";

import { useState } from "react";
import { updateServiceType } from "@/lib/manager/settings-actions";

export function ServiceRow({
  service,
}: {
  service: {
    id: string;
    name: string;
    category: string;
    durationMinutes: number;
    isActive: boolean;
    requiredSkill: string | null;
  };
}) {
  const [duration, setDuration] = useState(String(service.durationMinutes));
  const [active, setActive] = useState(service.isActive);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");

  return (
    <tr>
      <td className="px-4 py-2.5 font-semibold text-navy">{service.name}</td>
      <td className="px-4 py-2.5 text-slate">{service.category}</td>
      <td className="px-4 py-2.5 text-slate">{service.requiredSkill ?? "—"}</td>
      <td className="px-4 py-2.5">
        <input
          type="number"
          min={15}
          max={480}
          step={15}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-20 rounded-lg border border-line px-2 py-1"
        />{" "}
        <span className="text-xs text-slate">min</span>
      </td>
      <td className="px-4 py-2.5">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-4 accent-point"
        />
      </td>
      <td className="px-4 py-2.5">
        <button
          type="button"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            const result = await updateServiceType(service.id, {
              defaultDurationMinutes: Number(duration),
              isActive: active,
            });
            setState(result.ok ? "saved" : "error");
          }}
          className="rounded-lg border border-line px-3 py-1 text-xs font-bold text-navy hover:border-point disabled:opacity-50"
        >
          {state === "busy" ? "…" : state === "saved" ? "Saved" : "Save"}
        </button>
      </td>
    </tr>
  );
}
