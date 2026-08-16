# Decision Log

Format: date — decision — why — revisit-if.

- **2026-08-15 — pnpm workspaces, no Turborepo.** Two apps + small packages don't need task orchestration. Revisit if build times hurt.
- **2026-08-15 — PostgreSQL 17 (not 16) + PostGIS.** Homebrew's postgis 3.6.4 builds only for PG17/18; dev runs PG17 on port 5433 beside the machine's existing PG16; production uses `postgis/postgis:17-*`. Keeps dev/prod majors aligned.
- **2026-08-15 — Drizzle ORM + generated-then-hand-edited SQL migrations.** PostGIS types, `tstzrange`, exclusion constraints, and partial indexes need real SQL; Drizzle allows custom types and editable migrations. Prisma rejected (weak PostGIS/exclusion support).
- **2026-08-15 — Reservation table + `EXCLUDE USING gist` instead of application-level conflict checks.** Concurrency safety must not depend on app code (spec §23). Holds share the same exclusion domain, so hold/booking races are impossible by construction.
- **2026-08-15 — Better Auth over NextAuth/custom.** Needs: credential login, Postgres sessions, roles, future invitations/reset — all first-class. Public signup disabled; custom `owner`/`technician` roles via access-control statements (v1.6 requires explicit `roles` config for custom `adminRoles`).
- **2026-08-15 — pg-boss over Redis-backed queues.** One datastore, transactional enqueue, cron scheduling; Railway-friendly.
- **2026-08-15 — Skills mirror service types 1:1 at seed time.** Simplest correct model for §5/§65 (service → required skill); owner can restructure later without schema change.
- **2026-08-15 — Internal packages export TS source; web transpiles.** No build orchestration for shared code; `tsx` runs worker/scripts directly. Revisit if package consumers outside the monorepo appear.
- **2026-08-15 — zod v4 workspace-wide.** better-auth's stack peers on zod 4; config env schema uses `z.url()`.
- **2026-08-15 — Dev geo stubs.** Deterministic ZIP-centroid geocoding + haversine×1.35 @45 km/h travel heuristic until Google API keys are supplied; interfaces already final (spec §84).
