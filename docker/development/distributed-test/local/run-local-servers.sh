#!/bin/bash
# Run multiple OpenMetadata servers locally for debugging

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Default: run all 3 servers
SERVERS="${@:-1 2 3}"

# Check if we should run migrations first
RUN_MIGRATE=false
if [ "$1" == "--migrate" ]; then
    RUN_MIGRATE=true
    shift
    SERVERS="${@:-1 2 3}"
fi

echo "======================================"
echo "Local Multi-Server Development Setup"
echo "======================================"
echo "Project dir: $PROJECT_DIR"
echo "Servers to start: $SERVERS"
echo ""

# Check if JAR exists
JAR_PATH=$(find "$PROJECT_DIR/openmetadata-service/target" -name "openmetadata-service-*.jar" -not -name "*sources*" -not -name "*javadoc*" 2>/dev/null | head -1)

if [ -z "$JAR_PATH" ]; then
    echo "OpenMetadata JAR not found. Building..."
    cd "$PROJECT_DIR"
    mvn clean package -DskipTests -pl openmetadata-service -am
    JAR_PATH=$(find "$PROJECT_DIR/openmetadata-service/target" -name "openmetadata-service-*.jar" -not -name "*sources*" -not -name "*javadoc*" 2>/dev/null | head -1)
fi

if [ -z "$JAR_PATH" ]; then
    echo "ERROR: Could not find or build openmetadata-service JAR"
    exit 1
fi

echo "Using JAR: $JAR_PATH"
echo ""

# Check if dependencies are running
echo "Checking dependencies..."
if ! curl -s http://localhost:3306 >/dev/null 2>&1; then
    if ! docker ps | grep -q distributed_test_mysql; then
        echo "MySQL not running. Starting dependencies..."
        cd "$SCRIPT_DIR"
        docker compose -f docker-compose-deps.yml up -d
        echo "Waiting for MySQL..."
        until docker compose -f docker-compose-deps.yml exec -T mysql mysqladmin ping -h localhost -uroot -ppassword --silent 2>/dev/null; do
            sleep 2
        done
        echo "MySQL ready."
    fi
fi

if ! curl -s http://localhost:9200 >/dev/null 2>&1; then
    echo "OpenSearch not running. Please start dependencies first:"
    echo "  cd $SCRIPT_DIR && docker compose -f docker-compose-deps.yml up -d"
    exit 1
fi

echo "Dependencies are running."
echo ""

# Run migrations if requested
if [ "$RUN_MIGRATE" == "true" ]; then
    echo "Running database migrations..."
    cd "$PROJECT_DIR"
    java -cp "$JAR_PATH" \
        -Dloader.main=org.openmetadata.service.util.OpenMetadataSetup \
        org.springframework.boot.loader.launch.PropertiesLauncher \
        migrate --force
    echo "Migrations complete."
    echo ""
fi

# Function to start a server
start_server() {
    local server_num=$1
    local config_file="$SCRIPT_DIR/server${server_num}.yaml"

    if [ ! -f "$config_file" ]; then
        echo "Config file not found: $config_file"
        return 1
    fi

    local port=$((8583 + server_num * 2))
    echo "Starting Server $server_num on port $port..."

    cd "$PROJECT_DIR"

    # Start in a new terminal window (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR' && java -Xmx1G -Xms512M -Ddw.logging.appenders[0].logFormat='[SERVER-$server_num] %level [%d{ISO8601,UTC}] [%t] %logger{5} - %msg%n' -jar '$JAR_PATH' server '$config_file'\""
    # Linux with gnome-terminal
    elif command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "cd '$PROJECT_DIR' && java -Xmx1G -Xms512M -Ddw.logging.appenders[0].logFormat='[SERVER-$server_num] %level [%d{ISO8601,UTC}] [%t] %logger{5} - %msg%n' -jar '$JAR_PATH' server '$config_file'; exec bash"
    # Linux with xterm
    elif command -v xterm &> /dev/null; then
        xterm -e "cd '$PROJECT_DIR' && java -Xmx1G -Xms512M -jar '$JAR_PATH' server '$config_file'" &
    else
        # Fallback: run in background
        echo "No terminal emulator found. Running in background..."
        java -Xmx1G -Xms512M \
            -Ddw.logging.appenders[0].logFormat="[SERVER-$server_num] %level [%d{ISO8601,UTC}] [%t] %logger{5} - %msg%n" \
            -jar "$JAR_PATH" server "$config_file" \
            > "/tmp/om-server-$server_num.log" 2>&1 &
        echo "Server $server_num started in background. Log: /tmp/om-server-$server_num.log"
    fi
}

# Start requested servers
for server in $SERVERS; do
    start_server "$server"
    sleep 2  # Stagger startup
done

echo ""
echo "======================================"
echo "Servers starting..."
echo "======================================"
echo ""
echo "Server endpoints:"
for server in $SERVERS; do
    port=$((8583 + server * 2))
    echo "  - Server $server: http://localhost:$port"
done
echo ""
echo "For IDE debugging:"
echo "  1. Open your IDE"
echo "  2. Create a new Run Configuration"
echo "  3. Main class: org.openmetadata.service.OpenMetadataApplication"
echo "  4. Program arguments: server local/server1.yaml"
echo "  5. VM options: -Xmx1G -Xms512M"
echo "  6. Working directory: $PROJECT_DIR"
echo ""
