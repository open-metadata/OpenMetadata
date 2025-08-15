#!/bin/bash

# Script to start Fuseki and OpenSearch services for OpenMetadata RDF development

set -e

echo "=== Starting RDF Services for OpenMetadata ==="

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Running on macOS - skipping vm.max_map_count setting"
else
    # Set vm.max_map_count for OpenSearch (Linux only)
    echo "Setting vm.max_map_count for OpenSearch..."
    sudo sysctl -w vm.max_map_count=262144 || {
        echo "Warning: Could not set vm.max_map_count. OpenSearch might have issues."
        echo "Try running: sudo sysctl -w vm.max_map_count=262144"
    }
fi

# Load environment variables if .env exists
if [ -f .env ]; then
    echo "Loading environment variables from .env..."
    export $(grep -v '^#' .env | xargs)
fi

# Use default path if not set
VOLUMES_PATH=${DOCKER_VOLUMES_PATH:-./docker-volumes}

# Create volume directories
echo "Creating volume directories in: $VOLUMES_PATH"
mkdir -p "$VOLUMES_PATH/fuseki/databases" "$VOLUMES_PATH/fuseki/run" "$VOLUMES_PATH/opensearch"

# Set permissions
echo "Setting permissions..."
chmod -R 777 "$VOLUMES_PATH"

# Start Fuseki
echo "Starting Apache Jena Fuseki..."
# Use Rosetta 2 emulation on ARM64 for stain/jena-fuseki:5.0.0
if [[ $(uname -m) == "arm64" ]] || [[ $(uname -m) == "aarch64" ]]; then
    echo "Detected ARM64 architecture, using Rosetta 2 emulation..."
    docker compose -f docker-compose-fuseki-rosetta.yml up -d
else
    docker compose -f docker-compose-fuseki-standalone.yml up -d
fi

# Start OpenSearch
echo "Starting OpenSearch..."
docker compose -f docker-compose-opensearch-standalone.yml up -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 10

# Check Fuseki
echo -n "Checking Fuseki status... "
if curl -s http://localhost:3030/$/ping > /dev/null; then
    echo "✓ Fuseki is running"
    echo "  - Fuseki UI: http://localhost:3030"
    echo "  - SPARQL endpoint: http://localhost:3030/openmetadata/sparql"
    echo "  - Login: admin/admin"
else
    echo "✗ Fuseki is not responding"
fi

# Check OpenSearch
echo -n "Checking OpenSearch status... "
if curl -s http://localhost:9200/_cluster/health > /dev/null; then
    echo "✓ OpenSearch is running"
    echo "  - OpenSearch API: http://localhost:9200"
    echo "  - OpenSearch Dashboards: http://localhost:5601"
    echo "  - No authentication required (security disabled)"

    # Show cluster health
    echo ""
    echo "OpenSearch cluster health:"
    curl -s http://localhost:9200/_cluster/health?pretty | head -10
else
    echo "✗ OpenSearch is not responding"
fi

echo ""
echo "=== Services Started ==="
echo ""
echo "To stop services:"
echo "  docker-compose -f docker-compose-fuseki-standalone.yml down"
echo "  docker-compose -f docker-compose-opensearch-standalone.yml down"
echo ""
echo "To view logs:"
echo "  docker logs -f fuseki-standalone"
echo "  docker logs -f opensearch-standalone"
echo ""
echo "To clean up data:"
echo "  rm -rf fuseki-volume/* search-volume/*"
