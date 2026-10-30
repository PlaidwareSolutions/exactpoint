# ExactPoint Appliance & HVAC — Master Product & Implementation Plan

> Authoritative product specification as supplied by the owner (2026-08-15).
> Credentials mentioned in the original brief are intentionally omitted — secrets
> live outside the repository (see docs/SECURITY.md).

> **Owner amendments (2026-08-15, supersede the original text below):**
> domain is **exactpointrepairs.com** (purchased via Cloudflare; the original
> exactpointapplianceservices.com is obsolete); business name styling is
> **ExactPoint Appliance & HVAC Services**; business email is
> **info@exactpointrepairs.com**; logo **Concept 2 (EP Badge)** selected.

**Product:** ExactPoint Digital Service Platform
**Legal business name supplied:** Exact Point Appliance & HVAC Services
**Website:** exactpointapplianceservices.com
**Phone:** 281-915-8264
**Recommended business email:** info@exactpointapplianceservices.com
**Primary market:** Greater Houston, Texas
**Business hours:** Monday–Saturday, 7:00 AM–7:00 PM · **Sunday:** Closed
**Same-day service:** Yes · **Emergency service:** Yes, subject to availability
**Payment methods:** Zelle, Cash, Check
**Diagnostic/service-call fee:** $80 if repair is declined; waived if the quoted repair is approved
**Labor warranty:** Two months for the specific repair/workmanship performed

---

## 1. Product Vision

Build ExactPoint as two connected experiences:

### A. Customer Website — exactpointapplianceservices.com

Purpose: generate new customers; establish trust; explain services; rank for Greater Houston appliance/HVAC searches; allow one-tap calling; allow online service requests; collect service address and equipment information; validate the customer's address; intelligently show available appointment windows; accept photos of the appliance/HVAC problem; confirm the service request.

### B. ExactPoint Service Manager

Private application for Shams and his technicians. Purpose: manage technicians, customers, appointments; geographically cluster jobs; assign jobs across multiple technicians; prevent technician double-booking; optimize technician routes; track appliance/HVAC service history, job photos and notes, warranties; support future estimates, invoices and payments.

This is a **field-service management platform for ExactPoint**, not a generic booking calendar.

## 2. Core Product Principle

The scheduling model must be:

**CUSTOMER → JOB → LOCATION → ZONE → APPOINTMENT → TECHNICIAN → ROUTE**

Do **not** model scheduling around one company-wide appointment calendar. If ExactPoint has Shams plus Technicians A, B, C, all four people must be capable of performing separate jobs simultaneously (e.g. Tuesday 10:00 AM: Shams — refrigerator, Katy; A — AC diagnostic, Sugar Land; B — washer, Cypress; C — dryer, Pearland). What is not valid is assigning the **same technician** to overlapping appointments.

## 3. User Roles

Build role-based access from the beginning.

### 3.1 Owner / Administrator (initially Shams)

Full dashboard access; add/edit/deactivate technicians; assign/reassign technicians; view all customers, appointments, routes, zones; override scheduler recommendations; modify service areas, technician skills, technician hours; set technician time off; configure appointment duration and emergency capacity; edit business settings and services; view reports and audit trail.

## 4. Technician Accounts

Team → Add Technician creates/invites a technician. Fields: first/last name, mobile, email, profile photo, active/inactive, role, employment/start date, calendar color, skills, services the technician can perform, normal work schedule, days available, start/end time, preferred service zones, maximum daily jobs (if configured), emergency-call availability, notes. Technicians receive an invitation to activate their account. **Never permanently delete technicians with historical jobs** — Active → Inactive; historical assignments must remain intact.

## 5. Technician Skills

Do not assume every technician can perform every job. Implement technician capabilities.

- **Appliance**: Refrigerator, Freezer, Washer, Dryer, Dishwasher, Oven, Range, Stove, Cooktop, Microwave, Ice Maker, Water Filtration
- **HVAC**: HVAC Diagnostics, AC Repair, Heating Repair, HVAC Maintenance, Thermostat, other configured HVAC services

