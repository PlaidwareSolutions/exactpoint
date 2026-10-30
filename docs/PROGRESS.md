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

## Email — ✅ live 2026-08-16

- Resend (`no-reply@exactpointrepairs.com`, reply-to `info@`), domain DKIM/SPF/DMARC verified; Cloudflare Email Routing forwards info@ to the owner's inbox. Worker sends all queued templates; fixture domains blocked. Verified end-to-end with production booking EP-1001.

## Real content — ✅ live 2026-08-16

- 22 owner-supplied job photos web-optimized into Our Work (4 categories), About (owner portrait + at-work shots), and a homepage real-jobs band. A stock composite in the batch was excluded. Originals stay local (photos-inbox/, gitignored). Still open when supplied: licensing/insurance facts, testimonials.

## Owner access & operations round — ✅ live 2026-08-16

- Footer Team Sign-in link; change-password page; forgot/reset-password via the live email pipeline. Phone-intake New Booking in the Manager (find-or-create by phone, source "phone", hands off to recommendations). Calendar shows time-off/blocked segments; Block Time control (tech or company); job-page cross-day Reschedule. 26 E2E green (suite serialized — shared DB fixtures).

## Manager usability round 2 (Shams's field feedback) — ✅ live 2026-08-24

- Global search (customers/EP-refs/INV-numbers) with a header search box; Invoices menu with status filters + outstanding total; customer page gains Jobs & invoices section (job + invoice links — fixes "can't recall/print/email the invoice later") and an Edit details form (name/phone/email/notes, audited; addresses stay validation-only). E2E-stabilized suite: 30 tests, 3 consecutive clean runs.

## Quotes round (Shams's field report) — ✅ live 2026-08-25

- All billing labels say "Quote" (owner's vocabulary); Email-quote-to-customer button with fee-waiver wording (new quote_issued template); quote-first flow: Create quote on the customer page → /manager/quotes/[workOrderId] (bare work order, no appointment) → Open quote chip on the customer page. Handbook Ch.9 rewritten. 30 E2E green ×2.

## Commercial positioning (owner request) — ✅ live 2026-08-25

- "Residential & commercial" across hero, trust tile, footer, About, hub pages, meta descriptions, OG/Twitter, and JSON-LD; new /appliance-repair/commercial page (restaurants, coffee shops, small businesses — commercial kitchen/refrigeration equipment) in the services grid and sitemap for search visibility.

## MHub integration (Plaidware Marketing Ops Hub) — ✅ live 2026-08-27

- Activated with the tenant events key (Railway web-service variables `MHUB_EVENTS_KEY` + `MHUB_BASE_URL`); stage keys validated live against `getFunnelStages()` (six stages match; `job_completed` is the only revenue-carrying stage). Round-2 corrections from the MHub session: revenue is **additive** (per-invoice `emitJobRevenue` increments keyed by invoice id; completion emits carry no revenue), confirmed pack keys (`oven`/`stove_range`→`oven_range_repair`, `hvac_diagnostic`→`hvac_diagnostics`, `thermostat`→`thermostat_repair`; unmapped → omit, never invent), zone `east`→`zone_southeast` (no `zone_east` in the pack). Attribution note: the local journey harness must export BETTER_AUTH_SECRET as real process env (edge middleware cannot load dotenv) — first verification journeys emitted unattributed leads; EP-990006 is the fully attributed chain (channel google_ads, revenue $200.26). Production attribution probe-verified via Set-Cookie on /book. Live staging journeys verified via the opt-in `e2e/mhub-journey.spec.ts` (`MHUB_E2E=1` + key): **EP-990003** lead(w/ UTM attribution)→qualified→appointment_booked→job_completed→revenue $200.26; **EP-990004** lead→qualified→appointment_booked→appointment_cancelled; queue drained, zero SDK warnings. Dev EP sequence bumped to 990000+ so test journeys never collide with production references.

## MHub integration wiring detail — 2026-08-27

- Vendored @plaidware/mhub-sdk into packages/mhub (Railway can't see file: deps; only change: extensionless relative imports for Turbopack). Env-gated singleton (no-op without MHUB_EVENTS_KEY, staging base URL default), persistent queue (.mhub-queue.json), piiAllowlist [technician, contact_email, contact_phone]. First-touch attribution: edge-safe Web Crypto port of the SDK cookie (same v1.payload.hmac format — unit-tested round-trip against the SDK verifier) set by new src/middleware.ts on public pages only; read in submitBooking. Stage emissions with deterministic idempotency keys at: submitBooking + createPhoneBooking + createQuoteDraft (lead), estimate saved / request reviewed / auto-or-manual scheduling (qualified), scheduleAppointment successes (appointment_booked), cancelled/no_show/customer_declined (appointment_cancelled), estimate declined (repair_declined), tech completion + owner completion + payment recorded (job_completed with revenue_cents, technician first name). Awaiting MHUB_EVENTS_KEY to activate + run the live staging journey.

## Email delivery status for quotes — 🔧 built + committed 2026-10-30 (c3ad333), awaiting deploy

- Audit (2026-10-30): every one of the 41 production emails since launch was accepted by Resend (zero failed rows); Resend shows all 12 October sends as Delivered, 0% bounce/complaint, empty all-time suppression list. Resend exposes only 30 days of events and the app kept no record of its own; the owner tapped "Email quote" 4× within two minutes on Oct 22 because nothing confirmed delivery.
- Built: migration 0002 — `notifications` gains an entity link (estimate/invoice), `provider_message_id`, `delivery_status`/`delivery_detail`/`delivery_updated_at`. Worker stores the Resend id. New `POST /api/webhooks/resend` verifies the Svix signature in-process (no SDK), maps sent/delivery_delayed/delivered/bounced/complained/failed, never downgrades a later-ranked event, answers 200 for unknown ids. `emailQuote` is idempotent via `enqueueEmailOnce` (per-estimate advisory lock; reuses a pending send or one under 60 s old, returning a warning instead of a duplicate). Billing panel: one Email / Resend button (disabled while queued), a status chip (Sending… / Sent — awaiting confirmation / Delivered / Delayed / Bounced / Spam / Failed) with recipient and time, and a 10-second refresh for up to 10 minutes while awaiting. Tests: db notifications suite (5, incl. five concurrent enqueues → one row), webhook verifier unit tests; 20 db + web unit green. Handbook Ch.9 + Ch.13 updated.
- Activation (2026-10-30): Resend endpoint `https://exactpointrepairs.com/api/webhooks/resend` created and Enabled with the six email.* delivery events; `RESEND_WEBHOOK_SECRET` set on the Railway **web** service (that variable change redeployed the old image at 11:44 CT, so the route still 404s). **Still to do: deploy web first (pre-deploy runs migration 0002), then worker** — `railway up -s web -e production -p 1d7b7296-a589-43ec-9dc9-447365c8c081 --detach`, wait for SUCCESS, same with `-s worker`. The worker must not go out before the migration: its `pendingNotifications` select reads the new columns. Until the deploy lands, Resend's webhook deliveries fail against the 404 and are retried by Resend; the endpoint may need re-enabling if Resend disables it after repeated failures.

## Post-launch backlog

- Turnstile activation (needs token permission or dashboard-created widget keys).
- Real job photos + Our Work gallery; testimonials/licensing when supplied.
- Future phases: online payments, advanced dispatch (spec §87–88).

## Blocked on owner inputs

Logo selection (M1) · Cloudflare token + domain (R2, DNS) · Google Maps Platform keys (Phase 6/7) · photos/testimonials/licensing (final UI) · email provider (Phase 11).
