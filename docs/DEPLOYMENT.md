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

- `exactpointrepairs.com` and `www` are Railway custom domains on the `web` service; Cloudflare CNAMEs (apex → `nuoi9xnd.up.railway.app`, www → `bo9096i7.up.railway.app`).
- **Validation order matters**: Railway validates ownership by resolving the public record and comparing it to its target. Records must be **DNS-only (grey cloud) until Railway's certificate is issued** — with the proxy on, public DNS shows only Cloudflare IPs (`currentValue` comes back empty in Railway's checker) and validation stalls indefinitely. After the certificate is issued and the site serves, the proxy *may* be enabled (zone SSL/TLS is already "Full"; never "Full (strict)" — the origin cert is `*.up.railway.app`).
- `BETTER_AUTH_URL=https://exactpointrepairs.com`; auth trusted origins also cover www, the railway.app subdomain, and localhost.
- Email sending activates when `RESEND_API_KEY` + `EMAIL_FROM` are set on the worker; until then notifications log to the worker console and stay marked sent.

## Rules

- Never edit production tables manually — migrations only (spec §54).
- Keep production changes reversible; database backups before destructive migrations.
- DNS cutover to exactpointrepairs.com happens in Phase 12 with Cloudflare proxy + TLS.
