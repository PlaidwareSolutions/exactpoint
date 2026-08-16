# Security

Spec §58/§82 is the requirements list; this documents the implementation.

## Current (Phase 1)

- **Auth**: Better Auth, Postgres server sessions (14-day, secure cookies), scrypt password hashing, **public signup disabled** (`EMAIL_PASSWORD_SIGN_UP_DISABLED` verified live). Roles `owner`/`technician` via admin plugin with explicit access-control statements.
- **Authorization**: server-side only — `requireOwner()`/`requireTechnician()` (apps/web/src/lib/session.ts) on every protected page; pure rules in `authz.ts` are unit-tested. UI hiding is never the mechanism.
- **Secrets**: `.env` gitignored; no secrets in source. Railway/Cloudflare tokens live in local env / platform variable stores only. The Railway token used for provisioning should be **rotated after setup** (it transited chat).
- **DB integrity as a security control**: double-booking impossible at the constraint level; singletons CHECK-enforced; reservation source CHECK-enforced.
- **No PII in logs or URLs**; scheduler decision log stores ids and scores, not customer data.
- **No residential address** of the owner anywhere public (service-area business, spec §48).

## Committed for later phases

- Phase 3 booking: Cloudflare Turnstile, rate limiting, zod validation server-side, upload limits + MIME allowlist, no executable uploads, random object keys, CSRF-safe mutations, audit logging of booking actions.
- Media: R2 private by default; signed URLs; public gallery only via `is_publishable`.
- Technician data minimization (spec §40): technicians see only their assigned/relevant jobs — enforced in queries, not views.
- Production: HTTPS only (Railway TLS + Cloudflare), DB backups, session revocation UI, audit review.
