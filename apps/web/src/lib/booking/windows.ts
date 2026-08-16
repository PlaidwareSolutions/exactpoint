import { BUSINESS } from "@exactpoint/domain";

export interface OfferedWindow {
  date: string; // YYYY-MM-DD in business timezone
  start: string; // HH:MM
  end: string; // HH:MM
  label: string;
}

/** Customer-facing 3-hour arrival windows inside business hours. */
const DAY_WINDOWS: { start: string; end: string }[] = [
  { start: "07:00", end: "10:00" },
  { start: "10:00", end: "13:00" },
  { start: "13:00", end: "16:00" },
  { start: "16:00", end: "19:00" },
];

const SAME_DAY_CUTOFF_HOUR = 15;

function businessNowParts(now: Date): { ymd: string; weekday: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdays.indexOf(parts.weekday ?? "Sun"),
    hour: Number(parts.hour),
  };
}

function addDaysYmd(ymd: string, days: number): { ymd: string; weekday: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days, 12));
  const weekday = dt.getUTCDay();
  return { ymd: dt.toISOString().slice(0, 10), weekday };
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function friendlyLabel(ymd: string, weekday: number, start: string, end: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  const to12 = (t: string) => {
    const h = Number(t.slice(0, 2));
    return `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
  };
  return `${WEEKDAY_LABELS[weekday]} ${m}/${d}, ${to12(start)}–${to12(end)}`;
}

/**
 * Windows offered to the customer over the next `horizonDays` business days.
 * Sundays are never offered (spec Test G). Today's windows are offered only
 * before the same-day cutoff and only if they haven't started yet.
 * (Per-technician availability refines these in Milestone 3 — these are
 * customer preferences, confirmed by ExactPoint.)
 */
export function offeredWindows(now = new Date(), horizonDays = 7): OfferedWindow[] {
  const today = businessNowParts(now);
  const out: OfferedWindow[] = [];

  for (let offset = 0; offset <= horizonDays && out.length < 16; offset++) {
    const day = offset === 0
      ? { ymd: today.ymd, weekday: today.weekday }
      : addDaysYmd(today.ymd, offset);
    if (day.weekday === 0) continue; // Sunday closed

    for (const w of DAY_WINDOWS) {
      if (offset === 0) {
        if (today.hour >= SAME_DAY_CUTOFF_HOUR) continue;
        if (Number(w.start.slice(0, 2)) <= today.hour) continue;
      }
      out.push({
        date: day.ymd,
        start: w.start,
        end: w.end,
        label: friendlyLabel(day.ymd, day.weekday, w.start, w.end),
      });
    }
  }
  return out;
}
