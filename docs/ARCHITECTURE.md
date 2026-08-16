# Architecture

Modular monolith (spec §52). One deployable web app + one worker, shared typed packages.

```text
apps/web        Next.js 16 (App Router, Turbopack) — marketing site, booking,
                owner portal (/manager), technician PWA (/tech), auth API
apps/worker     Node + pg-boss (Postgres-backed queue) — hold expiry now;
                email, reminders, route recalculation later
packages/config Env loading + zod validation (loadEnv walks up to repo .env)
packages/domain Business facts + status vocabularies; dependency-free
packages/db     Drizzle schema, SQL migrations, seeds, DB operations
packages/scheduling  Pure-TS engine: availability, hard constraints, scoring
packages/maps   AddressProvider/RouteProvider interfaces + dev stubs
packages/notifications  EmailProvider interface + console provider
packages/ui     Shared components (arrives with Phase 2 design system)
```

## Key decisions

- **PostgreSQL 17 + PostGIS** (Homebrew `postgis` no longer builds for PG16, so dev runs PG17 on port 5433; production matches with a PostGIS-enabled image on Railway).
- **Drizzle ORM** with generated-then-hand-edited SQL migrations — chosen because PostGIS columns, `tstzrange`, and `EXCLUDE USING gist` need real SQL (spec §54). Internal packages export TS source; the web app transpiles them (`transpilePackages`).
- **Better Auth** for owner/technician sessions (Postgres-backed, public signup disabled, admin plugin with custom `owner`/`technician` roles). All authorization enforced server-side.
- **pg-boss** for background jobs — transactional enqueue in the same Postgres, no Redis.
- **Scheduling integrity is in the database**: every consumption of a technician's time (appointment assignment, booking hold, time off, block) is a row in `schedule_reservations`; the exclusion constraint makes same-technician overlaps impossible while parallel technicians are unaffected. See DATA_MODEL.md.
- **Provider abstractions** (spec §84): maps/email/storage vendors are only referenced inside their package; business code sees interfaces. Dev/test uses deterministic stubs until Google/Cloudflare/email credentials are supplied.

## Request flow (booking, Phase 3+)

Customer → Next.js booking flow → validate address (AddressProvider) → zone classification (PostGIS `ST_Contains`, ZIP fallback) → candidate slots (`packages/scheduling` + reservations) → slot hold (reservation row, expiring) → confirmation → service request + work order + appointment + assignment + reservation in one transaction.
