#!/bin/bash

# Script to stop Fuseki and OpenSearch services

echo "=== Stopping RDF Services ==="

# Stop Fuseki
echo "Stopping Apache Jena Fuseki..."
# Try to stop all possible Fuseki configurations
docker compose -f docker-compose-fuseki-rosetta.yml down 2>/dev/null || true
docker compose -f docker-compose-fuseki-multiarch.yml down 2>/dev/null || true
docker compose -f docker-compose-fuseki-arm64.yml down 2>/dev/null || true
docker compose -f docker-compose-fuseki-standalone.yml down 2>/dev/null || true

# Stop OpenSearch
echo "Stopping OpenSearch..."
docker compose -f docker-compose-opensearch-standalone.yml down

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Use default path if not set
VOLUMES_PATH=${DOCKER_VOLUMES_PATH:-./docker-volumes}

echo ""
echo "=== Services Stopped ==="
echo ""
echo "Data is preserved in:"
echo "  - Fuseki: $VOLUMES_PATH/fuseki"
echo "  - OpenSearch: $VOLUMES_PATH/opensearch"
echo ""
echo "To remove all data:"
echo "  rm -rf $VOLUMES_PATH/*"
echo ""
echo "To remove Docker volumes:"
echo "  docker volume prune"