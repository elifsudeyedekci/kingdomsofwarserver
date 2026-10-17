#!/usr/bin/env bash
# Docker Swarm deployment script for KingdomsOfWar.
#
# This script runs ON the Swarm manager node (copied there by CI via SSH).
# The CI job SSHes into the node and calls:
#   export IMAGE_TAG=<sha> IMAGE_PREFIX=ghcr.io/... REGISTRY_USER=... REGISTRY_TOKEN=...
#   bash /opt/kingdoms-of-war/scripts/deploy-swarm.sh [staging|production]
#
# Stack compose files expected at:
#   /opt/kingdoms-of-war/docker-compose.staging.yml
#   /opt/kingdoms-of-war/docker-compose.production.yml
set -euo pipefail

ENV="${1:-staging}"
STACK_NAME="kow-${ENV}"
COMPOSE_FILE="/opt/kingdoms-of-war/docker-compose.${ENV}.yml"

green()  { echo -e "\033[0;32m✅  $*\033[0m"; }
red()    { echo -e "\033[0;31m❌  $*\033[0m"; }
info()   { echo -e "\033[0;34mℹ️   $*\033[0m"; }

# ── Validate required env vars ─────────────────────────────────────────────
for VAR in IMAGE_TAG IMAGE_PREFIX REGISTRY_USER REGISTRY_TOKEN; do
  if [ -z "${!VAR:-}" ]; then
    red "Missing required env var: ${VAR}"
    exit 1
  fi
done

if [ ! -f "${COMPOSE_FILE}" ]; then
  red "Compose file not found: ${COMPOSE_FILE}"
  exit 1
fi

# ── Login to GHCR on the Swarm node ───────────────────────────────────────
info "Logging in to GitHub Container Registry…"
echo "${REGISTRY_TOKEN}" | docker login ghcr.io -u "${REGISTRY_USER}" --password-stdin

# ── Pull new images before deploying (pre-pull reduces rollout window) ────
SERVICES=(admin-backend admin-panel landing-website)
for SVC in "${SERVICES[@]}"; do
  NEW_IMAGE="${IMAGE_PREFIX}/${SVC}:${IMAGE_TAG}"
  info "Pulling ${NEW_IMAGE}…"
  docker pull "${NEW_IMAGE}"
  green "Pulled ${SVC}"
done

# ── Deploy (or update) the stack ──────────────────────────────────────────
info "Deploying stack ${STACK_NAME} from ${COMPOSE_FILE}…"
IMAGE_TAG="${IMAGE_TAG}" IMAGE_PREFIX="${IMAGE_PREFIX}" \
  docker stack deploy \
    --compose-file "${COMPOSE_FILE}" \
    --with-registry-auth \
    --prune \
    "${STACK_NAME}"

# ── Wait for all services to converge ─────────────────────────────────────
echo ""
echo "⏳  Waiting for Swarm services to converge (max 5min)…"
TIMEOUT=300
ELAPSED=0
INTERVAL=10

for SVC in "${SERVICES[@]}"; do
  FULL_SVC="${STACK_NAME}_${SVC}"
  info "Checking ${FULL_SVC}…"

  ELAPSED=0
  while true; do
    # Replicas running vs desired
    REPLICAS=$(docker service ls --filter "name=${FULL_SVC}" --format "{{.Replicas}}" 2>/dev/null || echo "0/0")
    RUNNING=$(echo "${REPLICAS}" | cut -d'/' -f1)
    DESIRED=$(echo "${REPLICAS}" | cut -d'/' -f2)

    if [ "${DESIRED}" -gt 0 ] && [ "${RUNNING}" = "${DESIRED}" ]; then
      green "${FULL_SVC}: ${REPLICAS} replicas running"
      break
    fi

    if [ "${ELAPSED}" -ge "${TIMEOUT}" ]; then
      red "${FULL_SVC}: timed out waiting for convergence (${REPLICAS})"
      docker service ps "${FULL_SVC}" --no-trunc
      exit 1
    fi

    info "${FULL_SVC}: ${REPLICAS} — waiting…"
    sleep "${INTERVAL}"
    ELAPSED=$((ELAPSED + INTERVAL))
  done
done

# ── Prune old images to free disk ─────────────────────────────────────────
info "Pruning dangling images…"
docker image prune -f --filter "until=24h" > /dev/null 2>&1 || true

echo ""
green "Docker Swarm deploy complete (${ENV}, tag=${IMAGE_TAG})"
