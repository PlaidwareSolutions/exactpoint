# Scheduling Engine

Package: `packages/scheduling` — pure TypeScript, no framework/DB/vendor imports (spec §92.7). The DB enforces integrity; this package decides *what to offer and recommend*.

## Model (spec §10)

**Hard constraints** decide whether a candidate slot may exist:
active technician · required skill · working that day · not on leave/blocked · no reservation overlap · fits within shift · travel physically feasible · serviceable address · duration fits · all technicians available for multi-tech jobs.

**Soft preferences** rank surviving candidates (weights in `scheduling_settings.weights`, owner-tunable, spec §13): customer preference, zone affinity, route proximity, travel efficiency, schedule compactness, workload balance, technician continuity, preferred zone/day — minus penalties for added travel, route fragmentation, idle gaps, cross-Houston trips.

Never relax a hard constraint to improve a score. Scores are heuristics, not claims of optimality.

## Pipeline (spec §11)

1. Resolve service → required skill + duration; resolve address → zone.
2. Filter qualified, active technicians.
3. Per technician: shift template + time off + blocks + reservations → `freeWindows` → `candidateStarts` (granularity + buffers).
4. Travel feasibility against neighboring jobs (RouteProvider — haversine stub now, Google Route Matrix in Phase 7).
5. Score with weights; keep per-component breakdown.
6. Offer top windows to the customer (never technician names); persist breakdowns to `scheduler_decisions` so the owner sees *why* (spec §14).

## Booking commit sequence

candidate chosen → `slot_holds` row + `schedule_reservations` (kind `hold`) — the exclusion constraint arbitrates races → customer confirms → transaction converts hold reservation to the appointment assignment → hold `converted`. Worker expires stale holds every minute.

## Status

Implemented: interval math (`availability.ts`), hard-constraint predicates, types/weights. Milestone 3 adds: candidate generation over real data, scoring, explainability persistence, emergency insertion, multi-technician windows, Optimize Day (recommendations only — confirmed appointments never move without owner approval, spec §16).
