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
    echo "  -e <endpoint>     The classified route to analyze (e.g., '/v1/tables')"
    echo "  -r                Show raw metrics data"
    echo ""
    echo "List Mode Options:"
    echo "  -l                List all endpoints with metrics"
    echo "  -t <top_n>        Show only top N endpoints (default: all)"
    echo "  -o <sort_by>      Sort by: count, time, or name (default: count)"
    echo ""
    echo "Examples:"
    echo "  # Analyze the table route"
    echo "  $0 -e '/v1/tables'"
    echo "  $0 -e '/v1/users' -h 'myserver.com' -p 9090 -r"
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

# Decode the route label once and keep the method with each sample.
SAMPLES=$(awk '
    function label(name, pattern, value) {
        pattern = "[{,][[:space:]]*" name "=\"[^\"]*\""
        if (match($0, pattern)) {
            value = substr($0, RSTART, RLENGTH)
            sub(/^[^=]*="/, "", value)
            return substr(value, 1, length(value) - 1)
        }
        return ""
    }

    /^request_(latency|operations|percentage)_[^{]*[{]/ {
        route = label("http_route")
        if (route == "") route = label("exported_endpoint")
        if (route == "") route = label("endpoint")
        if (route == "") next

        name = substr($0, 1, index($0, "{") - 1)
        method = label("method")
        bucket = label("le")
        data = $0
        sub(/^.*}[[:space:]]+/, "", data)
        split(data, sample, /[[:space:]]+/)
        print name, route, (method == "" ? "-" : method), (bucket == "" ? "-" : bucket), sample[1], $0
    }
' OFS='\t' <<< "$METRICS")

show_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Host:${NC} $HOST"
    echo -e "${GREEN}Port:${NC} $PORT"
    echo -e "${GREEN}Protocol:${NC} $PROTOCOL"
    echo -e "${GREEN}Metrics URL:${NC} $METRICS_URL"
    echo
}

list_routes() {
    local route_rows sorted sort_field
    route_rows=$(awk -F '\t' '
        { key = $2 FS $3 }
        $1 == "request_latency_total_seconds_count" { counts[key] = $5 }
        $1 == "request_latency_total_seconds_sum" { totals[key] = $5 }
        $1 == "request_percentage_database" { database[key] = $5 }
        $1 == "request_percentage_search" { search[key] = $5 }
        $1 == "request_percentage_internal" { internal[key] = $5 }
        END {
            for (key in counts) {
                count = counts[key] + 0
                total = totals[key] + 0
                average = count > 0 ? total * 1000 / count : 0
                printf "%s\t%.0f\t%.3f\t%.1f\t%.1f\t%.1f\t%.1f\n",
                    key, count, total, average, database[key], search[key], internal[key]
            }
        }
    ' <<< "$SAMPLES")

    case "$SORT_BY" in
        count) sort_field=(-k3,3nr) ;;
        time) sort_field=(-k4,4nr) ;;
        name) sort_field=(-k1,1 -k2,2) ;;
    esac
    sorted=$(sort -t$'\t' "${sort_field[@]}" <<< "$route_rows")
    if [ "$TOP_N" -gt 0 ]; then
        sorted=$(head -n "$TOP_N" <<< "$sorted")
    fi

    show_header "OpenMetadata Endpoints with Metrics"
    printf "${GREEN}%-60s %-8s %10s %15s %12s %10s %10s %10s${NC}\n" \
        "Endpoint" "Method" "Requests" "Total Time(s)" "Avg(ms)" "DB%" "Search%" "Internal%"
    awk -F '\t' '
        NF {
            route = length($1) > 57 ? substr($1, 1, 54) "..." : $1
            printf "%-60s %-8s %10s %15s %12s %10s %10s %10s\n", route, $2, $3, $4, $5, $6, $7, $8
            requests += $3
            if (!($1 in routes)) route_count++
            routes[$1] = 1
        }
        END {
            printf "\nTotal Endpoints: %d\nTotal Requests: %.0f\n", route_count, requests
        }
    ' <<< "$sorted"
}

metric_value() {
    local samples=$1 name=$2
    awk -F '\t' -v name="$name" '$1 == name { print $5; exit }' <<< "$samples"
}

format_time() {
    local seconds=$1 count=${2:-1}
    awk -v seconds="$seconds" -v count="$count" 'BEGIN {
        if (seconds + 0 > 0 && count + 0 > 0) printf "%.3fms\n", seconds * 1000 / count
        else print "N/A"
    }'
}

