#!/bin/bash
# seed-production.sh — Run the Prisma seed script against the production database.
#
# Usage:
#   SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=secret ./deployment/scripts/seed-production.sh
#
# The script:
#   1. Prompts for explicit confirmation before running.
#   2. Logs all output (stdout + stderr) to deployment/logs/seed.log.
#   3. Exits non-zero on any failure (set -e).

set -euo pipefail

# ---------------------------------------------------------------------------
# Paths — resolve relative to repo root regardless of where the script is called from
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_DIR="${REPO_ROOT}/deployment/logs"
LOG_FILE="${LOG_DIR}/seed.log"
BACKEND_DIR="${REPO_ROOT}/admin-backend"

# ---------------------------------------------------------------------------
# Confirmation prompt
# ---------------------------------------------------------------------------
echo ""
echo "================================================================"
echo "  KINGDOMS OF WAR — PRODUCTION DATABASE SEED"
echo "================================================================"
echo ""
echo "  Target backend: ${BACKEND_DIR}"
echo "  Log file:       ${LOG_FILE}"
echo ""
echo "  This will upsert feature flags, remote config, localization"
echo "  keys, and the seed admin user into the PRODUCTION database."
echo ""
echo "  All operations are idempotent — existing data will be updated,"
echo "  nothing will be deleted."
echo ""

if [ -z "${SEED_ADMIN_EMAIL:-}" ]; then
  echo "  WARNING: SEED_ADMIN_EMAIL is not set — admin user will be skipped."
fi
if [ -z "${SEED_ADMIN_PASSWORD:-}" ]; then
  echo "  WARNING: SEED_ADMIN_PASSWORD is not set — admin user will be skipped."
fi

echo ""
read -rp "  Type 'yes' to continue: " CONFIRM
echo ""

if [ "${CONFIRM}" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

# ---------------------------------------------------------------------------
# Ensure log directory exists
# ---------------------------------------------------------------------------
mkdir -p "${LOG_DIR}"

# ---------------------------------------------------------------------------
# Run seed
# ---------------------------------------------------------------------------
TIMESTAMP="$(date '+%Y-%m-%dT%H:%M:%S%z')"
echo "================================================================" | tee -a "${LOG_FILE}"
echo "  Seed started at ${TIMESTAMP}" | tee -a "${LOG_FILE}"
echo "================================================================" | tee -a "${LOG_FILE}"

(
  cd "${BACKEND_DIR}"
  npx ts-node prisma/seed.ts
) 2>&1 | tee -a "${LOG_FILE}"

EXIT_CODE=${PIPESTATUS[0]}

TIMESTAMP_END="$(date '+%Y-%m-%dT%H:%M:%S%z')"
if [ "${EXIT_CODE}" -eq 0 ]; then
  echo "" | tee -a "${LOG_FILE}"
  echo "  Seed completed successfully at ${TIMESTAMP_END}" | tee -a "${LOG_FILE}"
  echo "================================================================" | tee -a "${LOG_FILE}"
else
  echo "" | tee -a "${LOG_FILE}"
  echo "  Seed FAILED (exit code ${EXIT_CODE}) at ${TIMESTAMP_END}" | tee -a "${LOG_FILE}"
  echo "================================================================" | tee -a "${LOG_FILE}"
  exit "${EXIT_CODE}"
fi
