# Test Plan

Bar: spec §80 scenarios A–L all automated before Milestone 3 completes; §81 quality checks before launch.

## How to run

`pnpm test` (Vitest per package). DB integration tests need `TEST_DATABASE_URL` (schema is dropped and rebuilt from migrations each run — this doubles as the migration-reproducibility check; tests skip if unset).

## Status of spec §80 scenarios

| Test | Scenario | Status |
|---|---|---|
| A | Parallel technicians, same time | ✅ DB (`reservations.test.ts`) + logic (`availability.test.ts`) |
| B | Same-technician overlap rejected | ✅ DB + logic |
| C | Skill mismatch excluded | ✅ logic (`isQualified`) — engine-level in M3 |
| D | Geographic preference | ⏳ M3 (scoring) |
| E | Travel-impossible rejected | ✅ logic (`travelFeasible`) — engine-level with real travel data in M3 |
| F | Time off respected | ⏳ M3 (time-off reservations already block at DB level) |
| G | No public Sunday slots | ⏳ M2/M3 (booking flow) |
| H | Emergency proximity ranking | ⏳ M3 |
| I | Two-technician job needs both available | ⏳ M3 (schema ready) |
| J | Concurrent booking → exactly one wins | ✅ DB (two connections, `23P01` on loser) |
| K | Deactivation: history kept, future flagged | ⏳ M3 (Team management) |
| L | Manual override allowed + audited | ⏳ M3 |

Also covered now: hold blocks booking; expired hold reaped → slot bookable; reservation source CHECK; role isolation (unit + live HTTP verification); address stub confidence paths; travel heuristics.

## Later phases

- Playwright E2E: booking flow (iPhone/Android viewports), technician status flow (M2+).
- Authorization tests per protected route; API validation tests (M2/M3).
- Manual matrix before launch: §81 (viewports, slow connection, address errors, photo upload, drag/drop, map, reassignment).
