# Data Model

Schema source: `packages/db/src/schema/*.ts`; migrations in `packages/db/migrations/`.

## Core chain (spec §61)

```text
customers ─ customer_addresses (PostGIS point, zone, validation status)
         └─ equipment
         └─ service_requests (EP-#### reference)
               └─ work_orders (a job; may span visits)
                     └─ appointments (customer-facing window)
                           └─ appointment_technicians (1..n per appointment; lead/helper)
                                 └─ schedule_reservations (technician time consumption)
```

- **Service Request ≠ Work Order ≠ Appointment** (spec §36): a request is the customer's ask; a work order is the job; an appointment is one visit. Multi-visit jobs are normal (diagnose, then install part).
- **Appointment↔technician is many-to-many** via `appointment_technicians` (spec §6) — no `appointment.technician_id` anywhere.

## Scheduling integrity (spec §23–24)

`schedule_reservations`: `technician_id` + `time_range tstzrange` + `kind` (appointment | hold | time_off | block) + exactly one source FK (CHECK `num_nonnulls(...) = 1`).

```sql
EXCLUDE USING gist (technician_id WITH =, time_range WITH &&)
```

- Same technician, overlapping ranges → `23P01` exclusion violation. Different technicians never conflict. Ranges are half-open `[start, end)`, so back-to-back is legal.
- `slot_holds` own a reservation while a customer confirms; the worker expires stale holds (`expireSlotHolds`) which frees the reservation. Hold→appointment conversion swaps the reservation source in one transaction.
- Proven by `packages/db/src/reservations.test.ts` (spec Tests A, B, J + hold lifecycle), which rebuilds the schema from migrations each run.

## Geography (spec §7–8)

- `customer_addresses.geom geometry(Point,4326)` is canonical; lat/lng columns are conveniences; GiST-indexed.
- `service_zones` (owner-configurable) + `service_zone_zips` (fallback classification) + `service_zone_polygons` (`MultiPolygon`, `ST_Contains` classification in Phase 6). `zone_source` records auto_polygon / auto_zip / manual.

## Team

`technician_profiles` (deactivate, never delete) — optional `user_id` link to auth `users`; `technician_skills` ↔ `skills` (service types reference a required skill); `technician_availability` (weekly template, multiple windows/day); `technician_time_off`; `schedule_blocks` (NULL technician = company-wide).

## Settings & ops

- `business_settings` / `scheduling_settings`: singletons (CHECK id = 1). Scheduler weights live in `scheduling_settings.weights` (jsonb) — never in code.
- `audit_logs` (append-only), `scheduler_decisions` (explainability, spec §67), `job_status_history`, `notifications`, `media_assets` (R2 object keys only; `is_publishable` gates public use), `warranties` (2-month labor), `daily_routes`/`route_stops`.

## Conventions

- Domain tables: `uuid` PKs (`gen_random_uuid()`); auth tables: Better Auth text ids.
- Timestamps `timestamptz` (UTC); business rendering in America/Chicago.
- `service_requests.reference` = `'EP-' || nextval('service_request_ref_seq')` (starts 1001).
