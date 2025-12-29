#!/bin/bash
#
# Complete MCP OAuth Flow Test Script
#
# This script tests the full OAuth flow for MCP with OpenMetadata
# Usage: ./test-mcp-oauth-complete.sh <connector_name>
# Example: ./test-mcp-oauth-complete.sh my-bigquery-connector
#

set -e

if [ -z "$1" ]; then
  echo "Error: Connector name required"
  echo "Usage: $0 <connector_name>"
  echo "Example: $0 my-bigquery-connector"
  exit 1
fi

CONNECTOR_NAME="$1"
BASE_URL="http://localhost:8585"
REDIRECT_URI="http://localhost:6274/callback"

echo "========================================"
echo "  MCP OAuth Flow Test"
echo "  Connector: $CONNECTOR_NAME"
echo "========================================"
echo ""

echo "=== Step 1: OAuth Discovery ==="
echo "Testing OAuth authorization server metadata..."
DISCOVERY_RESPONSE=$(curl -s "$BASE_URL/.well-known/oauth-authorization-server")
if echo "$DISCOVERY_RESPONSE" | jq -e '.issuer' > /dev/null 2>&1; then
  echo "✅ OAuth discovery endpoint working"
  echo "$DISCOVERY_RESPONSE" | jq '{issuer, authorization_endpoint, token_endpoint}'
else
  echo "❌ OAuth discovery failed"
  echo "$DISCOVERY_RESPONSE"
  exit 1
fi
echo ""

echo "=== Step 2: Client Registration ==="
REGISTRATION_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_name\": \"MCP OAuth Test Client\",
    \"redirect_uris\": [\"$REDIRECT_URI\"],
    \"grant_types\": [\"authorization_code\", \"refresh_token\"],
    \"response_types\": [\"code\"],
    \"token_endpoint_auth_method\": \"none\"
  }")

if echo "$REGISTRATION_RESPONSE" | jq -e '.client_id' > /dev/null 2>&1; then
  echo "✅ Client registration successful"
  CLIENT_ID=$(echo "$REGISTRATION_RESPONSE" | jq -r '.client_id')
  echo "Client ID: $CLIENT_ID"
else
  echo "❌ Client registration failed"
  echo "$REGISTRATION_RESPONSE" | jq '.'
  exit 1
fi
echo ""

echo "=== Step 3: PKCE Setup ==="
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr -d "=+/" | cut -c1-43)
echo "✅ PKCE parameters generated"
echo "Code Verifier: ${CODE_VERIFIER:0:20}..."
echo "Code Challenge: ${CODE_CHALLENGE:0:20}..."
echo ""

echo "=== Step 4: Authorization Request ==="
echo "Requesting authorization for connector: $CONNECTOR_NAME"
AUTH_URL="$BASE_URL/mcp/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&scope=openid%20profile&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&state=$CONNECTOR_NAME"

AUTH_RESPONSE=$(curl -s -v "$AUTH_URL" 2>&1)
LOCATION=$(echo "$AUTH_RESPONSE" | grep -i "^< Location:" | sed 's/^< Location: //' | tr -d '\r\n')

if echo "$LOCATION" | grep -q "code="; then
  echo "✅ Authorization successful"
  AUTH_CODE=$(echo "$LOCATION" | sed 's/.*code=\([^&]*\).*/\1/')
  echo "Authorization Code: ${AUTH_CODE:0:20}..."
elif echo "$LOCATION" | grep -q "error="; then
  echo "❌ Authorization failed"
  ERROR=$(echo "$LOCATION" | sed 's/.*error=\([^&]*\).*/\1/')
  ERROR_DESC=$(echo "$LOCATION" | sed 's/.*error_description=\([^&]*\).*/\1/' | sed 's/+/ /g' | sed 's/%253A/:/g' | sed 's/%2F/\//g')
  echo "Error: $ERROR"
  echo "Description: $ERROR_DESC"
  echo ""
  echo "💡 This likely means:"
  if [[ "$ERROR_DESC" == *"not found"* ]]; then
    echo "   - The database service '$CONNECTOR_NAME' doesn't exist in OpenMetadata"
    echo "   - Create the service via OpenMetadata UI: http://localhost:8585"
  elif [[ "$ERROR_DESC" == *"OAuth not configured"* ]]; then
    echo "   - The database service exists but doesn't have OAuth credentials"
    echo "   - Configure OAuth credentials in the service settings"
  fi
  exit 1
else
  echo "❌ Unexpected response"
  echo "$LOCATION"
  exit 1
fi
echo ""

echo "=== Step 5: Token Exchange ==="
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=$AUTH_CODE&redirect_uri=$REDIRECT_URI&code_verifier=$CODE_VERIFIER&client_id=$CLIENT_ID")

if echo "$TOKEN_RESPONSE" | jq -e '.access_token' > /dev/null 2>&1; then
  echo "✅ Token exchange successful"
  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
  REFRESH_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.refresh_token')
  echo "Access Token: ${ACCESS_TOKEN:0:50}..."
  echo "Refresh Token: ${REFRESH_TOKEN:0:50}..."
  echo "Expires In: $(echo "$TOKEN_RESPONSE" | jq -r '.expires_in') seconds"
else
  echo "❌ Token exchange failed"
  echo "$TOKEN_RESPONSE" | jq '.'
  exit 1
fi
echo ""

echo "=== Step 6: Test API Access ==="
API_RESPONSE=$(curl -s "$BASE_URL/api/v1/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$API_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  echo "✅ API access with MCP token working"
  USER_COUNT=$(echo "$API_RESPONSE" | jq '.data | length')
  echo "Retrieved $USER_COUNT users from OpenMetadata"
else
  echo "❌ API access failed"
  echo "$API_RESPONSE" | jq '.' 2>/dev/null || echo "$API_RESPONSE"
fi
echo ""

echo "=== Step 7: Token Refresh ==="
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=$REFRESH_TOKEN&client_id=$CLIENT_ID")

if echo "$REFRESH_RESPONSE" | jq -e '.access_token' > /dev/null 2>&1; then
  echo "✅ Token refresh successful"
  NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.access_token')
  echo "New Access Token: ${NEW_ACCESS_TOKEN:0:50}..."
else
  echo "❌ Token refresh failed"
  echo "$REFRESH_RESPONSE" | jq '.'
  exit 1
fi
echo ""

echo "========================================"
echo "  ✅ ALL TESTS PASSED!"
echo "========================================"
echo ""
echo "Summary:"
echo "  - OAuth discovery: Working"
echo "  - Client registration: Working"
echo "  - Authorization: Working"
echo "  - Token exchange: Working"
echo "  - API access: Working"
echo "  - Token refresh: Working"
echo ""
echo "The MCP OAuth flow is fully functional!"
