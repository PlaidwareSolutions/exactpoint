import { describe, expect, it } from "vitest";
import {
  generateCandidates,
  generateMultiTechnicianCandidates,
  validateAssignment,
  type CandidateRequest,
  type EngineOptions,
  type GeoPoint,
  type TechnicianContext,
  type TechnicianDay,
} from "./engine";
import { DEFAULT_WEIGHTS_FOR_TESTS } from "./test-fixtures";

const d = (iso: string) => new Date(iso);

const KATY: GeoPoint = { latitude: 29.745, longitude: -95.735 };
const KATY_2: GeoPoint = { latitude: 29.76, longitude: -95.72 };
const PEARLAND: GeoPoint = { latitude: 29.55, longitude: -95.35 };

/** Straight-line-ish heuristic used across tests: ~1 min per km + 5. */
const travelMinutes = (a: GeoPoint, b: GeoPoint) => {
  const dx = (a.longitude - b.longitude) * 97;
  const dy = (a.latitude - b.latitude) * 111;
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 1.2) + 5;
};

const options: EngineOptions = {
  weights: DEFAULT_WEIGHTS_FOR_TESTS,
  granularityMinutes: 30,
  bufferMinutes: 0,
  travelMinutes,
  now: d("2026-08-17T12:00:00Z"),
};

// Tuesday 2026-08-18, 8 AM–7 PM CDT expressed in UTC.
const TUESDAY = "2026-08-18";
const shift = { start: d("2026-08-18T13:00:00Z"), end: d("2026-08-19T00:00:00Z") };

function workingDay(over: Partial<TechnicianDay> = {}): TechnicianDay {
  return { date: TUESDAY, shift, reservations: [], jobs: [], ...over };
}

function tech(id: string, over: Partial<TechnicianContext> = {}): TechnicianContext {
  return {
    id,
    isActive: true,
    skillSlugs: ["refrigerator", "washer", "dryer", "ac_repair"],
    days: [workingDay()],
    ...over,
  };
}

const fridgeKaty: CandidateRequest = {
  durationMinutes: 90,
  requiredSkillSlug: "refrigerator",
  zoneId: "west",
  location: KATY,
  urgency: "normal",
};

