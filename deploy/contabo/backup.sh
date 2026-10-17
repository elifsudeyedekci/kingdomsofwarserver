#!/bin/sh
# Daily PostgreSQL dump (custom format) + retention + report to the admin panel. Runs inside the `backup` container.
# Manual run: docker compose --env-file .env.production exec backup /bin/sh /backup.sh once
set -u
mkdir -p /backups
apk add --no-cache curl >/dev/null 2>&1 || true

report() {  # status file size checksum started
  [ -n "${BACKUP_AGENT_TOKEN:-}" ] || return 0
  curl -fsS -m 15 -X POST "$REPORT_URL" -H "x-agent-token: $BACKUP_AGENT_TOKEN" -H 'content-type: application/json' \
    -d "{\"type\":\"full\",\"status\":\"$1\",\"filePath\":\"$2\",\"fileSize\":$3,\"checksum\":\"$4\",\"startedAt\":\"$5\",\"completedAt\":\"$(date -u +%FT%TZ)\"}" >/dev/null || echo "report to the panel failed"
}

run_once() {
  started=$(date -u +%FT%TZ)
  f="/backups/kow-$(date -u +%Y%m%d-%H%M%S).dump"
  if pg_dump -Fc -f "$f" && pg_restore -l "$f" >/dev/null 2>&1; then
    size=$(wc -c < "$f"); sum=$(sha256sum "$f" | cut -d' ' -f1)
    echo "backup ok $f $size bytes"
    report completed "$f" "$size" "$sum" "$started"
  else
    echo "BACKUP FAILED"; rm -f "$f"; report failed "$f" 0 "" "$started"
  fi
  find /backups -name 'kow-*.dump' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
}

if [ "${1:-}" = "once" ]; then run_once; exit 0; fi
while true; do
  now=$(date +%s)
  next=$(date -d "03:15" +%s 2>/dev/null || echo $((now + 86400)))
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  run_once
done
