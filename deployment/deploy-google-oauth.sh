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

# Build and deploy ThirdEye UI
echo -e "${YELLOW}Step 7: Deploying ThirdEye UI...${NC}"
cd "$ROOT_DIR/thirdeye-ui"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Building production bundle..."
npm run build

# Setup port 80 permissions
echo "Setting up permissions for port 80..."
if command -v setcap &> /dev/null; then
    echo "Using setcap to allow Node.js to bind to port 80..."
    sudo setcap 'cap_net_bind_service=+ep' $(which node) || true
    echo -e "${GREEN}✓ Port 80 permissions configured${NC}"
else
    echo -e "${YELLOW}Warning: setcap not found. You may need to run with sudo${NC}"
fi

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    echo "Using PM2 to start ThirdEye UI on port 80..."
    pm2 delete thirdeye-ui 2>/dev/null || true
    PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
    pm2 save
    echo -e "${GREEN}✓ ThirdEye UI started with PM2 on port 80${NC}"
else
    echo -e "${YELLOW}PM2 not installed. Starting with npm...${NC}"
    echo "For production, consider installing PM2:"
    echo "  npm install -g pm2"
    echo ""
    echo "Starting ThirdEye UI on port 80..."
    PORT=80 npm run start &
    echo -e "${GREEN}✓ ThirdEye UI started on port 80${NC}"
fi
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "URLs:"
echo "  OpenMetadata: http://coming.live:8585"
echo "  ThirdEye UI:  http://coming.live"
echo "  Sign In:      http://coming.live/auth/signin"
echo ""
echo "Next Steps:"
echo "  1. Open http://coming.live/auth/signin in your browser"
echo "  2. Click 'Continue with Google'"
echo "  3. Complete Google authentication"
echo "  4. You should be redirected to the ThirdEye dashboard"
echo ""
echo "Logs:"
echo "  OpenMetadata: docker-compose logs -f openmetadata-server"
echo "  ThirdEye UI:  pm2 logs thirdeye-ui  (if using PM2)"
echo ""

