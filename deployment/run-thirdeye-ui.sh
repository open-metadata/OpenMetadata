#!/bin/bash

# ThirdEye UI Start Script
# This script builds and runs the ThirdEye UI on port 80

set -e

echo "========================================="
echo "ThirdEye UI Start Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
OM_DOMAIN="coming.live"
THIRDEYE_UI_PORT="80"
THIRDEYE_UI_URL="http://${OM_DOMAIN}"

# Get the root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Root directory: $ROOT_DIR"
echo ""

# Check if .env.local exists
echo -e "${YELLOW}Step 1: Checking environment file...${NC}"
if [ ! -f "$ROOT_DIR/thirdeye-ui/.env.local" ]; then
    echo -e "${YELLOW}Creating .env.local from template...${NC}"
    if [ -f "$ROOT_DIR/thirdeye-ui/env.production.template" ]; then
        cp "$ROOT_DIR/thirdeye-ui/env.production.template" "$ROOT_DIR/thirdeye-ui/.env.local"
        echo -e "${GREEN}✓ Created .env.local${NC}"
    else
        echo -e "${RED}ERROR: Template file not found!${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env.local exists${NC}"
fi
echo ""

# Navigate to ThirdEye UI directory
cd "$ROOT_DIR/thirdeye-ui"

# Install dependencies if needed
echo -e "${YELLOW}Step 2: Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

# Build the application
echo -e "${YELLOW}Step 3: Building ThirdEye UI...${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Setup port 80 permissions
echo -e "${YELLOW}Step 4: Setting up port 80 permissions...${NC}"
if command -v setcap &> /dev/null; then
    echo "Using setcap to allow Node.js to bind to port 80..."
    sudo setcap 'cap_net_bind_service=+ep' $(which node) || true
    echo -e "${GREEN}✓ Port 80 permissions configured${NC}"
else
    echo -e "${YELLOW}Warning: setcap not found. You may need to run with sudo${NC}"
fi
echo ""

# Start the application
echo -e "${YELLOW}Step 5: Starting ThirdEye UI on port ${THIRDEYE_UI_PORT}...${NC}"

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    echo "Using PM2 to manage the process..."
    
    # Stop existing instance if running
    pm2 delete thirdeye-ui 2>/dev/null || true
    
    # Start with PM2
    PORT=${THIRDEYE_UI_PORT} pm2 start npm --name "thirdeye-ui" -- run start
    pm2 save
    
    echo -e "${GREEN}✓ ThirdEye UI started with PM2${NC}"
    echo ""
    echo "PM2 Status:"
    pm2 status thirdeye-ui
    echo ""
    echo "View logs: pm2 logs thirdeye-ui"
    echo "Stop app:  pm2 stop thirdeye-ui"
    echo "Restart:   pm2 restart thirdeye-ui"
else
    echo -e "${YELLOW}PM2 not installed. Starting with nohup in background mode...${NC}"
    echo ""
    
    # Kill any existing process on port 80
    EXISTING_PID=$(lsof -ti:${THIRDEYE_UI_PORT} 2>/dev/null)
    if [ ! -z "$EXISTING_PID" ]; then
        echo "Stopping existing process on port ${THIRDEYE_UI_PORT} (PID: $EXISTING_PID)..."
        kill -9 $EXISTING_PID 2>/dev/null || true
        sleep 2
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Start with nohup to run in background and persist after terminal closes
    echo "Starting ThirdEye UI in background mode..."
    nohup bash -c "PORT=${THIRDEYE_UI_PORT} npm run start" > logs/thirdeye-ui.log 2>&1 &
    APP_PID=$!
    
    # Save PID to file for later management
    echo $APP_PID > logs/thirdeye-ui.pid
    
    echo -e "${GREEN}✓ ThirdEye UI started in background (PID: $APP_PID)${NC}"
    echo ""
    echo "Process will continue running even after closing the terminal."
    echo ""
    echo "Management commands:"
    echo "  View logs:  tail -f logs/thirdeye-ui.log"
    echo "  Stop app:   kill \$(cat logs/thirdeye-ui.pid)"
    echo "  Check PID:  cat logs/thirdeye-ui.pid"
    echo ""
    echo -e "${YELLOW}For production, we recommend installing PM2:${NC}"
    echo "  npm install -g pm2"
    echo "  Then re-run this script to use PM2 for better process management"
fi
echo ""

# Wait a moment for the app to start
sleep 3

# Check if the app is running
echo -e "${YELLOW}Step 6: Verifying application...${NC}"
if curl -s http://localhost:${THIRDEYE_UI_PORT} > /dev/null 2>&1; then
    echo -e "${GREEN}✓ ThirdEye UI is running${NC}"
else
    echo -e "${YELLOW}Warning: Could not verify if app is running${NC}"
    echo "Check the logs to ensure it started correctly"
fi
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}ThirdEye UI Started Successfully!${NC}"
echo "========================================="
echo ""
echo "Access your application:"
echo "  URL:      ${THIRDEYE_UI_URL}"
echo "  Sign In:  ${THIRDEYE_UI_URL}/auth/signin"
echo ""
echo "Management:"
if command -v pm2 &> /dev/null; then
    echo "  View logs:  pm2 logs thirdeye-ui"
    echo "  Stop:       pm2 stop thirdeye-ui"
    echo "  Restart:    pm2 restart thirdeye-ui"
    echo "  Status:     pm2 status"
else
    echo "  View logs:  tail -f logs/thirdeye-ui.log"
    echo "  Stop:       kill \$(cat logs/thirdeye-ui.pid)"
    echo "  Check PID:  cat logs/thirdeye-ui.pid"
    echo "  Check Port: lsof -i :${THIRDEYE_UI_PORT}"
fi
echo ""

