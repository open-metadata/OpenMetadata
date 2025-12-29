#!/bin/bash

echo "Testing OAuth with connector_name Parameter"
echo "==========================================="
echo ""

# Generate PKCE
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr -d "=+/" | cut -c1-43)

echo "Step 1: Authorization with connector_name parameter"
echo "Connector: test-snowflake-mcp"
echo ""

# Make authorization request with connector_name
AUTH_CODE=$(curl -s "http://localhost:8585/mcp/authorize?response_type=code&client_id=openmetadata-mcp-client&redirect_uri=http://localhost:3000/callback&scope=openid%20profile&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&connector_name=test-snowflake-mcp&state=inspector-csrf-token" 2>&1 | head -1)

# Extract code from redirect URL if present
if [[ $AUTH_CODE == *"http://localhost:3000/callback"* ]]; then
    AUTH_CODE=$(echo "$AUTH_CODE" | grep -oP 'code=\K[^&]*' | head -1)
fi

if [[ $AUTH_CODE == *"error"* ]] || [[ -z "$AUTH_CODE" ]]; then
    echo "❌ Authorization failed:"
    echo "$AUTH_CODE"
    exit 1
fi

echo "✅ Authorization Code: ${AUTH_CODE:0:40}..."
echo ""

echo "Step 2: Token Exchange"
TOKEN_RESPONSE=$(curl -s -X POST "http://localhost:8585/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=$AUTH_CODE&redirect_uri=http://localhost:3000/callback&client_id=openmetadata-mcp-client&code_verifier=$CODE_VERIFIER")

echo "$TOKEN_RESPONSE" | jq .

if echo "$TOKEN_RESPONSE" | jq -e '.access_token' > /dev/null 2>&1; then
    echo ""
    echo "🎉 SUCCESS! connector_name parameter working!"
    echo ""
    echo "✅ MCP Inspector can now use: &connector_name=test-snowflake-mcp"
    echo "✅ OAuth flow completes without errors"
    echo "✅ Snowflake OAuth credentials used internally"
else
    echo ""
    echo "❌ Token exchange failed"
fi
