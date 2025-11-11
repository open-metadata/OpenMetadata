#!/usr/bin/env bash
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Script to analyze request latency metrics for a specific endpoint from OpenMetadata Prometheus metrics

# Default values
HOST="localhost"
PORT="8586"
ENDPOINT=""
SHOW_RAW=false
PROTOCOL="http"
LIST_MODE=false
SORT_BY="count"
TOP_N=0

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Modes:"
    echo "  Analyze mode: $0 -e <endpoint> [options]"
    echo "  List mode:    $0 -l [options]"
    echo ""
    echo "Common Options:"
    echo "  -h <host>         Prometheus host (default: localhost)"
    echo "  -p <port>         Prometheus port (default: 8586)"
    echo "  -s                Use HTTPS instead of HTTP"
    echo ""
    echo "Analyze Mode Options:"
    echo "  -e <endpoint>     The endpoint to analyze (e.g., 'v1/tables/123-456-789')"
    echo "  -r                Show raw metrics data"
    echo ""
    echo "List Mode Options:"
    echo "  -l                List all endpoints with metrics"
    echo "  -t <top_n>        Show only top N endpoints (default: all)"
    echo "  -o <sort_by>      Sort by: count, time, or name (default: count)"
    echo ""
    echo "Examples:"
    echo "  # Analyze specific endpoint"
    echo "  $0 -e 'v1/tables/0a4cd328-50c3-44c8-a7d2-ba71ba53bbe3'"
    echo "  $0 -e 'v1/users' -h 'myserver.com' -p 9090 -r"
    echo ""
    echo "  # List all endpoints"
    echo "  $0 -l"
    echo "  $0 -l -t 10                    # Top 10 by request count"
    echo "  $0 -l -o time -t 5             # Top 5 by total time"
    exit 1
}

# Parse command line arguments
while getopts "e:h:p:srlt:o:" opt; do
    case $opt in
        e)
            ENDPOINT="$OPTARG"
            ;;
        h)
            HOST="$OPTARG"
            ;;
        p)
            PORT="$OPTARG"
            ;;
        s)
            PROTOCOL="https"
            ;;
        r)
            SHOW_RAW=true
            ;;
        l)
            LIST_MODE=true
            ;;
        t)
            TOP_N="$OPTARG"
            ;;
        o)
            SORT_BY="$OPTARG"
            if [[ ! "$SORT_BY" =~ ^(count|time|name)$ ]]; then
                echo -e "${RED}Error: Invalid sort option. Must be: count, time, or name${NC}"
                usage
            fi
            ;;
        *)
            usage
            ;;
    esac
done

# Validate mode selection
if [ "$LIST_MODE" = true ] && [ -n "$ENDPOINT" ]; then
    echo -e "${RED}Error: Cannot use both -l and -e options together${NC}"
    usage
fi

if [ "$LIST_MODE" = false ] && [ -z "$ENDPOINT" ]; then
    echo -e "${RED}Error: Either -e <endpoint> or -l must be specified${NC}"
    usage
fi

# Construct metrics URL
METRICS_URL="${PROTOCOL}://${HOST}:${PORT}/prometheus"

# Fetch metrics
echo -e "${YELLOW}Fetching metrics...${NC}"
METRICS=$(curl -s "$METRICS_URL")

if [ -z "$METRICS" ]; then
    echo -e "${RED}Error: Failed to fetch metrics from $METRICS_URL${NC}"
    exit 1
fi

