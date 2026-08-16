# Deployment

## Environments

- **Local**: PG17+PostGIS (port 5433), `pnpm dev`, worker via `pnpm --filter @exactpoint/worker dev`.
- **Staging/Production**: Railway project `exactpoint` — services `web` (Next.js), `worker` (pg-boss), `postgres` (PostGIS image `postgis/postgis:17-3.6` + volume). Cloudflare takes DNS/CDN/R2/Turnstile once the domain exists; until then the Railway `*.up.railway.app` domain serves staging.

## Railway

- Both `web` and `worker` deploy from the repo root (pnpm workspace needs the full tree); each service sets its own start command:
  - web: `pnpm --filter @exactpoint/web start` (build: `pnpm install --frozen-lockfile && pnpm --filter @exactpoint/web build`)
  - worker: `pnpm --filter @exactpoint/worker start`
- Migrations run as the web service's pre-deploy command: `pnpm --filter @exactpoint/db migrate`.
- Required variables per service: `DATABASE_URL` (internal network URL), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NODE_ENV=production`.
- The Railway API token is **not** stored in the repo; CLI auth via `RAILWAY_API_TOKEN` env var locally. Rotate it after initial setup.

## Production domain

- `exactpointrepairs.com` and `www` are Railway custom domains on the `web` service; Cloudflare CNAMEs (apex → `fvmkyoev.up.railway.app`, www → `ukmekgv3.up.railway.app`; targets are per-domain and change if a custom domain is deleted and recreated — always update DNS to match).
- **Current configuration (matches this workspace's proven-working pattern)**: Cloudflare proxy **ON** (orange cloud) for apex + www, zone SSL/TLS mode **"Full"** (never "Full (strict)" — the Railway origin cert is `*.up.railway.app`). The workspace's other production domains (diamondridge.live and five subdomains) sit `VALID` on Railway in exactly this proxied setup; Railway reports `DETECTED_CDN_PROVIDER_CLOUDFLARE` and validates through the CDN.
- **Railway needs TWO DNS records per custom domain**: the routing CNAME *and* a `_railway-verify[.<host>]` TXT ownership record. The TXT requirement does **not** appear in the API's `status.dnsRecords` list — read `status.verificationDnsHost` + `status.verificationToken` on the custom domain (or the dashboard's domain settings page) and create the TXT record with that exact value. A domain without it sits in `VALIDATING_OWNERSHIP` forever with "propagated" DNS — this cost us launch day (CAA/DNSSEC/port-80/proxy-mode were all red herrings). Recreating a domain regenerates both the CNAME target and the TXT token.
- `BETTER_AUTH_URL=https://exactpointrepairs.com`; auth trusted origins also cover www, the railway.app subdomain, and localhost.
- Email sending activates when `RESEND_API_KEY` + `EMAIL_FROM` are set on the worker; until then notifications log to the worker console and stay marked sent.

## Rules

- Never edit production tables manually — migrations only (spec §54).
- Keep production changes reversible; database backups before destructive migrations.
- DNS cutover to exactpointrepairs.com happens in Phase 12 with Cloudflare proxy + TLS.
