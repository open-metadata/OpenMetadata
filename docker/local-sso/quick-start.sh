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

# Quick start script for local SSO testing
# Usage: ./quick-start.sh [keycloak|ldap]

set -e

PROVIDER="${1:-keycloak}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║   OpenMetadata Local SSO Testing Environment             ║
║   No external dependencies • CI/CD Ready                  ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

if [[ "$PROVIDER" != "keycloak" && "$PROVIDER" != "ldap" ]]; then
  echo -e "${RED}❌ Invalid provider. Use 'keycloak' or 'ldap'${NC}"
  echo "Usage: $0 [keycloak|ldap]"
  exit 1
fi

echo -e "${GREEN}🚀 Starting $PROVIDER SSO environment...${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

# Clean up any existing containers
echo -e "${YELLOW}🧹 Cleaning up existing containers...${NC}"
docker-compose -f docker-compose-keycloak-saml.yml down > /dev/null 2>&1 || true
docker-compose -f docker-compose-ldap.yml down > /dev/null 2>&1 || true

if [ "$PROVIDER" == "keycloak" ]; then
  echo -e "${BLUE}📦 Starting Keycloak SAML environment...${NC}"
  docker-compose -f docker-compose-keycloak-saml.yml up -d

  echo ""
  echo -e "${YELLOW}⏳ Waiting for services to be ready (this may take 2-3 minutes)...${NC}"

  # Wait for Keycloak
  echo -n "   Waiting for Keycloak..."
  timeout 180 bash -c 'until curl -sf http://localhost:8080/health/ready > /dev/null 2>&1; do sleep 2; done' && echo -e " ${GREEN}✓${NC}" || {
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}Keycloak failed to start. Check logs: docker logs keycloak-saml-sso${NC}"
    exit 1
  }

  # Wait for MySQL
  echo -n "   Waiting for MySQL..."
  timeout 60 bash -c 'until docker exec openmetadata-mysql mysqladmin ping -h localhost --silent > /dev/null 2>&1; do sleep 2; done' && echo -e " ${GREEN}✓${NC}" || {
    echo -e " ${RED}✗${NC}"
    exit 1
  }

  # Wait for Elasticsearch
  echo -n "   Waiting for Elasticsearch..."
  timeout 60 bash -c 'until curl -sf http://localhost:9200/_cluster/health > /dev/null 2>&1; do sleep 2; done' && echo -e " ${GREEN}✓${NC}" || {
    echo -e " ${RED}✗${NC}"
    exit 1
  }

  echo ""
  echo -e "${BLUE}⚙️  Configuring Keycloak realm and test users...${NC}"
  sleep 5  # Give Keycloak a bit more time to fully initialize
  ./setup-keycloak-realm.sh

  echo ""
  echo -n "   Waiting for OpenMetadata..."
  timeout 180 bash -c 'until curl -sf http://localhost:8585/api/v1/system/status > /dev/null 2>&1; do sleep 5; done' && echo -e " ${GREEN}✓${NC}" || {
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}OpenMetadata failed to start. Check logs: docker logs openmetadata-server${NC}"
    exit 1
  }

  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅ Keycloak SAML environment is ready!                  ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}📋 Access URLs:${NC}"
  echo -e "   OpenMetadata:      ${GREEN}http://localhost:8585${NC}"
  echo -e "   Keycloak Admin:    ${GREEN}http://localhost:8080/admin${NC}"
  echo ""
  echo -e "${BLUE}🔑 Admin Credentials:${NC}"
  echo -e "   Username: ${YELLOW}admin${NC}"
  echo -e "   Password: ${YELLOW}admin123${NC}"
  echo ""
  echo -e "${BLUE}👥 Test Users (for OpenMetadata login):${NC}"
  echo -e "   1. ${YELLOW}testuser${NC} / ${YELLOW}Test@123${NC} (testuser@openmetadata.org)"
  echo -e "   2. ${YELLOW}adminuser${NC} / ${YELLOW}Admin@123${NC} (admin@openmetadata.org)"
  echo -e "   3. ${YELLOW}datasteward${NC} / ${YELLOW}Steward@123${NC} (steward@openmetadata.org)"
  echo ""
  echo -e "${BLUE}🧪 Run Playwright Tests:${NC}"
  echo -e "   ${YELLOW}cd ../../../../openmetadata-ui/src/main/resources/ui${NC}"
  echo -e "   ${YELLOW}SSO_PROVIDER_TYPE=saml SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \\${NC}"
  echo -e "   ${YELLOW}  yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts${NC}"

