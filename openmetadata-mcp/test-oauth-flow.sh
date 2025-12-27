#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:8585"
CLIENT_ID="example-client"
CLIENT_SECRET="example-secret"
REDIRECT_URI="http://localhost:8585/callback"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
test_result() {
  local test_name=$1
  local status_code=$2
  local expected_code=$3

  if [ "$status_code" -eq "$expected_code" ]; then
    echo -e "${GREEN}✓${NC} $test_name (HTTP $status_code)"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $test_name (Expected HTTP $expected_code, got $status_code)"
    ((TESTS_FAILED++))
  fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}OpenMetadata MCP OAuth 2.1 Flow Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: Check if server is running
echo -e "${YELLOW}[1] Testing Server Availability${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/mcp")
test_result "Server is running" "$HTTP_CODE" "401"
echo ""

# Test 2: OAuth Discovery - Protected Resource Metadata
echo -e "${YELLOW}[2] Testing Protected Resource Metadata${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/mcp/.well-known/oauth-protected-resource")
test_result "Protected Resource metadata (direct)" "$HTTP_CODE" "200"

if [ "$HTTP_CODE" -eq "200" ]; then
  METADATA=$(curl -s "$BASE_URL/mcp/.well-known/oauth-protected-resource")
  echo "Response:"
  echo "$METADATA" | python3 -m json.tool 2>/dev/null || echo "$METADATA"
fi
echo ""

# Test 3: OAuth Discovery - Authorization Server Metadata (Multiple paths per RFC 8414)
echo -e "${YELLOW}[3] Testing Authorization Server Metadata Discovery${NC}"

# Path 1: Issuer-based (direct)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/mcp/.well-known/oauth-authorization-server")
test_result "Auth Server metadata (direct /mcp prefix)" "$HTTP_CODE" "200"

# Path 2: Path-based discovery
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/.well-known/oauth-authorization-server/mcp")
test_result "Auth Server metadata (path-based with /mcp)" "$HTTP_CODE" "200"

# Path 3: Root fallback
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/.well-known/oauth-authorization-server")
test_result "Auth Server metadata (root fallback)" "$HTTP_CODE" "200"

# Path 4: OpenID Connect fallback
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/.well-known/openid-configuration/mcp")
test_result "OIDC discovery (with /mcp)" "$HTTP_CODE" "200"

if [ "$HTTP_CODE" -eq "200" ]; then
  echo ""
  echo "Authorization Server Metadata:"
  METADATA=$(curl -s "$BASE_URL/.well-known/oauth-authorization-server/mcp")
  echo "$METADATA" | python3 -m json.tool 2>/dev/null || echo "$METADATA"
fi
echo ""

# Test 4: Complete OAuth Flow
echo -e "${YELLOW}[4] Testing Complete OAuth 2.1 Flow with PKCE${NC}"

# Step 1: Get authorization code
echo "Step 1: Requesting authorization code..."
CODE_VERIFIER="dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
CODE_CHALLENGE="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

AUTH_RESPONSE=$(curl -s -i "$BASE_URL/mcp/authorize?client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&response_type=code&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&scope=read+write&state=test123")

if echo "$AUTH_RESPONSE" | grep -q "HTTP/1.1 302"; then
  echo "$AUTH_RESPONSE"
  CODE=$(echo "$AUTH_RESPONSE" | grep "Location:" | sed 's/.*code=\([^&]*\).*/\1/' | tr -d '\r')
  echo -e "${GREEN}✓${NC} Got authorization code: ${CODE:0:20}..."
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} Failed to get authorization code"
  ((TESTS_FAILED++))
  echo "$AUTH_RESPONSE" | head -20
  exit 1
fi
echo ""

# Step 2: Exchange code for token
echo "Step 2: Exchanging code for access token..."
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=$CODE&redirect_uri=$REDIRECT_URI&code_verifier=$CODE_VERIFIER&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)
REFRESH_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('refresh_token', ''))" 2>/dev/null)

