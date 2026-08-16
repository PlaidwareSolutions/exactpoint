"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reassignAction } from "@/lib/manager/schedule-actions";

interface CalendarAppointment {
  appointmentId: string;
  technicianId: string;
  startIso: string;
  endIso: string;
  durationMinutes: number;
  label: string;
  sub: string;
  status: string;
}

const SLOT_MINUTES = 30;
const SLOTS = 24; // 7 AM – 7 PM
const SLOT_PX = 44;

/**
 * Day view with technician lanes (spec §17) and drag-and-drop dispatch
 * (spec §21). Drop targets are (technician, half-hour). The server validates
 * every move; the exclusion constraint has the final word.
 */
export function CalendarDay({
  dayStartIso,
  technicians,
  appointments,
}: {
  dayStartIso: string;
  technicians: { id: string; name: string; color: string }[];
  appointments: CalendarAppointment[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dayStart = new Date(dayStartIso).getTime();

  async function onDrop(technicianId: string, slotIndex: number) {
    if (!dragging) return;
    const appt = appointments.find((a) => a.appointmentId === dragging);
    setDragging(null);
    if (!appt) return;
    const startIso = new Date(dayStart + slotIndex * SLOT_MINUTES * 60_000).toISOString();
    if (appt.technicianId === technicianId && appt.startIso === startIso) return;
    setError(null);
    const result = await reassignAction({
      appointmentId: appt.appointmentId,
      technicianId,
      startIso,
      durationMinutes: appt.durationMinutes,
    });
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  const hourLabel = (i: number) => {
    const h = 7 + Math.floor(i / 2);
    return `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
  };

  return (
    <div className="rounded-xl border border-line bg-white">
      {error && (
        <p className="border-b border-line bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[640px]"
          style={{ gridTemplateColumns: `4.5rem repeat(${technicians.length}, minmax(11rem, 1fr))` }}
        >
          {/* Header row */}
          <div className="border-b border-line" />
          {technicians.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 border-b border-l border-line px-3 py-2 text-sm font-bold text-navy"
            >
              <span className="size-2.5 rounded-full" style={{ background: t.color }} />
              {t.name}
            </div>
          ))}

          {/* Time gutter */}
          <div className="relative" style={{ height: SLOTS * SLOT_PX }}>
            {Array.from({ length: SLOTS / 2 }, (_, h) => (
              <div
                key={h}
                className="absolute right-2 text-xs font-semibold tabular-nums text-slate"
                style={{ top: h * 2 * SLOT_PX - 7 }}
              >
                {h > 0 && hourLabel(h * 2)}
              </div>
            ))}
          </div>

          {/* Lanes */}
          {technicians.map((t) => (
            <div
              key={t.id}
              className="relative border-l border-line"
              style={{ height: SLOTS * SLOT_PX }}
            >
              {Array.from({ length: SLOTS }, (_, i) => (
                <div
                  key={i}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(t.id, i)}
                  className={`absolute inset-x-0 ${i % 2 === 0 ? "border-t border-line/70" : "border-t border-line/30"} ${dragging ? "hover:bg-point/10" : ""}`}
                  style={{ top: i * SLOT_PX, height: SLOT_PX }}
                />
              ))}
              {appointments
                .filter((a) => a.technicianId === t.id)
                .map((a) => {
                  const start = new Date(a.startIso).getTime();
                  const end = new Date(a.endIso).getTime();
                  const top = ((start - dayStart) / 60_000 / SLOT_MINUTES) * SLOT_PX;
                  const height = Math.max(
                    ((end - start) / 60_000 / SLOT_MINUTES) * SLOT_PX - 4,
                    30,
                  );
                  if (top < -SLOT_PX || top > SLOTS * SLOT_PX) return null;
                  return (
                    <div
                      key={a.appointmentId}
                      draggable
                      onDragStart={() => setDragging(a.appointmentId)}
                      onDragEnd={() => setDragging(null)}
                      className="absolute inset-x-1 cursor-grab overflow-hidden rounded-lg border-l-4 bg-mist px-2 py-1 text-xs shadow-sm active:cursor-grabbing"
                      style={{ top: Math.max(top, 0) + 2, height, borderLeftColor: t.color }}
                      title={`${a.label} — drag to move`}
                    >
                      <p className="truncate font-bold text-navy">{a.label}</p>
                      <p className="truncate text-slate">{a.sub}</p>
                      <p className="mt-0.5 inline-block rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate">
                        {a.status.replace(/_/g, " ")}
                      </p>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
      <p className="border-t border-line px-4 py-2 text-xs text-slate">
        Drag a job onto another technician or time to reassign — moves that
        would double-book or break constraints are rejected.
      </p>
    </div>
  );
}