A technician can have any combination (e.g. Shams: Appliances ✓ HVAC ✓; Technician A: Refrigerators/Washers/Dryers ✓, HVAC ✕). The booking engine must never recommend a technician for a job they lack the skill for.

## 6. Multi-Technician Appointment Support

Support both normal jobs (one technician) and multi-person jobs (two or more — e.g. large HVAC installations). Model as **Appointment → one or more Appointment Technician Assignments**, not `appointment.technician_id`. An assignment carries: technician, role (Lead/Helper), scheduled start/end, status, assignment timestamp. This avoids an architectural rewrite later.

## 7. Greater Houston Geographic Scheduling

Divide Greater Houston into configurable service zones. Initial conceptual zones:

- **Central**: Downtown, Midtown, Heights, Montrose, Inner Loop
- **West**: Katy, Cinco Ranch, Energy Corridor, Memorial, Westchase
- **Northwest**: Cypress, Jersey Village, Tomball
- **North**: Spring, Klein, The Woodlands area
- **Northeast**: Humble, Atascocita, Kingwood
- **East**: Channelview, Baytown and surrounding configured areas
- **Southwest**: Sugar Land, Stafford, Missouri City
- **South**: Pearland, South Houston areas
- **Southeast**: Pasadena, Deer Park, Clear Lake, League City and surrounding configured areas

These must **not be hard-coded forever**. Settings → Service Zones lets zones be added, renamed, activated/deactivated, given a display color, ZIP codes, geographic boundaries, preferred service days, and scheduling priority.

## 8. Geographic Data Model

Store the validated service location as: original entered address, standardized address, street, unit, city, state, ZIP, latitude, longitude, service zone, validation status. Use **PostgreSQL with PostGIS**: location as a spatial point, service areas as polygons/multipolygons, spatial queries to determine which zone contains a customer. ZIP-based classification may be an additional/simple administrative mechanism, but latitude/longitude remains the canonical geographic representation.

## 9. Customer Address Validation

On booking: enter → validate → normalize → geocode → determine zone → determine whether inside service territory. Google's Address Validation API is suitable. Do not allow obvious bad addresses to silently become appointments. If not confidently validated: *"We could not confirm this address. Please review it."* If outside the service area: *"This address may be outside our normal service area. Please call 281-915-8264 so we can check availability."* Do not reject the customer permanently.

## 10. Scheduling Philosophy

**HARD CONSTRAINTS** (cannot be violated): technician is active; has required skill; is working that day; not on leave; not already booked; appointment fits work hours; required travel physically completable; address serviceable; duration fits; multi-technician jobs have all required technicians available.

**SOFT PREFERENCES** (affect ranking): technician already has jobs nearby / same zone; day already has several jobs in the area; lower travel time; compact route; workload balance; customer's preferred time; prior service of that customer/equipment; zone preferred-day.

Hard constraints determine whether a slot **can exist**; soft preferences determine how strongly to **recommend it**.

## 11. Intelligent Slot Generation

Per request: (1) determine service type, required skill, estimated duration, location, zone; (2) find active capable technicians; (3) per technician check schedule, time off, existing appointments, blocks, route, travel feasibility; (4) generate candidate windows; (5) score them; (6) show the customer the highest-quality options. The customer should not see every theoretical empty slot.

## 12. Example

If Shams has Katy/Cinco Ranch/Energy Corridor jobs Tuesday and a refrigerator customer in Katy requests service, strongly prefer Shams/Tuesday (already concentrated in West Houston) — but if he has no reasonable capacity, another technician may still be offered. A Pearland request may score Tuesday poorly; if Wednesday already has Pearland/South work, Wednesday ranks higher.

## 13. Scheduling Score

Weights are configuration values, not buried in code. Conceptually: candidateScore = customer preference + zone affinity + route proximity + travel-time efficiency + schedule compactness + workload balance + technician continuity + preferred zone/day affinity − additional travel − route fragmentation − idle gaps − cross-Houston travel penalties. Do not claim a score is inherently optimal. Store scoring components so recommendations are explainable.

