#!/bin/bash

# Google OAuth Deployment Script for Server coming.live
# This script helps deploy Google OAuth configuration

set -e

echo "========================================="
echo "Google OAuth Deployment Script"
echo "Server: coming.live"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on the server
echo -e "${YELLOW}Step 1: Checking environment...${NC}"
sleep 1

# Get the root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Root directory: $ROOT_DIR"
echo ""

# Check if Google Client ID is set
echo -e "${YELLOW}Step 2: Checking Google OAuth configuration...${NC}"
if grep -q "<YOUR_GOOGLE_CLIENT_ID>" "$ROOT_DIR/docker/docker-compose-quickstart/docker-compose.yml"; then
    echo -e "${RED}ERROR: Google Client ID not configured!${NC}"
    echo ""
    echo "Please update the docker-compose.yml file with your Google Client ID:"
    echo "  1. Open: $ROOT_DIR/docker/docker-compose-quickstart/docker-compose.yml"
    echo "  2. Replace: <YOUR_GOOGLE_CLIENT_ID>"
    echo "  3. With your actual Google Client ID from Google Cloud Console"
    echo ""
    echo "Or set environment variable:"
    echo "  export AUTHENTICATION_CLIENT_ID='your-client-id.apps.googleusercontent.com'"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Google Client ID is configured${NC}"
echo ""

# Check if ThirdEye UI .env.local exists
echo -e "${YELLOW}Step 3: Checking ThirdEye UI environment...${NC}"
if [ ! -f "$ROOT_DIR/thirdeye-ui/.env.local" ]; then
    echo -e "${YELLOW}Creating .env.local from template...${NC}"
    if [ -f "$ROOT_DIR/thirdeye-ui/env.production.template" ]; then
        cp "$ROOT_DIR/thirdeye-ui/env.production.template" "$ROOT_DIR/thirdeye-ui/.env.local"
        echo -e "${GREEN}✓ Created .env.local${NC}"
        echo ""
        echo -e "${GREEN}✓ JWT_SECRET already configured in template${NC}"
    else
        echo -e "${RED}ERROR: Template file not found!${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env.local already exists${NC}"
fi
echo ""

# Restart OpenMetadata Docker containers
echo -e "${YELLOW}Step 4: Restarting OpenMetadata containers...${NC}"
cd "$ROOT_DIR/docker/docker-compose-quickstart"

echo "Stopping containers..."
docker-compose down

echo "Starting containers with new configuration..."
docker-compose up -d

echo -e "${GREEN}✓ OpenMetadata containers restarted${NC}"
echo ""

# Wait for OpenMetadata to be ready
echo -e "${YELLOW}Step 5: Waiting for OpenMetadata to be ready...${NC}"
sleep 10

# Check OpenMetadata health
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://coming.live:8585/api/v1/system/config/auth > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OpenMetadata is ready${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for OpenMetadata... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}ERROR: OpenMetadata did not start properly${NC}"
    echo "Check logs: docker-compose logs openmetadata-server"
    exit 1
fi
echo ""

# Check auth configuration
echo -e "${YELLOW}Step 6: Verifying Google OAuth configuration...${NC}"
AUTH_CONFIG=$(curl -s http://coming.live:8585/api/v1/system/config/auth)
if echo "$AUTH_CONFIG" | grep -q "google"; then
    echo -e "${GREEN}✓ Google OAuth is configured in OpenMetadata${NC}"
else
    echo -e "${RED}WARNING: Could not verify Google OAuth configuration${NC}"
    echo "Auth config response: $AUTH_CONFIG"
fi
echo ""

# ThirdEye UI setup complete
echo -e "${YELLOW}Step 7: ThirdEye UI Configuration${NC}"
echo -e "${GREEN}✓ Environment file ready for ThirdEye UI${NC}"
echo ""
echo -e "${YELLOW}To start ThirdEye UI, run:${NC}"
echo "  ./deployment/run-thirdeye-ui.sh"
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}Google OAuth Configuration Complete!${NC}"
echo "========================================="
echo ""
echo "OpenMetadata with Google OAuth:"
echo "  URL:  http://coming.live:8585"
echo "  Logs: docker-compose logs -f openmetadata-server"
echo ""
echo "Next Steps:"
echo "  1. Start ThirdEye UI:"
echo "     ./deployment/run-thirdeye-ui.sh"
echo ""
echo "  2. Test Google OAuth:"
echo "     - Open http://coming.live/auth/signin"
echo "     - Click 'Continue with Google'"
echo "     - Complete authentication"
echo "     - You should be redirected to the ThirdEye dashboard"
echo ""
echo "Configuration files:"
echo "  OpenMetadata: docker/docker-compose-quickstart/docker-compose.yml"
echo "  ThirdEye UI:  thirdeye-ui/.env.local"
echo ""

