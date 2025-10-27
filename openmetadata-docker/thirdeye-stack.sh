#!/bin/bash

# ThirdEye Stack Management Script
# Quick commands for managing OpenMetadata + ThirdEye stack

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

COMPOSE_FILES="-f docker-compose.yml -f docker-compose.thirdeye.yml"
ENV_FILE="--env-file thirdeye.env"

show_help() {
    echo "ThirdEye Stack Management"
    echo ""
    echo "Usage: ./thirdeye-stack.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  status      Show service status"
    echo "  logs        Show logs (follow mode)"
    echo "  health      Check service health"
    echo "  test        Test ThirdEye integration"
    echo "  clean       Stop and remove all containers and volumes (DANGER!)"
    echo "  rebuild     Rebuild custom OpenMetadata image"
    echo "  help        Show this help message"
    echo ""
}

case "$1" in
    start)
        echo -e "${GREEN}🚀 Starting OpenMetadata + ThirdEye stack...${NC}"
        docker-compose $COMPOSE_FILES $ENV_FILE up -d
        echo -e "${GREEN}✅ Services started${NC}"
        echo ""
        echo "Access OpenMetadata at: http://localhost:8585"
        echo "ThirdEye proxy at: http://localhost:8585/api/v1/thirdeye/health"
        ;;
    
    stop)
        echo -e "${YELLOW}⏸️  Stopping services...${NC}"
        docker-compose $COMPOSE_FILES down
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;
    
    restart)
        echo -e "${YELLOW}🔄 Restarting services...${NC}"
        docker-compose $COMPOSE_FILES restart
        echo -e "${GREEN}✅ Services restarted${NC}"
        ;;
    
    status)
        echo -e "${GREEN}📊 Service Status:${NC}"
        docker-compose $COMPOSE_FILES ps
        ;;
    
    logs)
        echo -e "${GREEN}📋 Showing logs (Ctrl+C to exit):${NC}"
        docker-compose $COMPOSE_FILES logs -f
        ;;
    
    health)
        echo -e "${GREEN}🏥 Health Checks:${NC}"
        echo ""
        
        echo -n "OpenMetadata: "
        if curl -s http://localhost:8585/api/v1/system/version >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Healthy${NC}"
        else
            echo -e "${RED}❌ Unhealthy${NC}"
        fi
        
        echo -n "ThirdEye (Direct): "
        if curl -s http://localhost:8587/api/v1/thirdeye/health >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Healthy${NC}"
        else
            echo -e "${RED}❌ Unhealthy${NC}"
        fi
        
        echo -n "ThirdEye (Proxy): "
        if curl -s http://localhost:8585/api/v1/thirdeye/health >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Healthy${NC}"
        else
            echo -e "${RED}❌ Unhealthy${NC}"
        fi
        
        echo -n "MySQL: "
        if docker exec openmetadata_mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
            echo -e "${GREEN}✅ Healthy${NC}"
        else
            echo -e "${RED}❌ Unhealthy${NC}"
        fi
        
        echo -n "Elasticsearch: "
        if curl -s http://localhost:9200/_cluster/health | grep -q "green\|yellow" 2>/dev/null; then
            echo -e "${GREEN}✅ Healthy${NC}"
        else
            echo -e "${RED}❌ Unhealthy${NC}"
        fi
        ;;
    
    test)
        echo -e "${GREEN}🧪 Testing ThirdEye Integration:${NC}"
        echo ""
        
        echo "1. Testing health endpoint (no auth needed):"
        curl -s http://localhost:8585/api/v1/thirdeye/health | jq . || echo "Response received"
        echo ""
        
        echo "2. Testing authenticated endpoint (requires JWT):"
        echo "   Get JWT token from OpenMetadata UI first:"
        echo "   1. Open http://localhost:8585"
        echo "   2. Login (admin/admin)"
        echo "   3. Open DevTools → Application → Local Storage"
        echo "   4. Copy JWT token"
        echo "   5. Then run:"
        echo "      export JWT='<your_token>'"
        echo "      curl -H 'Authorization: Bearer \$JWT' http://localhost:8585/api/v1/thirdeye/zi-score/summary"
        ;;
    
    clean)
        echo -e "${RED}⚠️  WARNING: This will delete all data!${NC}"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo -e "${YELLOW}🧹 Cleaning up...${NC}"
            docker-compose $COMPOSE_FILES down -v
            echo -e "${GREEN}✅ Cleaned up${NC}"
        else
            echo "Cancelled"
        fi
        ;;
    
    rebuild)
        echo -e "${YELLOW}🔨 Rebuilding custom OpenMetadata image...${NC}"
        docker build -f Dockerfile.custom -t openmetadata-custom:1.9.9-thirdeye .
        echo -e "${GREEN}✅ Image rebuilt${NC}"
        echo ""
        echo "To apply changes, restart the stack:"
        echo "  ./thirdeye-stack.sh restart"
        ;;
    
    help|"")
        show_help
        ;;
    
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