if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "None" ]; then
  echo -e "${GREEN}✓${NC} Got access token: ${ACCESS_TOKEN:0:20}..."
  echo -e "${GREEN}✓${NC} Got refresh token: ${REFRESH_TOKEN:0:20}..."
  ((TESTS_PASSED+=2))
  echo ""
  echo "Token Response:"
  echo "$TOKEN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TOKEN_RESPONSE"
else
  echo -e "${RED}✗${NC} Failed to get access token"
  ((TESTS_FAILED++))
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi
echo ""

# Test 5: Use access token to call MCP endpoint
echo -e "${YELLOW}[5] Testing MCP Endpoint with Bearer Token${NC}"

MCP_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}')

HTTP_CODE=$(echo "$MCP_RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
MCP_BODY=$(echo "$MCP_RESPONSE" | sed '/HTTP_CODE:/d')

test_result "MCP endpoint with valid token" "$HTTP_CODE" "200"

if [ "$HTTP_CODE" -eq "200" ]; then
  echo "MCP Initialize Response:"
  echo "$MCP_BODY" | python3 -m json.tool 2>/dev/null | head -30
fi
echo ""

# Test 6: Test invalid token
echo -e "${YELLOW}[6] Testing Invalid Token Handling${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Authorization: Bearer invalid-token-xyz" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}')

test_result "Reject invalid token" "$HTTP_CODE" "401"
echo ""

# Test 7: Test missing token
echo -e "${YELLOW}[7] Testing Missing Token Handling${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}')

test_result "Reject missing token" "$HTTP_CODE" "401"
echo ""

# Test 8: Test token refresh
echo -e "${YELLOW}[8] Testing Token Refresh${NC}"
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=$REFRESH_TOKEN&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET")

NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ -n "$NEW_ACCESS_TOKEN" ] && [ "$NEW_ACCESS_TOKEN" != "None" ]; then
  echo -e "${GREEN}✓${NC} Token refresh successful"
  echo -e "    New access token: ${NEW_ACCESS_TOKEN:0:20}..."
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} Token refresh failed"
  ((TESTS_FAILED++))
  echo "Response: $REFRESH_RESPONSE"
fi
echo ""

# Test 9: Test WWW-Authenticate header
echo -e "${YELLOW}[9] Testing WWW-Authenticate Challenge Header${NC}"
CHALLENGE_RESPONSE=$(curl -s -i -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream")

if echo "$CHALLENGE_RESPONSE" | grep -q "WWW-Authenticate: Bearer"; then
  echo -e "${GREEN}✓${NC} WWW-Authenticate header present"
  ((TESTS_PASSED++))
  echo "Header:"
  echo "$CHALLENGE_RESPONSE" | grep "WWW-Authenticate:"
else
  echo -e "${RED}✗${NC} WWW-Authenticate header missing"
  ((TESTS_FAILED++))
fi
echo ""

# Test 10: Test OAuth endpoints forwarding (root level)
echo -e "${YELLOW}[10] Testing OAuth Endpoint Forwarding${NC}"

# Test /register forwarding
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{"client_name":"test","redirect_uris":["http://localhost:3000/callback"]}')
test_result "/register endpoint forwarding" "$HTTP_CODE" "201"

# Test /authorize forwarding
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/authorize?client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&response_type=code&code_challenge=test&code_challenge_method=S256&scope=read")
test_result "/authorize endpoint forwarding" "$HTTP_CODE" "302"

# Test /token forwarding
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/token" \
  -d "grant_type=authorization_code&code=dummy&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET")
# Will fail with 400 (invalid code) but proves endpoint is accessible
if [ "$HTTP_CODE" -eq "400" ] || [ "$HTTP_CODE" -eq "200" ]; then
  echo -e "${GREEN}✓${NC} /token endpoint forwarding (HTTP $HTTP_CODE)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC} /token endpoint forwarding (Expected HTTP 400/200, got $HTTP_CODE)"
  ((TESTS_FAILED++))
fi

echo ""

# Final Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed! OAuth implementation is working correctly.${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Please check the output above.${NC}"
  exit 1
fi
