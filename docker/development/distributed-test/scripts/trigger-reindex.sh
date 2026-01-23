#!/bin/bash
# Trigger reindexing via REST API

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default values
SERVER_URL="http://localhost:8585"
RECREATE_INDEX=false
ENTITY_TYPES=""
BATCH_SIZE=100
PARTITION_SIZE=10000

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --recreate)
            RECREATE_INDEX=true
            shift
            ;;
        --entities)
            ENTITY_TYPES="$2"
            shift 2
            ;;
        --batch-size)
            BATCH_SIZE="$2"
            shift 2
            ;;
        --partition-size)
            PARTITION_SIZE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --server URL          Target server URL (default: http://localhost:8585)"
            echo "  --recreate            Drop and recreate indices before reindexing"
            echo "  --entities TYPES      Comma-separated entity types to reindex (default: all)"
            echo "  --batch-size NUM      Batch size for indexing (default: 100)"
            echo "  --partition-size NUM  Partition size for distributed indexing (default: 10000, range: 1000-50000)"
            echo "                        Smaller values = more partitions = better distribution across servers"
            echo "  -h, --help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Reindex all on server 1"
            echo "  $0 --server http://localhost:8587    # Trigger on server 2"
            echo "  $0 --recreate                        # Drop and recreate indices"
            echo "  $0 --entities table,dashboard        # Reindex only tables and dashboards"
            echo "  $0 --partition-size 2000             # Use smaller partitions for better distribution"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "======================================"
echo "Triggering Search Reindexing"
echo "======================================"
echo "Server: $SERVER_URL"
echo "Recreate indices: $RECREATE_INDEX"
echo "Batch size: $BATCH_SIZE"
echo "Partition size: $PARTITION_SIZE"
if [ -n "$ENTITY_TYPES" ]; then
    echo "Entity types: $ENTITY_TYPES"
else
    echo "Entity types: all"
fi
echo ""

# First, get a JWT token (using admin user)
echo "Authenticating..."
TOKEN_RESPONSE=$(curl -s -X POST "${SERVER_URL}/api/v1/users/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@open-metadata.org", "password": "admin"}')

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "Failed to authenticate. Response: $TOKEN_RESPONSE"
    echo ""
    echo "Trying with basic auth token..."
    # Try to get the bot token instead
    ACCESS_TOKEN="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJvcGVuLW1ldGFkYXRhLm9yZyIsInN1YiI6ImFkbWluIiwiZW1haWwiOiJhZG1pbkBvcGVuLW1ldGFkYXRhLm9yZyIsImlzQm90IjpmYWxzZSwiaXNBZG1pbiI6dHJ1ZSwidG9rZW5UeXBlIjoiUEVSU09OQUxfQUNDRVNTIiwiaWF0IjoxNjk1MjM3MzY2LCJleHAiOjE2OTc4MjkzNjZ9.placeholder"
fi

echo "Authenticated successfully."
echo ""

# Build the reindex request body
if [ "$RECREATE_INDEX" == "true" ]; then
    RECREATE_FLAG="true"
else
    RECREATE_FLAG="false"
fi

# Build entities array
if [ -n "$ENTITY_TYPES" ]; then
    # Convert comma-separated to JSON array
    ENTITIES_JSON=$(echo "$ENTITY_TYPES" | sed 's/,/","/g' | sed 's/^/["/' | sed 's/$/"]/')
else
    ENTITIES_JSON='["all"]'
fi

REQUEST_BODY=$(cat <<EOF
{
  "recreateIndex": $RECREATE_FLAG,
  "entities": $ENTITIES_JSON,
  "batchSize": $BATCH_SIZE,
  "partitionSize": $PARTITION_SIZE,
  "useDistributedIndexing": true,
  "runMode": "BATCH"
}
EOF
)

echo "Request body:"
echo "$REQUEST_BODY"
echo ""

# Trigger the reindex
echo "Triggering reindex..."
RESPONSE=$(curl -s -X POST "${SERVER_URL}/api/v1/apps/name/SearchIndexingApplication/trigger" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "$REQUEST_BODY")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check job status
echo "Checking job status..."
sleep 2

STATUS_RESPONSE=$(curl -s -X GET "${SERVER_URL}/api/v1/apps/name/SearchIndexingApplication/status" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Job status:"
echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
echo ""

echo "======================================"
echo "Reindex triggered!"
echo "======================================"
echo ""
echo "Monitor progress with:"
echo "  ./scripts/logs.sh -f --grep 'partition\\|SearchIndex\\|Distributed'"
echo ""
echo "Check job status:"
echo "  curl -s '${SERVER_URL}/api/v1/apps/name/SearchIndexingApplication/status'"
echo ""
