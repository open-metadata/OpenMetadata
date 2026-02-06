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

# Test the GitHub Actions workflow steps locally
# This simulates what the CI workflow does

set -e

PROVIDER="${1:-keycloak-saml}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║   Local Workflow Test - Simulating GitHub Actions        ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

if [[ "$PROVIDER" != "keycloak-saml" && "$PROVIDER" != "ldap" ]]; then
  echo -e "${RED}❌ Invalid provider. Use 'keycloak-saml' or 'ldap'${NC}"
  exit 1
fi

echo -e "${GREEN}📋 Testing workflow for provider: $PROVIDER${NC}"
echo ""

# ============================================
# Step 1: Cleanup (like GitHub Actions does)
# ============================================
echo -e "${YELLOW}Step 1: Cleaning up existing containers...${NC}"
docker-compose -f docker-compose-keycloak-saml.yml down -v 2>/dev/null || true
docker-compose -f docker-compose-ldap.yml down -v 2>/dev/null || true
docker network rm openmetadata-sso 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# ============================================
# Step 2: Start Services (like workflow does)
# ============================================
if [ "$PROVIDER" == "keycloak-saml" ]; then
  echo -e "${YELLOW}Step 2: Starting Keycloak SAML environment...${NC}"

  # Start all services with docker-compose (includes Keycloak, MySQL, ES, migrations, OpenMetadata)
  docker-compose -f docker-compose-keycloak-saml.yml up -d

  echo -n "   Waiting for Keycloak..."
  SECONDS=0
  MAX_WAIT=120
  while ! curl -sf http://localhost:8080/realms/master > /dev/null 2>&1; do
    if [ $SECONDS -ge $MAX_WAIT ]; then
      echo -e " ${RED}✗${NC}"
      echo -e "${RED}Keycloak failed to start${NC}"
      exit 1
    fi
    sleep 2
  done
  echo -e " ${GREEN}✓${NC}"

  echo -e "${GREEN}✓ Keycloak started${NC}"
  echo ""

  # ============================================
  # Step 3: Configure Keycloak (like workflow does)
  # ============================================
  echo -e "${YELLOW}Step 3: Configuring Keycloak realm...${NC}"
  ./setup-keycloak-realm.sh
  echo -e "${GREEN}✓ Keycloak configured${NC}"
  echo ""

  # ============================================
  # Step 4: Wait for services to be ready
  # ============================================
  echo -e "${YELLOW}Step 4: Waiting for services to be ready...${NC}"

  echo -n "   Waiting for MySQL..."
  SECONDS=0
  MAX_WAIT=60
  while ! docker exec openmetadata_mysql mysqladmin ping -h localhost --silent > /dev/null 2>&1; do
    if [ $SECONDS -ge $MAX_WAIT ]; then
      echo -e " ${RED}✗${NC}"
      exit 1
    fi
    sleep 2
  done
  echo -e " ${GREEN}✓${NC}"

  echo -n "   Waiting for Elasticsearch..."
  SECONDS=0
  MAX_WAIT=60
  while ! curl -sf http://localhost:9200/_cluster/health > /dev/null 2>&1; do
    if [ $SECONDS -ge $MAX_WAIT ]; then
      echo -e " ${RED}✗${NC}"
      exit 1
    fi
    sleep 2
  done
  echo -e " ${GREEN}✓${NC}"

  echo -n "   Waiting for OpenMetadata..."
  SECONDS=0
  MAX_WAIT=180
  while ! curl -sf http://localhost:8585/api/v1/system/health > /dev/null 2>&1; do
    if [ $SECONDS -ge $MAX_WAIT ]; then
      echo -e " ${RED}✗${NC}"
      echo -e "${RED}OpenMetadata failed to start${NC}"
      exit 1
    fi
    sleep 5
  done
  echo -e " ${GREEN}✓${NC}"

  echo -e "${GREEN}✓ OpenMetadata started${NC}"
  echo ""

  SSO_PROVIDER_TYPE="saml"

