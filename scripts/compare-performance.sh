#!/bin/bash
# Performance comparison script
# Compares sequential vs distributed ingestion for Redshift

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/../performance-results"
mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "========================================================================"
echo "OpenMetadata Distributed Ingestion - Performance Comparison"
echo "========================================================================"
echo ""

# Check required environment variables
REQUIRED_VARS=("REDSHIFT_USER" "REDSHIFT_PASSWORD" "REDSHIFT_HOST" "REDSHIFT_DATABASE" "OM_JWT_TOKEN")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}✗ Missing required environment variable: $var${NC}"
        echo "Please export all required variables:"
        echo "  export REDSHIFT_USER='...'"
        echo "  export REDSHIFT_PASSWORD='...'"
        echo "  export REDSHIFT_HOST='...'"
        echo "  export REDSHIFT_DATABASE='...'"
        echo "  export OM_JWT_TOKEN='...'"
        exit 1
    fi
done

echo -e "${GREEN}✓ All required environment variables set${NC}"
echo ""

# Configuration
SCHEMA_FILTER="${SCHEMA_FILTER:-public}"
PARALLELISM="${PARALLELISM:-20}"

echo "Configuration:"
echo "  Database: $REDSHIFT_DATABASE"
echo "  Schema filter: $SCHEMA_FILTER"
echo "  Parallelism: $PARALLELISM"
echo ""

# Create sequential workflow config
SEQUENTIAL_CONFIG="$RESULTS_DIR/redshift-sequential-$TIMESTAMP.yaml"
cat > "$SEQUENTIAL_CONFIG" << EOF
source:
  type: redshift
  serviceName: redshift-sequential-test
  serviceConnection:
    config:
      type: Redshift
      username: $REDSHIFT_USER
      password: $REDSHIFT_PASSWORD
      hostPort: $REDSHIFT_HOST:5439
      database: $REDSHIFT_DATABASE
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        includes:
          - "^$SCHEMA_FILTER$"
      includeViews: true
      includeTables: true

sink:
  type: metadata-rest
  config:
    api_endpoint: null

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: $OM_JWT_TOKEN

  # Sequential mode - no distributed execution
  loggerLevel: INFO
EOF

echo -e "${BLUE}Created sequential config: $SEQUENTIAL_CONFIG${NC}"

# Create distributed (local) workflow config
DISTRIBUTED_LOCAL_CONFIG="$RESULTS_DIR/redshift-distributed-local-$TIMESTAMP.yaml"
cat > "$DISTRIBUTED_LOCAL_CONFIG" << EOF
source:
  type: redshift
  serviceName: redshift-distributed-local-test
  serviceConnection:
    config:
      type: Redshift
      username: $REDSHIFT_USER
      password: $REDSHIFT_PASSWORD
      hostPort: $REDSHIFT_HOST:5439
      database: $REDSHIFT_DATABASE
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        includes:
          - "^$SCHEMA_FILTER$"
      includeViews: true
      includeTables: true

sink:
  type: metadata-rest
  config:
    api_endpoint: null

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: $OM_JWT_TOKEN

  # Distributed local mode
  distributedExecution:
    enabled: true
    orchestrator: local
    parallelism: $PARALLELISM

  loggerLevel: INFO
EOF

echo -e "${BLUE}Created distributed (local) config: $DISTRIBUTED_LOCAL_CONFIG${NC}"

# Create distributed (Argo) workflow config
DISTRIBUTED_ARGO_CONFIG="$RESULTS_DIR/redshift-distributed-argo-$TIMESTAMP.yaml"
cat > "$DISTRIBUTED_ARGO_CONFIG" << EOF
source:
  type: redshift
  serviceName: redshift-distributed-argo-test
  serviceConnection:
    config:
      type: Redshift
      username: $REDSHIFT_USER
      password: $REDSHIFT_PASSWORD
      hostPort: $REDSHIFT_HOST:5439
      database: $REDSHIFT_DATABASE
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        includes:
          - "^$SCHEMA_FILTER$"
      includeViews: true
      includeTables: true

sink:
  type: metadata-rest
  config:
    api_endpoint: null

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://host.docker.internal:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: $OM_JWT_TOKEN

  # Distributed Argo mode
  distributedExecution:
    enabled: true
    orchestrator: argo
    parallelism: $PARALLELISM
    namespace: openmetadata
    serviceAccount: openmetadata-ingestion
    image: openmetadata-ingestion:local

    retryPolicy:
      maxAttempts: 3
      backoffSeconds: 30

    resourceRequests:
      cpu: "500m"
      memory: "1Gi"

    resourceLimits:
      cpu: "1"
      memory: "2Gi"

    waitForCompletion: true

  loggerLevel: INFO
EOF

echo -e "${BLUE}Created distributed (Argo) config: $DISTRIBUTED_ARGO_CONFIG${NC}"
echo ""