elif [ "$PROVIDER" == "ldap" ]; then
  echo -e "${BLUE}📦 Starting LDAP environment...${NC}"
  docker-compose -f docker-compose-ldap.yml up -d

  echo ""
  echo -e "${YELLOW}⏳ Waiting for services to be ready (this may take 2-3 minutes)...${NC}"

  # Wait for OpenLDAP
  echo -n "   Waiting for OpenLDAP..."
  sleep 15  # LDAP needs a bit more time
  timeout 60 bash -c 'until docker exec openldap ldapsearch -x -H ldap://localhost:1389 -b "dc=openmetadata,dc=org" -D "cn=admin,dc=openmetadata,dc=org" -w admin123 > /dev/null 2>&1; do sleep 2; done' && echo -e " ${GREEN}✓${NC}" || {
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}OpenLDAP failed to start. Check logs: docker logs openldap-sso${NC}"
    exit 1
  }

  # Wait for MySQL
  echo -n "   Waiting for MySQL..."
  timeout 60 bash -c 'until docker exec openmetadata-mysql mysqladmin ping -h localhost --silent > /dev/null 2>&1; do sleep 2; done' && echo -e " ${GREEN}✓${NC}" || {
    echo -e " ${RED}✗${NC}"
    exit 1
  }

  # Wait for Elasticsearch
  echo -n "   Waiting for Elasticsearch..."
  timeout 60 bash -c 'until curl -sf http://localhost:9200/_cluster/health > /dev/null 2>&1; do sleep 2; done' && echo -e " ${GREEN}✓${NC}" || {
    echo -e " ${RED}✗${NC}"
    exit 1
  }

  echo -n "   Waiting for OpenMetadata..."
  timeout 180 bash -c 'until curl -sf http://localhost:8585/api/v1/system/status > /dev/null 2>&1; do sleep 5; done' && echo -e " ${GREEN}✓${NC}" || {
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}OpenMetadata failed to start. Check logs: docker logs openmetadata-server${NC}"
    exit 1
  }

  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅ LDAP environment is ready!                           ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}📋 Access URLs:${NC}"
  echo -e "   OpenMetadata:      ${GREEN}http://localhost:8585${NC}"
  echo -e "   phpLDAPadmin:      ${GREEN}http://localhost:8081${NC}"
  echo ""
  echo -e "${BLUE}🔑 LDAP Admin Credentials:${NC}"
  echo -e "   DN: ${YELLOW}cn=admin,dc=openmetadata,dc=org${NC}"
  echo -e "   Password: ${YELLOW}admin123${NC}"
  echo ""
  echo -e "${BLUE}👥 Test Users (for OpenMetadata login):${NC}"
  echo -e "   1. ${YELLOW}testuser${NC} / ${YELLOW}Test@123${NC} (testuser@openmetadata.org)"
  echo -e "   2. ${YELLOW}adminuser${NC} / ${YELLOW}Admin@123${NC} (admin@openmetadata.org)"
  echo -e "   3. ${YELLOW}datasteward${NC} / ${YELLOW}Steward@123${NC} (steward@openmetadata.org)"
  echo ""
  echo -e "${BLUE}🧪 Run Playwright Tests:${NC}"
  echo -e "   ${YELLOW}cd ../../../../openmetadata-ui/src/main/resources/ui${NC}"
  echo -e "   ${YELLOW}SSO_PROVIDER_TYPE=ldap SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \\${NC}"
  echo -e "   ${YELLOW}  yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts${NC}"
fi

echo ""
echo -e "${BLUE}📚 For more info:${NC} See README.md in this directory"
echo -e "${BLUE}🛑 To stop:${NC} ${YELLOW}docker-compose -f docker-compose-$PROVIDER.yml down${NC}"
echo ""
