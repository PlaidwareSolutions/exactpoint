# Progress

Pacing: milestone checkpoints (owner-approved 2026-08-15) — pause for review after M1 (foundation + logo concepts), M2 (public site + booking on staging), M3 (Service Manager + scheduler).

## Milestone 1 — Foundation (spec Phase 1) — ✅ code complete 2026-08-15

- Monorepo (pnpm), TS strict, ESLint, Vitest — build/typecheck/lint/tests all green (23 tests).
- PG17 + PostGIS dev environment (port 5433); migration `0000` creates full §60 schema incl. exclusion constraint, CHECKs, spatial indexes, EP-reference sequence; reproducible from empty (proven by test suite).
- Seeds: 9 zones + 77 ZIPs, 16 service types/skills with default durations, settings singletons, owner account + dev technician.
- Auth: Better Auth, roles, signup disabled; role isolation verified live (owner→/manager 200; technician→/manager denied; anonymous→redirect).
- Worker: pg-boss with per-minute expired-hold reaper.
- Scheduling package: interval math + hard-constraint predicates (Tests A/B/C/E at logic level; A/B/J at DB level).

- Logo: **Concept 2 (EP Badge) selected by owner 2026-08-15**; drives the design system.
- Railway: token turned out to be a *workspace token* (no user context — that's why `whoami` failed). Project `exactpoint` provisioned via GraphQL: services `postgres` (postgis/postgis:17-3.6-alpine + volume), `web`, `worker`; staging at **https://web-production-6b592.up.railway.app**; migrations+seeds run as web pre-deploy.

## Milestone 2 — Public website + booking (spec Phases 2–3) — ✅ code complete 2026-08-15

- Design system from EP Badge (navy `#16233B`, point orange `#F26A21`); favicon; header/footer/mobile call bar.
- All §43 pages (home, 11 service pages + 2 hubs, about, our-work placeholder, service areas, contact, 2 policies) + sitemap/robots.
- Booking flow per §31 with stub address validation → ZIP-zone detection, preferred windows (no Sundays, 3 PM same-day cutoff, America/Chicago), photo upload (local StorageProvider — R2 needs an R2-scoped token), $80 fee acknowledgement, EP-#### confirmation; zod + rate limits + honeypot.
- Tests: 27 unit/integration + 6 Playwright E2E (iPhone + desktop booking end-to-end). Domain facts updated to exactpointrepairs.com (Cloudflare zone active, token verified — DNS cutover deferred to launch).

## Upcoming

- M2: design system from chosen logo, §43 public pages, booking flow with fee acknowledgement, Turnstile, Playwright E2E.
- M3: team management, technician-lane calendar, zones admin + map, intelligent scheduler with explainability, Tests A–L complete.
- Then: routes/Optimize Day, technician PWA, records/warranty, notifications, SEO/launch.

## Blocked on owner inputs

Logo selection (M1) · Cloudflare token + domain (R2, DNS) · Google Maps Platform keys (Phase 6/7) · photos/testimonials/licensing (final UI) · email provider (Phase 11).
