#!/bin/bash
set -e

echo "========================================="
echo "MCP OAuth Test Setup for Snowflake"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration from existing Collate Snowflake connection
SNOWFLAKE_ACCOUNT="FMFAHQK-GI58232"
SNOWFLAKE_USERNAME="svc_caip_benchmarking"
SNOWFLAKE_WAREHOUSE="COMPUTE_WH"
SNOWFLAKE_DATABASE="CUSTOMERS"
CONNECTOR_NAME="snowflake_test_mcp"

# OpenMetadata configuration
OM_HOST="http://localhost:8585"
OM_API="${OM_HOST}/api/v1"

# Admin JWT token (from test config)
ADMIN_JWT="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"

echo ""
echo -e "${YELLOW}NOTE: This script creates a Snowflake service in OpenMetadata${NC}"
echo -e "${YELLOW}Currently using PRIVATE KEY auth (not OAuth yet)${NC}"
echo ""
echo "For full MCP OAuth testing, you'll need to:"
echo "  1. Complete Snowflake OAuth setup (see instructions below)"
echo "  2. Run the OAuth setup endpoint with authorization code"
echo ""

# Step 1: Check if OpenMetadata is running
echo -e "${GREEN}[1/4] Checking OpenMetadata server...${NC}"
if ! curl -s -f "${OM_HOST}/swagger.json" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: OpenMetadata server not running at ${OM_HOST}${NC}"
    echo "Please start OpenMetadata first:"
    echo "  cd /Users/vishnujain/IdeaProjects/openmetadata-collate/OpenMetadata"
    echo "  docker compose -f docker/development/docker-compose.yml up -d"
    exit 1
fi
echo -e "${GREEN}✓ OpenMetadata server is running${NC}"

# Step 2: Check if connector already exists
echo -e "${GREEN}[2/4] Checking if connector already exists...${NC}"
EXISTING_SERVICE=$(curl -s -H "Authorization: Bearer ${ADMIN_JWT}" \
    "${OM_API}/services/databaseServices/name/${CONNECTOR_NAME}" 2>/dev/null || echo "")

if [ ! -z "$EXISTING_SERVICE" ]; then
    echo -e "${YELLOW}⚠ Connector '${CONNECTOR_NAME}' already exists${NC}"
    read -p "Delete and recreate? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        SERVICE_ID=$(echo "$EXISTING_SERVICE" | jq -r '.id')
        curl -s -X DELETE \
            -H "Authorization: Bearer ${ADMIN_JWT}" \
            "${OM_API}/services/databaseServices/${SERVICE_ID}?hardDelete=true&recursive=true" \
            > /dev/null 2>&1
        echo -e "${GREEN}✓ Deleted existing connector${NC}"
    else
        echo "Keeping existing connector. Skipping creation."
        echo ""
        echo -e "${GREEN}Ready to test! Run:${NC}"
        echo "  npx @modelcontextprotocol/inspector --url ${OM_HOST}/mcp --auth-type oauth2 --auth-params connector_name=${CONNECTOR_NAME}"
        exit 0
    fi
fi

# Step 3: Create Snowflake database service
echo -e "${GREEN}[3/4] Creating Snowflake database service...${NC}"

# Note: We're creating with privateKey auth type initially
# OAuth will be added via the /mcp/oauth/setup endpoint after Snowflake OAuth config
cat > /tmp/snowflake_service.json <<EOF
{
  "name": "${CONNECTOR_NAME}",
  "displayName": "Snowflake Test (MCP OAuth)",
  "description": "Test Snowflake connector for MCP OAuth testing using Collate Analytics credentials",
  "serviceType": "Snowflake",
  "connection": {
    "config": {
      "type": "Snowflake",
      "account": "${SNOWFLAKE_ACCOUNT}",
      "warehouse": "${SNOWFLAKE_WAREHOUSE}",
      "database": "${SNOWFLAKE_DATABASE}",
      "username": "${SNOWFLAKE_USERNAME}",
      "privateKey": "\${SNOWFLAKE_PRIVATE_KEY}"
    }
  }
}
EOF

