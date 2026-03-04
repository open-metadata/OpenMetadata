#!/bin/bash
# Stop the distributed test environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "Stopping distributed test environment..."

# Check for cleanup flag
if [ "$1" == "--clean" ] || [ "$1" == "-c" ]; then
    echo "Removing containers and volumes..."
    docker compose down -v --remove-orphans
    echo "Cleaned up all containers and volumes."
else
    docker compose down --remove-orphans
    echo "Containers stopped. Data volumes preserved."
    echo "Use --clean or -c to also remove volumes."
fi

echo "Done."
