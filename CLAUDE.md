# ExactPoint — Instructions for Claude sessions

Field-service platform for **Exact Point Appliance & HVAC Services** (Greater Houston).
The authoritative product requirements live in [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) — read it before large changes. Current status: [docs/PROGRESS.md](docs/PROGRESS.md).

## Non-negotiable rules

1. **Never weaken scheduling-conflict controls.** The `EXCLUDE USING gist` constraint on `schedule_reservations` is the double-booking safeguard; tests must adapt to it, never the reverse.
2. **Never fabricate business content** — no invented reviews, ratings, years in business, licenses, certifications, response-time or 24/7 claims. Only facts in `packages/domain/src/business.ts` are verified.
3. **Never expose the owner's residential address** anywhere (site, metadata, structured data, defaults). This is a service-area business.
4. **No secrets in the repo.** `.env` is gitignored; Railway/Cloudflare tokens live only in local env or the platform's variable store.
5. **Every schema change is a migration** (`pnpm db:generate`, then hand-edit if PostGIS/range/exclusion SQL is needed, then `pnpm db:migrate`). Migrations must be reproducible from empty.
6. **Keep `packages/scheduling` pure** — no framework, DB, or vendor imports. External providers (maps, email, storage) stay behind the interfaces in `packages/maps` / `packages/notifications`.
7. **Authorization is server-side** — `requireOwner()` / `requireTechnician()` in `apps/web/src/lib/session.ts` on every protected page/action; hiding UI is never the mechanism.
8. Technicians are **deactivated, never deleted** — historical assignments must survive.
9. **Every user-facing feature change updates the owner handbook in the same breath.** `docs/handbook.html` is the single source for three surfaces: the in-app `/help` page (served from the file at runtime — a web deploy ships it) and the shareable artifact (republish `docs/handbook.html` to keep its existing URL). A feature PR that changes what the owner sees or does is incomplete until the handbook reflects it.

## Environment

- Dev DB: PostgreSQL 17 + PostGIS, Homebrew, **port 5433** (`postgresql@16` on 5432 is unrelated — do not touch it). Databases: `exactpoint_dev`, `exactpoint_test` (test suite drops/rebuilds `exactpoint_test`).
- `.env` at repo root; loaded by `loadEnv()` from `@exactpoint/config` (walks up from cwd).
- Business timezone `America/Chicago`; store timestamps UTC.

## Commands

`pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm db:migrate` · `pnpm db:seed`

## Delivery process

Milestone checkpoints (user-approved): pause for owner review after (M1) foundation+logo concepts, (M2) public site+booking on staging, (M3) Service Manager+scheduler. Report each phase in the spec §93 format. The scheduling test scenarios in spec §80 (Tests A–L) are the acceptance bar.
