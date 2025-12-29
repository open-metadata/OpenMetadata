#!/bin/bash

echo "Testing MCP Server with OAuth Token"
echo "===================================="
echo ""

# Get a fresh OAuth token
echo "[1] Getting OAuth access token..."
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr -d "=+/" | cut -c1-43)

# Use random hash in state (like MCP Inspector does) - will use default connector
RANDOM_HASH=$(openssl rand -hex 32)

AUTH_RESPONSE=$(curl -s -i "http://localhost:8585/mcp/authorize?response_type=code&client_id=openmetadata-mcp-client&redirect_uri=http://localhost:3000/callback&scope=openid%20profile&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&state=$RANDOM_HASH")

LOCATION=$(echo "$AUTH_RESPONSE" | grep -i "^Location:" | cut -d: -f2- | tr -d ' \r\n')
AUTH_CODE=$(echo "$LOCATION" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')

if [ -z "$AUTH_CODE" ]; then
    echo "❌ Failed to get authorization code"
    echo "$AUTH_RESPONSE" | head -20
    exit 1
fi

echo "✅ Got authorization code"

# Exchange for token
TOKEN_RESPONSE=$(curl -s -X POST "http://localhost:8585/mcp/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code&code=$AUTH_CODE&redirect_uri=http://localhost:3000/callback&client_id=openmetadata-mcp-client&code_verifier=$CODE_VERIFIER")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Failed to get access token"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Got JWT access token: ${ACCESS_TOKEN:0:50}..."
echo ""

# Test MCP endpoint
echo "[2] Testing MCP initialize request..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:8585/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}')

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ MCP Server is working!"
    echo ""
    echo "Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""

    echo "[3] Listing available tools..."
    TOOLS=$(curl -s -X POST http://localhost:8585/mcp \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')

    echo "$TOOLS" | python3 -m json.tool 2>/dev/null || echo "$TOOLS"
else
    echo "❌ MCP request failed"
    echo "Response: $BODY"
fi
