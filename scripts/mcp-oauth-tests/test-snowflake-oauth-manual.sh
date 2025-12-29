#!/bin/bash

echo "Testing MCP OAuth with Snowflake Connector"
echo "=========================================="
echo ""

# Step 1: Get or use existing client
CLIENT_ID="openmetadata-mcp-client"
echo "Using client: $CLIENT_ID"
echo ""

# Step 2: Generate PKCE parameters
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr -d "=+/" | cut -c1-43)

echo "PKCE Challenge generated"
echo ""

# Step 3: Make authorization request with connector name in state
echo "Step 3: Authorization Request"
echo "Requesting authorization for connector: test-snowflake-mcp"

AUTH_RESPONSE=$(curl -s "http://localhost:8585/mcp/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=http://localhost:3000/callback&scope=openid%20profile&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&state=test-snowflake-mcp")

echo "Response: $AUTH_RESPONSE"

# Check if it's an error or a code
if [[ $AUTH_RESPONSE == *"error"* ]]; then
    echo ""
    echo "❌ Authorization failed:"
    echo "$AUTH_RESPONSE" | jq .
    exit 1
fi

# The response should be the authorization code directly (no redirect for connector OAuth)
AUTH_CODE="$AUTH_RESPONSE"
echo ""
echo "✅ Authorization successful!"
echo "Authorization Code: ${AUTH_CODE:0:30}..."
echo ""

# Step 4: Exchange code for tokens
echo "Step 4: Token Exchange"
TOKEN_RESPONSE=$(curl -s -X POST "http://localhost:8585/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=$AUTH_CODE&redirect_uri=http://localhost:3000/callback&client_id=$CLIENT_ID&code_verifier=$CODE_VERIFIER")

echo "$TOKEN_RESPONSE" | jq .

if [[ $TOKEN_RESPONSE == *"access_token"* ]]; then
    echo ""
    echo "✅ Token exchange successful!"
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
    echo "Access Token: ${ACCESS_TOKEN:0:50}..."
    echo ""
    echo "🎉 Complete OAuth flow successful with Snowflake connector!"
else
    echo ""
    echo "❌ Token exchange failed"
fi
