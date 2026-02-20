#!/bin/bash
# Start the distributed test environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$PROJECT_DIR/../../.." && pwd)"

cd "$PROJECT_DIR"

# Load environment variables (handle values with spaces properly)
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

echo "======================================"
echo "Distributed Search Indexing Test Setup"
echo "======================================"
echo ""
echo "Configuration:"
echo "  - MySQL Port: ${MYSQL_PORT:-3306}"
echo "  - OpenSearch Port: ${OPENSEARCH_PORT:-9200}"
echo "  - Server 1: http://localhost:8585"
echo "  - Server 2: http://localhost:8587"
echo "  - Server 3: http://localhost:8589"
echo ""

# Parse arguments
BUILD_FLAG=""
SKIP_MVN=false
for arg in "$@"; do
    case $arg in
        --build|-b)
            BUILD_FLAG="--build"
            ;;
        --skip-mvn|-s)
            SKIP_MVN=true
            ;;
    esac
done

# Check if distribution exists, if not build with Maven
DIST_TAR=$(find "$ROOT_DIR/openmetadata-dist/target" -name "openmetadata-*.tar.gz" 2>/dev/null | head -1)
if [ -z "$DIST_TAR" ] && [ "$SKIP_MVN" != "true" ]; then
    echo "OpenMetadata distribution not found. Building with Maven..."
    echo "This may take several minutes on first run."
    echo ""
    cd "$ROOT_DIR"
    mvn clean install -DskipTests -Pquickstart -pl '!openmetadata-ui' -am
    cd "$PROJECT_DIR"
    BUILD_FLAG="--build"
    echo ""
    echo "Maven build complete."
elif [ "$SKIP_MVN" == "true" ]; then
    echo "Skipping Maven build (--skip-mvn flag)"
fi

if [ -n "$BUILD_FLAG" ]; then
    echo "Building Docker images..."
fi

# Start the services
echo "Starting services..."
docker compose up -d $BUILD_FLAG

echo ""
echo "Waiting for services to be healthy..."

# Wait for MySQL
echo -n "  MySQL: "
until docker compose exec -T mysql mysqladmin ping -h localhost -uroot -p${MYSQL_ROOT_PASSWORD:-password} --silent 2>/dev/null; do
    echo -n "."
    sleep 2
done
echo " Ready"

# Wait for OpenSearch
echo -n "  OpenSearch: "
until curl -s http://localhost:${OPENSEARCH_PORT:-9200}/_cluster/health 2>/dev/null | grep -qE '"status":"(green|yellow)"'; do
    echo -n "."
    sleep 2
done
echo " Ready"

# Wait for each OM server
for server_num in 1 2 3; do
    case $server_num in
        1) port=8586 ;;
        2) port=8588 ;;
        3) port=8590 ;;
    esac

    echo -n "  Server $server_num (admin port $port): "
    timeout=120
    elapsed=0
    until curl -s "http://localhost:$port/healthcheck" >/dev/null 2>&1; do
        echo -n "."
        sleep 3
        elapsed=$((elapsed + 3))
        if [ $elapsed -ge $timeout ]; then
            echo " Timeout waiting for server $server_num"
            echo "Check logs with: ./scripts/logs.sh -f --server $server_num"
            exit 1
        fi
    done
    echo " Ready"
done

echo ""
echo "======================================"
echo "All services are up and running!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Load test data:     ./scripts/load-test-data.sh --tables 10000"
echo "  2. Trigger reindexing: ./scripts/trigger-reindex.sh"
echo "  3. Watch logs:         ./scripts/logs.sh -f"
echo ""
echo "Server endpoints:"
echo "  - Server 1: http://localhost:8585 (trigger reindex here)"
echo "  - Server 2: http://localhost:8587"
echo "  - Server 3: http://localhost:8589"
echo ""
