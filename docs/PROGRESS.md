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

## Milestone 3 — Service Manager + intelligent scheduler (spec Phases 4–7) — ✅ code complete 2026-08-16

- Scheduling engine complete: hard-constraint filtering, weighted explainable scoring (owner-tunable in Settings → Scheduling), multi-technician windows, override validation. Spec §80 Tests A–L all automated (see TEST_PLAN.md).
- Public booking now engine-backed: real technician slots behind signed tokens, 5-minute holds at review, hold→appointment conversion on submit, graceful degradation to the unassigned queue.
- Manager app: Today dashboard, requests queue with ranked explainable recommendations + audited manual override, drag-and-drop technician-lane calendar (day) + week view, area/zone analytics, customers, full team management (skills/schedules/zones/time off/login creation/deactivation with future-assignment flagging), settings for business/scheduler weights/services/zones (ZIP editing).
- 50 unit/integration tests + 12 Playwright E2E, all green; deployed to staging.

## Final stretch — Phases 8–12 — ✅ code complete 2026-08-16

- Routes + Optimize Day (owner-approved, windows never moved); technician PWA with full field flow and own-jobs-only privacy; completion → 2-month warranty records + possible-callback flags; worker email notifications behind EmailProvider (Resend-ready, console until credentials); LocalBusiness JSON-LD; PWA manifest; **exactpointrepairs.com + www live on Railway with Cloudflare DNS**.
- 53 unit/integration + 18 E2E tests green.

## Estimates & Invoices (spec §85–86 future phase) — ✅ code complete 2026-08-16

- Estimate editor on the manager job page (parts/labor lines, live totals, tax), audited customer approve/decline, automatic invoice issuance (approved → fee waived + tax; declined → $80 diagnostic only), Zelle/cash/check payment recording, printable INV-#### invoices, receipt email on payment. No card processing (§87). 58 unit/integration tests green.

## Domain launch — ✅ exactpointrepairs.com LIVE 2026-08-16

- Apex + www verified and serving with valid Let's Encrypt certificates (auto-renewed by Railway). Root cause of the day-long stall: Railway requires a `_railway-verify` TXT record the API's record list doesn't surface — see DEPLOYMENT.md.

## Google Maps Platform — ✅ live 2026-08-16

- Address Validation (rooftop geocodes) + Routes API drive times power booking, recommendations, assignment checks, and Optimize Day (batched matrix, 15-min cache, haversine fallback). `/manager/map` day view and polygon boundary drawing (Settings → Service Zones → Draw boundaries) active; polygon-first classification live.

## R2 media storage — ✅ live 2026-08-16

- Booking and job photos now persist in the `exactpoint-media` R2 bucket (S3 API, private, random keys); local-disk fallback remains for keyless dev. Round-trip verified.

## Post-launch backlog

- Turnstile activation; email provider credentials.
- Real job photos + Our Work gallery; testimonials/licensing when supplied.
- Future phases: online payments, advanced dispatch (spec §87–88).

## Blocked on owner inputs

Logo selection (M1) · Cloudflare token + domain (R2, DNS) · Google Maps Platform keys (Phase 6/7) · photos/testimonials/licensing (final UI) · email provider (Phase 11).
