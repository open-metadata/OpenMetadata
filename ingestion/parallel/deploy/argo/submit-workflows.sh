#!/bin/bash
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE

# Script to submit OpenMetadata workflows using parallel execution

set -e

NAMESPACE=${NAMESPACE:-openmetadata}
TEMPLATE=${TEMPLATE:-om-parallel-ingestion}
REGISTRY=${REGISTRY:-localhost:5000}
VERSION=${VERSION:-latest}

function usage() {
    echo "Usage: $0 <workflow_type> [options]"
    echo ""
    echo "Workflow types:"
    echo "  metadata     - Database metadata ingestion"
    echo "  lineage      - Query lineage extraction"
    echo "  usage        - Query usage statistics"
    echo "  profiler     - Data profiling"
    echo "  data_quality - Data quality tests"
    echo "  dbt          - DBT metadata"
    echo ""
    echo "Options:"
    echo "  -n, --namespace <namespace>    Kubernetes namespace (default: openmetadata)"
    echo "  -t, --template <template>      Workflow template name (default: om-parallel-ingestion)"
    echo "  -w, --workers <count>          Number of Ray workers (default: 3)"
    echo "  -s, --service <name>           Service name (required for most workflows)"
    echo "  -c, --connection <json>        Service connection config (JSON)"
    echo "  --dry-run                      Print command without executing"
    echo ""
    echo "Examples:"
    echo "  # Metadata ingestion for PostgreSQL"
    echo "  $0 metadata -s postgres_prod -c '{\"type\":\"Postgres\",\"hostPort\":\"localhost:5432\"}'"
    echo ""
    echo "  # Lineage with time window sharding"
    echo "  $0 lineage -s bigquery_prod -w 5"
    echo ""
    echo "  # Profiler with more workers"
    echo "  $0 profiler -s mysql_prod -w 10"
    exit 1
}

# Parse arguments
WORKFLOW_TYPE=$1
shift

# Default values
WORKERS=3
DRY_RUN=false
SERVICE_NAME=""
CONNECTION_CONFIG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -t|--template)
            TEMPLATE="$2"
            shift 2
            ;;
        -w|--workers)
            WORKERS="$2"
            shift 2
            ;;
        -s|--service)
            SERVICE_NAME="$2"
            shift 2
            ;;
        -c|--connection)
            CONNECTION_CONFIG="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate workflow type
case $WORKFLOW_TYPE in
    metadata|lineage|usage|profiler|data_quality|dbt)
        ;;
    *)
        echo "Invalid workflow type: $WORKFLOW_TYPE"
        usage
        ;;
esac

# Get configuration from Python script
CONFIG_JSON=$(python3 ingestion/parallel/examples/all_workflows.py $WORKFLOW_TYPE 2>/dev/null | grep -A 1000 "^{" | grep -B 1000 "^}")

if [ -z "$CONFIG_JSON" ]; then
    echo "Failed to generate configuration for workflow: $WORKFLOW_TYPE"
    exit 1
fi

# Extract values from config
SOURCE_CLASS=$(echo "$CONFIG_JSON" | jq -r '.source_class')
PROCESSOR_CLASS=$(echo "$CONFIG_JSON" | jq -r '.processor_class')
SINK_CLASS=$(echo "$CONFIG_JSON" | jq -r '.sink_class')
ENABLE_REDUCE=$(echo "$CONFIG_JSON" | jq -r '.enable_reduce')

# Override service name if provided
if [ -n "$SERVICE_NAME" ]; then
    CONFIG_JSON=$(echo "$CONFIG_JSON" | jq --arg svc "$SERVICE_NAME" '.source_config.config.source_config.serviceName = $svc')
fi

# Override connection config if provided
if [ -n "$CONNECTION_CONFIG" ]; then
    CONFIG_JSON=$(echo "$CONFIG_JSON" | jq --argjson conn "$CONNECTION_CONFIG" '.source_config.config.source_config.serviceConnection.config = $conn')
fi

# Build final config parameter
FINAL_CONFIG=$(echo "$CONFIG_JSON" | jq -c '{
    source_config: .source_config.config,
    processor_config: .config.processor_config,
    sink_config: .config.sink_config
}')

# Prepare Argo command
ARGO_CMD="argo submit -n $NAMESPACE --from workflowtemplate/$TEMPLATE"
ARGO_CMD="$ARGO_CMD -p source_class='$SOURCE_CLASS'"
ARGO_CMD="$ARGO_CMD -p processor_class='$PROCESSOR_CLASS'"
ARGO_CMD="$ARGO_CMD -p sink_class='$SINK_CLASS'"
ARGO_CMD="$ARGO_CMD -p config='$FINAL_CONFIG'"
ARGO_CMD="$ARGO_CMD -p enable_reduce=$ENABLE_REDUCE"
ARGO_CMD="$ARGO_CMD -p workerReplicas=$WORKERS"
ARGO_CMD="$ARGO_CMD -p runner_image=$REGISTRY/om-ray-runner:$VERSION"
ARGO_CMD="$ARGO_CMD -p openmetadata_host=${OPENMETADATA_HOST:-http://openmetadata:8585}"

# Workflow-specific parameters
case $WORKFLOW_TYPE in
    profiler)
        ARGO_CMD="$ARGO_CMD -p worker_memory=4Gi"
        ARGO_CMD="$ARGO_CMD -p microbatch_size=500"
        ;;
    lineage|usage)
        ARGO_CMD="$ARGO_CMD -p enable_reduce=true"
        ;;
    metadata)
        ARGO_CMD="$ARGO_CMD -p microbatch_size=2000"
        ;;
esac

# Add workflow name
WORKFLOW_NAME="${WORKFLOW_TYPE}-$(date +%Y%m%d-%H%M%S)"
ARGO_CMD="$ARGO_CMD --name $WORKFLOW_NAME"

# Execute or print
if [ "$DRY_RUN" = true ]; then
    echo "Dry run mode - would execute:"
    echo ""
    echo "$ARGO_CMD"
    echo ""
    echo "Configuration:"
    echo "$FINAL_CONFIG" | jq .
else
    echo "Submitting $WORKFLOW_TYPE workflow..."
    echo ""
    eval "$ARGO_CMD"
    echo ""
    echo "Workflow submitted: $WORKFLOW_NAME"
    echo ""
    echo "Monitor with:"
    echo "  argo get -n $NAMESPACE $WORKFLOW_NAME"
    echo "  argo logs -n $NAMESPACE $WORKFLOW_NAME -f"
    echo ""
    echo "Or port-forward Argo UI:"
    echo "  kubectl -n argo port-forward deployment/argo-server 2746:2746"
fi