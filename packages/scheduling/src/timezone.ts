/**
 * Business-timezone helpers (America/Chicago). No hard-coded UTC offsets —
 * DST is resolved via Intl (spec §62).
 */

/** Converts a local wall-clock time in `timeZone` to the UTC instant. */
export function zonedTimeToUtc(ymd: string, hm: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const utcGuess = Date.UTC(y!, m! - 1, d!, hh!, mm ?? 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asIfLocal = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(utcGuess - (asIfLocal - utcGuess));
}

/** The YYYY-MM-DD date of an instant in `timeZone`. */
export function ymdInTimeZone(instant: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(instant);
}

/** Weekday (0=Sun..6=Sat) of a YYYY-MM-DD calendar date. */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).getUTCDay();
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days, 12)).toISOString().slice(0, 10);
}
