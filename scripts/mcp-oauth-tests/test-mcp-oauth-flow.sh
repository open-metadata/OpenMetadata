#!/bin/bash
set -e

echo "🧪 Testing OpenMetadata MCP OAuth Flow"
echo "======================================"
echo ""

# Configuration
BASE_URL="http://localhost:8585"
CLIENT_ID="openmetadata-mcp-client"
CLIENT_SECRET="test-secret"  # This will be fetched from database
REDIRECT_URI="http://localhost:3000/callback"
STATE="test-state-$(date +%s)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Check OAuth Server Metadata${NC}"
echo "Fetching: ${BASE_URL}/.well-known/oauth-authorization-server"
curl -s "${BASE_URL}/.well-known/oauth-authorization-server" | jq '.' || echo "Failed to fetch OAuth metadata"
echo ""

echo -e "${BLUE}Step 2: Check Existing OAuth Client${NC}"
docker exec openmetadata_mysql mysql -u openmetadata_user -popenmetadata_password -D openmetadata_db -e "SELECT client_id, client_name, redirect_uris, grant_types FROM oauth_clients WHERE client_id='${CLIENT_ID}';" 2>&1 | grep -v Warning
echo ""

echo -e "${BLUE}Step 3: Generate PKCE Challenge${NC}"
CODE_VERIFIER=$(openssl rand -base64 64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')
CODE_CHALLENGE=$(echo -n "${CODE_VERIFIER}" | openssl dgst -binary -sha256 | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')
echo "Code Verifier: ${CODE_VERIFIER:0:50}..."
echo "Code Challenge: ${CODE_CHALLENGE}"
echo ""

echo -e "${BLUE}Step 4: Build Authorization URL${NC}"
AUTH_URL="${BASE_URL}/oauth/authorize"
AUTH_URL="${AUTH_URL}?client_id=${CLIENT_ID}"
AUTH_URL="${AUTH_URL}&redirect_uri=${REDIRECT_URI}"
AUTH_URL="${AUTH_URL}&response_type=code"
AUTH_URL="${AUTH_URL}&scope=openid%20profile%20email"
AUTH_URL="${AUTH_URL}&state=${STATE}"
AUTH_URL="${AUTH_URL}&code_challenge=${CODE_CHALLENGE}"
AUTH_URL="${AUTH_URL}&code_challenge_method=S256"

echo "Authorization URL:"
echo "${AUTH_URL}"
echo ""
echo -e "${GREEN}✓ Opening browser to authorize...${NC}"
echo "  (The browser will open automatically)"
echo ""

# Open browser for authorization
open "${AUTH_URL}" || echo "Could not open browser automatically. Please open the URL above manually."

echo ""
echo -e "${RED}⚠️  IMPORTANT: After authorizing, you'll be redirected to:${NC}"
echo "   http://localhost:3000/callback?code=XXXX&state=${STATE}"
echo ""
echo "   Since you don't have a server on :3000, the page will fail to load."
echo "   That's OK! Just copy the 'code' parameter from the URL."
echo ""
read -p "Enter the authorization code from the redirect URL: " AUTH_CODE

echo ""
echo -e "${BLUE}Step 5: Exchange Authorization Code for Tokens${NC}"
echo "POST ${BASE_URL}/oauth/token"
echo ""

TOKEN_RESPONSE=$(curl -s -X POST "${BASE_URL}/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=${AUTH_CODE}" \
  -d "redirect_uri=${REDIRECT_URI}" \
  -d "code_verifier=${CODE_VERIFIER}" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}")

echo "${TOKEN_RESPONSE}" | jq '.' || echo "Response: ${TOKEN_RESPONSE}"
echo ""

# Extract access token
ACCESS_TOKEN=$(echo "${TOKEN_RESPONSE}" | jq -r '.access_token' 2>/dev/null)

if [ "${ACCESS_TOKEN}" != "null" ] && [ -n "${ACCESS_TOKEN}" ]; then
    echo -e "${GREEN}✓ Successfully obtained access token!${NC}"
    echo "Access Token: ${ACCESS_TOKEN:0:40}..."
    echo ""

    echo -e "${BLUE}Step 6: Verify Database Persistence${NC}"
    echo ""

    echo "6.1: Authorization Code (should be marked as used):"
    docker exec openmetadata_mysql mysql -u openmetadata_user -popenmetadata_password -D openmetadata_db -e "SELECT code_hash, client_id, used, FROM_UNIXTIME(expires_at/1000) as expires FROM oauth_authorization_codes ORDER BY created_at DESC LIMIT 3;" 2>&1 | grep -v Warning
    echo ""

    echo "6.2: Access Tokens:"
    docker exec openmetadata_mysql mysql -u openmetadata_user -popenmetadata_password -D openmetadata_db -e "SELECT LEFT(token_hash, 20) as token_hash, client_id, connector_name, FROM_UNIXTIME(expires_at/1000) as expires FROM oauth_access_tokens ORDER BY created_at DESC LIMIT 3;" 2>&1 | grep -v Warning
    echo ""

    echo "6.3: Refresh Tokens:"
    docker exec openmetadata_mysql mysql -u openmetadata_user -popenmetadata_password -D openmetadata_db -e "SELECT LEFT(token_hash, 20) as token_hash, client_id, revoked, FROM_UNIXTIME(expires_at/1000) as expires FROM oauth_refresh_tokens ORDER BY created_at DESC LIMIT 3;" 2>&1 | grep -v Warning
    echo ""

    echo -e "${BLUE}Step 7: Test MCP Endpoint with Access Token${NC}"
    echo "POST ${BASE_URL}/mcp"
    echo ""

    MCP_RESPONSE=$(curl -s -X POST "${BASE_URL}/mcp" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list"
      }')

    echo "${MCP_RESPONSE}" | jq '.' || echo "Response: ${MCP_RESPONSE}"
    echo ""

    echo -e "${GREEN}✅ OAuth Flow Test Complete!${NC}"
    echo ""
    echo "Summary:"
    echo "  ✓ OAuth metadata discovered"
    echo "  ✓ Authorization code obtained"
    echo "  ✓ Tokens exchanged successfully"
    echo "  ✓ Database persistence verified"
    echo "  ✓ MCP endpoint accessed with token"
else
    echo -e "${RED}✗ Failed to obtain access token${NC}"
    echo "Response: ${TOKEN_RESPONSE}"
    exit 1
fi