## 14. Explainable Scheduling

When Shams examines a recommendation, show why — e.g. *"Recommended: Tuesday 10 AM–1 PM — Shams: 2 existing West Houston jobs that day; same service zone; ~14 minutes from previous appointment; required refrigerator skill; maintains a compact route."* Alternatives show their own reasons (e.g. "+31 minutes additional estimated travel"). This lets Shams trust and override the algorithm intelligently.

## 15. Real Driving Time

Zone matching alone is insufficient. Use actual route travel information (Google Routes API Compute Route Matrix) to evaluate **previous appointment → proposed appointment → next appointment**. The scheduler calculates the **incremental travel cost** of inserting a new job.

## 16. Route Optimization

Provide **Optimize Day**: recommend the day's stop order per technician (Google's Route Optimization API supports fleet task assignment with work hours and time windows). **Never silently move confirmed customer appointments** — optimization produces *recommended changes*; Shams chooses *Accept Optimization* before anything changes.

## 17. Calendar Design — Day View, Technician Lanes

Each technician gets a column; parallel appointments are immediately visible.

## 18. Week View

Display per technician: appointment count, zones, available capacity, total estimated driving, unassigned appointments. Filters: technician, zone, service, status.

## 19. Area / Zone View

Geographic scheduling view per day (e.g. Tuesday: West 5, Southwest 2, North 1) making geographic fragmentation visible.

## 20. Map View

Daily appointments on a map: markers, technician, sequence, service type, window, zone, route, unassigned jobs; distinct visual route per technician; clicking a marker opens the appointment.

## 21. Drag-and-Drop Dispatch

Drag appointments between technicians or days. Before accepting, check skill, conflicts, travel feasibility, work hours, zone impact; then show "Good move" or "Warning: adds ~48 minutes of travel". Shams can override most soft recommendations; hard safety/data-integrity constraints (double-booking) require explicit resolution.

## 22. Unassigned Appointment Queue

Display unassigned requests (reference, service, area, preference, duration) with ranked technician/time recommendations and one-click Assign.

## 23. Prevent Double Booking at Database Level

Do not rely on front-end checks. The database must enforce technician reservation conflicts (PostgreSQL range/exclusion strategy or equivalent transactional locking). **Concurrency tests are mandatory.** Two technicians may have appointments at the same time; one technician may not.

## 24. Booking Slot Holds

At final confirmation create a short-lived slot hold (e.g. 5 minutes, configurable). During the hold, no other booking can consume the identical technician reservation. Completion: Hold → Appointment. Timeout: hold expires.

## 25. Company Capacity

Available capacity is calculated from the entire team (subject to geography, duration, skills) — never a simplistic company-wide `maxAppointmentsPerDay`.

## 26. Work Hours

Default: Mon–Sat 7:00 AM–7:00 PM, Sunday closed. Each technician can have a different schedule; technician schedules override general company capacity.

## 27. Time Off and Blocks

Technicians need vacation/sick/personal/training/lunch/vehicle-maintenance/other blocks. Shams can block a technician, a time period, the entire team, or a company day. Blocked periods immediately disappear from public booking availability.

## 28. Emergency Service

Emergency requests get higher priority; customer may mark "urgent/emergency". The website must not imply guaranteed 24/7 service — preferred wording: *"Emergency and same-day service may be available. Call 281-915-8264 for the fastest assistance."* The scheduler determines closest qualified technician, earliest feasible arrival, route insertion, travel impact; Shams makes the final dispatch decision.

## 29. Same-Day Scheduling

Allow same-day booking if capacity, skill, and travel permit, the appointment fits before closing, and the configurable cutoff hasn't passed. Shams can override manually.

## 30. Appointment Duration

