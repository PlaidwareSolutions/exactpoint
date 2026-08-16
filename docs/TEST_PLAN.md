# Test Plan

Bar: spec §80 scenarios A–L all automated before Milestone 3 completes; §81 quality checks before launch.

## How to run

`pnpm test` (Vitest per package). DB integration tests need `TEST_DATABASE_URL` (schema is dropped and rebuilt from migrations each run — this doubles as the migration-reproducibility check; tests skip if unset).

## Status of spec §80 scenarios

| Test | Scenario | Status |
|---|---|---|
| A | Parallel technicians, same time | ✅ DB (`reservations.test.ts`) + engine (`engine.test.ts`) |
| B | Same-technician overlap rejected | ✅ DB + engine + reassignment path (`schedule.test.ts`) |
| C | Skill mismatch excluded | ✅ engine (never a candidate) |
| D | Geographic preference | ✅ engine (Katy-loaded tech outranks empty tech; zoneAffinity component present) |
| E | Travel-impossible rejected | ✅ engine (insertion with insufficient travel gap filtered) |
| F | Time off respected | ✅ DB (`addTimeOff` blocks scheduling; context shows reservation) + engine (no shift → no candidates) |
| G | No public Sunday slots | ✅ `windows.test.ts` + engine (Sunday shift null) |
| H | Emergency: earliest feasible arrival ranks first | ✅ engine |
| I | Two-technician job needs both available | ✅ engine (`generateMultiTechnicianCandidates`; distinct technicians enforced) |
| J | Concurrent booking → exactly one wins | ✅ DB (two connections; exactly one reservation exists) |
| K | Deactivation: history kept, excluded from scheduling, future flagged | ✅ engine (inactive excluded) + `unassignedWork` query surfaces orphaned future assignments |
| L | Manual override allowed + audited | ✅ engine (`validateAssignment`: warnings vs blockers) + audited `assignRequest` E2E path |

E2E (Playwright, 12 tests · iPhone + desktop): booking end-to-end with engine-backed slot + hold + reserved confirmation; unconfirmable address guard; homepage CTAs; owner assigns from an explainable recommendation and sees it on the calendar; technician denied `/manager`.

Also covered now: hold blocks booking; expired hold reaped → slot bookable; reservation source CHECK; role isolation (unit + live HTTP verification); address stub confidence paths; travel heuristics.

## Later phases

- Playwright E2E: booking flow (iPhone/Android viewports), technician status flow (M2+).
- Authorization tests per protected route; API validation tests (M2/M3).
- Manual matrix before launch: §81 (viewports, slow connection, address errors, photo upload, drag/drop, map, reassignment).
