#!/bin/sh
# Creates .env.production from the template with fresh random secrets. Never overwrites an existing file.
set -eu
cd "$(dirname "$0")"
[ -f .env.production ] && { echo ".env.production exists: not touching it"; exit 1; }
r() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
sed -e "s|__POSTGRES_PASSWORD__|$(r 24)|" -e "s|__REDIS_PASSWORD__|$(r 24)|" \
    -e "s|__JWT_SECRET__|$(r 48)|" -e "s|__JWT_REFRESH_SECRET__|$(r 48)|" -e "s|__ADMIN_JWT_SECRET__|$(r 48)|" \
    -e "s|__NEXTAUTH_SECRET__|$(r 32)|" -e "s|__BACKUP_AGENT_TOKEN__|$(r 32)|" .env.production.example > .env.production
chmod 600 .env.production
echo "created .env.production (mode 600). Now edit domains, e-mail and the store credentials in it."
