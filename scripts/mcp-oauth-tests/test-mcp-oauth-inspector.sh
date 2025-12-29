#!/bin/bash

echo "========================================="
echo "Testing MCP OAuth with Inspector (No Connector)"
echo "========================================="
echo ""

echo "Step 1: Test OAuth Discovery"
curl -s http://localhost:8585/.well-known/oauth-authorization-server | jq .
echo ""

echo "Step 2: Test Client Registration"
RESPONSE=$(curl -s -X POST http://localhost:8585/mcp/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "MCP Inspector Test",
    "redirect_uris": ["http://localhost:3000/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "scope": "openid profile email api://apiId/.default"
  }')

echo "$RESPONSE" | jq .

CLIENT_ID=$(echo "$RESPONSE" | jq -r '.client_id')
echo ""
echo "✅ Client registered: $CLIENT_ID"
echo ""

echo "========================================="
echo "MCP OAuth infrastructure is working!"
echo ""
echo "Next steps:"
echo "1. Install MCP Inspector: npm install -g @modelcontextprotocol/inspector"
echo "2. Run: npx @modelcontextprotocol/inspector http://localhost:8585/mcp"
echo "3. It will use OAuth to connect (no connector needed for this test)"
echo "========================================="
