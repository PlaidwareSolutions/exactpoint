# ExactPoint Digital Service Platform

Field-service management platform for **ExactPoint Appliance & HVAC Services** (Greater Houston):

- **Customer website** — exactpointrepairs.com: service info, trust content, and intelligent online booking.
- **ExactPoint Service Manager** — private owner/dispatch app: technicians, customers, multi-technician geo-aware scheduling, routes.
- **ExactPoint Technician PWA** — mobile field workflow for technicians.

See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) for the full product specification and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for architecture decisions.

## Repository layout

```text
apps/
  web/       Next.js app: marketing site + booking + owner portal + technician PWA
  worker/    Background jobs (pg-boss): hold expiry, email, reminders, route recalc
packages/
  config/    Env loading & validation
  domain/    Business constants, status vocabularies, shared types (dependency-free)
  db/        Drizzle schema, SQL migrations, seeds (PostgreSQL 17 + PostGIS)
  scheduling/ Pure-TypeScript scheduling engine (no framework/vendor imports)
  maps/      AddressProvider / RouteProvider abstractions (+ dev stubs)
  notifications/ EmailProvider abstraction (+ console provider)
  ui/        Shared UI components
docs/        Product spec, architecture, data model, runbooks
```

## Development setup

Requires Node ≥ 22, pnpm 9, PostgreSQL 17 with PostGIS (Homebrew: `brew install postgresql@17 postgis`, running on port 5433).

```sh
pnpm install
cp .env.example .env        # then fill in secrets
createdb -p 5433 exactpoint_dev
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Checks: `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm test`
