# Progress

Pacing: milestone checkpoints (owner-approved 2026-08-15) — pause for review after M1 (foundation + logo concepts), M2 (public site + booking on staging), M3 (Service Manager + scheduler).

## Milestone 1 — Foundation (spec Phase 1) — ✅ code complete 2026-08-15

- Monorepo (pnpm), TS strict, ESLint, Vitest — build/typecheck/lint/tests all green (23 tests).
- PG17 + PostGIS dev environment (port 5433); migration `0000` creates full §60 schema incl. exclusion constraint, CHECKs, spatial indexes, EP-reference sequence; reproducible from empty (proven by test suite).
- Seeds: 9 zones + 77 ZIPs, 16 service types/skills with default durations, settings singletons, owner account + dev technician.
- Auth: Better Auth, roles, signup disabled; role isolation verified live (owner→/manager 200; technician→/manager denied; anonymous→redirect).
- Worker: pg-boss with per-minute expired-hold reaper.
- Scheduling package: interval math + hard-constraint predicates (Tests A/B/C/E at logic level; A/B/J at DB level).

Remaining for M1 review: Railway staging deploy · logo concepts (2–3) · owner review.

## Upcoming

- M2: design system from chosen logo, §43 public pages, booking flow with fee acknowledgement, Turnstile, Playwright E2E.
- M3: team management, technician-lane calendar, zones admin + map, intelligent scheduler with explainability, Tests A–L complete.
- Then: routes/Optimize Day, technician PWA, records/warranty, notifications, SEO/launch.

## Blocked on owner inputs

Logo selection (M1) · Cloudflare token + domain (R2, DNS) · Google Maps Platform keys (Phase 6/7) · photos/testimonials/licensing (final UI) · email provider (Phase 11).
