#!/bin/bash
#
# Setup Test Snowflake Service with OAuth for MCP Testing
#
# This script creates a test Snowflake database service with mock OAuth credentials
# to enable testing of the MCP OAuth flow end-to-end.
#

set -e

echo "========================================"
echo "  Setup Test Snowflake Service"
echo "  for MCP OAuth Testing"
echo "========================================"
echo ""

# Configuration
BASE_URL="http://localhost:8585"
SERVICE_NAME="snowflake-mcp-test"
ADMIN_TOKEN="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"

# Mock OAuth credentials (will expire immediately, but good enough for flow testing)
MOCK_ACCESS_TOKEN="mock_access_token_for_testing_$(date +%s)"
MOCK_REFRESH_TOKEN="mock_refresh_token_for_testing_$(date +%s)"
MOCK_CLIENT_ID="mock_snowflake_client_id"
MOCK_CLIENT_SECRET="mock_snowflake_client_secret"
CURRENT_TIMESTAMP=$(date +%s)
EXPIRY_TIMESTAMP=$((CURRENT_TIMESTAMP + 3600))  # 1 hour from now

echo "=== Step 1: Check if service already exists ==="
EXISTING_SERVICE=$(curl -s "$BASE_URL/api/v1/services/databaseServices/name/$SERVICE_NAME" \
  -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null || echo '{}')

if echo "$EXISTING_SERVICE" | jq -e '.id' > /dev/null 2>&1; then
  echo "⚠️  Service '$SERVICE_NAME' already exists"
  echo "Deleting existing service..."
  SERVICE_ID=$(echo "$EXISTING_SERVICE" | jq -r '.id')
  curl -s -X DELETE "$BASE_URL/api/v1/services/databaseServices/$SERVICE_ID?hardDelete=true&recursive=true" \
    -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
  echo "✅ Deleted existing service"
  sleep 2
else
  echo "✅ Service does not exist, proceeding with creation"
fi
echo ""

echo "=== Step 2: Create Snowflake Database Service ==="

# Create service payload with OAuth credentials embedded
SERVICE_PAYLOAD=$(cat <<EOF
{
  "name": "$SERVICE_NAME",
  "displayName": "Snowflake MCP Test Service",
  "description": "Test Snowflake service with mock OAuth credentials for MCP OAuth flow testing",
  "serviceType": "Snowflake",
  "connection": {
    "config": {
      "type": "Snowflake",
      "account": "test-account.us-east-1.aws",
      "warehouse": "TEST_WAREHOUSE",
      "role": "TEST_ROLE",
      "database": "TEST_DB",
      "username": "test_user",
      "oauth": {
        "clientId": "$MOCK_CLIENT_ID",
        "clientSecret": "$MOCK_CLIENT_SECRET",
        "accessToken": "$MOCK_ACCESS_TOKEN",
        "refreshToken": "$MOCK_REFRESH_TOKEN",
        "expiresAt": $EXPIRY_TIMESTAMP,
        "tokenEndpoint": "https://test-account.us-east-1.aws.snowflakecomputing.com/oauth/token-request",
        "scopes": ["session:role:TEST_ROLE"]
      }
    }
  }
}
EOF
)

echo "Creating service with OAuth credentials..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/services/databaseServices" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SERVICE_PAYLOAD")

if echo "$CREATE_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  echo "✅ Service created successfully"
  SERVICE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')
  echo "Service ID: $SERVICE_ID"
  echo "Service Name: $SERVICE_NAME"
else
  echo "❌ Failed to create service"
  echo "$CREATE_RESPONSE" | jq '.'
  exit 1
fi
echo ""

echo "=== Step 3: Verify Service Creation ==="
VERIFY_RESPONSE=$(curl -s "$BASE_URL/api/v1/services/databaseServices/name/$SERVICE_NAME" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$VERIFY_RESPONSE" | jq -e '.connection.config.oauth.accessToken' > /dev/null 2>&1; then
  echo "✅ OAuth credentials verified in service configuration"
  echo "Access Token: $(echo "$VERIFY_RESPONSE" | jq -r '.connection.config.oauth.accessToken' | cut -c1-30)..."
  echo "Refresh Token: $(echo "$VERIFY_RESPONSE" | jq -r '.connection.config.oauth.refreshToken' | cut -c1-30)..."
  echo "Expires At: $(date -r "$EXPIRY_TIMESTAMP" 2>/dev/null || date -d "@$EXPIRY_TIMESTAMP" 2>/dev/null)"
else
  echo "⚠️  OAuth credentials may not be visible (could be encrypted)"
  echo "This is normal if SecretsManager is encrypting the credentials"
fi
echo ""

echo "========================================"
echo "  ✅ Setup Complete!"
echo "========================================"
echo ""
echo "Test Snowflake Service Details:"
echo "  Name: $SERVICE_NAME"
echo "  Type: Snowflake"
echo "  OAuth: Configured with mock credentials"
echo ""
echo "Next Steps:"
echo "  1. Run the OAuth flow test:"
echo "     ./test-mcp-oauth-complete.sh $SERVICE_NAME"
echo ""
echo "  2. Or test with MCP Inspector:"
echo "     - Transport: Streamable HTTP"
echo "     - URL: http://localhost:8585/mcp"
echo "     - The OAuth flow will use connector name: $SERVICE_NAME"
echo ""
echo "Note: Mock credentials will work for OAuth flow testing"
echo "but won't actually connect to Snowflake. For real testing,"
echo "replace with actual OAuth credentials via the UI or API."
