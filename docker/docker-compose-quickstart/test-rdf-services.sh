#!/bin/bash

# Test script for RDF services

echo "=== Testing RDF Services ==="
echo ""

# Test Fuseki
echo "Testing Apache Jena Fuseki..."
echo -n "  Checking health: "
if curl -s http://localhost:3030/$/ping > /dev/null 2>&1; then
    echo "✓ OK"
    
    echo -n "  Checking datasets: "
    if curl -s http://localhost:3030/$/datasets | grep -q "openmetadata"; then
        echo "✓ openmetadata dataset found"
    else
        echo "✗ openmetadata dataset not found"
    fi
    
    echo -n "  Testing SPARQL endpoint: "
    SPARQL_TEST=$(curl -s -X POST http://localhost:3030/openmetadata/sparql \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d 'query=SELECT ?s WHERE { ?s ?p ?o } LIMIT 1' 2>&1)
    if echo "$SPARQL_TEST" | grep -q "results"; then
        echo "✓ SPARQL endpoint working"
    else
        echo "✗ SPARQL endpoint not responding correctly"
    fi
else
    echo "✗ Fuseki not responding on port 3030"
fi

echo ""

# Test OpenSearch
echo "Testing OpenSearch..."
echo -n "  Checking health: "
HEALTH=$(curl -s http://localhost:9200/_cluster/health 2>/dev/null)
if echo "$HEALTH" | grep -q "status"; then
    STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "✓ OK (status: $STATUS)"
    
    echo -n "  Checking version: "
    VERSION=$(curl -s http://localhost:9200 | grep -o '"number":"[^"]*"' | cut -d'"' -f4)
    echo "✓ Version $VERSION"
    
    echo -n "  Checking indices: "
    INDICES=$(curl -s http://localhost:9200/_cat/indices?v 2>/dev/null | wc -l)
    echo "✓ $((INDICES-1)) indices"
else
    echo "✗ OpenSearch not responding on port 9200"
fi

echo ""
echo "=== Test Complete ==="