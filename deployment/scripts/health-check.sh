#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
ADMIN_PANEL_URL="${ADMIN_PANEL_URL:-http://localhost:3000}"
LANDING_URL="${LANDING_URL:-http://localhost:3002}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-kowuser}"
TIMEOUT=5

# Health check results
PASS_COUNT=0
FAIL_COUNT=0

# Utility functions
print_pass() {
    echo -e "${GREEN}PASS${NC}: $1"
    ((PASS_COUNT++))
}

print_fail() {
    echo -e "${RED}FAIL${NC}: $1"
    ((FAIL_COUNT++))
}

print_header() {
    echo ""
    echo "================================================"
    echo "$1"
    echo "================================================"
}

# HTTP health check
check_http_endpoint() {
    local name="$1"
    local url="$2"

    if command -v curl &> /dev/null; then
        if curl -sf --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$url" > /dev/null 2>&1; then
            print_pass "$name is responding ($url)"
        else
            print_fail "$name is not responding ($url)"
        fi
    else
        echo -e "${YELLOW}SKIP${NC}: curl not available, skipping $name"
    fi
}

# Docker container check
check_docker_container() {
    local container_name="$1"

    if command -v docker &> /dev/null; then
        if docker ps --filter "name=$container_name" --format '{{.Names}}' | grep -q "^$container_name$"; then
            print_pass "Docker container $container_name is running"
        else
            print_fail "Docker container $container_name is not running"
        fi
    else
        echo -e "${YELLOW}SKIP${NC}: Docker not available, skipping container checks"
    fi
}

# Database connectivity check
check_database() {
    if command -v pg_isready &> /dev/null; then
        if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
            print_pass "PostgreSQL database is accessible ($DB_HOST:$DB_PORT)"
        else
            print_fail "PostgreSQL database is not accessible ($DB_HOST:$DB_PORT)"
        fi
    elif command -v psql &> /dev/null; then
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "kingdoms_of_war" -c "SELECT 1" > /dev/null 2>&1; then
            print_pass "PostgreSQL database is accessible ($DB_HOST:$DB_PORT)"
        else
            print_fail "PostgreSQL database is not accessible ($DB_HOST:$DB_PORT)"
        fi
    else
        echo -e "${YELLOW}SKIP${NC}: pg_isready or psql not available, skipping database check"
    fi
}

# Main execution
echo ""
echo "Kingdoms of War - Health Check"
echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"

print_header "HTTP Endpoint Checks"
check_http_endpoint "Backend API" "$BACKEND_URL/health"
check_http_endpoint "Admin Panel" "$ADMIN_PANEL_URL"
check_http_endpoint "Landing Website" "$LANDING_URL"

print_header "Docker Container Checks"
check_docker_container "kowbackend"
check_docker_container "kowdb"
check_docker_container "kowredis"
check_docker_container "kownginx"
check_docker_container "kowadminpanel"
check_docker_container "kowlanding"

print_header "Database Connectivity"
check_database

# Summary
print_header "Health Check Summary"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Exit status
if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}All health checks passed!${NC}"
    exit 0
else
    echo -e "${RED}$FAIL_COUNT health check(s) failed!${NC}"
    exit 1
fi
