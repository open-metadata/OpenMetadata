#!/bin/bash

# Use the authorization code from the Python error
AUTH_CODE="b0a1f975-9db4-4674-8224-87e6f80145d2"

# Generate the code_verifier that matches
CODE_VERIFIER="lBHdXkhXDK1iAJrGHpzLOCVvVgpT-t4JF4K28sPRqzU"

echo "Testing Token Exchange"
echo "======================"
echo "Auth Code: $AUTH_CODE"
echo ""

curl -s -X POST "http://localhost:8585/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=$AUTH_CODE&redirect_uri=http://localhost:3000/callback&client_id=openmetadata-mcp-client&code_verifier=$CODE_VERIFIER" | jq .
