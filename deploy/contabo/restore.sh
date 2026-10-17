#!/bin/sh
# Restore a dump INTO A SCRATCH DATABASE first (proves the backup works), or over the live one with --live.
#   ./restore.sh backups/kow-20261017-031500.dump          -> restores into kow_restore_test and prints row counts
#   ./restore.sh backups/kow-20261017-031500.dump --live   -> stops backend+panel, REPLACES the live database, starts them again
set -eu
cd "$(dirname "$0")"
f="${1:?dump file}"
[ -f "$f" ] || { echo "no such file: $f"; exit 1; }
DC="docker compose --env-file .env.production"
if [ "${2:-}" = "--live" ]; then
  printf 'This REPLACES the live database with %s. Type RESTORE to continue: ' "$f"
  read -r a
  [ "$a" = "RESTORE" ] || exit 1
  $DC stop backend panel
  $DC exec -T postgres psql -U kow -d postgres -c "DROP DATABASE IF EXISTS kingdoms_of_war WITH (FORCE);" -c "CREATE DATABASE kingdoms_of_war;"
  $DC exec -T postgres pg_restore -U kow -d kingdoms_of_war --no-owner < "$f"
  $DC up -d backend panel
else
  $DC exec -T postgres psql -U kow -d postgres -c "DROP DATABASE IF EXISTS kow_restore_test;" -c "CREATE DATABASE kow_restore_test;"
  $DC exec -T postgres pg_restore -U kow -d kow_restore_test --no-owner < "$f"
  $DC exec -T postgres psql -U kow -d kow_restore_test -c 'SELECT count(*) AS users FROM "users";' -c 'SELECT count(*) AS purchases FROM "player_purchases";'
  echo "scratch restore finished (database kow_restore_test). Drop it: $DC exec postgres psql -U kow -d postgres -c 'DROP DATABASE kow_restore_test;'"
fi