Duration configurable by service type (seeded defaults for diagnostic, refrigerator, washer, dryer, cooking, HVAC diagnostic, HVAC repair — configuration defaults, not permanent assumptions). Individual appointments can override estimated duration.

## 31. Customer Booking Flow

1. **Service**: Refrigerator, Freezer, Washer, Dryer, Dishwasher, Oven, Stove/Range, Cooktop, Microwave, Ice Maker, Water Filtration, HVAC, Other
2. **Problem**: description; optional brand, model, serial, error code
3. **Photos**: appliance, equipment label, error display, damage, HVAC equipment
4. **Customer**: name, phone, email
5. **Address**: street, unit, city, state, ZIP — validated
6. **Appointment**: the customer does **not** select a technician; the system offers intelligent windows (e.g. Tue 10 AM–1 PM). Technician assignment remains an ExactPoint operational decision.

## 32. Appointment Confirmation

"Service Request Received" with reference (EP-1048), service, address, window, phone, diagnostic-fee policy, what happens next.

## 33. Service Call Fee

**Diagnostic & Service Call Fee**: $80 applies when ExactPoint visits and diagnoses but the customer declines the recommended repair. If the customer approves the quoted repair, the $80 fee is **waived** and the customer pays the agreed repair amount. Display during booking; require acknowledgement.

## 34. Customer Management

Store name, phone, email, addresses, equipment, service history, appointments, work orders, photos, notes, warranty history. Detect likely duplicates by phone/email but never auto-merge without safeguards.

## 35. Equipment Records

Reusable records: type, brand, model, serial, approximate age, location in home, previous problems/repairs, photos. Future appointments link to the same equipment.

## 36. Work Order Model