describe("generateCandidates — hard constraints", () => {
  it("Test A — both technicians can be offered the same time in parallel", () => {
    const candidates = generateCandidates(fridgeKaty, [tech("shams"), tech("a")], options);
    const at10 = candidates.filter(
      (c) => c.window.start.toISOString() === "2026-08-18T15:00:00.000Z",
    );
    expect(new Set(at10.map((c) => c.technicianId))).toEqual(new Set(["shams", "a"]));
  });

  it("Test B — an existing reservation removes overlapping candidates", () => {
    const busy = tech("shams", {
      days: [
        workingDay({
          reservations: [
            { technicianId: "shams", start: d("2026-08-18T15:00:00Z"), end: d("2026-08-18T17:00:00Z") },
          ],
        }),
      ],
    });
    const candidates = generateCandidates(fridgeKaty, [busy], options);
    for (const c of candidates) {
      const overlapsBusy =
        c.window.start < d("2026-08-18T17:00:00Z") && d("2026-08-18T15:00:00Z") < c.window.end;
      expect(overlapsBusy).toBe(false);
    }
  });

  it("Test C — a technician without the skill is never a candidate", () => {
    const applianceOnly = tech("a", { skillSlugs: ["refrigerator", "washer", "dryer"] });
    const hvac: CandidateRequest = { ...fridgeKaty, requiredSkillSlug: "ac_repair" };
    const candidates = generateCandidates(hvac, [applianceOnly], options);
    expect(candidates).toHaveLength(0);
  });

  it("Test E — travel-impossible insertions are rejected", () => {
    // Existing Katy job ends 10:00; Pearland job would start 10:00 sharp —
    // ~50 min of driving with zero gap must be filtered out.
    const busy = tech("shams", {
      days: [
        workingDay({
          reservations: [
            { technicianId: "shams", start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T15:00:00Z") },
          ],
          jobs: [
            { start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T15:00:00Z"), location: KATY, zoneId: "west" },
          ],
        }),
      ],
    });
    const pearland: CandidateRequest = { ...fridgeKaty, zoneId: "south", location: PEARLAND };
    const candidates = generateCandidates(pearland, [busy], options);
    const impossible = candidates.find(
      (c) => c.window.start.getTime() - d("2026-08-18T15:00:00Z").getTime() < 40 * 60_000
        && c.window.start >= d("2026-08-18T15:00:00Z"),
    );
    expect(impossible).toBeUndefined();
  });

  it("Test F — a day off produces no candidates", () => {
    const off = tech("b", { days: [workingDay({ shift: null })] });
    expect(generateCandidates(fridgeKaty, [off], options)).toHaveLength(0);
  });

  it("Test G — Sunday (no shift) is never offered", () => {
    const sunday = tech("shams", {
      days: [{ date: "2026-08-23", shift: null, reservations: [], jobs: [] }],
    });
    expect(generateCandidates(fridgeKaty, [sunday], options)).toHaveLength(0);
  });

  it("Test K — an inactive technician is excluded entirely", () => {
    const deactivated = tech("b", { isActive: false });
    expect(generateCandidates(fridgeKaty, [deactivated], options)).toHaveLength(0);
  });

  it("respects a technician's max daily jobs", () => {
    const maxed = tech("a", {
      maxDailyJobs: 1,
      days: [
        workingDay({
          jobs: [{ start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T14:00:00Z"), location: KATY }],
          reservations: [
            { technicianId: "a", start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T14:00:00Z") },
          ],
        }),
      ],
    });
    expect(generateCandidates(fridgeKaty, [maxed], options)).toHaveLength(0);
  });
});

describe("generateCandidates — soft preferences", () => {
  it("Test D — a technician already working Katy outranks an empty one for a Katy job", () => {
    const inKaty = tech("shams", {
      days: [
        workingDay({
          reservations: [
            { technicianId: "shams", start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T14:30:00Z") },
          ],
          jobs: [
            { start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T14:30:00Z"), location: KATY_2, zoneId: "west" },
          ],
        }),
      ],
    });
    const empty = tech("b");
    const candidates = generateCandidates(fridgeKaty, [inKaty, empty], options);
    expect(candidates[0]!.technicianId).toBe("shams");
    const bestShams = candidates.find((c) => c.technicianId === "shams")!;
    const bestEmpty = candidates.find((c) => c.technicianId === "b")!;
    expect(bestShams.totalScore).toBeGreaterThan(bestEmpty.totalScore);
    expect(bestShams.scoreBreakdown.map((s) => s.key)).toContain("zoneAffinity");
  });

  it("Test H — emergencies rank by earliest feasible arrival", () => {
    const nearby = tech("a", {
      days: [
        workingDay({
          reservations: [
            { technicianId: "a", start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T14:00:00Z") },
          ],
          jobs: [{ start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T14:00:00Z"), location: KATY_2, zoneId: "west" }],
        }),
      ],
    });
    const emergency: CandidateRequest = { ...fridgeKaty, urgency: "emergency" };
    const candidates = generateCandidates(emergency, [nearby, tech("b")], {
      ...options,
      now: d("2026-08-18T13:30:00Z"),
    });
    expect(candidates.length).toBeGreaterThan(0);
    // Sorted by start ascending for emergencies.
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i]!.window.start.getTime()).toBeGreaterThanOrEqual(
        candidates[i - 1]!.window.start.getTime(),
      );
    }
  });

  it("scores carry an explainable component breakdown (spec §14)", () => {
    const candidates = generateCandidates(fridgeKaty, [tech("shams")], options);
    expect(candidates[0]!.scoreBreakdown.every((c) => c.label.length > 0)).toBe(true);
  });

  it("prefers the customer's requested window when feasible", () => {
    const preferred: CandidateRequest = {
      ...fridgeKaty,
      preferredWindows: [{ start: d("2026-08-18T15:00:00Z"), end: d("2026-08-18T18:00:00Z") }],
    };
    const candidates = generateCandidates(preferred, [tech("shams")], {
      ...options,
      maxCandidatesPerTechnician: 40,
    });
    const inWindow = candidates.find(
      (c) =>
        c.window.start >= d("2026-08-18T15:00:00Z") &&
        c.window.start < d("2026-08-18T18:00:00Z"),
    )!;
    const outside = candidates.find((c) => c.window.start >= d("2026-08-18T20:00:00Z"))!;
    expect(inWindow.totalScore).toBeGreaterThan(outside.totalScore);
  });
});

describe("Test I — multi-technician jobs", () => {
  it("only offers windows where every required technician is free", () => {
    const lead = tech("shams");
    const helper = tech("b", {
      days: [
        workingDay({
          reservations: [
            // Helper busy all morning.
            { technicianId: "b", start: d("2026-08-18T13:00:00Z"), end: d("2026-08-18T18:00:00Z") },
          ],
        }),
      ],
    });
    const slots = generateMultiTechnicianCandidates(fridgeKaty, [[lead], [helper]], {
      ...options,
      maxCandidatesPerTechnician: 40,
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.technicianIds).toHaveLength(2);
      expect(slot.window.start.getTime()).toBeGreaterThanOrEqual(d("2026-08-18T18:00:00Z").getTime());
    }
  });

  it("never assigns the same technician to both roles", () => {
    const only = tech("shams");
    const slots = generateMultiTechnicianCandidates(fridgeKaty, [[only], [only]], options);
    expect(slots).toHaveLength(0);
  });
});

describe("Test L — manual override validation", () => {
  const day = workingDay({
    reservations: [
      { technicianId: "a", start: d("2026-08-18T15:00:00Z"), end: d("2026-08-18T17:00:00Z") },
    ],
    jobs: [{ start: d("2026-08-18T15:00:00Z"), end: d("2026-08-18T17:00:00Z"), location: KATY, zoneId: "west" }],
  });

  it("allows an override that satisfies hard constraints, with soft warnings only", () => {
    const result = validateAssignment(
      tech("a"),
      workingDay({ jobs: day.jobs, reservations: day.reservations }),
      { start: d("2026-08-18T18:00:00Z"), end: d("2026-08-18T19:30:00Z") },
      "refrigerator",
      { travelMinutes },
      PEARLAND,
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0); // cross-town travel warning
  });

  it("blocks an override that double-books the technician", () => {
    const result = validateAssignment(
      tech("a"),
      day,
      { start: d("2026-08-18T16:00:00Z"), end: d("2026-08-18T17:30:00Z") },
      "refrigerator",
      { travelMinutes },
      KATY,
    );
    expect(result.ok).toBe(false);
    expect(result.blockers.join(" ")).toMatch(/existing reservation/);
  });

  it("blocks assignment to an unqualified or inactive technician", () => {
    expect(
      validateAssignment(tech("a", { skillSlugs: [] }), day, { start: d("2026-08-18T18:00:00Z"), end: d("2026-08-18T19:00:00Z") }, "refrigerator", { travelMinutes }, KATY).ok,
    ).toBe(false);
    expect(
      validateAssignment(tech("a", { isActive: false }), day, { start: d("2026-08-18T18:00:00Z"), end: d("2026-08-18T19:00:00Z") }, "refrigerator", { travelMinutes }, KATY).ok,
    ).toBe(false);
  });
});
