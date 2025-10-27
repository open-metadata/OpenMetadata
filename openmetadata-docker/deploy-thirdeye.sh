#!/bin/bash

# OpenMetadata with ThirdEye Integration Deployment Script
# This script builds and deploys OpenMetadata with custom ThirdEye integration

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}OpenMetadata + ThirdEye Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Step 1: Check if custom JAR exists
echo -e "${YELLOW}[1/6] Checking for custom JAR...${NC}"
if [ -f "custom-jar/openmetadata-service-1.9.9.jar" ]; then
    echo -e "${GREEN}✅ Custom JAR found ($(du -h custom-jar/openmetadata-service-1.9.9.jar | cut -f1))${NC}"
else
    echo -e "${RED}❌ Custom JAR not found!${NC}"
    echo "Please build OpenMetadata first:"
    echo "  cd .. && mvn clean install -pl openmetadata-service -am -DskipTests"
    echo "  cp openmetadata-service/target/openmetadata-service-1.9.9.jar openmetadata-docker/custom-jar/"
    exit 1
fi

# Step 2: Check if ThirdEye Dockerfile exists
echo -e "${YELLOW}[2/6] Checking ThirdEye service...${NC}"
if [ -f "../thirdeye-py-service/Dockerfile" ]; then
    echo -e "${GREEN}✅ ThirdEye Dockerfile found${NC}"
else
    echo -e "${RED}❌ ThirdEye Dockerfile not found!${NC}"
    exit 1
fi

# Step 3: Stop existing containers
echo -e "${YELLOW}[3/6] Stopping existing containers...${NC}"
docker-compose -f docker-compose.yml -f docker-compose.thirdeye.yml down 2>/dev/null || true
echo -e "${GREEN}✅ Stopped existing containers${NC}"

# Step 4: Build custom OpenMetadata image
echo -e "${YELLOW}[4/6] Building custom OpenMetadata image with ThirdEye integration...${NC}"
docker build -f Dockerfile.custom -t openmetadata-custom:1.9.9-thirdeye .
echo -e "${GREEN}✅ Custom image built${NC}"

# Step 5: Start all services
echo -e "${YELLOW}[5/6] Starting all services...${NC}"
docker-compose -f docker-compose.yml -f docker-compose.thirdeye.yml --env-file thirdeye.env up -d
echo -e "${GREEN}✅ Services started${NC}"

# Step 6: Wait for services to be healthy
echo -e "${YELLOW}[6/6] Waiting for services to be healthy...${NC}"
echo "This may take a few minutes..."

# Wait for MySQL
echo -n "Waiting for MySQL..."
until docker exec openmetadata_mysql mysqladmin ping -h localhost --silent 2>/dev/null; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✅${NC}"

# Wait for Elasticsearch
echo -n "Waiting for Elasticsearch..."
until curl -s http://localhost:9200/_cluster/health | grep -q '"status":"green\|yellow"' 2>/dev/null; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✅${NC}"

# Wait for ThirdEye
echo -n "Waiting for ThirdEye..."
for i in {1..30}; do
    if curl -s http://localhost:8587/api/v1/thirdeye/health 2>/dev/null | grep -q "ok\|status"; then
        echo -e " ${GREEN}✅${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for OpenMetadata
echo -n "Waiting for OpenMetadata..."
for i in {1..60}; do
    if curl -s http://localhost:8585/api/v1/system/version 2>/dev/null | grep -q "version"; then
        echo -e " ${GREEN}✅${NC}"
        break
    fi
    echo -n "."
    sleep 3
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Services:"
echo "  • OpenMetadata UI:        http://localhost:8585"
echo "  • OpenMetadata API:       http://localhost:8585/api"
echo "  • ThirdEye Proxy:         http://localhost:8585/api/v1/thirdeye"
echo "  • ThirdEye Direct:        http://localhost:8587"
echo "  • Elasticsearch:          http://localhost:9200"
echo "  • MySQL:                  localhost:3307"
echo ""
echo "Test ThirdEye integration:"
echo "  curl http://localhost:8585/api/v1/thirdeye/health"
echo ""
echo "View logs:"
echo "  docker-compose -f docker-compose.yml -f docker-compose.thirdeye.yml logs -f openmetadata-server"
echo "  docker-compose -f docker-compose.yml -f docker-compose.thirdeye.yml logs -f thirdeye"
echo ""
echo -e "${YELLOW}⚠️  Note: Get JWT token from OpenMetadata UI for authenticated requests${NC}"
echo ""
