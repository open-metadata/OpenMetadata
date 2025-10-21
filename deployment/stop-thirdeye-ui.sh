#!/bin/bash

# ThirdEye UI Stop Script
# Stops the ThirdEye UI process

set -e

echo "========================================="
echo "ThirdEye UI Stop Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
THIRDEYE_UI_PORT="80"

cd "$ROOT_DIR/thirdeye-ui"

# Check if PM2 is managing the process
if command -v pm2 &> /dev/null && pm2 list | grep -q "thirdeye-ui"; then
    echo -e "${YELLOW}Stopping ThirdEye UI with PM2...${NC}"
    pm2 stop thirdeye-ui
    pm2 delete thirdeye-ui
    echo -e "${GREEN}✓ ThirdEye UI stopped${NC}"
    
# Check if PID file exists
elif [ -f "logs/thirdeye-ui.pid" ]; then
    PID=$(cat logs/thirdeye-ui.pid)
    echo -e "${YELLOW}Stopping ThirdEye UI (PID: $PID)...${NC}"
    
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        if ps -p $PID > /dev/null 2>&1; then
            echo "Process still running, forcing stop..."
            kill -9 $PID 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✓ ThirdEye UI stopped${NC}"
    else
        echo -e "${YELLOW}Process not running (PID file is stale)${NC}"
    fi
    
    rm -f logs/thirdeye-ui.pid

# Try to find process by port
else
    echo -e "${YELLOW}No PID file found, checking port ${THIRDEYE_UI_PORT}...${NC}"
    
    EXISTING_PID=$(lsof -ti:${THIRDEYE_UI_PORT} 2>/dev/null)
    if [ ! -z "$EXISTING_PID" ]; then
        echo -e "${YELLOW}Stopping process on port ${THIRDEYE_UI_PORT} (PID: $EXISTING_PID)...${NC}"
        kill -9 $EXISTING_PID 2>/dev/null || true
        echo -e "${GREEN}✓ Process stopped${NC}"
    else
        echo -e "${YELLOW}No ThirdEye UI process found running on port ${THIRDEYE_UI_PORT}${NC}"
    fi
fi

echo ""
echo "========================================="
echo -e "${GREEN}Done!${NC}"
echo "========================================="
echo ""
echo "To start ThirdEye UI again:"
echo "  ./deployment/run-thirdeye-ui.sh"
echo ""

