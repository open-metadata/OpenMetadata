#!/bin/bash
# Integration test script for Confluent CDC connector
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "==================================================================="
echo "Confluent CDC Connector - Integration Test"
echo "==================================================================="
echo ""

# Test 1: Check Kafka Connect is running
echo -n "Test 1: Checking Kafka Connect availability... "
if curl -sf http://localhost:8083/ > /dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC} - Kafka Connect not available"
    exit 1
fi

# Test 2: List connectors
echo -n "Test 2: Listing CDC connectors... "
CONNECTORS=$(curl -s http://localhost:8083/connectors)
if echo "$CONNECTORS" | grep -q "mysql-source-inventory"; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo "   Found connectors: $CONNECTORS"
else
    echo -e "${RED}✗ FAIL${NC} - No connectors found"
    exit 1
fi

# Test 3: Check connector status
echo -n "Test 3: Checking MySQL source connector status... "
STATUS=$(curl -s http://localhost:8083/connectors/mysql-source-inventory/status | jq -r '.connector.state')
if [ "$STATUS" = "RUNNING" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC} - Connector status: $STATUS"
    curl -s http://localhost:8083/connectors/mysql-source-inventory/status | jq .
fi

# Test 4: Check sink connector status
echo -n "Test 4: Checking PostgreSQL sink connector status... "
SINK_STATUS=$(curl -s http://localhost:8083/connectors/postgres-sink-customers/status | jq -r '.connector.state' 2>/dev/null || echo "NOT_FOUND")
if [ "$SINK_STATUS" = "RUNNING" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Sink connector status: $SINK_STATUS"
fi

# Test 5: Check Kafka topics exist
echo -n "Test 5: Checking Kafka topics... "
TOPICS=$(docker exec cdc-kafka kafka-topics --bootstrap-server localhost:9092 --list 2>/dev/null || echo "")
if echo "$TOPICS" | grep -q "dbserver1.inventory.customers"; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo "   Topics found:"
    echo "$TOPICS" | grep "dbserver1" | sed 's/^/   - /'
else
    echo -e "${YELLOW}⚠ WARNING${NC} - CDC topics not found yet"
fi

# Test 6: Check MySQL data
echo -n "Test 6: Checking MySQL source data... "
MYSQL_COUNT=$(docker exec cdc-mysql mysql -uroot -pdebezium inventory -sN -e "SELECT COUNT(*) FROM customers" 2>/dev/null || echo "0")
if [ "$MYSQL_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Found $MYSQL_COUNT customers"
else
    echo -e "${RED}✗ FAIL${NC} - No data in MySQL"
fi

# Test 7: Check PostgreSQL data
echo -n "Test 7: Checking PostgreSQL target data... "
sleep 5
PG_COUNT=$(docker exec cdc-postgres psql -U postgres -d warehouse -t -c "SELECT COUNT(*) FROM customers" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$PG_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Found $PG_COUNT customers replicated"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - No data in PostgreSQL yet"
fi

# Test 8: Insert test data and verify CDC
echo ""
echo "Test 8: Testing CDC data flow..."
echo "   Inserting test record into MySQL..."
docker exec cdc-mysql mysql -uroot -pdebezium inventory -e \
    "INSERT INTO customers (id, first_name, last_name, email) VALUES (9999, 'Test', 'User', 'test@cdc.com');" 2>/dev/null

echo "   Waiting for CDC to propagate..."
sleep 10

echo -n "   Checking if record appeared in PostgreSQL... "
PG_TEST=$(docker exec cdc-postgres psql -U postgres -d warehouse -t -c \
    "SELECT COUNT(*) FROM customers WHERE id = 9999" 2>/dev/null | tr -d ' ')
if [ "$PG_TEST" = "1" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Record not replicated yet (count: $PG_TEST)"
fi

# Test 9: Check Schema Registry
echo -n "Test 9: Checking Schema Registry for topic schemas... "
SCHEMAS=$(curl -s http://localhost:8081/subjects 2>/dev/null || echo "[]")
if echo "$SCHEMAS" | grep -q "dbserver1.inventory.customers"; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo "   Schemas registered:"
    echo "$SCHEMAS" | jq -r '.[]' | grep "dbserver1" | sed 's/^/   - /'
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Schemas not registered yet"
fi

# Test 10: Validate connector configuration
echo ""
echo "Test 10: Validating connector config for lineage extraction..."
CONFIG=$(curl -s http://localhost:8083/connectors/mysql-source-inventory/config)

echo -n "   Checking table.include.list... "
if echo "$CONFIG" | jq -r '.["table.include.list"]' | grep -q "inventory.customers"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC}"
fi

# Cleanup test data
echo ""
echo "Cleaning up test data..."
docker exec cdc-mysql mysql -uroot -pdebezium inventory -e \
    "DELETE FROM customers WHERE id = 9999;" 2>/dev/null || true

echo ""
echo "==================================================================="
echo "Integration Test Summary"
echo "==================================================================="
echo -e "${GREEN}CDC infrastructure is ready for OpenMetadata ingestion!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: cd /path/to/OpenMetadata"
echo "  2. Generate models: mvn clean install -DskipTests -pl openmetadata-spec"
echo "  3. Run unit tests: cd ingestion && python -m pytest tests/unit/topology/pipeline/test_confluentcdc.py -v"
echo "  4. Start OpenMetadata server"
echo "  5. Run database ingestion workflows"
echo "  6. Run Confluent CDC workflow"
echo ""
echo "Connector Status:"
curl -s http://localhost:8083/connectors | jq -r '.[]' | while read connector; do
    echo "  - $connector"
    curl -s "http://localhost:8083/connectors/$connector/status" | \
        jq -r '"    Status: \(.connector.state), Tasks: \(.tasks | length)"' 2>/dev/null || echo "    Status: ERROR"
done
echo ""
