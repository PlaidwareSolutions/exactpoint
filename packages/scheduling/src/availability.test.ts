import { describe, expect, it } from "vitest";
import { candidateStarts, freeWindows, overlaps } from "./availability";
import {
  conflictsWithReservations,
  fitsWithinShift,
  isQualified,
  travelFeasible,
} from "./hard-constraints";
import type { TechnicianSnapshot } from "./types";

const d = (iso: string) => new Date(iso);

describe("overlaps", () => {
  it("detects overlapping windows", () => {
    expect(
      overlaps(
        { start: d("2026-08-18T10:00:00Z"), end: d("2026-08-18T12:00:00Z") },
        { start: d("2026-08-18T11:00:00Z"), end: d("2026-08-18T13:00:00Z") },
      ),
    ).toBe(true);
  });

  it("treats touching half-open intervals as non-overlapping", () => {
    expect(
      overlaps(
        { start: d("2026-08-18T10:00:00Z"), end: d("2026-08-18T12:00:00Z") },
        { start: d("2026-08-18T12:00:00Z"), end: d("2026-08-18T14:00:00Z") },
      ),
    ).toBe(false);
  });
});

describe("freeWindows", () => {
  const shift = { start: d("2026-08-18T13:00:00Z"), end: d("2026-08-19T01:00:00Z") }; // 8a–8p CDT

  it("returns the whole shift when nothing is booked", () => {
    expect(freeWindows(shift, [])).toEqual([shift]);
  });

  it("splits around existing reservations", () => {
    const free = freeWindows(shift, [
      { technicianId: "t1", start: d("2026-08-18T15:00:00Z"), end: d("2026-08-18T17:00:00Z") },
    ]);
    expect(free).toEqual([
      { start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T15:00:00Z") },
      { start: d("2026-08-18T17:00:00Z"), end: d("2026-08-19T01:00:00Z") },
    ]);
  });

  it("handles overlapping reservations without producing negative windows", () => {
    const free = freeWindows(shift, [
      { technicianId: "t1", start: d("2026-08-18T14:00:00Z"), end: d("2026-08-18T18:00:00Z") },
      { technicianId: "t1", start: d("2026-08-18T15:00:00Z"), end: d("2026-08-18T17:00:00Z") },
    ]);
    expect(free).toEqual([
      { start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T14:00:00Z") },
      { start: d("2026-08-18T18:00:00Z"), end: d("2026-08-19T01:00:00Z") },
    ]);
  });
});

describe("candidateStarts", () => {
  it("only proposes starts where the job plus buffers fits", () => {
    const shift = { start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T16:00:00Z") };
    const starts = candidateStarts(shift, [], 90, 30, 15);
    // 90m job + 2×15m buffer = 120m needed inside a 180m shift.
    expect(starts.length).toBeGreaterThan(0);
    for (const s of starts) {
      expect(s.getTime() + 90 * 60_000 + 15 * 60_000).toBeLessThanOrEqual(
        shift.end.getTime(),
      );
    }
  });
});

describe("hard constraints", () => {
  const tech: TechnicianSnapshot = {
    id: "tech-a",
    isActive: true,
    skillSlugs: ["refrigerator", "washer", "dryer"],
  };

  it("Test C — skill mismatch: appliance-only technician is not an HVAC candidate", () => {
    expect(isQualified(tech, "ac_repair")).toBe(false);
    expect(isQualified(tech, "refrigerator")).toBe(true);
  });

  it("rejects inactive technicians regardless of skills", () => {
    expect(isQualified({ ...tech, isActive: false }, "refrigerator")).toBe(false);
  });

  it("Test B (logic layer) — same-technician overlap conflicts", () => {
    const existing = [
      { technicianId: "tech-a", start: d("2026-08-18T15:00:00Z"), end: d("2026-08-18T17:00:00Z") },
    ];
    const candidate = { start: d("2026-08-18T16:00:00Z"), end: d("2026-08-18T18:00:00Z") };
    expect(conflictsWithReservations(candidate, "tech-a", existing)).toBe(true);
    // Test A — a different technician at the same time is fine.
    expect(conflictsWithReservations(candidate, "tech-b", existing)).toBe(false);
  });

  it("Test E — travel-impossible candidate is rejected", () => {
    // Previous job ends 10:00 in Katy; next would start 10:05 in Pearland (~45 min away).
    expect(travelFeasible(d("2026-08-18T15:00:00Z"), d("2026-08-18T15:05:00Z"), 45)).toBe(false);
    expect(travelFeasible(d("2026-08-18T15:00:00Z"), d("2026-08-18T16:00:00Z"), 45)).toBe(true);
  });

  it("keeps candidates inside the shift", () => {
    const shift = { start: d("2026-08-18T13:00:00Z"), end: d("2026-08-19T01:00:00Z") };
    expect(
      fitsWithinShift({ start: d("2026-08-18T14:00:00Z"), end: d("2026-08-18T15:30:00Z") }, shift),
    ).toBe(true);
    expect(
      fitsWithinShift({ start: d("2026-08-19T00:30:00Z"), end: d("2026-08-19T02:00:00Z") }, shift),
    ).toBe(false);
  });
});