else
  # LDAP setup
  echo -e "${YELLOW}Step 2: Starting LDAP environment...${NC}"

  # Start all services with docker-compose (includes OpenLDAP, MySQL, ES, migrations, OpenMetadata)
  docker-compose -f docker-compose-ldap.yml up -d

  echo "   Waiting for OpenLDAP to initialize..."
  sleep 20

  echo -e "${GREEN}✓ OpenLDAP started${NC}"
  echo ""

  # ============================================
  # Step 3: LDAP users already configured via ldap-init.ldif
  # ============================================
  echo -e "${YELLOW}Step 3: LDAP users auto-configured from ldap-init.ldif...${NC}"
  echo -e "${GREEN}✓ LDAP users configured${NC}"
  echo ""

  # ============================================
  # Step 4: Wait for services to be ready
  # ============================================
  echo -e "${YELLOW}Step 4: Waiting for services to be ready...${NC}"

  echo -n "   Waiting for MySQL..."
  SECONDS=0
  MAX_WAIT=60
  while ! docker exec openmetadata_mysql mysqladmin ping -h localhost --silent > /dev/null 2>&1; do
    if [ $SECONDS -ge $MAX_WAIT ]; then
      echo -e " ${RED}✗${NC}"
      exit 1
    fi
    sleep 2
  done
  echo -e " ${GREEN}✓${NC}"

  echo -n "   Waiting for Elasticsearch..."
  SECONDS=0
  MAX_WAIT=60
  while ! curl -sf http://localhost:9200/_cluster/health > /dev/null 2>&1; do
    if [ $SECONDS -ge $MAX_WAIT ]; then
      echo -e " ${RED}✗${NC}"
      exit 1
    fi
    sleep 2
  done
  echo -e " ${GREEN}✓${NC}"

  echo -n "   Waiting for OpenMetadata..."
  SECONDS=0
  MAX_WAIT=180
  while ! curl -sf http://localhost:8585/api/v1/system/health > /dev/null 2>&1; do
    if [ $SECONDS -ge $MAX_WAIT ]; then
      echo -e " ${RED}✗${NC}"
      echo -e "${RED}OpenMetadata failed to start${NC}"
      exit 1
    fi
    sleep 5
  done
  echo -e " ${GREEN}✓${NC}"

  echo -e "${GREEN}✓ OpenMetadata started${NC}"
  echo ""

  SSO_PROVIDER_TYPE="ldap"
fi

# ============================================
# Step 5: Run Playwright Tests (like workflow does)
# ============================================
echo -e "${YELLOW}Step 5: Running Playwright tests...${NC}"
echo ""

cd ../../openmetadata-ui/src/main/resources/ui

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "   Installing dependencies..."
  yarn install --frozen-lockfile
fi

# Check if Playwright is installed
if [ ! -d "node_modules/playwright" ]; then
  echo "   Installing Playwright browsers..."
  npx playwright install chromium --with-deps
fi

echo ""
echo -e "${BLUE}Running Playwright SSO tests with:${NC}"
echo -e "  Provider: ${YELLOW}$SSO_PROVIDER_TYPE${NC}"
echo -e "  Username: ${YELLOW}testuser${NC}"
echo -e "  Password: ${YELLOW}Test@123${NC}"
echo ""

# Run tests
SSO_PROVIDER_TYPE=$SSO_PROVIDER_TYPE \
SSO_USERNAME=testuser \
SSO_PASSWORD=Test@123 \
PLAYWRIGHT_TEST_BASE_URL=http://localhost:8585 \
PLAYWRIGHT_IS_OSS=true \
  npx playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts --workers=1

TEST_EXIT_CODE=$?

# ============================================
# Step 6: Show Results
# ============================================
echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅ All tests passed!                                    ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ❌ Tests failed!                                        ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}Check test results in:${NC}"
  echo "  playwright/output/playwright-report/"
  echo "  playwright/output/test-results/"
fi

echo ""
echo -e "${BLUE}Test artifacts:${NC}"
echo "  HTML Report: playwright/output/playwright-report/index.html"
echo "  Screenshots: playwright/output/test-results/"
echo "  Traces:      playwright/output/test-results/**/trace.zip"
echo ""
echo -e "${BLUE}View HTML report:${NC}"
echo "  ${YELLOW}yarn playwright show-report${NC}"
echo ""
echo -e "${BLUE}Container logs:${NC}"
if [ "$PROVIDER" == "keycloak-saml" ]; then
  echo "  ${YELLOW}docker logs keycloak-saml-sso${NC}"
else
  echo "  ${YELLOW}docker logs openldap-sso${NC}"
fi
echo "  ${YELLOW}docker logs openmetadata_server${NC}"
echo "  ${YELLOW}docker logs execute_migrate_all${NC}"
echo ""

# ============================================
# Cleanup prompt
# ============================================
echo -e "${YELLOW}Keep services running?${NC}"
echo "  Yes - Access OpenMetadata at http://localhost:8585"
echo "  No  - Run cleanup command below"
echo ""
echo -e "${BLUE}To stop services:${NC}"
if [ "$PROVIDER" == "keycloak-saml" ]; then
  echo "  ${YELLOW}cd docker/local-sso && docker-compose -f docker-compose-keycloak-saml.yml down -v${NC}"
else
  echo "  ${YELLOW}cd docker/local-sso && docker-compose -f docker-compose-ldap.yml down -v${NC}"
fi
echo ""

exit $TEST_EXIT_CODE
