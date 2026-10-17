#!/usr/bin/env bash
# Smoke test suite for KingdomsOfWar deployments.
#
# Usage:
#   BACKEND_URL=https://... PANEL_URL=https://... LANDING_URL=https://... \
#   bash scripts/smoke-test.sh [staging|production]
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
set -euo pipefail

ENV="${1:-staging}"
FAILURES=0
PASS=0

# ── Helpers ────────────────────────────────────────────────────────────────

green()  { echo -e "\033[0;32m✅  $*\033[0m"; }
red()    { echo -e "\033[0;31m❌  $*\033[0m"; }
yellow() { echo -e "\033[0;33m⚠️   $*\033[0m"; }
header() { echo -e "\n\033[1;36m── $* ──\033[0m"; }

check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local grep_pattern="${4:-}"
  local timeout="${5:-15}"

  local response http_status body
  response=$(curl --silent --max-time "${timeout}" --write-out "\n%{http_code}" "${url}" 2>/dev/null || echo -e "\n000")
  http_status=$(echo "${response}" | tail -1)
  body=$(echo "${response}" | head -n -1)

  if [ "${http_status}" = "000" ]; then
    red "${name}: UNREACHABLE (${url})"
    FAILURES=$((FAILURES + 1))
    return
  fi

  if [ "${http_status}" != "${expected_status}" ]; then
    red "${name}: HTTP ${http_status} (expected ${expected_status}) — ${url}"
    FAILURES=$((FAILURES + 1))
    return
  fi

  if [ -n "${grep_pattern}" ] && ! echo "${body}" | grep -q "${grep_pattern}"; then
    red "${name}: Response body missing '${grep_pattern}' — ${url}"
    FAILURES=$((FAILURES + 1))
    return
  fi

  green "${name}: HTTP ${http_status} OK"
  PASS=$((PASS + 1))
}

# ── Allow services time to stabilise after deploy ─────────────────────────
echo "⏳  Waiting 15s for services to stabilise…"
sleep 15

# ── Backend checks ─────────────────────────────────────────────────────────
header "Backend (${BACKEND_URL:-NOT SET})"

if [ -n "${BACKEND_URL:-}" ]; then
  # Liveness — must return { "status": "ok" }
  check "GET /health"          "${BACKEND_URL}/health"         200 '"status":"ok"'

  # Auth endpoint exists (OPTIONS 200 or POST 400/422 means route is registered)
  check "POST /auth/login exists" "${BACKEND_URL}/auth/login"  400 ""

  # OpenAPI spec accessible
  check "GET /api (Swagger)"   "${BACKEND_URL}/api-json"       200 '"openapi"'

  # Throttler probe — 429 would indicate misconfiguration at smoke-test volume
  check "GET /health (2nd)"    "${BACKEND_URL}/health"         200 '"status":"ok"'
else
  yellow "BACKEND_URL not set — skipping backend checks"
fi

# ── Admin panel checks ─────────────────────────────────────────────────────
header "Admin Panel (${PANEL_URL:-NOT SET})"

if [ -n "${PANEL_URL:-}" ]; then
  # Root should redirect to /login or return 200
  check "GET / (panel)"        "${PANEL_URL}/"                 200 ""
  check "GET /login"           "${PANEL_URL}/login"            200 ""
else
  yellow "PANEL_URL not set — skipping admin panel checks"
fi

# ── Landing website checks ─────────────────────────────────────────────────
header "Landing Website (${LANDING_URL:-NOT SET})"

if [ -n "${LANDING_URL:-}" ]; then
  check "GET / (landing)"      "${LANDING_URL}/"               200 ""
  check "GET /about"           "${LANDING_URL}/about"          200 ""
  check "GET /privacy"         "${LANDING_URL}/privacy"        200 ""
else
  yellow "LANDING_URL not set — skipping landing website checks"
fi

# ── Production-only extra checks ──────────────────────────────────────────
if [ "${ENV}" = "production" ] && [ -n "${BACKEND_URL:-}" ]; then
  header "Production Extra Checks"
  # Confirm backend reports correct service name
  check "Backend version tag"  "${BACKEND_URL}/health"   200 '"service":"kingdoms-of-war-admin-backend"'
fi

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────"
echo "  Smoke test results [${ENV}]"
echo "  Passed : ${PASS}"
echo "  Failed : ${FAILURES}"
echo "────────────────────────────────────────"

if [ "${FAILURES}" -gt 0 ]; then
  red "Smoke tests FAILED (${FAILURES} failure(s))"
  exit 1
fi

green "All smoke tests passed"
exit 0
