#!/bin/bash

echo "Complete MCP OAuth Flow Test with Snowflake"
echo "============================================"
echo ""

# Generate PKCE
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr -d "=+/" | cut -c1-43)

echo "Step 1: Authorization Request"
echo "Connector: test-snowflake-mcp"

AUTH_CODE=$(curl -s "http://localhost:8585/mcp/authorize?response_type=code&client_id=openmetadata-mcp-client&redirect_uri=http://localhost:3000/callback&scope=openid%20profile&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&state=test-snowflake-mcp")

if [[ $AUTH_CODE == *"error"* ]]; then
    echo "❌ Authorization failed:"
    echo "$AUTH_CODE" | jq .
    exit 1
fi

echo "✅ Authorization Code: ${AUTH_CODE:0:40}..."
echo ""

echo "Step 2: Token Exchange"
TOKEN_RESPONSE=$(curl -s -X POST "http://localhost:8585/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=$AUTH_CODE&redirect_uri=http://localhost:3000/callback&client_id=openmetadata-mcp-client&code_verifier=$CODE_VERIFIER")

echo "$TOKEN_RESPONSE" | jq .

if [[ $TOKEN_RESPONSE == *"access_token"* ]]; then
    echo ""
    echo "🎉 SUCCESS! Complete OAuth flow with Snowflake connector working!"
    echo ""
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
    echo "You can now use this access token to call MCP tools:"
    echo "  Authorization: Bearer $ACCESS_TOKEN"
else
    echo ""
    echo "❌ Token exchange failed"
fi