get_percentile() {
    local samples=$1 percentile=$2
    awk -F '\t' -v percentile="$percentile" '
        $1 == "request_latency_total_seconds_bucket" { buckets[$4] = $5 }
        END {
            target = buckets["+Inf"] * percentile / 100
            for (bound in buckets) {
                if (target > 0 && bound != "+Inf" && buckets[bound] >= target &&
                    (result == "" || bound + 0 < result)) result = bound + 0
            }
            if (result != "") printf "%.3fms\n", result * 1000
            else print "N/A"
        }
    ' <<< "$samples"
}

show_operations() {
    local samples=$1 total_count=$2 title=$3 metric=$4
    local count sum percentage
    count=$(metric_value "$samples" "request_latency_${metric}_seconds_count")
    sum=$(metric_value "$samples" "request_latency_${metric}_seconds_sum")
    percentage=$(metric_value "$samples" "request_percentage_${metric}")
    echo -e "${YELLOW}$title${NC}"
    printf '  Total Operations: %.0f (across %.0f requests)\n' "${count:-0}" "$total_count"
    awk -v count="${count:-0}" -v requests="$total_count" 'BEGIN {
        printf "  Avg Operations/Request: %.1f\n", count / requests
    }'
    echo "  Avg Time/Operation: $(format_time "${sum:-0}" "${count:-0}")"
    echo "  Avg Time/Request: $(format_time "${sum:-0}" "$total_count")"
    echo "  Percentage of Request: ${percentage:-0}%"
}

show_time_distribution() {
    local samples=$1
    awk -F '\t' '
        function bar(title, percent, width, i) {
            width = percent < 100 ? int(percent / 2) : 50
            printf "%-12s", title
            for (i = 0; i < width; i++) printf "█"
            printf " %s%%\n", percent + 0
        }
        $1 == "request_percentage_database" { database = $5 }
        $1 == "request_percentage_search" { search = $5 }
        $1 == "request_percentage_internal" { internal = $5 }
        END {
            if (database != "" || search != "" || internal != "") {
                print "\nTime Distribution"
                bar("Database", database)
                bar("Search", search)
                bar("Internal", internal)
            }
        }
    ' <<< "$samples"
}

show_analysis() {
    local method=$1 samples total_count total_sum internal_sum internal_percentage
    samples=$(awk -F '\t' -v route="$ENDPOINT" -v method="$method" \
        '$2 == route && $3 == method' <<< "$SAMPLES")
    total_count=$(metric_value "$samples" "request_latency_total_seconds_count")
    total_sum=$(metric_value "$samples" "request_latency_total_seconds_sum")
    internal_sum=$(metric_value "$samples" "request_latency_internal_seconds_sum")
    internal_percentage=$(metric_value "$samples" "request_percentage_internal")

    echo -e "${GREEN}Endpoint:${NC} $ENDPOINT"
    echo -e "${GREEN}Method:${NC} $method"
    printf 'Total Requests: %.0f\n' "$total_count"
    echo "Total Time: $(format_time "${total_sum:-0}")"
    echo "Average Time: $(format_time "${total_sum:-0}" "$total_count")"
    echo "P50: $(get_percentile "$samples" 50)"
    echo "P95: $(get_percentile "$samples" 95)"
    echo "P99: $(get_percentile "$samples" 99)"
    echo
    show_operations "$samples" "$total_count" "Database Operations" "database"
    show_operations "$samples" "$total_count" "Search Operations" "search"
    echo -e "${YELLOW}Internal Processing${NC}"
    echo "  Avg Time/Request: $(format_time "${internal_sum:-0}" "$total_count")"
    echo "  Percentage of Request: ${internal_percentage:-0}%"
    show_time_distribution "$samples"

    if [ "$SHOW_RAW" = true ]; then
        echo -e "${GREEN}Raw Metrics${NC}"
        cut -f6- <<< "$samples" | sort
    fi
    echo
}

if [ "$LIST_MODE" = true ]; then
    list_routes
    exit 0
fi

methods=$(awk -F '\t' -v route="$ENDPOINT" \
    '$1 == "request_latency_total_seconds_count" && $2 == route && $5 + 0 > 0 { print $3 }' \
    <<< "$SAMPLES" | sort -u)
if [ -z "$methods" ]; then
    echo -e "${RED}No metrics found for endpoint: $ENDPOINT${NC}"
    echo "Available endpoints with metrics:"
    awk -F '\t' '$1 == "request_latency_total_seconds_count" { print $2 }' \
        <<< "$SAMPLES" | sort -u | head -20
    exit 1
fi

show_header "OpenMetadata Endpoint Metrics Analysis"
while IFS= read -r method; do
    show_analysis "$method"
done <<< "$methods"