# Branch based on mode
if [ "$LIST_MODE" = true ]; then
    # List mode
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}OpenMetadata Endpoints with Metrics${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Host:${NC} $HOST"
    echo -e "${GREEN}Port:${NC} $PORT"
    echo -e "${GREEN}Protocol:${NC} $PROTOCOL"
    echo -e "${GREEN}Metrics URL:${NC} $METRICS_URL"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    echo -e "${YELLOW}Processing endpoint data...${NC}"
    echo ""
    
    # Create temporary file for processing
    TEMP_FILE=$(mktemp)
    
    # Extract endpoint data
    echo "$METRICS" | grep -E "^request_latency_total_seconds_count" | while read -r line; do
        endpoint=$(echo "$line" | sed -n 's/.*endpoint="\([^"]*\)".*/\1/p')
        count=$(echo "$line" | awk '{print $NF}')
        
        # Get total time for this endpoint
        total_time=$(echo "$METRICS" | grep -E "^request_latency_total_seconds_sum.*endpoint=\"${endpoint}\"" | head -1 | awk '{print $NF}')
        
        # Get percentages
        db_pct=$(echo "$METRICS" | grep -E "^request_percentage_database.*endpoint=\"${endpoint}\"" | head -1 | awk '{print $NF}')
        search_pct=$(echo "$METRICS" | grep -E "^request_percentage_search.*endpoint=\"${endpoint}\"" | head -1 | awk '{print $NF}')
        internal_pct=$(echo "$METRICS" | grep -E "^request_percentage_internal.*endpoint=\"${endpoint}\"" | head -1 | awk '{print $NF}')
        
        # Calculate average time in ms
        if [ -n "$total_time" ] && [ -n "$count" ] && [ "$count" != "0" ]; then
            avg_time=$(echo "scale=3; $total_time * 1000 / $count" | bc)
        else
            avg_time="0"
        fi
        
        # Format percentages
        db_pct=${db_pct:-0}
        search_pct=${search_pct:-0}
        internal_pct=${internal_pct:-0}
        
        # Output in tab-separated format
        echo -e "$endpoint\t$count\t$total_time\t$avg_time\t$db_pct\t$search_pct\t$internal_pct"
    done > "$TEMP_FILE"
    
    # Sort based on option
    case "$SORT_BY" in
        count)
            SORTED=$(sort -t$'\t' -k2 -nr "$TEMP_FILE")
            ;;
        time)
            SORTED=$(sort -t$'\t' -k3 -nr "$TEMP_FILE")
            ;;
        name)
            SORTED=$(sort -t$'\t' -k1 "$TEMP_FILE")
            ;;
    esac
    
    # Apply top N filter if specified
    if [ "$TOP_N" -gt 0 ]; then
        SORTED=$(echo "$SORTED" | head -n "$TOP_N")
    fi
    
    # Display header
    printf "${GREEN}%-60s %10s %15s %12s %10s %10s %10s${NC}\n" \
        "Endpoint" "Requests" "Total Time(s)" "Avg(ms)" "DB%" "Search%" "Internal%"
    echo -e "${BLUE}$(printf '%.0s─' {1..130})${NC}"
    
    # Display data
    echo "$SORTED" | while IFS=$'\t' read -r endpoint count total_time avg_time db_pct search_pct internal_pct; do
        # Truncate endpoint if too long
        if [ ${#endpoint} -gt 57 ]; then
            display_endpoint="${endpoint:0:54}..."
        else
            display_endpoint="$endpoint"
        fi
        
        # Format numbers
        total_time_fmt=$(printf "%.3f" "$total_time" 2>/dev/null || echo "0.000")
        avg_time_fmt=$(printf "%.1f" "$avg_time" 2>/dev/null || echo "0.0")
        db_pct_fmt=$(printf "%.1f" "$db_pct" 2>/dev/null || echo "0.0")
        search_pct_fmt=$(printf "%.1f" "$search_pct" 2>/dev/null || echo "0.0")
        internal_pct_fmt=$(printf "%.1f" "$internal_pct" 2>/dev/null || echo "0.0")
        
        printf "%-60s %10s %15s %12s %10s %10s %10s\n" \
            "$display_endpoint" "$count" "$total_time_fmt" "$avg_time_fmt" \
            "$db_pct_fmt" "$search_pct_fmt" "$internal_pct_fmt"
    done
    
    # Summary
    echo -e "${BLUE}$(printf '%.0s─' {1..130})${NC}"
    TOTAL_ENDPOINTS=$(echo "$SORTED" | wc -l | tr -d ' ')
    TOTAL_REQUESTS=$(echo "$SORTED" | awk -F$'\t' '{sum+=$2} END {print sum}')
    echo -e "${GREEN}Total Endpoints:${NC} $TOTAL_ENDPOINTS"
    echo -e "${GREEN}Total Requests:${NC} $TOTAL_REQUESTS"
    
    # Cleanup
    rm -f "$TEMP_FILE"
    
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
    exit 0
fi

# Analyze mode
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}OpenMetadata Endpoint Metrics Analysis${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Endpoint:${NC} $ENDPOINT"
echo -e "${GREEN}Host:${NC} $HOST"
echo -e "${GREEN}Port:${NC} $PORT"
echo -e "${GREEN}Protocol:${NC} $PROTOCOL"
echo -e "${GREEN}Metrics URL:${NC} $METRICS_URL"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Escape special characters in endpoint for regex
ENDPOINT_ESCAPED=$(echo "$ENDPOINT" | sed 's/[[\.*^$()+?{|]/\\&/g')

# Function to extract metric value
get_metric_value() {
    local metric_name=$1
    local metric_type=$2
    
    if [ "$metric_type" = "counter" ]; then
        # For counters, get the total count
        echo "$METRICS" | grep -E "^${metric_name}.*endpoint=\"${ENDPOINT_ESCAPED}\"[^}]*} " | grep -v "_total" | grep -v "_created" | head -1 | awk '{print $NF}'
    elif [ "$metric_type" = "histogram_count" ]; then
        # For histograms, get the count
        echo "$METRICS" | grep -E "^${metric_name}_count.*endpoint=\"${ENDPOINT_ESCAPED}\"" | head -1 | awk '{print $NF}'
    elif [ "$metric_type" = "histogram_sum" ]; then
        # For histograms, get the sum (total time)
        echo "$METRICS" | grep -E "^${metric_name}_sum.*endpoint=\"${ENDPOINT_ESCAPED}\"" | head -1 | awk '{print $NF}'
    elif [ "$metric_type" = "gauge" ]; then
        # For gauges, get the value
        echo "$METRICS" | grep -E "^${metric_name}.*endpoint=\"${ENDPOINT_ESCAPED}\"" | grep -v "#" | head -1 | awk '{print $NF}'
    fi
}

# Function to calculate mean from histogram
calculate_mean() {
    local sum=$1
    local count=$2
    if [ -n "$sum" ] && [ -n "$count" ] && [ "$count" != "0" ]; then
        echo "scale=6; $sum / $count" | bc
    else
        echo "0"
    fi
}

# Function to format time
format_time() {
    local seconds=$1
    if [ -z "$seconds" ] || [ "$seconds" = "0" ]; then
        echo "N/A"
    else
        local ms=$(echo "scale=3; $seconds * 1000" | bc)
        echo "${ms}ms"
    fi
}

# Function to get percentile from histogram
get_percentile() {
    local metric_name=$1
    local percentile=$2
    
    # Get all bucket values for this metric
    local buckets=$(echo "$METRICS" | grep -E "^${metric_name}_bucket.*endpoint=\"${ENDPOINT_ESCAPED}\"" | grep -v "#")
    
    if [ -z "$buckets" ]; then
        echo "N/A"
        return
    fi
    
    # Get total count
    local total_count=$(echo "$buckets" | grep 'le="+Inf"' | awk '{print $NF}')
    if [ -z "$total_count" ] || [ "$total_count" = "0" ]; then
        echo "N/A"
        return
    fi
    
    # Calculate target count for percentile
    local target_count=$(echo "scale=0; $total_count * $percentile / 100" | bc)
    
    # Find the bucket that contains the percentile
    local prev_le="0"
    echo "$buckets" | sort -t'=' -k3 -g | while IFS= read -r line; do
        local le=$(echo "$line" | sed -n 's/.*le="\([^"]*\)".*/\1/p')
        local count=$(echo "$line" | awk '{print $NF}')
        
        if [ "$le" != "+Inf" ] && [ "$(echo "$count >= $target_count" | bc)" -eq 1 ]; then
            format_time "$le"
            break
        fi
        prev_le="$le"
    done
}

# Collect metrics
echo -e "${YELLOW}Analyzing metrics for endpoint: ${NC}${ENDPOINT}"
echo ""

# Total request metrics
TOTAL_COUNT=$(get_metric_value "request_latency_total_seconds" "histogram_count")
TOTAL_SUM=$(get_metric_value "request_latency_total_seconds" "histogram_sum")
TOTAL_MEAN=$(calculate_mean "$TOTAL_SUM" "$TOTAL_COUNT")

# Database metrics
DB_COUNT=$(get_metric_value "request_latency_database_seconds" "histogram_count")
DB_SUM=$(get_metric_value "request_latency_database_seconds" "histogram_sum")
DB_MEAN=$(calculate_mean "$DB_SUM" "$DB_COUNT")
DB_OPERATIONS=$(get_metric_value "request_operations_database" "counter")
DB_PERCENTAGE=$(get_metric_value "request_percentage_database" "gauge")

# Search metrics
SEARCH_COUNT=$(get_metric_value "request_latency_search_seconds" "histogram_count")
SEARCH_SUM=$(get_metric_value "request_latency_search_seconds" "histogram_sum")
SEARCH_MEAN=$(calculate_mean "$SEARCH_SUM" "$SEARCH_COUNT")
SEARCH_OPERATIONS=$(get_metric_value "request_operations_search" "counter")
SEARCH_PERCENTAGE=$(get_metric_value "request_percentage_search" "gauge")

# Internal processing metrics
INTERNAL_COUNT=$(get_metric_value "request_latency_internal_seconds" "histogram_count")
INTERNAL_SUM=$(get_metric_value "request_latency_internal_seconds" "histogram_sum")
INTERNAL_MEAN=$(calculate_mean "$INTERNAL_SUM" "$INTERNAL_COUNT")
INTERNAL_PERCENTAGE=$(get_metric_value "request_percentage_internal" "gauge")

# Calculate average time per request (not per operation)
if [ -n "$TOTAL_COUNT" ] && [ "$TOTAL_COUNT" != "0" ]; then
    DB_TIME_PER_REQUEST=$(echo "scale=6; $DB_SUM / $TOTAL_COUNT" | bc)
    SEARCH_TIME_PER_REQUEST=$(echo "scale=6; $SEARCH_SUM / $TOTAL_COUNT" | bc)
    INTERNAL_TIME_PER_REQUEST=$(echo "scale=6; $INTERNAL_SUM / $TOTAL_COUNT" | bc)
else
    DB_TIME_PER_REQUEST="0"
    SEARCH_TIME_PER_REQUEST="0"
    INTERNAL_TIME_PER_REQUEST="0"
fi

# Check if we have any data
if [ -z "$TOTAL_COUNT" ] || [ "$TOTAL_COUNT" = "0" ]; then
    echo -e "${RED}No metrics found for endpoint: $ENDPOINT${NC}"
    echo ""
    echo "Available endpoints with metrics:"
    echo "$METRICS" | grep -E "request_latency_total.*endpoint=" | sed -n 's/.*endpoint="\([^"]*\)".*/\1/p' | sort | uniq | head -20
    exit 1
fi

# Display summary
echo -e "${GREEN}📊 REQUEST SUMMARY${NC}"
echo -e "├─ Total Requests: ${BLUE}${TOTAL_COUNT}${NC}"
echo -e "├─ Total Time: ${BLUE}$(format_time "$TOTAL_SUM")${NC}"
echo -e "└─ Average Time: ${BLUE}$(format_time "$TOTAL_MEAN")${NC}"
echo ""

# Display component breakdown
echo -e "${GREEN}⏱️  LATENCY BREAKDOWN${NC}"
echo -e "├─ ${YELLOW}Total Request Time:${NC}"
echo -e "│  ├─ Mean: ${BLUE}$(format_time "$TOTAL_MEAN")${NC}"
echo -e "│  ├─ P50: ${BLUE}$(get_percentile "request_latency_total_seconds" 50)${NC}"
echo -e "│  ├─ P95: ${BLUE}$(get_percentile "request_latency_total_seconds" 95)${NC}"
echo -e "│  └─ P99: ${BLUE}$(get_percentile "request_latency_total_seconds" 99)${NC}"
echo -e "│"
echo -e "├─ ${YELLOW}Database Operations:${NC}"
echo -e "│  ├─ Total Operations: ${BLUE}${DB_COUNT:-0}${NC} (across ${BLUE}${TOTAL_COUNT}${NC} requests)"
echo -e "│  ├─ Avg Operations/Request: ${BLUE}$(echo "scale=1; ${DB_COUNT:-0} / ${TOTAL_COUNT}" | bc)${NC}"
echo -e "│  ├─ Avg Time/Operation: ${BLUE}$(format_time "$DB_MEAN")${NC}"
echo -e "│  ├─ Avg Time/Request: ${BLUE}$(format_time "$DB_TIME_PER_REQUEST")${NC}"
echo -e "│  └─ Percentage of Request: ${BLUE}${DB_PERCENTAGE:-0}%${NC}"
echo -e "│"
echo -e "├─ ${YELLOW}Search Operations:${NC}"
echo -e "│  ├─ Total Operations: ${BLUE}${SEARCH_COUNT:-0}${NC} (across ${BLUE}${TOTAL_COUNT}${NC} requests)"
echo -e "│  ├─ Avg Operations/Request: ${BLUE}$(echo "scale=1; ${SEARCH_COUNT:-0} / ${TOTAL_COUNT}" | bc)${NC}"
echo -e "│  ├─ Avg Time/Operation: ${BLUE}$(format_time "$SEARCH_MEAN")${NC}"
echo -e "│  ├─ Avg Time/Request: ${BLUE}$(format_time "$SEARCH_TIME_PER_REQUEST")${NC}"
echo -e "│  └─ Percentage of Request: ${BLUE}${SEARCH_PERCENTAGE:-0}%${NC}"
echo -e "│"
echo -e "└─ ${YELLOW}Internal Processing:${NC}"
echo -e "   ├─ Avg Time/Request: ${BLUE}$(format_time "$INTERNAL_TIME_PER_REQUEST")${NC}"
echo -e "   └─ Percentage of Request: ${BLUE}${INTERNAL_PERCENTAGE:-0}%${NC}"
echo ""

# Calculate and display percentage summary
if [ -n "$DB_PERCENTAGE" ] || [ -n "$SEARCH_PERCENTAGE" ] || [ -n "$INTERNAL_PERCENTAGE" ]; then
    echo -e "${GREEN}📈 TIME DISTRIBUTION${NC}"
    
    # Create a simple bar chart
    DB_PCT=${DB_PERCENTAGE:-0}
    SEARCH_PCT=${SEARCH_PERCENTAGE:-0}
    INTERNAL_PCT=${INTERNAL_PERCENTAGE:-0}
    
    # Function to create bar
    create_bar() {
        local pct=$1
        local width=$(echo "scale=0; $pct / 2" | bc)
        printf '█%.0s' $(seq 1 $width)
    }
    
    echo -e "Database:  $(create_bar $DB_PCT) ${DB_PCT}%"
    echo -e "Search:    $(create_bar $SEARCH_PCT) ${SEARCH_PCT}%"
    echo -e "Internal:  $(create_bar $INTERNAL_PCT) ${INTERNAL_PCT}%"
    echo ""
fi

# Show raw metrics if requested
if [ "$SHOW_RAW" = true ]; then
    echo -e "${GREEN}📋 RAW METRICS${NC}"
    echo "$METRICS" | grep -E "(request_latency|request_percentage|request_operations).*endpoint=\"${ENDPOINT_ESCAPED}\"" | sort
    echo ""
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"