# Function to run ingestion and capture metrics
run_ingestion() {
    local mode=$1
    local config=$2
    local log_file="$RESULTS_DIR/${mode}-${TIMESTAMP}.log"

    echo "========================================================================"
    echo -e "${YELLOW}Running ${mode} ingestion...${NC}"
    echo "========================================================================"
    echo ""

    local start_time=$(date +%s)

    if metadata ingest -c "$config" > "$log_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        echo -e "${GREEN}✓ ${mode} completed in ${duration} seconds${NC}"
        echo ""

        # Extract metrics from log
        local total_entities=$(grep -o "Total entities: [0-9]*" "$log_file" | grep -o "[0-9]*" | tail -1)
        local successful=$(grep -o "Successful: [0-9]*" "$log_file" | grep -o "[0-9]*" | tail -1)
        local failed=$(grep -o "Failed: [0-9]*" "$log_file" | grep -o "[0-9]*" | tail -1)
        local throughput=$(grep -o "Throughput: [0-9.]*" "$log_file" | grep -o "[0-9.]*" | tail -1)

        # Save results
        cat > "$RESULTS_DIR/${mode}-${TIMESTAMP}-results.txt" << EOF
Mode: $mode
Duration: $duration seconds
Total entities: ${total_entities:-N/A}
Successful: ${successful:-N/A}
Failed: ${failed:-N/A}
Throughput: ${throughput:-N/A} entities/second
Log file: $log_file
EOF

        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        echo -e "${RED}✗ ${mode} failed after ${duration} seconds${NC}"
        echo "See log: $log_file"
        echo ""
        return 1
    fi
}

# Run tests
echo "========================================================================"
echo "Test 1: Sequential Mode (Baseline)"
echo "========================================================================"
echo ""
run_ingestion "sequential" "$SEQUENTIAL_CONFIG" || true
echo ""

echo "========================================================================"
echo "Test 2: Distributed Local Mode (Thread-based)"
echo "========================================================================"
echo ""
run_ingestion "distributed-local" "$DISTRIBUTED_LOCAL_CONFIG" || true
echo ""

# Check if K8s is available
if kubectl cluster-info &> /dev/null && kubectl get namespace openmetadata &> /dev/null; then
    echo "========================================================================"
    echo "Test 3: Distributed Argo Mode (Kubernetes-based)"
    echo "========================================================================"
    echo ""
    run_ingestion "distributed-argo" "$DISTRIBUTED_ARGO_CONFIG" || true
    echo ""
else
    echo "========================================================================"
    echo "Test 3: Distributed Argo Mode - SKIPPED"
    echo "========================================================================"
    echo -e "${YELLOW}⚠ Kubernetes cluster or 'openmetadata' namespace not available${NC}"
    echo "To test Argo mode, run: ./scripts/k8s-setup.sh"
    echo ""
fi

# Generate comparison report
echo "========================================================================"
echo "Performance Comparison Report"
echo "========================================================================"
echo ""

REPORT_FILE="$RESULTS_DIR/comparison-report-$TIMESTAMP.txt"

{
    echo "OpenMetadata Distributed Ingestion - Performance Comparison"
    echo "Generated: $(date)"
    echo ""
    echo "Configuration:"
    echo "  Database: $REDSHIFT_DATABASE"
    echo "  Schema: $SCHEMA_FILTER"
    echo "  Parallelism: $PARALLELISM"
    echo ""
    echo "========================================================================"
    echo ""

    for mode in sequential distributed-local distributed-argo; do
        results_file="$RESULTS_DIR/${mode}-${TIMESTAMP}-results.txt"
        if [ -f "$results_file" ]; then
            cat "$results_file"
            echo ""
            echo "------------------------------------------------------------------------"
            echo ""
        fi
    done

    echo "Speedup Calculations:"
    echo ""

    # Calculate speedups if both sequential and distributed completed
    seq_duration=$(grep "Duration:" "$RESULTS_DIR/sequential-${TIMESTAMP}-results.txt" 2>/dev/null | grep -o "[0-9]*" || echo "0")
    local_duration=$(grep "Duration:" "$RESULTS_DIR/distributed-local-${TIMESTAMP}-results.txt" 2>/dev/null | grep -o "[0-9]*" || echo "0")
    argo_duration=$(grep "Duration:" "$RESULTS_DIR/distributed-argo-${TIMESTAMP}-results.txt" 2>/dev/null | grep -o "[0-9]*" || echo "0")

    if [ "$seq_duration" -gt 0 ] && [ "$local_duration" -gt 0 ]; then
        speedup=$(echo "scale=2; $seq_duration / $local_duration" | bc)
        echo "Distributed Local vs Sequential: ${speedup}x faster"
    fi

    if [ "$seq_duration" -gt 0 ] && [ "$argo_duration" -gt 0 ]; then
        speedup=$(echo "scale=2; $seq_duration / $argo_duration" | bc)
        echo "Distributed Argo vs Sequential: ${speedup}x faster"
    fi

    echo ""
    echo "========================================================================"
    echo ""
    echo "All logs and results saved to: $RESULTS_DIR"

} | tee "$REPORT_FILE"

echo ""
echo -e "${GREEN}✓ Performance comparison complete!${NC}"
echo -e "${BLUE}Report saved to: $REPORT_FILE${NC}"
echo ""