Separate: **Service Request** (customer asks) / **Work Order** (ExactPoint's job) / **Appointment** (a scheduled visit). A work order may require multiple visits (diagnose; install ordered part). Do not force one work order = one appointment.

## 37. Appointment Status

Requested, Pending Confirmation, Confirmed, Assigned, En Route, Arrived, In Progress, Waiting for Part, Follow-Up Required, Completed, Customer Declined, Cancelled, No Show. **Status history must be retained.**

## 38. Technician Mobile Application

Mobile-friendly PWA: Today list with per-job customer name, call, address, navigate, equipment, problem, customer photos, notes, start job, upload photos, complete job. Technicians should not need a laptop.

## 39. Technician Actions

En Route → Arrived → Start Work → Add Notes → Photos (before, model/serial, component, after) → Complete (repair outcome).

## 40. Technician Privacy / Permissions

By default technicians only see customer data for their assigned jobs, relevant upcoming work, and relevant historical context — not the full customer database. Shams has full administrative access.

## 41. Warranty Tracking

Standard labor warranty: **2 months**, applying to the specific service/repair and workmanship — not unrelated failures. Per completed repair store: completion date, warranty start/end, issue repaired, component/area, technician, notes. On repeat contact flag **Possible Warranty Callback**; Shams determines whether it qualifies.

## 42. Payment

Phase 1: Zelle, Cash, Check. No credit-card processing in initial release; architect so card payments can be added later.

**Payments ledger (implemented 2026-10-30).** Every payment is an append-only ledger row against an invoice: amount, method, optional reference (check number / Zelle confirmation), date received, note, who recorded it, and a receipt number (`RCT-####`). Invoices accept **partial payments** (deposits, instalments); status is derived from the ledger — `unpaid` → `partially_paid` → `paid` — never set by hand, and paid-to-date / balance are computed, not stored. A payment above the balance, or on a void invoice, is refused; concurrent recordings are serialised on the invoice row so overpayment is impossible. **Refunds** are ledger rows of kind `refund` (never above what was received) and reopen the balance. Rows are never edited or deleted. **Receipts:** one per ledger row — printable page and `payment_receipt` email showing amount, method, invoice total, paid to date and balance remaining (or "paid in full"), reading as issued. Receipt emails are idempotent (no duplicate within a minute). Revenue reporting (MHub) emits one increment per ledger row, negative for refunds.

## 43. Public Website Pages

Home · Appliance Repair · Refrigerator Repair · Washer Repair · Dryer Repair · Dishwasher Repair · Oven/Range Repair · Microwave Repair · Ice Maker Repair · Water Filtration · HVAC Services · AC Repair · About · Our Work · Service Areas · Book Service · Contact · Service & Warranty Policy · Privacy Policy

## 44. Homepage

Above the fold: EXACTPOINT / APPLIANCE & HVAC / "Appliance or HVAC Problem? We Can Help." / Serving Greater Houston / Same-Day & Emergency Service Available / BOOK SERVICE / CALL 281-915-8264. Mobile calling must work with one tap.

## 45. Business Hours Display

Mon–Sat 7:00 AM–7:00 PM; Sunday Closed. Do not advertise "24/7 Emergency Service" unless the operating policy changes.

## 46. Service Brands

Requirement supplied: "All appliance brands serviced" — use safer wording: **"We service all major appliance brands."** Avoid an exhaustive manufacturer-logo wall.

## 47. Service Areas & SEO

Architecture supporting localized pages (e.g. Appliance Repair Katy/Cypress/Sugar Land/Pearland/Spring/Humble). No hundreds of low-quality doorway pages; each published location page needs meaningful local/service content.

## 48. Google Business Presence

The business does not publish the owner's residential address — support a service-area business model. No home address may appear in footer, metadata, public API, HTML source, sitemap, photos, or map defaults.

## 49. Photography

Before final production visuals, the owner supplies: Shams portrait, Shams working, appliance repair photos, HVAC work photos. Use authentic ExactPoint work heavily ("Our Work": Refrigerators, Washer/Dryer, Cooking, HVAC). **Do not fabricate customer jobs or testimonials.**

## 50. Logo

No current logo. Create a simple professional identity: EXACTPOINT with APPLIANCE & HVAC. Requirements: clean, modern, legible; works at favicon size, on vehicle, on shirt, in black/white, horizontally; SVG master; transparent PNG exports. Avoid a collage of refrigerator+washer+flame+snowflake; a subtle precision/point/target motif integrated into the E/P mark is preferable. **Prepare 2–3 concepts before selecting.**

## 51. Facebook

No page exists yet. Branding should be reusable for an eventual Facebook business page (logo, cover, description, phone, domain, service area). No Facebook icon/link until the page exists.

## 52. Recommended Technical Architecture

**Modular monolith**, not microservices.

```text
exactpoint/
  apps/ web/ worker/
  packages/ db/ domain/ scheduling/ maps/ notifications/ ui/ config/
  docs/
```

`apps/web`: one Next.js application (App Router) containing public marketing, customer booking, owner portal, technician PWA, and API endpoints. TypeScript strict, server-side authorization, responsive mobile-first UI, accessible components.

## 53. Database

**PostgreSQL + PostGIS**: transactional scheduling, relational customer/job data, geographic points, zone polygons, spatial queries, mature locking/constraints. Do not put critical scheduling state only in browser/local state.

## 54. Data Access

Typed data layer with proper SQL migrations, supporting raw SQL for PostGIS, range constraints, scheduling conflict protection, advanced reports. Every schema change requires a migration. Never modify production tables manually as normal deployment.

## 55. Photo Storage

Object storage (recommended: **Cloudflare R2**), not large photos in PostgreSQL. Metadata in PostgreSQL: object key, MIME, size, dimensions, uploader, work order, category, created. Signed/private access for customer/job images; public gallery images explicitly marked publishable.

## 56. Hosting

**Railway** for Next.js app, worker, PostgreSQL. **Cloudflare** for DNS, CDN/proxy, R2, Turnstile, security controls.

## 57. Background Worker

Async jobs: email, SMS later, image processing, route recalculation, expired slot holds, reminders, warranty jobs, review requests. Never block customer booking on non-essential async work.

## 58. Booking Security

Turnstile (or equivalent), rate limiting, server-side validation, file-size limits, MIME validation, secure object keys, no executable uploads, CSRF protections, input sanitization, audit logging. Don't expose map/API secrets to public clients unless browser-restricted by design.

## 59. Authentication

Secure auth for owner + technicians: server-side sessions, secure cookies, password hashing, invitation flow, password reset, session revocation, role checks on every protected server operation. Never rely on hiding UI buttons.

## 60. Core Database Entities

Organization, User, Role, TechnicianProfile, TechnicianSkill, TechnicianAvailability, TechnicianTimeOff, ServiceCategory, ServiceType, Customer, CustomerAddress, Equipment, ServiceZone, ServiceZoneZip, ServiceZonePolygon, ServiceRequest, WorkOrder, Appointment, AppointmentTechnician, ScheduleReservation, SlotHold, JobStatusHistory, WorkOrderNote, MediaAsset, Warranty, DailyRoute, RouteStop, Notification, AuditLog, BusinessSettings, SchedulingSettings.

## 61. Important Entity Relationships

Customer → CustomerAddress / Equipment / ServiceRequest → WorkOrder → Appointment → AppointmentTechnician → Technician. CustomerAddress → ServiceZone. Technician → Skills / Availability / TimeOff / Appointments / DailyRoute.

## 62. Business Time Zone

**America/Chicago.** Store timestamps in UTC; render scheduling in America/Chicago; never hard-code UTC offsets (DST).

## 63. Admin Dashboard (Today)

Today's jobs, in progress, unassigned, emergencies, new online bookings, technicians working/off, estimated travel, today's zones; upcoming (tomorrow, next 7 days); alerts (unassigned, conflicts, possible warranty callback, awaiting confirmation).

## 64. Team Dashboard

Table: technician, today's count, current zone, next job, status. Click through to calendar, route, jobs, skills, hours, time off.

## 65. Admin Settings (no code required)

Business (phone, email, hours, closed days) · Scheduling (booking horizon, slot duration, buffers, same-day cutoff, emergency rules) · Services (offerings, typical duration, required skill) · Zones (names, boundaries, ZIPs, colors, preferred days) · Team (technicians, skills, availability) · Warranty (default labor warranty) · Diagnostic fee.

## 66. Audit Trail

Record who/what/when, old and new values, for: technician reassignment, appointment time changes, cancellations, warranty determinations, zone overrides, manual schedule overrides.

## 67. Scheduler Decision Log

For recommendations record: candidate technician/time, skill match, zone, travel delta, daily zone concentration, score, reasons rejected/selected. No unnecessary customer PII.

## 68. Phase 1 — Foundation

Repository, architecture docs, monorepo, TypeScript, lint/test/build, PostgreSQL schema, PostGIS, migrations, authentication, roles, audit foundation, dev/staging/prod configuration. **Exit:** clean build; unit tests pass; migrations reproducible; owner and technician login work; role isolation tested.

## 69. Phase 2 — Brand & Public Website

Logo concepts, design system, homepage, services, about, our work, service areas, contact, policies, mobile CTA. **Exit:** excellent mobile presentation; call button works; no home address; no fake reviews/licensing claims; no 24/7 claim; performance/accessibility checked.

## 70. Phase 3 — Customer Booking

Service → problem → equipment → photos → customer → address validation → zone → appointment suggestions → fee acknowledgement → confirmation. **Exit:** a customer can submit a complete valid service request from a phone without an account.

## 71. Phase 4 — Team Management

Add/invite technician, skills, hours, time off, active/inactive, calendar color, zone preferences. **Exit:** Shams can add two technicians with different schedules and capabilities.

## 72. Phase 5 — Multi-Technician Calendar

Day/week views, technician lanes, filters, appointment details, drag/drop, reassignment, unassigned queue, conflict detection. **Critical test:** Shams and Technician A can both have 10 AM appointments; Shams cannot have two overlapping ones.

## 73. Phase 6 — Geographic Intelligence

Geocoding, PostGIS points, service polygons, ZIP mapping, zone classification, zone admin, map view, area/day analytics. **Exit:** Katy auto-assigns to the configured West zone; Pearland to South; Shams can override.

## 74. Phase 7 — Intelligent Scheduler

Hard constraints, candidate generation, team-wide capacity, geographic + travel scoring, workload, explainable recommendations, slot holds, concurrency protection. **Exit:** the engine prefers travel-reducing appointments while honoring qualification, hours and customer preference.

## 75. Phase 8 — Route Planning

Daily route, stop sequence, travel estimates, Optimize Day, recommended changes, owner approval. Never auto-move confirmed windows.

## 76. Phase 9 — Technician PWA

Today, next appointment, navigate, call, en route, arrived, start, notes, photos, complete. Test primarily on mobile viewport.

## 77. Phase 10 — Service Records & Warranty

Work orders, equipment history, multiple visits, notes, before/after photos, completion, warranty calculation, callback detection.

## 78. Phase 11 — Notifications

Provider abstraction. Initially email confirmation; architecture ready for SMS (request received, confirmation, reminder, en route, complete, review request) when credentials are supplied.

## 79. Phase 12 — SEO / Launch

Titles, descriptions, canonicals, sitemap, robots, structured business info, service pages, service-area content, analytics, performance and mobile testing, production DNS, TLS, backups, monitoring.

## 80. Critical Scheduling Test Scenarios (must be automated)

- **A — Parallel work**: Shams 10 AM refrigerator + Tech A 10 AM HVAC → allowed.
- **B — Same-technician conflict**: Shams 10–12 exists; new Shams 11–1 → rejected.
- **C — Skill mismatch**: appliance-only Tech A never a candidate for HVAC.
- **D — Geographic preference**: three Katy jobs Tuesday → new Katy request strongly prefers Shams/Tuesday if feasible.
- **E — Travel impossible**: A ends 10:00 Katy; B starts 10:05 Pearland → rejected.
- **F — Time off**: Tech B off Wednesday → no Wednesday slots for B.
- **G — Sunday**: no normal public Sunday slots.
- **H — Emergency**: nearby qualified technician ranks strongly.
- **I — Two-technician job**: both schedules must have availability.
- **J — Concurrent booking**: two customers, last identical slot → exactly one wins.
- **K — Deactivation**: history remains; no new scheduling; future assignments flagged.
- **L — Manual override**: allowed if hard constraints hold; audited.

## 81. Quality Requirements

Automated: unit, integration, scheduling, concurrency, authorization, API validation, E2E booking, E2E technician. Manual: iPhone/Android viewports, desktop, slow connection, address errors, photo uploads, calendar drag/drop, route map, reassignment.

## 82. Security Requirements

HTTPS only; secure sessions; server-side RBAC; rate limiting; Turnstile; private job images; signed object access; input and upload validation; secrets outside source; DB backups; audit logs; minimal technician permissions; no residential address exposure; no sensitive customer data in URLs or logs.

## 83. Production Observability

Capture app errors, failed bookings/address validation/scheduler/route API/email/worker/database failures. Metrics: bookings, call CTA clicks, conversion, jobs per technician/zone, travel time per technician, same-day jobs, unassigned jobs, cancellation rate.

## 84. External Provider Architecture Rule

Wrap maps, email, SMS, storage behind interfaces (AddressProvider, RouteProvider, OptimizationProvider, EmailProvider, SmsProvider, StorageProvider). Business scheduling code must not depend on one vendor's SDK throughout.

## 85–88. Future Phases

**Estimates** (diagnostic, parts, labor, tax, approval, signature; declined → $80 due; accepted → waived). *Revisions (implemented 2026-10-30):* every save of a quote is a new numbered revision; the one the customer is looking at is `presented`, earlier ones become `superseded` and stay readable; a decision attaches to a specific revision and locks it. *Change orders:* after approval, a further save is a `change_order` revision that is emailed and approved/declined on its own — approved → the invoice totals are rebuilt from it (refused if the new total is below what has been paid; record a refund first), declined → the approved revision and invoice stand. No change orders once the invoice is paid in full and the job is completed; a declined quote is terminal (new work = new job). **Invoices** (number, work order, items, derived payment status, payments ledger, per-payment receipts — see §42). **Online payments** (cards, Apple/Google Pay — not at launch). **Advanced dispatch** (live location if explicitly enabled, reoptimization, skill levels, territories, vehicles, parts inventory, dispatch board, memberships, recurring HVAC maintenance, revenue/performance/profitability reporting). Phase-1 architecture must allow these without a rewrite.

## 89. Required Inputs Before Final Production UI

Shams portrait; working photos; appliance/HVAC photos; publishable testimonials; legally advertisable licensing/insurance; final production email configuration. Use **Exact Point Appliance & HVAC Services** as the legal name; do not invent an LLC suffix.

## 90. Business Claims Guardrail

Never invent: years in business, customer counts, ratings, reviews, certifications, licenses, insurance, manufacturer authorization, response times, guaranteed same-day, 24/7 availability. Only publish verified claims.

## 91. Repository Documentation

`/docs/`: PRODUCT_SPEC.md, ARCHITECTURE.md, DATA_MODEL.md, SCHEDULING_ENGINE.md, SECURITY.md, DEPLOYMENT.md, BUSINESS_RULES.md, TEST_PLAN.md, DECISIONS.md, PROGRESS.md. Plus `CLAUDE.md` with project-specific instructions for future sessions.

## 92. Working Rules

1. Read this specification completely. 2. Inspect the repository before changing anything. 3. Write the implementation plan into the repository. 4. Identify conflicts between existing code and this spec. 5. Modular monolith over unnecessary microservices. 6. Business logic outside UI components. 7. Scheduling logic independently testable. 8. Migrations before relying on fields. 9. Automated tests as features are implemented. 10. Never expose secrets. 11. Never fabricate business content. 12. Never expose Shams's home address. 13. Never weaken scheduling conflict controls to make a test pass. 14. Every external provider behind an abstraction. 15. Production changes reversible. 16. Document architectural decisions. 17. No critical flows on mock data. 18. No phase marked complete until acceptance criteria pass.

## 93. Phase Completion Format

Report per phase: Completed / Files / Database (migrations) / Tests (run + results) / UI Verification / Security / Remaining / Next Phase. Never a vague "Done."

## 94. Most Important Acceptance Requirement

With multiple technicians the scheduler must answer: **"Who is qualified, available and geographically best positioned to perform this appointment?"** — not merely "Is there an empty square on the company calendar?" Continuously balance **customer preference × technician capability × technician availability × geographic efficiency**.

## 95. Target Customer Experience

Google → website → choose service → enter problem → enter address → (ExactPoint determines zone/availability) → choose recommended appointment → confirmation. The customer never needs to understand technician scheduling, zones, route matrices, load balancing, or dispatch logic — the complexity belongs inside ExactPoint.

## 96. Target Owner Experience

Shams opens the app and sees TODAY: technicians working, appointment count, routes by area, unassigned requests — and can immediately see where everyone is going, who has capacity, which jobs are geographically inefficient, which appointments need assignment, where an emergency fits, and which technician is the best choice.

## 97. Final Product Definition

**ExactPoint Digital Service Platform** = exactpointapplianceservices.com (acquisition + intelligent booking) + ExactPoint Service Manager (owner, dispatch, technicians, customers, jobs, geographic scheduling, routes) + ExactPoint Technician PWA (mobile field workflow). Defining capability: **multi-technician, geo-aware intelligent scheduling for Greater Houston**, built into the data model and scheduling architecture from the first migration.

---

**Infrastructure:** Railway (app hosting + Postgres) and Cloudflare (DNS/CDN/R2/Turnstile) only. Credentials are supplied by the owner out-of-band and never committed; the Cloudflare token and domain purchase are pending.