RESPONSE=$(curl -s -X POST "${OM_API}/services/databaseServices" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_JWT}" \
    -d @/tmp/snowflake_service.json)

if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    SERVICE_ID=$(echo "$RESPONSE" | jq -r '.id')
    echo -e "${GREEN}✓ Created Snowflake service: ${SERVICE_ID}${NC}"
else
    echo -e "${RED}ERROR: Failed to create service${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

rm /tmp/snowflake_service.json

# Step 4: Provide OAuth setup instructions
echo -e "${GREEN}[4/4] OAuth Setup Instructions${NC}"
echo ""
echo "========================================="
echo "NEXT STEPS: Set up OAuth for MCP"
echo "========================================="
echo ""
echo -e "${YELLOW}Option 1: Use Existing Private Key Auth (Quick Test)${NC}"
echo ""
echo "You can test MCP connection now with private key auth:"
echo ""
echo -e "${GREEN}  npx @modelcontextprotocol/inspector \\"
echo "    --url ${OM_HOST}/mcp \\"
echo "    --auth-type oauth2 \\"
echo "    --auth-params connector_name=${CONNECTOR_NAME}${NC}"
echo ""
echo "However, this will fail OAuth flow since private key != OAuth."
echo ""
echo "========================================="
echo ""
echo -e "${YELLOW}Option 2: Add OAuth to Snowflake (Full MCP OAuth Test)${NC}"
echo ""
echo "1. Create OAuth integration in Snowflake:"
echo ""
echo "   -- Connect to Snowflake as ACCOUNTADMIN"
echo "   USE ROLE ACCOUNTADMIN;"
echo ""
echo "   CREATE SECURITY INTEGRATION openmetadata_mcp_oauth"
echo "     TYPE = OAUTH"
echo "     ENABLED = TRUE"
echo "     OAUTH_CLIENT = CUSTOM"
echo "     OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'"
echo "     OAUTH_REDIRECT_URI = 'http://localhost:3000/oauth/callback'"
echo "     OAUTH_ISSUE_REFRESH_TOKENS = TRUE"
echo "     OAUTH_REFRESH_TOKEN_VALIDITY = 7776000; -- 90 days"
echo ""
echo "   -- Get OAuth credentials"
echo "   SELECT SYSTEM\$SHOW_OAUTH_CLIENT_SECRETS('OPENMETADATA_MCP_OAUTH');"
echo ""
echo "2. Complete OAuth flow in browser:"
echo ""
echo "   https://${SNOWFLAKE_ACCOUNT}.snowflakecomputing.com/oauth/authorize?client_id=<CLIENT_ID>&response_type=code&redirect_uri=http://localhost:3000/oauth/callback&scope=session:role:ACCOUNTADMIN"
echo ""
echo "3. Copy authorization code from redirect URL"
echo ""
echo "4. Call OAuth setup endpoint:"
echo ""
echo "   curl -X POST ${OM_API}/mcp/oauth/setup \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'Authorization: Bearer ${ADMIN_JWT}' \\"
echo "     -d '{"
echo "       \"connectorName\": \"${CONNECTOR_NAME}\","
echo "       \"authorizationCode\": \"<CODE_FROM_STEP_3>\","
echo "       \"redirectUri\": \"http://localhost:3000/oauth/callback\","
echo "       \"clientId\": \"<FROM_STEP_1>\","
echo "       \"clientSecret\": \"<FROM_STEP_1>\","
echo "       \"tokenEndpoint\": \"https://${SNOWFLAKE_ACCOUNT}.snowflakecomputing.com/oauth/token-request\""
echo "     }'"
echo ""
echo "5. Test MCP connection with OAuth:"
echo ""
echo -e "${GREEN}   npx @modelcontextprotocol/inspector \\"
echo "     --url ${OM_HOST}/mcp \\"
echo "     --auth-type oauth2 \\"
echo "     --auth-params connector_name=${CONNECTOR_NAME}${NC}"
echo ""
echo "========================================="
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "For detailed instructions, see:"
echo "  ${PWD}/OAUTH_MCP_TESTING_GUIDE.md"
echo ""
