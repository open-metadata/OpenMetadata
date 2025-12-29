#!/bin/bash

echo "Testing Default Connector with Random Hash State"
echo "================================================"
echo ""

CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr -d "=+/" | cut -c1-43)

# Use the same hash from MCP Inspector error
RANDOM_HASH="e0b1c6f4feb421df4903fb39b39c388d2b71288b608845becb343ef224c88997"

echo "Making authorization request with random hash in state..."
echo "State: $RANDOM_HASH"
echo ""

RESPONSE=$(curl -s -i "http://localhost:8585/mcp/authorize?response_type=code&client_id=openmetadata-mcp-client&redirect_uri=http://localhost:3000/callback&scope=openid%20profile&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&state=$RANDOM_HASH")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP" | head -1 | awk '{print $2}')
LOCATION=$(echo "$RESPONSE" | grep -i "^Location:" | cut -d: -f2- | tr -d ' \r')

echo "HTTP Status: $HTTP_CODE"
echo "Redirect: $LOCATION"
echo ""

if echo "$LOCATION" | grep -q "code="; then
    echo "✅ SUCCESS!"
    echo "✅ Server detected random hash and used default connector"
    echo "✅ MCP Inspector should now work!"
    echo ""
    echo "Try: npx @modelcontextprotocol/inspector http://localhost:8585/mcp"
elif echo "$RESPONSE" | grep -qi "error"; then
    echo "❌ Still getting error:"
    echo "$RESPONSE" | grep -i "error"
else
    echo "Response:"
    echo "$RESPONSE"
fi
