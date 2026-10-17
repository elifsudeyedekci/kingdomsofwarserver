# Contabo deployment (Docker Compose + Caddy HTTPS)

**Status: written, NOT deployed.** What was actually tested on the dev machine (no Docker available there): the baseline database migration on an empty PostgreSQL, the backend booting with `NODE_ENV=production` and generated secrets (refuses weak config; HSTS on; Swagger off; guest sign-in works), compose/Caddy syntax. NOT tested: the Docker images, Caddy certificates, Redis, the backup container, restore on the server. Treat the first install as a test run.

## One-time server setup
1. VPS with Docker + Compose plugin, ports 80/443 open, 2+ GB RAM. Firewall: only 22, 80, 443.
2. DNS: A records for `API_DOMAIN` and `PANEL_DOMAIN` -> server IP (before the first `up`, or Let's Encrypt fails).
3. Copy the repo (or `git clone` with LFS not required: only `admin-backend`, `admin-panel`, `database`, `deploy`, and 4 small data folders are used).
4. `cd deploy/contabo && sh generate-secrets.sh` -> creates `.env.production` (mode 600, random secrets). Edit domains, `ACME_EMAIL`, `CORS_ORIGINS` (= `https://PANEL_DOMAIN`). Never commit this file.
5. `docker compose --env-file .env.production up -d --build`
6. First admin (once): `docker compose --env-file .env.production run --rm -e SEED_ADMIN_EMAIL=you@x.com -e SEED_ADMIN_PASSWORD='long-password' migrate sh -c "npx ts-node prisma/seed.ts"`. Log in at the panel; 2FA enrolment is forced at first login (save the recovery codes). **Re-running the seed resets that admin's password.**
7. In the panel: Oyun Verisi -> "import shipped data" -> publish; then Canlı Kontrol -> set the update gates.

## Secrets
Kept only in `.env.production` (root-owned, 600) on the server; containers get them as environment variables. Backend/panel containers run read-only, non-root, all capabilities dropped. Rotate JWT secrets = all players/admins sign in again. Use a password manager copy of the file, not git.

## Backups
`backup` container: `pg_dump -Fc` daily 03:15 into `deploy/contabo/backups/`, verifies the dump lists, keeps `BACKUP_KEEP_DAYS`, reports to the panel (Yedekleme page) through `BACKUP_AGENT_TOKEN`. **Copy `backups/` off the server** (Contabo object storage / another host) - a dump on the same disk is not a backup. Manual: `docker compose --env-file .env.production exec backup /bin/sh /backup.sh once`.
Restore test (do this once after the first dump, before launch): `./restore.sh backups/<file>.dump` (scratch database). Disaster restore: `./restore.sh backups/<file>.dump --live`.

## Updates
`git pull && docker compose --env-file .env.production up -d --build` (migrations run automatically through the `migrate` service).

## Store purchases
Fill the Google/Apple variables in `.env.production`, keep `PAYMENTS_DEV_MODE=false`. With them empty real purchases are refused (fail closed). Not testable without your store accounts: use Google Play license testers / Apple sandbox, see docs/PURCHASE_TEST_PLAN.md.
