#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="${LOG_FILE:-deployment/logs/rollback.log}"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Log function
log_action() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log_action "ERROR: $1"
    echo -e "${RED}ROLLBACK FAILED: $1${NC}" >&2
    exit 1
}

# Check arguments
if [ $# -ne 1 ]; then
    echo "Usage: $(basename "$0") <commit-hash>"
    echo ""
    echo "Example: $(basename "$0") abc123def456"
    exit 1
fi

COMMIT_HASH="$1"

# Validate commit hash format (basic check)
if ! [[ "$COMMIT_HASH" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
    error_exit "Invalid commit hash format: $COMMIT_HASH"
fi

# Confirmation
echo ""
echo -e "${YELLOW}WARNING: About to rollback to commit: ${GREEN}$COMMIT_HASH${NC}"
echo -e "${YELLOW}This will:${NC}"
echo "  1. Fetch latest from origin"
echo "  2. Checkout commit $COMMIT_HASH"
echo "  3. Install dependencies"
echo "  4. Run database migrations"
echo "  5. Rebuild and restart containers"
echo ""
read -p "Proceed with rollback? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
fi

# Start rollback
log_action "Starting rollback to commit: $COMMIT_HASH"

# Step 1: Fetch latest
log_action "Fetching latest from origin..."
cd "$DEPLOY_DIR"
if ! git fetch origin; then
    error_exit "Failed to fetch from origin"
fi
log_action "Fetch completed successfully"

# Step 2: Checkout commit
log_action "Checking out commit: $COMMIT_HASH"
if ! git checkout "$COMMIT_HASH"; then
    error_exit "Failed to checkout commit $COMMIT_HASH"
fi
log_action "Checked out commit: $COMMIT_HASH"

# Step 3: Install dependencies
log_action "Installing dependencies in admin-backend..."
if ! cd "$DEPLOY_DIR/admin-backend"; then
    error_exit "Failed to navigate to admin-backend directory"
fi
if ! npm ci; then
    error_exit "Failed to install dependencies"
fi
log_action "Dependencies installed successfully"

# Step 4: Run migrations
log_action "Running Prisma migrations..."
if ! npx prisma migrate deploy; then
    error_exit "Failed to run Prisma migrations"
fi
log_action "Migrations completed successfully"

# Step 5: Rebuild and restart containers
log_action "Rebuilding and restarting Docker containers..."
cd "$DEPLOY_DIR"
if ! docker-compose -f docker-compose.yml -f deployment/docker-compose.prod.yml up -d --build; then
    error_exit "Failed to build and start Docker containers"
fi
log_action "Docker containers rebuilt and started successfully"

# Completion
log_action "Rollback to $COMMIT_HASH completed successfully"
echo ""
echo -e "${GREEN}Rollback completed successfully!${NC}"
echo "Rolled back to commit: $COMMIT_HASH"
echo "Log file: $LOG_FILE"
