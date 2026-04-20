#!/bin/bash
# View aggregated logs from all OM servers with color coding

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Colors for different servers
COLOR_SERVER1="\033[1;32m"  # Green
COLOR_SERVER2="\033[1;34m"  # Blue
COLOR_SERVER3="\033[1;35m"  # Magenta
COLOR_MYSQL="\033[1;33m"    # Yellow
COLOR_OPENSEARCH="\033[1;36m"  # Cyan
COLOR_RESET="\033[0m"

# Default values
FOLLOW=false
SERVER_FILTER=""
GREP_PATTERN=""
TAIL_LINES=100

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        --server)
            SERVER_FILTER="$2"
            shift 2
            ;;
        --grep)
            GREP_PATTERN="$2"
            shift 2
            ;;
        --tail)
            TAIL_LINES="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -f, --follow       Follow log output (like tail -f)"
            echo "  --server NUM       Filter to specific server (1, 2, or 3)"
            echo "  --grep PATTERN     Filter logs by pattern"
            echo "  --tail NUM         Number of lines to show (default: 100)"
            echo "  -h, --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 -f                           # Follow all server logs"
            echo "  $0 --server 1 -f                # Follow only server 1 logs"
            echo "  $0 --grep 'partition' -f        # Follow logs containing 'partition'"
            echo "  $0 --grep 'SearchIndex' --tail 500"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Build the docker compose logs command
COMPOSE_ARGS=""

if [ "$FOLLOW" == "true" ]; then
    COMPOSE_ARGS="$COMPOSE_ARGS -f"
fi

COMPOSE_ARGS="$COMPOSE_ARGS --tail=$TAIL_LINES"

# Determine which services to show
SERVICES=""
if [ -n "$SERVER_FILTER" ]; then
    case $SERVER_FILTER in
        1) SERVICES="openmetadata-server-1" ;;
        2) SERVICES="openmetadata-server-2" ;;
        3) SERVICES="openmetadata-server-3" ;;
        mysql) SERVICES="mysql" ;;
        opensearch) SERVICES="opensearch" ;;
        *)
            echo "Invalid server filter: $SERVER_FILTER"
            echo "Use 1, 2, 3, mysql, or opensearch"
            exit 1
            ;;
    esac
else
    SERVICES="openmetadata-server-1 openmetadata-server-2 openmetadata-server-3"
fi

# Function to colorize output
colorize_logs() {
    while IFS= read -r line; do
        if [[ $line == *"openmetadata-server-1"* ]] || [[ $line == *"om-server-1"* ]]; then
            echo -e "${COLOR_SERVER1}[SERVER-1]${COLOR_RESET} $line"
        elif [[ $line == *"openmetadata-server-2"* ]] || [[ $line == *"om-server-2"* ]]; then
            echo -e "${COLOR_SERVER2}[SERVER-2]${COLOR_RESET} $line"
        elif [[ $line == *"openmetadata-server-3"* ]] || [[ $line == *"om-server-3"* ]]; then
            echo -e "${COLOR_SERVER3}[SERVER-3]${COLOR_RESET} $line"
        elif [[ $line == *"mysql"* ]]; then
            echo -e "${COLOR_MYSQL}[MYSQL]${COLOR_RESET} $line"
        elif [[ $line == *"opensearch"* ]]; then
            echo -e "${COLOR_OPENSEARCH}[OPENSEARCH]${COLOR_RESET} $line"
        else
            echo "$line"
        fi
    done
}

echo "======================================"
echo "Distributed Test Logs"
echo "======================================"
echo "Services: $SERVICES"
if [ -n "$GREP_PATTERN" ]; then
    echo "Filter: $GREP_PATTERN"
fi
echo "--------------------------------------"
echo ""

# Run the logs command with optional grep filter
if [ -n "$GREP_PATTERN" ]; then
    docker compose logs $COMPOSE_ARGS $SERVICES 2>&1 | grep --line-buffered -i "$GREP_PATTERN" | colorize_logs
else
    docker compose logs $COMPOSE_ARGS $SERVICES 2>&1 | colorize_logs
fi
