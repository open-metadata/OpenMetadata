#!/usr/bin/env bash
# Gather context about an OpenMetadata connector for review.
# Usage: ./gather-connector-context.sh <service_type> <connector_name>
#
# Example: ./gather-connector-context.sh database mysql

set -euo pipefail

SERVICE_TYPE="${1:?Usage: gather-connector-context.sh <service_type> <connector_name>}"
CONNECTOR_NAME="${2:?Usage: gather-connector-context.sh <service_type> <connector_name>}"

REPO_ROOT="$(git rev-parse --show-toplevel)"
SOURCE_DIR="$REPO_ROOT/ingestion/src/metadata/ingestion/source/$SERVICE_TYPE/$CONNECTOR_NAME"
SPEC_DIR="$REPO_ROOT/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/$SERVICE_TYPE"
TEST_CONN_DIR="$REPO_ROOT/openmetadata-service/src/main/resources/json/data/testConnections/$SERVICE_TYPE"
UNIT_TEST_DIR="$REPO_ROOT/ingestion/tests/unit/topology/$SERVICE_TYPE"
INT_TEST_DIR="$REPO_ROOT/ingestion/tests/integration/$CONNECTOR_NAME"

echo "=== Connector: $CONNECTOR_NAME ($SERVICE_TYPE) ==="
echo ""

echo "--- Source Files ---"
if [ -d "$SOURCE_DIR" ]; then
    find "$SOURCE_DIR" -type f -name "*.py" | sort
else
    echo "NOT FOUND: $SOURCE_DIR"
fi
echo ""

echo "--- Connection Schema ---"
# Find the schema file (lowerCamelCase naming)
SCHEMA_FILES=$(find "$SPEC_DIR" -maxdepth 1 -name "*${CONNECTOR_NAME}*Connection.json" 2>/dev/null || true)
if [ -n "$SCHEMA_FILES" ]; then
    echo "$SCHEMA_FILES"
else
    echo "NOT FOUND in $SPEC_DIR"
fi
echo ""

echo "--- Test Connection JSON ---"
TEST_CONN_FILES=$(find "$TEST_CONN_DIR" -maxdepth 1 -name "*.json" 2>/dev/null | grep -i "$CONNECTOR_NAME" || true)
if [ -n "$TEST_CONN_FILES" ]; then
    echo "$TEST_CONN_FILES"
else
    echo "NOT FOUND in $TEST_CONN_DIR"
fi
echo ""

echo "--- Unit Tests ---"
UNIT_TESTS=$(find "$UNIT_TEST_DIR" -name "test_${CONNECTOR_NAME}*" 2>/dev/null || true)
if [ -n "$UNIT_TESTS" ]; then
    echo "$UNIT_TESTS"
else
    echo "NOT FOUND in $UNIT_TEST_DIR"
fi
echo ""

echo "--- Integration Tests ---"
if [ -d "$INT_TEST_DIR" ]; then
    find "$INT_TEST_DIR" -type f -name "*.py" | sort
else
    echo "NOT FOUND: $INT_TEST_DIR"
fi
echo ""

echo "--- Base Class ---"
if [ -f "$SOURCE_DIR/metadata.py" ]; then
    grep -E "class .+\(.*Source" "$SOURCE_DIR/metadata.py" || echo "No class found"
fi
echo ""

echo "--- ServiceSpec ---"
if [ -f "$SOURCE_DIR/service_spec.py" ]; then
    grep "ServiceSpec" "$SOURCE_DIR/service_spec.py" || echo "No ServiceSpec found"
fi
echo ""

echo "--- Imports Summary ---"
if [ -d "$SOURCE_DIR" ]; then
    grep -rh "^from metadata" "$SOURCE_DIR"/*.py 2>/dev/null | sort -u | head -20
fi
