#!/usr/bin/env bash
# AWS ECS deployment script for KingdomsOfWar.
#
# Usage (deploy):
#   IMAGE_TAG=<sha> ECS_CLUSTER=kingdoms-of-war-staging ECS_REGION=eu-west-1 \
#   IMAGE_PREFIX=ghcr.io/org/repo bash scripts/deploy-ecs.sh staging
#
# Usage (rollback):
#   bash scripts/deploy-ecs.sh production rollback
#
# Required env vars for deploy:
#   IMAGE_TAG       — Docker image tag (git SHA)
#   ECS_CLUSTER     — ECS cluster name
#   ECS_REGION      — AWS region
#   IMAGE_PREFIX    — GHCR image prefix (ghcr.io/owner/repo)
#
# AWS credentials must be pre-configured (e.g. via aws-actions/configure-aws-credentials).
set -euo pipefail

ENV="${1:-staging}"
ACTION="${2:-deploy}"

SERVICES=(admin-backend admin-panel landing-website)

# ── Per-service ECS config ─────────────────────────────────────────────────
# Map service name → ECS service name + task family
declare -A ECS_SERVICE_NAME=(
  [admin-backend]="kow-${ENV}-backend"
  [admin-panel]="kow-${ENV}-panel"
  [landing-website]="kow-${ENV}-landing"
)
declare -A TASK_FAMILY=(
  [admin-backend]="kow-${ENV}-backend"
  [admin-panel]="kow-${ENV}-panel"
  [landing-website]="kow-${ENV}-landing"
)
# Container name inside the task definition that holds our image
declare -A CONTAINER_NAME=(
  [admin-backend]="backend"
  [admin-panel]="panel"
  [landing-website]="landing"
)

green()  { echo -e "\033[0;32m✅  $*\033[0m"; }
red()    { echo -e "\033[0;31m❌  $*\033[0m"; }
info()   { echo -e "\033[0;34mℹ️   $*\033[0m"; }

# ── Rollback: re-register previous revision and redeploy ─────────────────
if [ "${ACTION}" = "rollback" ]; then
  echo "🔄  Rolling back ECS services in cluster ${ECS_CLUSTER} (${ENV})…"
  for SVC in "${SERVICES[@]}"; do
    FAMILY="${TASK_FAMILY[$SVC]}"
    ECS_SVC="${ECS_SERVICE_NAME[$SVC]}"

    # Get current active revision, then roll back to revision - 1
    CURRENT_REV=$(aws ecs describe-services \
      --cluster "${ECS_CLUSTER}" \
      --services "${ECS_SVC}" \
      --region "${ECS_REGION}" \
      --query 'services[0].taskDefinition' \
      --output text)

    # Extract revision number and decrement
    REV_NUM=$(echo "${CURRENT_REV}" | grep -oE '[0-9]+$')
    PREV_REV=$((REV_NUM - 1))
    PREV_DEF="${FAMILY}:${PREV_REV}"

    info "Rolling ${ECS_SVC} back to ${PREV_DEF}"
    aws ecs update-service \
      --cluster "${ECS_CLUSTER}" \
      --service "${ECS_SVC}" \
      --task-definition "${PREV_DEF}" \
      --region "${ECS_REGION}" \
      --force-new-deployment \
      --output text --query 'service.serviceName' > /dev/null

    green "Rollback initiated for ${ECS_SVC}"
  done

  # Wait for rollbacks to stabilise
  for SVC in "${SERVICES[@]}"; do
    ECS_SVC="${ECS_SERVICE_NAME[$SVC]}"
    info "Waiting for rollback of ${ECS_SVC}…"
    aws ecs wait services-stable \
      --cluster "${ECS_CLUSTER}" \
      --services "${ECS_SVC}" \
      --region "${ECS_REGION}"
    green "${ECS_SVC} stable after rollback"
  done
  exit 0
fi

# ── Deploy: register new task definition revision, update service ─────────
echo "🚀  Deploying to ECS cluster ${ECS_CLUSTER} (${ENV}), tag=${IMAGE_TAG}…"

for SVC in "${SERVICES[@]}"; do
  FAMILY="${TASK_FAMILY[$SVC]}"
  ECS_SVC="${ECS_SERVICE_NAME[$SVC]}"
  CONTAINER="${CONTAINER_NAME[$SVC]}"
  NEW_IMAGE="${IMAGE_PREFIX}/${SVC}:${IMAGE_TAG}"

  info "Updating task definition for ${FAMILY} → ${NEW_IMAGE}"

  # Fetch current task definition JSON, swap image, strip registration-time fields
  TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition "${FAMILY}" \
    --region "${ECS_REGION}" \
    --query 'taskDefinition' \
    --output json)

  NEW_TASK_DEF=$(echo "${TASK_DEF}" | python3 -c "
import sys, json
td = json.load(sys.stdin)
# Update image for matching container
for c in td.get('containerDefinitions', []):
    if c.get('name') == '${CONTAINER}':
        c['image'] = '${NEW_IMAGE}'
# Strip read-only fields that cannot be re-registered
for key in ('taskDefinitionArn','revision','status','requiresAttributes',
             'compatibilities','registeredAt','registeredBy','deregisteredAt'):
    td.pop(key, None)
print(json.dumps(td))
")

  # Register new task definition revision
  NEW_ARN=$(aws ecs register-task-definition \
    --cli-input-json "${NEW_TASK_DEF}" \
    --region "${ECS_REGION}" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

  info "Registered ${NEW_ARN}"

  # Update the ECS service to use the new revision
  aws ecs update-service \
    --cluster "${ECS_CLUSTER}" \
    --service "${ECS_SVC}" \
    --task-definition "${NEW_ARN}" \
    --force-new-deployment \
    --region "${ECS_REGION}" \
    --output text --query 'service.serviceName' > /dev/null

  green "Service update initiated: ${ECS_SVC}"
done

# ── Wait for all services to stabilise (ECS rolling deploy) ───────────────
echo ""
echo "⏳  Waiting for ECS services to stabilise…"
for SVC in "${SERVICES[@]}"; do
  ECS_SVC="${ECS_SERVICE_NAME[$SVC]}"
  info "Waiting for ${ECS_SVC}…"
  aws ecs wait services-stable \
    --cluster "${ECS_CLUSTER}" \
    --services "${ECS_SVC}" \
    --region "${ECS_REGION}"
  green "${ECS_SVC} stable"
done

echo ""
green "ECS deploy complete (${ENV}, tag=${IMAGE_TAG})"
