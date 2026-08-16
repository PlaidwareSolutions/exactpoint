# Business Rules

Verified facts live in `packages/domain/src/business.ts`; owner-editable copies in `business_settings`. Only the owner supplies new claims (spec §90).

- **Legal name**: ExactPoint Appliance & HVAC Services (no LLC suffix unless registration confirms).
- **Phone** 281-915-8264 · **email** info@exactpointrepairs.com · **area** Greater Houston, TX.
- **Hours**: Mon–Sat 7:00 AM–7:00 PM; Sunday closed. No public Sunday booking slots (spec Test G). Never advertise 24/7. Emergency wording: *"Emergency and same-day service may be available. Call 281-915-8264 for the fastest assistance."*
- **Diagnostic/service-call fee**: $80, due when the customer declines the quoted repair; **waived when the repair is approved**. Shown and acknowledged during booking.
- **Labor warranty**: 2 months, covering the specific repair/workmanship performed — unrelated failures are separate problems. Repeat contact within warranty flags *Possible Warranty Callback*; the owner decides whether it qualifies.
- **Payments** (Phase 1): Zelle, cash, check. No card processing at launch; data model leaves room for it.
- **Brands**: say "We service all major appliance brands." — no logo walls, no manufacturer-authorization claims.
- **Booking**: customers never pick a technician; assignment is an ExactPoint operational decision. Same-day allowed until the configurable cutoff when capacity/skill/travel permit; owner can override.
- **Technicians**: deactivate, never delete; deactivation removes them from new scheduling and flags future assignments for reassignment (spec Test K).
- **Content**: no fabricated jobs, testimonials, ratings, or credentials — ever. Job photos publish only with `is_publishable`.
- **Timezone**: America/Chicago for all business scheduling; storage in UTC.
