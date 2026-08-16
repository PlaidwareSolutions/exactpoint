import type { Reservation, TimeWindow } from "./types";

/** Half-open interval overlap: [a.start, a.end) ∩ [b.start, b.end) ≠ ∅. */
export function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

export function durationMinutes(w: TimeWindow): number {
  return (w.end.getTime() - w.start.getTime()) / 60_000;
}

/**
 * Subtracts a technician's reservations from a shift window, returning the
 * free intervals in chronological order.
 */
export function freeWindows(shift: TimeWindow, reservations: Reservation[]): TimeWindow[] {
  const relevant = reservations
    .filter((r) => overlaps(r, shift))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const free: TimeWindow[] = [];
  let cursor = shift.start;
  for (const r of relevant) {
    if (r.start > cursor) {
      free.push({ start: cursor, end: r.start });
    }
    if (r.end > cursor) {
      cursor = r.end;
    }
  }
  if (cursor < shift.end) {
    free.push({ start: cursor, end: shift.end });
  }
  return free;
}

/**
 * Candidate start times within the free windows of a shift where a job of
 * `jobMinutes` (+ `bufferMinutes` on each side for travel/padding) fits,
 * stepped by `granularityMinutes`.
 */
export function candidateStarts(
  shift: TimeWindow,
  reservations: Reservation[],
  jobMinutes: number,
  granularityMinutes: number,
  bufferMinutes = 0,
): Date[] {
  const needed = jobMinutes + bufferMinutes * 2;
  const step = granularityMinutes * 60_000;
  const starts: Date[] = [];
  for (const window of freeWindows(shift, reservations)) {
    // Align the first candidate to the granularity grid (relative to the hour).
    const first = new Date(Math.ceil(window.start.getTime() / step) * step);
    for (
      let t = first.getTime();
      t + needed * 60_000 <= window.end.getTime();
      t += step
    ) {
      starts.push(new Date(t + bufferMinutes * 60_000));
    }
  }
  return starts;
}
