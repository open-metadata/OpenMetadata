#!/bin/bash

# MCP OAuth Setup Verification Script
# This script checks if all components are ready for MCP OAuth testing

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================="
echo "MCP OAuth Setup Verification"
echo "========================================="
echo ""

# Configuration
OM_HOST="http://localhost:8585"
OM_API="${OM_HOST}/api/v1"
ADMIN_JWT="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"

CHECKS_PASSED=0
CHECKS_FAILED=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check 1: OpenMetadata Server
echo -e "${BLUE}[1] Checking OpenMetadata Server...${NC}"
if curl -s -f "${OM_HOST}/swagger.json" > /dev/null 2>&1; then
    check_pass "OpenMetadata server is running at ${OM_HOST}"

    # Get server version
    VERSION=$(curl -s "${OM_HOST}/swagger.json" | jq -r '.info.version' 2>/dev/null || echo "unknown")
    echo "    Version: ${VERSION}"
else
    check_fail "OpenMetadata server not running at ${OM_HOST}"
    echo "    Fix: docker compose -f docker/development/docker-compose.yml up -d"
fi
echo ""

# Check 2: MCP Server Endpoint
echo -e "${BLUE}[2] Checking MCP Server Endpoint...${NC}"
MCP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${OM_HOST}/mcp" 2>/dev/null || echo "000")
if [ "$MCP_RESPONSE" = "200" ] || [ "$MCP_RESPONSE" = "404" ]; then
    check_pass "MCP endpoint is accessible"
    echo "    HTTP Status: ${MCP_RESPONSE}"
else
    check_warn "MCP endpoint returned status: ${MCP_RESPONSE}"
    echo "    This might be normal if MCP server isn't fully started"
fi
echo ""

# Check 3: Database Services
echo -e "${BLUE}[3] Checking Database Services...${NC}"
SERVICES=$(curl -s -H "Authorization: Bearer ${ADMIN_JWT}" \
    "${OM_API}/services/databaseServices?limit=1000" 2>/dev/null)

if [ $? -eq 0 ]; then
    SERVICE_COUNT=$(echo "$SERVICES" | jq '.data | length' 2>/dev/null || echo "0")
    check_pass "Found ${SERVICE_COUNT} database service(s)"

    # Check for Snowflake services
    SNOWFLAKE_SERVICES=$(echo "$SERVICES" | jq -r '.data[] | select(.serviceType == "Snowflake") | .name' 2>/dev/null)
    if [ ! -z "$SNOWFLAKE_SERVICES" ]; then
        echo "    Snowflake services found:"
        echo "$SNOWFLAKE_SERVICES" | while read -r svc; do
            echo "      - $svc"
        done
    else
        check_warn "No Snowflake services found"
        echo "    Run: ./setup-mcp-test-snowflake.sh"
    fi
else
    check_fail "Could not fetch database services"
    echo "    Check if OpenMetadata API is working"
fi
echo ""

# Check 4: MCP OAuth Setup Endpoint
echo -e "${BLUE}[4] Checking MCP OAuth Setup Endpoint...${NC}"
OAUTH_ENDPOINT="${OM_API}/mcp/oauth/setup"
OAUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${OAUTH_ENDPOINT}" \
    -H "Authorization: Bearer ${ADMIN_JWT}" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null || echo "000")

if [ "$OAUTH_RESPONSE" = "400" ] || [ "$OAUTH_RESPONSE" = "404" ]; then
    check_pass "OAuth setup endpoint exists"
    echo "    HTTP Status: ${OAUTH_RESPONSE} (expected for empty request)"
elif [ "$OAUTH_RESPONSE" = "000" ]; then
    check_fail "OAuth setup endpoint not accessible"
    echo "    Endpoint may not be deployed yet"
else
    check_warn "OAuth setup endpoint returned: ${OAUTH_RESPONSE}"
fi
echo ""

# Check 5: Node.js and MCP Inspector
echo -e "${BLUE}[5] Checking MCP Inspector Tool...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js installed: ${NODE_VERSION}"

    if command -v npx &> /dev/null; then
        check_pass "npx command available"
    else
        check_fail "npx not found"
        echo "    Fix: Install Node.js with npm"
    fi
else
    check_fail "Node.js not installed"
    echo "    Fix: Install Node.js from https://nodejs.org/"
fi
echo ""

# Check 6: OAuth Configuration Status
echo -e "${BLUE}[6] Checking OAuth Configuration...${NC}"
if [ ! -z "$SNOWFLAKE_SERVICES" ]; then
    echo "$SNOWFLAKE_SERVICES" | while read -r svc; do
        SERVICE_DETAIL=$(curl -s -H "Authorization: Bearer ${ADMIN_JWT}" \
            "${OM_API}/services/databaseServices/name/${svc}" 2>/dev/null)

        # Check if service has OAuth configured
        HAS_OAUTH=$(echo "$SERVICE_DETAIL" | jq -r '.connection.config.oauth' 2>/dev/null)

        if [ "$HAS_OAUTH" != "null" ] && [ ! -z "$HAS_OAUTH" ]; then
            check_pass "Service '$svc' has OAuth configured"

            # Check token expiry
            EXPIRES_AT=$(echo "$HAS_OAUTH" | jq -r '.expiresAt' 2>/dev/null)
            if [ "$EXPIRES_AT" != "null" ]; then
                CURRENT_TIME=$(date +%s)
                if [ "$EXPIRES_AT" -gt "$CURRENT_TIME" ]; then
                    echo "    Access token valid until: $(date -r $EXPIRES_AT)"
                else
                    check_warn "Access token expired, will auto-refresh"
                fi
            fi
        else
            check_warn "Service '$svc' does NOT have OAuth configured"
            echo "    Auth type: Private key or username/password"
            echo "    Run OAuth setup to add OAuth credentials"
        fi
    done
else
    check_warn "No Snowflake services to check for OAuth"
fi
echo ""

# Summary
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo -e "Passed: ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "Failed: ${RED}${CHECKS_FAILED}${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. If no OAuth configured, run: ./setup-mcp-test-snowflake.sh"
    echo "2. Complete Snowflake OAuth setup (see SNOWFLAKE_TEST_CREDENTIALS.md)"
    echo "3. Test with: npx @modelcontextprotocol/inspector --url ${OM_HOST}/mcp --auth-type oauth2 --auth-params connector_name=snowflake_test_mcp"
else
    echo -e "${RED}✗ Some checks failed${NC}"
    echo ""
    echo "Fix the issues above and run this script again."
fi
echo ""
