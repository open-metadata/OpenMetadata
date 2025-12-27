#!/bin/bash
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Script to automatically configure Keycloak with OpenMetadata SAML realm and test users
# Run this after starting docker-compose-keycloak-saml.yml

set -e

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin123}"
REALM_NAME="openmetadata"
CLIENT_ID="http://localhost:8585"

echo "🔧 Configuring Keycloak for OpenMetadata SAML SSO..."
echo "Keycloak URL: $KEYCLOAK_URL"

# Wait for Keycloak to be ready
echo "⏳ Waiting for Keycloak to be ready..."
timeout 120 bash -c "until curl -f $KEYCLOAK_URL/health/ready > /dev/null 2>&1; do sleep 2; done" || {
  echo "❌ Keycloak did not become ready in time"
  exit 1
}
echo "✅ Keycloak is ready"

# Get admin access token
echo "🔑 Getting admin access token..."
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASSWORD" \
  -d 'grant_type=password' \
  -d 'client_id=admin-cli' | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Failed to get admin token"
  exit 1
fi
echo "✅ Got admin token"

# Create OpenMetadata realm
echo "🏛️  Creating OpenMetadata realm..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "realm": "'"$REALM_NAME"'",
    "enabled": true,
    "displayName": "OpenMetadata SAML Realm",
    "sslRequired": "none",
    "registrationAllowed": false,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "resetPasswordAllowed": true,
    "editUsernameAllowed": false,
    "bruteForceProtected": false
  }' && echo "✅ Realm created" || echo "⚠️  Realm may already exist"

# Create SAML client
echo "📱 Creating SAML client..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "clientId": "'"$CLIENT_ID"'",
    "name": "OpenMetadata SAML Client",
    "enabled": true,
    "protocol": "saml",
    "frontchannelLogout": true,
    "attributes": {
      "saml.authnstatement": "true",
      "saml.server.signature": "true",
      "saml_assertion_consumer_url_post": "http://localhost:8585/callback",
      "saml_single_logout_service_url_post": "http://localhost:8585/logout",
      "saml.assertion.signature": "true",
      "saml.client.signature": "false",
      "saml_name_id_format": "email",
      "saml_force_name_id_format": "true",
      "saml.signature.algorithm": "RSA_SHA256"
    },
    "redirectUris": ["http://localhost:8585/*"],
    "baseUrl": "http://localhost:8585",
    "adminUrl": "http://localhost:8585",
    "fullScopeAllowed": true
  }' && echo "✅ SAML client created" || echo "⚠️  Client may already exist"

# Create test users
echo "👤 Creating test users..."

# User 1: testuser
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "testuser",
    "email": "testuser@openmetadata.org",
    "firstName": "Test",
    "lastName": "User",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "Test@123",
      "temporary": false
    }]
  }' && echo "✅ Created testuser" || echo "⚠️  testuser may already exist"

# User 2: adminuser
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "adminuser",
    "email": "admin@openmetadata.org",
    "firstName": "Admin",
    "lastName": "User",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "Admin@123",
      "temporary": false
    }]
  }' && echo "✅ Created adminuser" || echo "⚠️  adminuser may already exist"

# User 3: datasteward
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "datasteward",
    "email": "steward@openmetadata.org",
    "firstName": "Data",
    "lastName": "Steward",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "Steward@123",
      "temporary": false
    }]
  }' && echo "✅ Created datasteward" || echo "⚠️  datasteward may already exist"

echo ""
echo "🎉 Keycloak configuration complete!"
echo ""
echo "📋 Summary:"
echo "  Realm: $REALM_NAME"
echo "  Client ID: $CLIENT_ID"
echo "  SAML Metadata: $KEYCLOAK_URL/realms/$REALM_NAME/protocol/saml/descriptor"
echo ""
echo "👥 Test Users:"
echo "  1. testuser / Test@123 (testuser@openmetadata.org)"
echo "  2. adminuser / Admin@123 (admin@openmetadata.org)"
echo "  3. datasteward / Steward@123 (steward@openmetadata.org)"
echo ""
echo "🌐 Keycloak Admin Console: $KEYCLOAK_URL/admin"
echo "   Username: $ADMIN_USER"
echo "   Password: $ADMIN_PASSWORD"
echo ""
echo "Next steps:"
echo "  1. Start OpenMetadata: docker-compose -f docker-compose-keycloak-saml.yml up openmetadata-server"
echo "  2. Access OpenMetadata: http://localhost:8585"
echo "  3. Click 'Sign in with SAML' and use test user credentials"
