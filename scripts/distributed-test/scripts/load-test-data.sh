#!/bin/bash
# Load test data for distributed indexing testing
# Supports 30+ entity types including time-series data, lineage, and data quality
# Includes benchmarking, latency tracking, and cluster sizing recommendations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Default values (backward-compatible ~46k) ────────────────────────────────
SERVER_URL="https://mohitcorp.getcollate.io"
NUM_TABLES=20000
NUM_TOPICS=3000
NUM_DASHBOARDS=5000
NUM_CHARTS=10000
NUM_PIPELINES=3000
NUM_STORED_PROCEDURES=0
NUM_CONTAINERS=2000
NUM_SEARCH_INDEXES=1000
NUM_MLMODELS=2000
NUM_QUERIES=0
NUM_DASHBOARD_DATA_MODELS=0
NUM_TEST_SUITES=0
NUM_TEST_CASES=0
NUM_GLOSSARY_TERMS=5000
NUM_GLOSSARIES=50
NUM_TAGS=1000
NUM_CLASSIFICATIONS=20
NUM_USERS=0
NUM_TEAMS=0
NUM_DOMAINS=0
NUM_DATA_PRODUCTS=0
NUM_API_COLLECTIONS=0
NUM_API_ENDPOINTS=0
NUM_LINEAGE_EDGES=0
NUM_TEST_CASE_RESULTS=0
NUM_ENTITY_REPORT_DATA=0
NUM_WEB_ANALYTIC_VIEWS=0
NUM_WEB_ANALYTIC_ACTIVITY=0
NUM_RAW_COST_ANALYSIS=0
NUM_AGG_COST_ANALYSIS=0
NUM_WORKERS=20
SCALE_APPLIED=""
ONLY_ENTITIES=""
OUTPUT_PATH=""
AUTH_TOKEN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --scale)
            SCALE_APPLIED="$2"
            case $2 in
                xlarge)
                    NUM_TABLES=2500000; NUM_TOPICS=400000; NUM_DASHBOARDS=200000; NUM_CHARTS=400000
                    NUM_PIPELINES=100000; NUM_STORED_PROCEDURES=100000; NUM_CONTAINERS=75000
                    NUM_SEARCH_INDEXES=50000; NUM_MLMODELS=50000; NUM_QUERIES=100000
                    NUM_DASHBOARD_DATA_MODELS=50000; NUM_TEST_SUITES=1500; NUM_TEST_CASES=150000
                    NUM_GLOSSARY_TERMS=50000; NUM_GLOSSARIES=500; NUM_TAGS=10000; NUM_CLASSIFICATIONS=200
                    NUM_USERS=5000; NUM_TEAMS=500; NUM_DOMAINS=50; NUM_DATA_PRODUCTS=500
                    NUM_API_COLLECTIONS=500; NUM_API_ENDPOINTS=50000; NUM_LINEAGE_EDGES=200000
                    NUM_TEST_CASE_RESULTS=300000; NUM_ENTITY_REPORT_DATA=50000
                    NUM_WEB_ANALYTIC_VIEWS=100000; NUM_WEB_ANALYTIC_ACTIVITY=50000
                    NUM_RAW_COST_ANALYSIS=25000; NUM_AGG_COST_ANALYSIS=25000
                    ;;
                large)
                    NUM_TABLES=1000000; NUM_TOPICS=160000; NUM_DASHBOARDS=80000; NUM_CHARTS=160000
                    NUM_PIPELINES=40000; NUM_STORED_PROCEDURES=40000; NUM_CONTAINERS=30000
                    NUM_SEARCH_INDEXES=20000; NUM_MLMODELS=20000; NUM_QUERIES=40000
                    NUM_DASHBOARD_DATA_MODELS=20000; NUM_TEST_SUITES=600; NUM_TEST_CASES=60000
                    NUM_GLOSSARY_TERMS=20000; NUM_GLOSSARIES=200; NUM_TAGS=4000; NUM_CLASSIFICATIONS=80
                    NUM_USERS=2000; NUM_TEAMS=200; NUM_DOMAINS=20; NUM_DATA_PRODUCTS=200
                    NUM_API_COLLECTIONS=200; NUM_API_ENDPOINTS=20000; NUM_LINEAGE_EDGES=80000
                    NUM_TEST_CASE_RESULTS=120000; NUM_ENTITY_REPORT_DATA=20000
                    NUM_WEB_ANALYTIC_VIEWS=40000; NUM_WEB_ANALYTIC_ACTIVITY=20000
                    NUM_RAW_COST_ANALYSIS=10000; NUM_AGG_COST_ANALYSIS=10000
                    ;;
                medium)
                    NUM_TABLES=250000; NUM_TOPICS=40000; NUM_DASHBOARDS=20000; NUM_CHARTS=40000
                    NUM_PIPELINES=10000; NUM_STORED_PROCEDURES=10000; NUM_CONTAINERS=7500
                    NUM_SEARCH_INDEXES=5000; NUM_MLMODELS=5000; NUM_QUERIES=10000
                    NUM_DASHBOARD_DATA_MODELS=5000; NUM_TEST_SUITES=150; NUM_TEST_CASES=15000
                    NUM_GLOSSARY_TERMS=5000; NUM_GLOSSARIES=50; NUM_TAGS=1000; NUM_CLASSIFICATIONS=20
                    NUM_USERS=500; NUM_TEAMS=50; NUM_DOMAINS=5; NUM_DATA_PRODUCTS=50
                    NUM_API_COLLECTIONS=50; NUM_API_ENDPOINTS=5000; NUM_LINEAGE_EDGES=20000
                    NUM_TEST_CASE_RESULTS=30000; NUM_ENTITY_REPORT_DATA=5000
                    NUM_WEB_ANALYTIC_VIEWS=10000; NUM_WEB_ANALYTIC_ACTIVITY=5000
                    NUM_RAW_COST_ANALYSIS=2500; NUM_AGG_COST_ANALYSIS=2500
                    ;;
                small)
                    NUM_TABLES=25000; NUM_TOPICS=4000; NUM_DASHBOARDS=2000; NUM_CHARTS=4000
                    NUM_PIPELINES=1000; NUM_STORED_PROCEDURES=1000; NUM_CONTAINERS=750
                    NUM_SEARCH_INDEXES=500; NUM_MLMODELS=500; NUM_QUERIES=1000
                    NUM_DASHBOARD_DATA_MODELS=500; NUM_TEST_SUITES=15; NUM_TEST_CASES=1500
                    NUM_GLOSSARY_TERMS=500; NUM_GLOSSARIES=5; NUM_TAGS=100; NUM_CLASSIFICATIONS=2
                    NUM_USERS=50; NUM_TEAMS=5; NUM_DOMAINS=1; NUM_DATA_PRODUCTS=5
                    NUM_API_COLLECTIONS=5; NUM_API_ENDPOINTS=500; NUM_LINEAGE_EDGES=2000
                    NUM_TEST_CASE_RESULTS=3000; NUM_ENTITY_REPORT_DATA=500
                    NUM_WEB_ANALYTIC_VIEWS=1000; NUM_WEB_ANALYTIC_ACTIVITY=500
                    NUM_RAW_COST_ANALYSIS=250; NUM_AGG_COST_ANALYSIS=250
                    ;;
                *)
                    echo "Unknown scale: $2 (use small|medium|large|xlarge)"
                    exit 1
                    ;;
            esac
            shift 2
            ;;
        --tables) NUM_TABLES="$2"; shift 2 ;;
        --dashboards) NUM_DASHBOARDS="$2"; shift 2 ;;
        --charts) NUM_CHARTS="$2"; shift 2 ;;
        --pipelines) NUM_PIPELINES="$2"; shift 2 ;;
        --topics) NUM_TOPICS="$2"; shift 2 ;;
        --mlmodels) NUM_MLMODELS="$2"; shift 2 ;;
        --containers) NUM_CONTAINERS="$2"; shift 2 ;;
        --search-indexes) NUM_SEARCH_INDEXES="$2"; shift 2 ;;
        --stored-procedures) NUM_STORED_PROCEDURES="$2"; shift 2 ;;
        --queries) NUM_QUERIES="$2"; shift 2 ;;
        --data-models) NUM_DASHBOARD_DATA_MODELS="$2"; shift 2 ;;
        --test-suites) NUM_TEST_SUITES="$2"; shift 2 ;;
        --test-cases) NUM_TEST_CASES="$2"; shift 2 ;;
        --glossaries) NUM_GLOSSARIES="$2"; shift 2 ;;
        --glossary-terms) NUM_GLOSSARY_TERMS="$2"; shift 2 ;;
        --classifications) NUM_CLASSIFICATIONS="$2"; shift 2 ;;
        --tags) NUM_TAGS="$2"; shift 2 ;;
        --users) NUM_USERS="$2"; shift 2 ;;
        --teams) NUM_TEAMS="$2"; shift 2 ;;
        --domains) NUM_DOMAINS="$2"; shift 2 ;;
        --data-products) NUM_DATA_PRODUCTS="$2"; shift 2 ;;
        --api-collections) NUM_API_COLLECTIONS="$2"; shift 2 ;;
        --api-endpoints) NUM_API_ENDPOINTS="$2"; shift 2 ;;
        --lineage-edges) NUM_LINEAGE_EDGES="$2"; shift 2 ;;
        --test-case-results) NUM_TEST_CASE_RESULTS="$2"; shift 2 ;;
        --entity-report-data) NUM_ENTITY_REPORT_DATA="$2"; shift 2 ;;
        --web-analytic-views) NUM_WEB_ANALYTIC_VIEWS="$2"; shift 2 ;;
        --web-analytic-activity) NUM_WEB_ANALYTIC_ACTIVITY="$2"; shift 2 ;;
        --raw-cost-analysis) NUM_RAW_COST_ANALYSIS="$2"; shift 2 ;;
        --aggregated-cost-analysis) NUM_AGG_COST_ANALYSIS="$2"; shift 2 ;;
        --workers) NUM_WORKERS="$2"; shift 2 ;;
        --only) ONLY_ENTITIES="$2"; shift 2 ;;
        --output) OUTPUT_PATH="$2"; shift 2 ;;
        --token) AUTH_TOKEN="$2"; shift 2 ;;
        --databases) shift 2 ;;  # ignored, auto-calculated now
        --terms-per-glossary) shift 2 ;;  # ignored, use --glossary-terms
        --tags-per-classification) shift 2 ;;  # ignored, use --tags
        --server) SERVER_URL="$2"; shift 2 ;;
        --quick)
            SCALE_APPLIED="quick"
            NUM_TABLES=3000; NUM_DASHBOARDS=1000; NUM_CHARTS=2000; NUM_PIPELINES=500
            NUM_TOPICS=500; NUM_MLMODELS=300; NUM_CONTAINERS=300; NUM_SEARCH_INDEXES=200
            NUM_STORED_PROCEDURES=200; NUM_QUERIES=200; NUM_DASHBOARD_DATA_MODELS=100
            NUM_TEST_SUITES=5; NUM_TEST_CASES=500; NUM_GLOSSARY_TERMS=500; NUM_GLOSSARIES=10
            NUM_TAGS=100; NUM_CLASSIFICATIONS=5; NUM_USERS=20; NUM_TEAMS=3; NUM_DOMAINS=1
            NUM_DATA_PRODUCTS=3; NUM_API_COLLECTIONS=3; NUM_API_ENDPOINTS=100
            NUM_LINEAGE_EDGES=500; NUM_TEST_CASE_RESULTS=1000; NUM_ENTITY_REPORT_DATA=100
            NUM_WEB_ANALYTIC_VIEWS=200; NUM_WEB_ANALYTIC_ACTIVITY=100
            NUM_RAW_COST_ANALYSIS=50; NUM_AGG_COST_ANALYSIS=50
            shift
            ;;
        -h|--help)
            cat << 'HELPEOF'
Usage: load-test-data.sh [OPTIONS]

Scale presets:
  --scale {small|medium|large|xlarge}   Apply a preset (see table below)
  --quick                               Quick mode (~10k entities)

Individual entity counts override any preset:
  --tables NUM                  --dashboards NUM            --charts NUM
  --pipelines NUM               --topics NUM                --mlmodels NUM
  --containers NUM              --search-indexes NUM        --stored-procedures NUM
  --queries NUM                 --data-models NUM           --test-suites NUM
  --test-cases NUM              --glossaries NUM            --glossary-terms NUM
  --classifications NUM         --tags NUM                  --users NUM
  --teams NUM                   --domains NUM               --data-products NUM
  --api-collections NUM         --api-endpoints NUM         --lineage-edges NUM

Time-series entity counts:
  --test-case-results NUM       --entity-report-data NUM
  --web-analytic-views NUM      --web-analytic-activity NUM
  --raw-cost-analysis NUM       --aggregated-cost-analysis NUM

Benchmarking & filtering:
  --only ENTITIES               Comma-separated entity types to create (e.g. tables,charts,topics)
                                When specified, only listed entities run. Prerequisites auto-enabled.
                                Valid names: tables, topics, dashboards, charts, pipelines,
                                  storedProcedures, containers, searchIndexes, mlmodels, queries,
                                  dashboardDataModels, testSuites, testCases, glossaries,
                                  glossaryTerms, users, teams, domains, dataProducts,
                                  apiCollections, apiEndpoints, lineageEdges, testCaseResults,
                                  entityReportData, webAnalyticViews, webAnalyticActivity,
                                  rawCostAnalysis, aggCostAnalysis
  --output PATH                 Write JSON benchmark report to PATH
                                (default: benchmark-report-{timestamp}.json in current dir)
  --token TOKEN                 Auth token (overrides hardcoded default)

Other:
  --server URL                  Target server URL (default: https://mohitcorp.getcollate.io)
  --workers NUM                 Concurrent workers (default: 20)
  -h, --help                    Show this help message

Scale preset totals:
  xlarge  ~5M    large  ~2M    medium  ~500K    small  ~50K

Examples:
  # Quick benchmark with just tables
  ./load-test-data.sh --only tables --tables 100 --workers 5

  # Full benchmark with JSON output
  ./load-test-data.sh --quick --workers 10 --output /tmp/bench.json

  # Only tables and charts, custom counts
  ./load-test-data.sh --only tables,charts --tables 5000 --charts 2000
HELPEOF
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Calculate total
TOTAL=$((NUM_TABLES + NUM_TOPICS + NUM_DASHBOARDS + NUM_CHARTS + NUM_PIPELINES + \
    NUM_STORED_PROCEDURES + NUM_CONTAINERS + NUM_SEARCH_INDEXES + NUM_MLMODELS + \
    NUM_QUERIES + NUM_DASHBOARD_DATA_MODELS + NUM_TEST_SUITES + NUM_TEST_CASES + \
    NUM_GLOSSARY_TERMS + NUM_GLOSSARIES + NUM_TAGS + NUM_CLASSIFICATIONS + \
    NUM_USERS + NUM_TEAMS + NUM_DOMAINS + NUM_DATA_PRODUCTS + \
    NUM_API_COLLECTIONS + NUM_API_ENDPOINTS + NUM_LINEAGE_EDGES + \
    NUM_TEST_CASE_RESULTS + NUM_ENTITY_REPORT_DATA + \
    NUM_WEB_ANALYTIC_VIEWS + NUM_WEB_ANALYTIC_ACTIVITY + \
    NUM_RAW_COST_ANALYSIS + NUM_AGG_COST_ANALYSIS))

echo "======================================"
echo "Loading Test Data for Distributed Indexing"
echo "======================================"
echo "Server: $SERVER_URL"
if [ -n "$SCALE_APPLIED" ]; then
    echo "Scale:  $SCALE_APPLIED"
fi
echo "Workers: $NUM_WORKERS"
if [ -n "$ONLY_ENTITIES" ]; then
    echo "Only:   $ONLY_ENTITIES"
fi
echo ""
echo "Entity counts:"
printf "  %-26s %s\n" "Tables:" "$NUM_TABLES"
printf "  %-26s %s\n" "Topics:" "$NUM_TOPICS"
printf "  %-26s %s\n" "Dashboards:" "$NUM_DASHBOARDS"
printf "  %-26s %s\n" "Charts:" "$NUM_CHARTS"
printf "  %-26s %s\n" "Pipelines:" "$NUM_PIPELINES"
printf "  %-26s %s\n" "Stored Procedures:" "$NUM_STORED_PROCEDURES"
printf "  %-26s %s\n" "Containers:" "$NUM_CONTAINERS"
printf "  %-26s %s\n" "Search Indexes:" "$NUM_SEARCH_INDEXES"
printf "  %-26s %s\n" "ML Models:" "$NUM_MLMODELS"
printf "  %-26s %s\n" "Queries:" "$NUM_QUERIES"
printf "  %-26s %s\n" "Dashboard Data Models:" "$NUM_DASHBOARD_DATA_MODELS"
printf "  %-26s %s\n" "Test Suites:" "$NUM_TEST_SUITES"
printf "  %-26s %s\n" "Test Cases:" "$NUM_TEST_CASES"
printf "  %-26s %s\n" "Glossaries:" "$NUM_GLOSSARIES"
printf "  %-26s %s\n" "Glossary Terms:" "$NUM_GLOSSARY_TERMS"
printf "  %-26s %s\n" "Classifications:" "$NUM_CLASSIFICATIONS"
printf "  %-26s %s\n" "Tags:" "$NUM_TAGS"
printf "  %-26s %s\n" "Users:" "$NUM_USERS"
printf "  %-26s %s\n" "Teams:" "$NUM_TEAMS"
printf "  %-26s %s\n" "Domains:" "$NUM_DOMAINS"
printf "  %-26s %s\n" "Data Products:" "$NUM_DATA_PRODUCTS"
printf "  %-26s %s\n" "API Collections:" "$NUM_API_COLLECTIONS"
printf "  %-26s %s\n" "API Endpoints:" "$NUM_API_ENDPOINTS"
printf "  %-26s %s\n" "Lineage Edges:" "$NUM_LINEAGE_EDGES"
printf "  %-26s %s\n" "Test Case Results (TS):" "$NUM_TEST_CASE_RESULTS"
printf "  %-26s %s\n" "Entity Report Data (TS):" "$NUM_ENTITY_REPORT_DATA"
printf "  %-26s %s\n" "Web Analytic Views (TS):" "$NUM_WEB_ANALYTIC_VIEWS"
printf "  %-26s %s\n" "Web Analytic Activity (TS):" "$NUM_WEB_ANALYTIC_ACTIVITY"
printf "  %-26s %s\n" "Raw Cost Analysis (TS):" "$NUM_RAW_COST_ANALYSIS"
printf "  %-26s %s\n" "Agg Cost Analysis (TS):" "$NUM_AGG_COST_ANALYSIS"
echo "  --------------------------"
printf "  %-26s %s\n" "Total:" "$TOTAL"
echo ""

python3 << PYEOF
import urllib.request
import urllib.error
import json
import sys
import time
import random
import uuid
import threading
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

SERVER_URL = "${SERVER_URL}"
NUM_WORKERS = ${NUM_WORKERS}

# ── Entity counts ────────────────────────────────────────────────────────────
NUM_TABLES = ${NUM_TABLES}
NUM_TOPICS = ${NUM_TOPICS}
NUM_DASHBOARDS = ${NUM_DASHBOARDS}
NUM_CHARTS = ${NUM_CHARTS}
NUM_PIPELINES = ${NUM_PIPELINES}
NUM_STORED_PROCEDURES = ${NUM_STORED_PROCEDURES}
NUM_CONTAINERS = ${NUM_CONTAINERS}
NUM_SEARCH_INDEXES = ${NUM_SEARCH_INDEXES}
NUM_MLMODELS = ${NUM_MLMODELS}
NUM_QUERIES = ${NUM_QUERIES}
NUM_DASHBOARD_DATA_MODELS = ${NUM_DASHBOARD_DATA_MODELS}
NUM_TEST_SUITES = ${NUM_TEST_SUITES}
NUM_TEST_CASES = ${NUM_TEST_CASES}
NUM_GLOSSARY_TERMS = ${NUM_GLOSSARY_TERMS}
NUM_GLOSSARIES = ${NUM_GLOSSARIES}
NUM_TAGS = ${NUM_TAGS}
NUM_CLASSIFICATIONS = ${NUM_CLASSIFICATIONS}
NUM_USERS = ${NUM_USERS}
NUM_TEAMS = ${NUM_TEAMS}
NUM_DOMAINS = ${NUM_DOMAINS}
NUM_DATA_PRODUCTS = ${NUM_DATA_PRODUCTS}
NUM_API_COLLECTIONS = ${NUM_API_COLLECTIONS}
NUM_API_ENDPOINTS = ${NUM_API_ENDPOINTS}
NUM_LINEAGE_EDGES = ${NUM_LINEAGE_EDGES}
NUM_TEST_CASE_RESULTS = ${NUM_TEST_CASE_RESULTS}
NUM_ENTITY_REPORT_DATA = ${NUM_ENTITY_REPORT_DATA}
NUM_WEB_ANALYTIC_VIEWS = ${NUM_WEB_ANALYTIC_VIEWS}
NUM_WEB_ANALYTIC_ACTIVITY = ${NUM_WEB_ANALYTIC_ACTIVITY}
NUM_RAW_COST_ANALYSIS = ${NUM_RAW_COST_ANALYSIS}
NUM_AGG_COST_ANALYSIS = ${NUM_AGG_COST_ANALYSIS}

ONLY_ENTITIES_RAW = "${ONLY_ENTITIES}"
OUTPUT_PATH_RAW = "${OUTPUT_PATH}"
AUTH_TOKEN_RAW = "${AUTH_TOKEN}"
SCALE_APPLIED = "${SCALE_APPLIED}" or "default"

# Auto-calculate database/schema counts
NUM_DATABASES = max(1, NUM_TABLES // 50000)
SCHEMAS_PER_DB = min(20, max(1, NUM_TABLES // (NUM_DATABASES * 5000))) if NUM_TABLES > 0 else 1

# ── Entity filter (--only) ───────────────────────────────────────────────────
ONLY_ENTITIES = set()
if ONLY_ENTITIES_RAW.strip():
    ONLY_ENTITIES = {e.strip() for e in ONLY_ENTITIES_RAW.split(",") if e.strip()}

ENTITY_PREREQUISITES = {
    "tables": {"_services_db", "_infra_db"},
    "storedProcedures": {"_services_db", "_infra_db"},
    "queries": {"_services_db"},
    "dashboards": {"_services_dashboard"},
    "charts": {"_services_dashboard"},
    "dashboardDataModels": {"_services_dashboard"},
    "topics": {"_services_messaging"},
    "pipelines": {"_services_pipeline"},
    "mlmodels": {"_services_mlmodel"},
    "containers": {"_services_storage"},
    "searchIndexes": {"_services_search"},
    "apiCollections": {"_services_api"},
    "apiEndpoints": {"_services_api", "apiCollections"},
    "dataProducts": {"domains"},
    "glossaryTerms": {"glossaries"},
    "tags": {"classifications"},
    "testCases": {"tables", "_services_db", "_infra_db"},
    "testCaseResults": {"testCases", "tables", "_services_db", "_infra_db"},
    "lineageEdges": {"tables", "_services_db", "_infra_db"},
}

def _resolve_prerequisites(entities):
    resolved = set(entities)
    changed = True
    while changed:
        changed = False
        for e in list(resolved):
            for prereq in ENTITY_PREREQUISITES.get(e, set()):
                if prereq not in resolved:
                    resolved.add(prereq)
                    changed = True
    return resolved

if ONLY_ENTITIES:
    _resolved = _resolve_prerequisites(ONLY_ENTITIES)
    _infra_needed = {p for p in _resolved if p.startswith("_")}
    _resolved -= _infra_needed
else:
    _resolved = set()
    _infra_needed = set()

def should_run(entity_name):
    if not ONLY_ENTITIES:
        return True
    return entity_name in ONLY_ENTITIES or entity_name in _resolved

def _need_infra(tag):
    if not ONLY_ENTITIES:
        return True
    return tag in _infra_needed

print(f"Connecting to {SERVER_URL}...")
sys.stdout.flush()

# ── HTTP helper with retry ───────────────────────────────────────────────────
def make_request(url, data=None, method="GET", headers=None, retries=3):
    if headers is None:
        headers = {}
    headers["Content-Type"] = "application/json"
    encoded = json.dumps(data).encode("utf-8") if data else None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=encoded, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = resp.read().decode("utf-8")
                try:
                    parsed = json.loads(body) if body.strip() else {}
                except json.JSONDecodeError:
                    parsed = body
                return resp.status, parsed
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8")
            except Exception:
                body = str(e)
            if e.code >= 500 and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            return e.code, body
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            return 0, str(e)
    return 0, "max retries exceeded"

# ── Auth token ───────────────────────────────────────────────────────────────
if AUTH_TOKEN_RAW.strip():
    token = AUTH_TOKEN_RAW.strip()
    print("Using token from --token argument.")
else:
    token = ("eyJraWQiOiJmNzhjZmQ2NzkxOGQ0ZTVhYWM3NWEwOTAyOWNhMDlhMCIsImFsZyI6IlJTMjU2IiwidHlwIjoiSldUIn0.eyJpc3MiOiJnZXRjb2xsYXRlLmlvIiwic3ViIjoibW9oaXQiLCJyb2xlcyI6WyJBZG1pbiJdLCJlbWFpbCI6Im1vaGl0QGdldGNvbGxhdGUuaW8iLCJpc0JvdCI6ZmFsc2UsInRva2VuVHlwZSI6IlBFUlNPTkFMX0FDQ0VTUyIsInVzZXJuYW1lIjoibW9oaXQiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJtb2hpdCIsImlhdCI6MTc3MjQ0Mzc2MCwiZXhwIjoxNzgwMjE5NzYwfQ.JOe92j3295uVfipWMKl_Nv9gXbXTGHJRVyTJlYZ72iEq_NYdI-rXvmqG14ZYB6xRY3ktgPYzbHoOBQQDo4R6eNs7a71unRD0Di6PPUlTvubBP-65y6HiHgB-yoVJFFMxTjW_Mvh5DZvHGQDdNiBZMZ_bUiWh-b5tcQi1EgO47RN8riuYhYZcmTMHDFRAhhToGd57fUAsFkAQBaiB4xWW0O3LssXnA6T14pvt3CVrtBlrXUy_Tu_9Ju4D3s32iKFffYCKbqKgTCjU6vjF_dMVTezYDFYYpPZO0EFGl33lEn80hPuMQk9gYoWeK_4I_wxB19vAUvaEJPLBem0HEQSaQw")
    print("Using default admin JWT token for authentication.")

headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}

# ── Output path ──────────────────────────────────────────────────────────────
if OUTPUT_PATH_RAW.strip():
    output_path = OUTPUT_PATH_RAW.strip()
else:
    ts_str = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = f"benchmark-report-{ts_str}.json"

# ══════════════════════════════════════════════════════════════════════════════
# BENCHMARK INFRASTRUCTURE
# ══════════════════════════════════════════════════════════════════════════════

class BenchmarkCollector:
    def __init__(self, entity_name, requested_count):
        self.entity_name = entity_name
        self.requested = requested_count
        self.latencies = []
        self.errors = []
        self.created = 0
        self.failed = 0
        self.start_time = None
        self.end_time = None
        self.lock = threading.Lock()
        self.window_counts = []

    def record_success(self, latency_s):
        with self.lock:
            self.latencies.append(latency_s)
            self.created += 1

    def record_failure(self, latency_s, status, error):
        with self.lock:
            self.latencies.append(latency_s)
            self.failed += 1
            if len(self.errors) < 50:
                self.errors.append({"status": status, "error": str(error)[:200]})

    def percentile(self, p):
        if not self.latencies:
            return 0
        s = sorted(self.latencies)
        k = int(len(s) * p / 100)
        return s[min(k, len(s) - 1)]

    def _throughput_windows(self):
        if not self.window_counts or len(self.window_counts) < 2:
            return []
        buckets = []
        bucket_size = 5
        start_ts = self.window_counts[0][0]
        i = 0
        while i < len(self.window_counts):
            bucket_start = start_ts + len(buckets) * bucket_size
            bucket_end = bucket_start + bucket_size
            count_at_start = self.window_counts[i][1] if i == 0 else None
            count_at_end = None
            for j in range(i, len(self.window_counts)):
                if self.window_counts[j][0] >= bucket_end:
                    break
                count_at_end = self.window_counts[j][1]
                if count_at_start is None:
                    count_at_start = self.window_counts[j][1]
                i = j + 1
            if count_at_start is not None and count_at_end is not None:
                delta = count_at_end - count_at_start
                rps = delta / bucket_size if bucket_size > 0 else 0
                buckets.append({
                    "elapsed_s": round(bucket_end - start_ts, 1),
                    "rps": round(rps, 1),
                })
            else:
                i += 1
        return buckets

    def summary(self):
        n = len(self.latencies)
        if n == 0:
            return None
        elapsed = (self.end_time or time.time()) - self.start_time if self.start_time else 0
        s = sorted(self.latencies)
        return {
            "requested": self.requested,
            "total_requests": n,
            "created": self.created,
            "failed": self.failed,
            "error_rate_pct": round(self.failed / n * 100, 2) if n > 0 else 0,
            "wall_clock_s": round(elapsed, 2),
            "throughput_rps": round(n / elapsed, 2) if elapsed > 0 else 0,
            "latency_ms": {
                "min": round(s[0] * 1000, 1),
                "p50": round(self.percentile(50) * 1000, 1),
                "p75": round(self.percentile(75) * 1000, 1),
                "p90": round(self.percentile(90) * 1000, 1),
                "p95": round(self.percentile(95) * 1000, 1),
                "p99": round(self.percentile(99) * 1000, 1),
                "max": round(s[-1] * 1000, 1),
                "avg": round(sum(s) / len(s) * 1000, 1),
            },
            "throughput_over_time": self._throughput_windows(),
            "errors_sample": self.errors[:10],
        }


class HealthMonitor:
    def __init__(self, server_url, req_headers, interval=5):
        self.server_url = server_url
        self.req_headers = req_headers
        self.interval = interval
        self.samples = []
        self.running = True
        self.start_time = time.time()
        self._thread = threading.Thread(target=self._poll, daemon=True)
        self._thread.start()

    def _poll(self):
        while self.running:
            t0 = time.time()
            try:
                status, _ = make_request(
                    f"{self.server_url}/api/v1/system/version",
                    method="GET", headers=self.req_headers, retries=1,
                )
            except Exception:
                status = 0
            latency = (time.time() - t0) * 1000
            self.samples.append({
                "timestamp": time.time(),
                "elapsed_s": round(time.time() - self.start_time, 1),
                "latency_ms": round(latency, 1),
                "status": status,
                "healthy": status == 200,
            })
            time.sleep(self.interval)

    def stop(self):
        self.running = False
        self._thread.join(timeout=self.interval + 2)

    def summary(self):
        if not self.samples:
            return {
                "total_checks": 0, "healthy": 0, "unhealthy": 0,
                "health_latency_ms": {}, "timeline": [],
            }
        healthy = [s for s in self.samples if s["healthy"]]
        unhealthy = [s for s in self.samples if not s["healthy"]]
        latencies = sorted([s["latency_ms"] for s in self.samples])
        n = len(latencies)
        return {
            "total_checks": n,
            "healthy": len(healthy),
            "unhealthy": len(unhealthy),
            "health_latency_ms": {
                "min": round(latencies[0], 1),
                "avg": round(sum(latencies) / n, 1),
                "p95": round(latencies[min(int(n * 0.95), n - 1)], 1),
                "max": round(latencies[-1], 1),
            },
            "timeline": self.samples,
        }


# ── Start health monitor ────────────────────────────────────────────────────
health_monitor = HealthMonitor(SERVER_URL, dict(headers), interval=5)

overall_start = time.time()
stats = {}
benchmarks = {}
phase_timings = {}

# ── Collected IDs for linking phases ─────────────────────────────────────────
collected_table_ids = []
collected_dashboard_ids = []
collected_pipeline_ids = []
collected_test_case_fqns = []
collect_lock = threading.Lock()

MAX_COLLECT = max(NUM_LINEAGE_EDGES * 2, NUM_TEST_CASE_RESULTS, 10000)

# ── Generic batch creator (with benchmarking) ───────────────────────────────
def create_entity_batch(entity_name, count, payload_fn, workers=None, collect_fn=None,
                        log_interval=None):
    if count <= 0:
        return 0, None
    if workers is None:
        workers = NUM_WORKERS
    if log_interval is None:
        log_interval = max(1, count // 20)

    bench = BenchmarkCollector(entity_name, count)
    bench.start_time = time.time()

    print(f"\nCreating {count} {entity_name}...")
    sys.stdout.flush()

    counter_lock = threading.Lock()
    sample_running = True

    def _sampler():
        while sample_running:
            with counter_lock:
                total = bench.created + bench.failed
            bench.window_counts.append((time.time(), total))
            time.sleep(1)

    sampler_thread = threading.Thread(target=_sampler, daemon=True)
    sampler_thread.start()

    def _work(idx):
        t0 = time.time()
        payload = payload_fn(idx)
        if payload is None:
            return
        url = payload.pop("__url__", None)
        method = payload.pop("__method__", "PUT")
        if url is None:
            return
        status, resp = make_request(url, data=payload, method=method, headers=headers)
        latency = time.time() - t0
        ok = status in [200, 201]
        if ok:
            bench.record_success(latency)
        else:
            bench.record_failure(latency, status, resp)
        with counter_lock:
            total = bench.created + bench.failed
            if total % log_interval == 0 or total == count:
                elapsed = time.time() - bench.start_time
                rate = total / elapsed if elapsed > 0 else 0
                print(f"  {entity_name}: {total}/{count} ({rate:.1f}/sec) - OK: {bench.created}, Fail: {bench.failed}")
                sys.stdout.flush()
        if ok and collect_fn and isinstance(resp, dict):
            collect_fn(idx, resp)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(_work, i) for i in range(count)]
        for f in as_completed(futures):
            try:
                f.result()
            except Exception:
                pass

    sample_running = False
    bench.end_time = time.time()
    stats[entity_name] = bench.created
    benchmarks[entity_name] = bench
    elapsed = time.time() - bench.start_time
    p50 = bench.percentile(50) * 1000
    p95 = bench.percentile(95) * 1000
    print(f"{entity_name} done: {bench.created} created, {bench.failed} failed "
          f"({elapsed:.1f}s, p50={p50:.0f}ms, p95={p95:.0f}ms)")
    sys.stdout.flush()
    return bench.created, bench


# ── Helper to create a service ───────────────────────────────────────────────
def create_service(endpoint, data):
    status, resp = make_request(f"{SERVER_URL}/api/v1/services/{endpoint}", data=data,
                                method="PUT", headers=headers)
    if status in [200, 201] and isinstance(resp, dict):
        fqn = resp["fullyQualifiedName"]
        print(f"  Service created: {fqn}")
        return fqn
    print(f"  Failed to create service: {status} - {resp}")
    return None


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1: Metadata (no dependencies)
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 1: Metadata (domains, classifications, glossaries, users, teams)")
print("=" * 60)

# ── Domains ──────────────────────────────────────────────────────────────────
domain_fqns = []

if should_run("domains") and NUM_DOMAINS > 0:
    def domain_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/domains",
            "name": f"TestDomain_{idx:04d}",
            "domainType": "Aggregate",
            "description": f"Test domain {idx} for load testing",
        }

    def collect_domain(idx, resp):
        with collect_lock:
            domain_fqns.append(resp.get("fullyQualifiedName", f"TestDomain_{idx:04d}"))

    create_entity_batch("domains", NUM_DOMAINS, domain_payload, collect_fn=collect_domain)

# ── Classifications & Tags ───────────────────────────────────────────────────
classification_fqns = []
if should_run("classifications") and NUM_CLASSIFICATIONS > 0:
    print(f"\nCreating {NUM_CLASSIFICATIONS} classifications...")
    sys.stdout.flush()
    for i in range(NUM_CLASSIFICATIONS):
        data = {
            "name": f"TestClassification_{i:04d}",
            "description": f"Test classification {i} for load testing",
        }
        status, resp = make_request(f"{SERVER_URL}/api/v1/classifications", data=data,
                                    method="PUT", headers=headers)
        if status in [200, 201] and isinstance(resp, dict):
            classification_fqns.append(resp["fullyQualifiedName"])
    stats["classifications"] = len(classification_fqns)
    print(f"classifications done: {len(classification_fqns)} created")

if should_run("tags") and NUM_TAGS > 0 and classification_fqns:
    tags_per_class = max(1, NUM_TAGS // len(classification_fqns))
    tag_assignments = []
    for cfqn in classification_fqns:
        for j in range(tags_per_class):
            tag_assignments.append((cfqn, j))
            if len(tag_assignments) >= NUM_TAGS:
                break
        if len(tag_assignments) >= NUM_TAGS:
            break

    def tag_payload(idx):
        cfqn, j = tag_assignments[idx]
        return {
            "__url__": f"{SERVER_URL}/api/v1/tags",
            "name": f"Tag_{j:05d}",
            "classification": cfqn,
            "description": f"Test tag {j}",
        }

    create_entity_batch("tags", len(tag_assignments), tag_payload)

# ── Glossaries & Terms ───────────────────────────────────────────────────────
glossary_fqns = []
if should_run("glossaries") and NUM_GLOSSARIES > 0:
    print(f"\nCreating {NUM_GLOSSARIES} glossaries...")
    sys.stdout.flush()
    for i in range(NUM_GLOSSARIES):
        data = {
            "name": f"TestGlossary_{i:04d}",
            "displayName": f"Test Glossary {i}",
            "description": f"Test glossary {i} for load testing",
        }
        status, resp = make_request(f"{SERVER_URL}/api/v1/glossaries", data=data,
                                    method="PUT", headers=headers)
        if status in [200, 201] and isinstance(resp, dict):
            glossary_fqns.append(resp["fullyQualifiedName"])
    stats["glossaries"] = len(glossary_fqns)
    print(f"glossaries done: {len(glossary_fqns)} created")

if should_run("glossaryTerms") and NUM_GLOSSARY_TERMS > 0 and glossary_fqns:
    terms_per_glossary = max(1, NUM_GLOSSARY_TERMS // len(glossary_fqns))
    term_assignments = []
    for gfqn in glossary_fqns:
        for j in range(terms_per_glossary):
            term_assignments.append((gfqn, j))
            if len(term_assignments) >= NUM_GLOSSARY_TERMS:
                break
        if len(term_assignments) >= NUM_GLOSSARY_TERMS:
            break

    def term_payload(idx):
        gfqn, j = term_assignments[idx]
        return {
            "__url__": f"{SERVER_URL}/api/v1/glossaryTerms",
            "name": f"Term_{j:05d}",
            "glossary": gfqn,
            "displayName": f"Term {j}",
            "description": f"Test glossary term {j}",
        }

    create_entity_batch("glossaryTerms", len(term_assignments), term_payload)

# ── Users ────────────────────────────────────────────────────────────────────
if should_run("users") and NUM_USERS > 0:
    def user_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/users",
            "name": f"testuser_{idx:05d}",
            "email": f"testuser_{idx:05d}@example.com",
            "displayName": f"Test User {idx}",
            "description": f"Test user {idx} for load testing",
        }

    create_entity_batch("users", NUM_USERS, user_payload)

# ── Teams ────────────────────────────────────────────────────────────────────
if should_run("teams") and NUM_TEAMS > 0:
    def team_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/teams",
            "name": f"testteam_{idx:04d}",
            "displayName": f"Test Team {idx}",
            "description": f"Test team {idx} for load testing",
            "teamType": "Group",
        }

    create_entity_batch("teams", NUM_TEAMS, team_payload)

phase_timings["phase_1_metadata"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: Services
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 2: Services")
print("=" * 60)

db_service_fqn = None
dashboard_service_fqn = None
pipeline_service_fqn = None
messaging_service_fqn = None
mlmodel_service_fqn = None
storage_service_fqn = None
search_service_fqn = None
api_service_fqn = None

need_db_svc = (should_run("tables") or should_run("storedProcedures") or should_run("queries")
               or should_run("testCases") or should_run("testCaseResults")
               or should_run("lineageEdges") or _need_infra("_services_db"))
need_dashboard_svc = (should_run("dashboards") or should_run("charts")
                      or should_run("dashboardDataModels") or _need_infra("_services_dashboard"))
need_pipeline_svc = should_run("pipelines") or _need_infra("_services_pipeline")
need_messaging_svc = should_run("topics") or _need_infra("_services_messaging")
need_mlmodel_svc = should_run("mlmodels") or _need_infra("_services_mlmodel")
need_storage_svc = should_run("containers") or _need_infra("_services_storage")
need_search_svc = should_run("searchIndexes") or _need_infra("_services_search")
need_api_svc = (should_run("apiCollections") or should_run("apiEndpoints")
                or _need_infra("_services_api"))

if need_db_svc:
    db_service_fqn = create_service("databaseServices", {
        "name": "test-service-distributed",
        "serviceType": "Mysql",
        "connection": {"config": {"type": "Mysql", "username": "test",
                                  "authType": {"password": "test"}, "hostPort": "localhost:3306"}},
    })

if need_dashboard_svc:
    dashboard_service_fqn = create_service("dashboardServices", {
        "name": "test-dashboard-service",
        "serviceType": "Looker",
        "connection": {"config": {"type": "Looker", "clientId": "test-client-id",
                                  "clientSecret": "test-client-secret",
                                  "hostPort": "https://looker.example.com"}},
    })

if need_pipeline_svc:
    pipeline_service_fqn = create_service("pipelineServices", {
        "name": "test-pipeline-service",
        "serviceType": "Airflow",
        "connection": {"config": {"type": "Airflow", "hostPort": "http://airflow.example.com:8080",
                                  "connection": {"type": "Backend"}}},
    })

if need_messaging_svc:
    messaging_service_fqn = create_service("messagingServices", {
        "name": "test-messaging-service",
        "serviceType": "Kafka",
        "connection": {"config": {"type": "Kafka", "bootstrapServers": "localhost:9092"}},
    })

if need_mlmodel_svc:
    mlmodel_service_fqn = create_service("mlmodelServices", {
        "name": "test-mlmodel-service",
        "serviceType": "Mlflow",
        "connection": {"config": {"type": "Mlflow", "trackingUri": "http://mlflow.example.com:5000",
                                  "registryUri": "http://mlflow.example.com:5000"}},
    })

if need_storage_svc:
    storage_service_fqn = create_service("storageServices", {
        "name": "test-storage-service",
        "serviceType": "S3",
        "connection": {"config": {"type": "S3", "awsConfig": {
            "awsAccessKeyId": "test-key", "awsSecretAccessKey": "test-secret",
            "awsRegion": "us-east-1"}}},
    })

if need_search_svc:
    search_service_fqn = create_service("searchServices", {
        "name": "test-search-service",
        "serviceType": "ElasticSearch",
        "connection": {"config": {"type": "ElasticSearch",
                                  "hostPort": "http://elasticsearch.example.com:9200"}},
    })

if need_api_svc:
    api_service_fqn = create_service("apiServices", {
        "name": "test-api-service",
        "serviceType": "Rest",
        "connection": {"config": {"type": "Rest",
                                  "openAPISchemaConnection": {
                                      "openAPISchemaURL": "http://api.example.com/openapi.json"}}},
    })

phase_timings["phase_2_services"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: Infrastructure (databases, schemas, apiCollections)
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 3: Infrastructure (databases, schemas, API collections)")
print("=" * 60)

# ── Databases & Schemas ──────────────────────────────────────────────────────
schema_fqns = []
need_db_infra = (should_run("tables") or should_run("storedProcedures") or should_run("queries")
                 or should_run("testCases") or should_run("testCaseResults")
                 or should_run("lineageEdges") or _need_infra("_infra_db"))

if db_service_fqn and need_db_infra and NUM_TABLES > 0:
    print(f"Creating {NUM_DATABASES} databases with {SCHEMAS_PER_DB} schemas each...")
    sys.stdout.flush()
    for i in range(NUM_DATABASES):
        db_data = {"name": f"test_db_{i:04d}", "service": db_service_fqn}
        status, resp = make_request(f"{SERVER_URL}/api/v1/databases", data=db_data,
                                    method="PUT", headers=headers)
        if status in [200, 201] and isinstance(resp, dict):
            db_fqn = resp["fullyQualifiedName"]
            for s in range(SCHEMAS_PER_DB):
                schema_name = f"schema_{s:03d}" if SCHEMAS_PER_DB > 1 else "public"
                s_data = {"name": schema_name, "database": db_fqn}
                s_status, s_resp = make_request(f"{SERVER_URL}/api/v1/databaseSchemas",
                                                data=s_data, method="PUT", headers=headers)
                if s_status in [200, 201] and isinstance(s_resp, dict):
                    schema_fqns.append(s_resp["fullyQualifiedName"])
    print(f"  Created {NUM_DATABASES} databases, {len(schema_fqns)} schemas")

# ── API Collections ──────────────────────────────────────────────────────────
api_collection_fqns = []
if should_run("apiCollections") and api_service_fqn and NUM_API_COLLECTIONS > 0:
    def api_coll_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/apiCollections",
            "name": f"api_collection_{idx:04d}",
            "service": api_service_fqn,
            "displayName": f"API Collection {idx}",
            "description": f"Test API collection {idx}",
        }

    def collect_api_coll(idx, resp):
        with collect_lock:
            api_collection_fqns.append(resp.get("fullyQualifiedName",
                                                f"test-api-service.api_collection_{idx:04d}"))

    create_entity_batch("apiCollections", NUM_API_COLLECTIONS, api_coll_payload,
                        collect_fn=collect_api_coll)

phase_timings["phase_3_infrastructure"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: Core entities
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 4: Core entities")
print("=" * 60)

# ── Tables ───────────────────────────────────────────────────────────────────
if should_run("tables") and schema_fqns and NUM_TABLES > 0:
    def table_payload(idx):
        sfqn = schema_fqns[idx % len(schema_fqns)]
        return {
            "__url__": f"{SERVER_URL}/api/v1/tables",
            "name": f"table_{idx:07d}",
            "databaseSchema": sfqn,
            "columns": [
                {"name": "id", "dataType": "BIGINT", "description": "Primary key"},
                {"name": "name", "dataType": "VARCHAR", "dataLength": 255},
                {"name": "created_at", "dataType": "TIMESTAMP"},
                {"name": "data", "dataType": "JSON"},
            ],
        }

    def collect_table(idx, resp):
        with collect_lock:
            if len(collected_table_ids) < MAX_COLLECT:
                collected_table_ids.append((resp["id"], resp.get("fullyQualifiedName", "")))

    create_entity_batch("tables", NUM_TABLES, table_payload, collect_fn=collect_table)

# ── Dashboards ───────────────────────────────────────────────────────────────
if should_run("dashboards") and dashboard_service_fqn and NUM_DASHBOARDS > 0:
    def dashboard_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/dashboards",
            "name": f"dashboard_{idx:06d}",
            "service": dashboard_service_fqn,
            "displayName": f"Test Dashboard {idx}",
            "description": f"Test dashboard {idx}",
        }

    def collect_dashboard(idx, resp):
        with collect_lock:
            if len(collected_dashboard_ids) < MAX_COLLECT:
                collected_dashboard_ids.append((resp["id"], resp.get("fullyQualifiedName", "")))

    create_entity_batch("dashboards", NUM_DASHBOARDS, dashboard_payload,
                        collect_fn=collect_dashboard)

# ── Charts ───────────────────────────────────────────────────────────────────
if should_run("charts") and dashboard_service_fqn and NUM_CHARTS > 0:
    chart_types = ["Line", "Bar", "Pie", "Area", "Scatter", "Table"]

    def chart_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/charts",
            "name": f"chart_{idx:06d}",
            "service": dashboard_service_fqn,
            "displayName": f"Test Chart {idx}",
            "chartType": chart_types[idx % len(chart_types)],
            "description": f"Test chart {idx}",
        }

    create_entity_batch("charts", NUM_CHARTS, chart_payload)

# ── Topics ───────────────────────────────────────────────────────────────────
if should_run("topics") and messaging_service_fqn and NUM_TOPICS > 0:
    def topic_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/topics",
            "name": f"topic_{idx:06d}",
            "service": messaging_service_fqn,
            "partitions": 3,
            "replicationFactor": 1,
            "description": f"Test topic {idx}",
        }

    create_entity_batch("topics", NUM_TOPICS, topic_payload)

# ── Pipelines ────────────────────────────────────────────────────────────────
if should_run("pipelines") and pipeline_service_fqn and NUM_PIPELINES > 0:
    def pipeline_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/pipelines",
            "name": f"pipeline_{idx:06d}",
            "service": pipeline_service_fqn,
            "displayName": f"Test Pipeline {idx}",
            "description": f"Test pipeline {idx}",
        }

    def collect_pipeline(idx, resp):
        with collect_lock:
            if len(collected_pipeline_ids) < MAX_COLLECT:
                collected_pipeline_ids.append((resp["id"], resp.get("fullyQualifiedName", "")))

    create_entity_batch("pipelines", NUM_PIPELINES, pipeline_payload,
                        collect_fn=collect_pipeline)

# ── Stored Procedures ────────────────────────────────────────────────────────
if should_run("storedProcedures") and db_service_fqn and schema_fqns and NUM_STORED_PROCEDURES > 0:
    def stored_proc_payload(idx):
        sfqn = schema_fqns[idx % len(schema_fqns)]
        return {
            "__url__": f"{SERVER_URL}/api/v1/storedProcedures",
            "name": f"stored_proc_{idx:06d}",
            "databaseSchema": sfqn,
            "storedProcedureCode": {
                "code": f"CREATE PROCEDURE sp_{idx}() BEGIN SELECT 1; END",
                "language": "SQL",
            },
            "description": f"Test stored procedure {idx}",
        }

    create_entity_batch("storedProcedures", NUM_STORED_PROCEDURES, stored_proc_payload)

# ── ML Models ────────────────────────────────────────────────────────────────
if should_run("mlmodels") and mlmodel_service_fqn and NUM_MLMODELS > 0:
    algorithms = ["LinearRegression", "RandomForest", "XGBoost", "NeuralNetwork",
                  "SVM", "KMeans", "DecisionTree"]

    def mlmodel_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/mlmodels",
            "name": f"mlmodel_{idx:06d}",
            "service": mlmodel_service_fqn,
            "algorithm": algorithms[idx % len(algorithms)],
            "displayName": f"Test ML Model {idx}",
            "description": f"Test ML model {idx}",
        }

    create_entity_batch("mlmodels", NUM_MLMODELS, mlmodel_payload)

# ── Containers ───────────────────────────────────────────────────────────────
if should_run("containers") and storage_service_fqn and NUM_CONTAINERS > 0:
    def container_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/containers",
            "name": f"container_{idx:06d}",
            "service": storage_service_fqn,
            "displayName": f"Test Container {idx}",
            "description": f"Test container {idx}",
        }

    create_entity_batch("containers", NUM_CONTAINERS, container_payload)

# ── Search Indexes ───────────────────────────────────────────────────────────
if should_run("searchIndexes") and search_service_fqn and NUM_SEARCH_INDEXES > 0:
    def search_idx_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/searchIndexes",
            "name": f"search_index_{idx:06d}",
            "service": search_service_fqn,
            "displayName": f"Test Search Index {idx}",
            "description": f"Test search index {idx}",
            "fields": [
                {"name": "id", "dataType": "KEYWORD"},
                {"name": "content", "dataType": "TEXT"},
                {"name": "timestamp", "dataType": "DATE"},
            ],
        }

    create_entity_batch("searchIndexes", NUM_SEARCH_INDEXES, search_idx_payload)

# ── Queries ──────────────────────────────────────────────────────────────────
if should_run("queries") and NUM_QUERIES > 0 and db_service_fqn:
    def query_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/queries",
            "name": f"query_{idx:06d}",
            "query": f"SELECT * FROM table_{idx % max(1, NUM_TABLES):07d} WHERE id = {idx}",
            "service": db_service_fqn,
            "description": f"Test query {idx}",
        }

    create_entity_batch("queries", NUM_QUERIES, query_payload)

# ── Dashboard Data Models ────────────────────────────────────────────────────
if should_run("dashboardDataModels") and dashboard_service_fqn and NUM_DASHBOARD_DATA_MODELS > 0:
    dm_types = ["MetabaseDataModel", "SupersetDataModel", "TableauDataModel"]

    def data_model_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/dashboard/datamodels",
            "name": f"data_model_{idx:06d}",
            "service": dashboard_service_fqn,
            "dataModelType": dm_types[idx % len(dm_types)],
            "displayName": f"Test Data Model {idx}",
            "description": f"Test dashboard data model {idx}",
            "columns": [
                {"name": "id", "dataType": "BIGINT"},
                {"name": "value", "dataType": "VARCHAR", "dataLength": 255},
            ],
        }

    create_entity_batch("dashboardDataModels", NUM_DASHBOARD_DATA_MODELS, data_model_payload)

# ── API Endpoints ────────────────────────────────────────────────────────────
if should_run("apiEndpoints") and api_service_fqn and api_collection_fqns and NUM_API_ENDPOINTS > 0:
    http_methods = ["GET", "POST", "PUT", "DELETE", "PATCH"]

    def api_endpoint_payload(idx):
        coll_fqn = api_collection_fqns[idx % len(api_collection_fqns)]
        return {
            "__url__": f"{SERVER_URL}/api/v1/apiEndpoints",
            "name": f"endpoint_{idx:06d}",
            "apiCollection": coll_fqn,
            "endpointURL": f"https://api.example.com/v1/resource_{idx}",
            "requestMethod": http_methods[idx % len(http_methods)],
            "displayName": f"Test Endpoint {idx}",
            "description": f"Test API endpoint {idx}",
        }

    create_entity_batch("apiEndpoints", NUM_API_ENDPOINTS, api_endpoint_payload)

# ── Data Products ────────────────────────────────────────────────────────────
if should_run("dataProducts") and NUM_DATA_PRODUCTS > 0 and domain_fqns:
    def data_product_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataProducts",
            "name": f"data_product_{idx:04d}",
            "domains": [domain_fqns[idx % len(domain_fqns)]],
            "displayName": f"Test Data Product {idx}",
            "description": f"Test data product {idx}",
        }

    create_entity_batch("dataProducts", NUM_DATA_PRODUCTS, data_product_payload)

phase_timings["phase_4_core_entities"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5: Data Quality (test suites, test cases)
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 5: Data Quality (test suites, test cases)")
print("=" * 60)

test_suite_fqns = []

if should_run("testSuites") and NUM_TEST_SUITES > 0:
    def test_suite_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataQuality/testSuites",
            "name": f"testSuite_{idx:04d}",
            "displayName": f"Test Suite {idx}",
            "description": f"Test suite {idx} for load testing",
        }

    def collect_test_suite(idx, resp):
        with collect_lock:
            test_suite_fqns.append(resp.get("fullyQualifiedName",
                                            f"testSuite_{idx:04d}"))

    create_entity_batch("testSuites", NUM_TEST_SUITES, test_suite_payload,
                        collect_fn=collect_test_suite)

if should_run("testCases") and NUM_TEST_CASES > 0 and collected_table_ids:
    table_level_defs = [
        ("tableRowCountToEqual", [{"name": "value", "value": "100"}]),
        ("tableColumnCountToEqual", [{"name": "columnCount", "value": "4"}]),
    ]
    column_level_defs = [
        ("columnValuesToBeNotNull", []),
        ("columnValuesToBeUnique", []),
    ]
    column_names = ["id", "name", "created_at", "data"]

    def test_case_payload(idx):
        table_id, table_fqn = collected_table_ids[idx % len(collected_table_ids)]
        if idx % 3 == 0:
            defn, params = table_level_defs[idx % len(table_level_defs)]
            entity_link = f"<#E::table::{table_fqn}>"
        else:
            defn, params = column_level_defs[idx % len(column_level_defs)]
            col = column_names[idx % len(column_names)]
            entity_link = f"<#E::table::{table_fqn}::columns::{col}>"
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataQuality/testCases",
            "name": f"testCase_{idx:06d}",
            "entityLink": entity_link,
            "testDefinition": defn,
            "parameterValues": params,
        }

    def collect_test_case(idx, resp):
        with collect_lock:
            if len(collected_test_case_fqns) < MAX_COLLECT:
                fqn = resp.get("fullyQualifiedName")
                if fqn:
                    collected_test_case_fqns.append(fqn)

    create_entity_batch("testCases", NUM_TEST_CASES, test_case_payload,
                        collect_fn=collect_test_case)

phase_timings["phase_5_data_quality"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6: Lineage
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 6: Lineage")
print("=" * 60)

if should_run("lineageEdges") and NUM_LINEAGE_EDGES > 0 and collected_table_ids:
    n_t2t = int(NUM_LINEAGE_EDGES * 0.60)
    n_t2d = int(NUM_LINEAGE_EDGES * 0.25)
    n_p2t = NUM_LINEAGE_EDGES - n_t2t - n_t2d

    lineage_tasks = []
    for i in range(n_t2t):
        from_idx = i % len(collected_table_ids)
        to_idx = (i + 1) % len(collected_table_ids)
        lineage_tasks.append(("table", collected_table_ids[from_idx][0],
                              "table", collected_table_ids[to_idx][0]))
    if collected_dashboard_ids:
        for i in range(n_t2d):
            from_idx = i % len(collected_table_ids)
            to_idx = i % len(collected_dashboard_ids)
            lineage_tasks.append(("table", collected_table_ids[from_idx][0],
                                  "dashboard", collected_dashboard_ids[to_idx][0]))
    else:
        n_t2t += n_t2d
        n_t2d = 0

    if collected_pipeline_ids:
        for i in range(n_p2t):
            from_idx = i % len(collected_pipeline_ids)
            to_idx = (i + len(collected_table_ids) // 2) % len(collected_table_ids)
            lineage_tasks.append(("pipeline", collected_pipeline_ids[from_idx][0],
                                  "table", collected_table_ids[to_idx][0]))
    else:
        n_t2t += n_p2t
        n_p2t = 0

    actual_edges = len(lineage_tasks)

    def lineage_payload(idx):
        if idx >= len(lineage_tasks):
            return None
        from_type, from_id, to_type, to_id = lineage_tasks[idx]
        return {
            "__url__": f"{SERVER_URL}/api/v1/lineage",
            "__method__": "PUT",
            "edge": {
                "fromEntity": {"id": from_id, "type": from_type},
                "toEntity": {"id": to_id, "type": to_type},
            },
        }

    create_entity_batch("lineageEdges", actual_edges, lineage_payload,
                        workers=min(10, NUM_WORKERS))
elif should_run("lineageEdges") and NUM_LINEAGE_EDGES > 0:
    print("Skipping lineage: no table IDs collected")
    stats["lineageEdges"] = 0

phase_timings["phase_6_lineage"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7: Time-Series Data
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 7: Time-Series Data")
print("=" * 60)

ts_workers = min(10, NUM_WORKERS)
base_ts = int(time.time() * 1000)

# ── Test Case Results ────────────────────────────────────────────────────────
if should_run("testCaseResults") and NUM_TEST_CASE_RESULTS > 0 and collected_test_case_fqns:
    statuses = ["Success", "Failed", "Aborted"]

    def tc_result_payload(idx):
        fqn = collected_test_case_fqns[idx % len(collected_test_case_fqns)]
        encoded_fqn = urllib.request.quote(fqn, safe="")
        ts = base_ts - (idx * 3600000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataQuality/testCases/testCaseResults/{encoded_fqn}",
            "__method__": "POST",
            "timestamp": ts,
            "testCaseStatus": statuses[idx % len(statuses)],
            "result": f"Test result {idx}",
            "testResultValue": [{"name": "value", "value": str(round(random.uniform(0, 100), 2))}],
        }

    create_entity_batch("testCaseResults", NUM_TEST_CASE_RESULTS, tc_result_payload,
                        workers=ts_workers)
elif should_run("testCaseResults") and NUM_TEST_CASE_RESULTS > 0:
    print("Skipping testCaseResults: no test case FQNs collected")
    stats["testCaseResults"] = 0

# ── Entity Report Data ───────────────────────────────────────────────────────
if should_run("entityReportData") and NUM_ENTITY_REPORT_DATA > 0:
    entity_types_for_report = ["table", "topic", "dashboard", "pipeline", "mlmodel"]

    def entity_report_payload(idx):
        ts = base_ts - (idx * 86400000)
        e_type = entity_types_for_report[idx % len(entity_types_for_report)]
        entity_count = random.randint(1, 1000)
        has_owner = random.randint(0, entity_count)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "entityReportData",
            "data": {
                "entityType": e_type,
                "entityTier": f"Tier.Tier{(idx % 5) + 1}",
                "serviceName": "test-service-distributed",
                "completedDescriptions": random.randint(0, 100),
                "missingDescriptions": random.randint(0, 50),
                "hasOwner": has_owner,
                "missingOwner": entity_count - has_owner,
                "entityCount": entity_count,
            },
        }

    create_entity_batch("entityReportData", NUM_ENTITY_REPORT_DATA, entity_report_payload,
                        workers=ts_workers)

# ── Web Analytic Entity Views ────────────────────────────────────────────────
if should_run("webAnalyticViews") and NUM_WEB_ANALYTIC_VIEWS > 0:
    def web_view_payload(idx):
        ts = base_ts - (idx * 60000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "webAnalyticEntityViewReportData",
            "data": {
                "entityType": "table",
                "entityFqn": f"test-service-distributed.test_db_0000.public.table_{idx % max(1, NUM_TABLES):07d}",
                "entityHref": f"{SERVER_URL}/table/test-service-distributed.test_db_0000.public.table_{idx % max(1, NUM_TABLES):07d}",
                "owner": f"user_{idx % 50}",
                "views": random.randint(1, 500),
            },
        }

    create_entity_batch("webAnalyticViews", NUM_WEB_ANALYTIC_VIEWS, web_view_payload,
                        workers=ts_workers)

# ── Web Analytic User Activity ───────────────────────────────────────────────
if should_run("webAnalyticActivity") and NUM_WEB_ANALYTIC_ACTIVITY > 0:
    def web_activity_payload(idx):
        ts = base_ts - (idx * 60000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "webAnalyticUserActivityReportData",
            "data": {
                "userName": f"testuser_{idx % max(1, NUM_USERS):05d}",
                "userId": str(uuid.uuid4()),
                "team": "test-team",
                "totalSessions": random.randint(1, 20),
                "totalSessionDuration": random.randint(10, 3600),
                "totalPageView": random.randint(1, 100),
                "lastSession": ts,
            },
        }

    create_entity_batch("webAnalyticActivity", NUM_WEB_ANALYTIC_ACTIVITY,
                        web_activity_payload, workers=ts_workers)

# ── Raw Cost Analysis ────────────────────────────────────────────────────────
if should_run("rawCostAnalysis") and NUM_RAW_COST_ANALYSIS > 0:
    def raw_cost_payload(idx):
        ts = base_ts - (idx * 86400000)
        if collected_table_ids:
            table_id, table_fqn = collected_table_ids[idx % len(collected_table_ids)]
        else:
            table_id = str(uuid.uuid4())
            table_fqn = f"test-service-distributed.test_db_0000.public.table_{idx % max(1, NUM_TABLES):07d}"
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "rawCostAnalysisReportData",
            "data": {
                "entity": {
                    "id": table_id,
                    "type": "table",
                    "fullyQualifiedName": table_fqn,
                },
                "sizeInByte": round(random.uniform(100.0, 100000.0), 2),
            },
        }

    create_entity_batch("rawCostAnalysis", NUM_RAW_COST_ANALYSIS, raw_cost_payload,
                        workers=ts_workers)

# ── Aggregated Cost Analysis ─────────────────────────────────────────────────
if should_run("aggCostAnalysis") and NUM_AGG_COST_ANALYSIS > 0:
    def agg_cost_payload(idx):
        ts = base_ts - (idx * 86400000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "aggregatedCostAnalysisReportData",
            "data": {
                "entityType": "table",
                "serviceName": "test-service-distributed",
                "serviceType": "BigQuery",
                "totalSize": round(random.uniform(1000.0, 1000000.0), 2),
                "totalCount": random.randint(100, 100000),
                "unusedDataAssets": {
                    "count": {"threeDays": random.randint(1, 50), "sevenDays": random.randint(1, 40),
                              "fourteenDays": random.randint(1, 30), "thirtyDays": random.randint(1, 20),
                              "sixtyDays": random.randint(1, 10)},
                    "size": {"threeDays": random.randint(100, 10000), "sevenDays": random.randint(100, 9000),
                             "fourteenDays": random.randint(100, 8000), "thirtyDays": random.randint(100, 7000),
                             "sixtyDays": random.randint(100, 6000)},
                    "totalSize": random.randint(1000, 50000),
                    "totalCount": random.randint(1, 50),
                },
                "frequentlyUsedDataAssets": {
                    "count": {"threeDays": random.randint(1, 10), "sevenDays": random.randint(1, 20),
                              "fourteenDays": random.randint(1, 30), "thirtyDays": random.randint(1, 40),
                              "sixtyDays": random.randint(1, 50)},
                    "size": {"threeDays": random.randint(1000, 50000), "sevenDays": random.randint(1000, 60000),
                             "fourteenDays": random.randint(1000, 70000), "thirtyDays": random.randint(1000, 80000),
                             "sixtyDays": random.randint(1000, 90000)},
                    "totalSize": random.randint(1000, 100000),
                    "totalCount": random.randint(1, 50),
                },
            },
        }

    create_entity_batch("aggCostAnalysis", NUM_AGG_COST_ANALYSIS, agg_cost_payload,
                        workers=ts_workers)

phase_timings["phase_7_time_series"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# STOP HEALTH MONITOR & BUILD REPORT
# ══════════════════════════════════════════════════════════════════════════════
health_monitor.stop()
overall_elapsed = time.time() - overall_start
total_created = sum(stats.values())


# ── Cluster sizing analysis ──────────────────────────────────────────────────
def generate_cluster_sizing(report):
    findings = []
    recommendations = {}

    entity_data = report.get("entities", {})
    health = report.get("server_health", {})
    measured_workers = report["metadata"]["workers"]

    max_p95 = 0
    for entity, data in entity_data.items():
        if not data:
            continue
        p95 = data.get("latency_ms", {}).get("p95", 0)
        if p95 > max_p95:
            max_p95 = p95
        if p95 > 5000:
            findings.append(f"{entity} PUT p95={p95:.0f}ms -- severe bottleneck")
        elif p95 > 1000:
            findings.append(f"{entity} PUT p95={p95:.0f}ms -- moderate latency")

    total_checks = health.get("total_checks", 0)
    unhealthy_count = health.get("unhealthy", 0)
    if unhealthy_count > 0 and total_checks > 0:
        pct = unhealthy_count / total_checks * 100
        findings.append(f"Health check failed {unhealthy_count} times ({pct:.0f}%) -- server overwhelmed")

    for entity, data in entity_data.items():
        if not data:
            continue
        windows = data.get("throughput_over_time", [])
        if len(windows) >= 4:
            q_len = max(1, len(windows) // 4)
            first_q = [w["rps"] for w in windows[:q_len]]
            last_q = [w["rps"] for w in windows[-q_len:]]
            if first_q and last_q:
                avg_first = sum(first_q) / len(first_q)
                avg_last = sum(last_q) / len(last_q)
                if avg_first > 0 and avg_last / avg_first < 0.5:
                    degradation = (1 - avg_last / avg_first) * 100
                    findings.append(
                        f"{entity}: throughput degraded {degradation:.0f}% "
                        f"({avg_first:.0f} rps -> {avg_last:.0f} rps) -- resource exhaustion"
                    )

    if max_p95 > 5000:
        rec_workers = max(2, measured_workers // 4)
    elif max_p95 > 2000:
        rec_workers = max(2, measured_workers // 2)
    else:
        rec_workers = measured_workers
    recommendations["api_concurrency"] = {
        "current": measured_workers,
        "recommended": rec_workers,
        "reason": f"Max p95 latency {max_p95:.0f}ms across entity types",
    }

    overall_rps = report.get("overall", {}).get("overall_throughput_rps", 0)
    if overall_rps > 0:
        estimates = {}
        for target in [50000, 250000, 1000000, 5000000]:
            secs = target / overall_rps
            label = f"{target // 1000}k_entities"
            if secs < 3600:
                estimates[label] = f"~{secs / 60:.0f} min"
            else:
                estimates[label] = f"~{secs / 3600:.1f} hours"
        recommendations["estimated_times"] = estimates

    if max_p95 > 5000 or (unhealthy_count / max(1, total_checks)) > 0.1:
        assessment = "undersized"
    elif max_p95 > 2000:
        assessment = "marginal"
    else:
        assessment = "adequate"

    return {
        "assessment": assessment,
        "findings": findings,
        "recommendations": recommendations,
    }


# ── Build report ─────────────────────────────────────────────────────────────
entity_summaries = {}
for name, bench in benchmarks.items():
    s = bench.summary()
    if s:
        entity_summaries[name] = s

report = {
    "metadata": {
        "timestamp": datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "server_url": SERVER_URL,
        "workers": NUM_WORKERS,
        "scale": SCALE_APPLIED,
        "only_entities": list(ONLY_ENTITIES) if ONLY_ENTITIES else None,
        "script_version": "2.0",
    },
    "server_health": health_monitor.summary(),
    "entities": entity_summaries,
    "phases": phase_timings,
    "overall": {
        "total_entities_created": total_created,
        "total_wall_clock_s": round(overall_elapsed, 2),
        "overall_throughput_rps": round(total_created / overall_elapsed, 2) if overall_elapsed > 0 else 0,
        "total_errors": sum(b.failed for b in benchmarks.values()),
        "overall_error_rate_pct": round(
            sum(b.failed for b in benchmarks.values()) /
            max(1, sum(len(b.latencies) for b in benchmarks.values())) * 100, 2
        ),
    },
}

report["cluster_sizing"] = generate_cluster_sizing(report)

# ── Write JSON report ────────────────────────────────────────────────────────
report_for_file = json.loads(json.dumps(report))
if "server_health" in report_for_file and "timeline" in report_for_file["server_health"]:
    del report_for_file["server_health"]["timeline"]

try:
    with open(output_path, "w") as f:
        json.dump(report_for_file, f, indent=2)
    print(f"\nJSON report written to: {output_path}")
except Exception as e:
    print(f"\nFailed to write JSON report: {e}")


# ── Pretty-print summary table ──────────────────────────────────────────────
def print_summary_table(report):
    print("")
    print("\u2550" * 70)
    print("BENCHMARK RESULTS")
    print("\u2550" * 70)
    print("")
    header = f"{'Entity':<22} {'Count':>7} {'Rate/s':>8} {'p50ms':>7} {'p95ms':>7} {'p99ms':>7} {'Errors':>7}"
    print(header)
    print("\u2500" * 70)

    for name, data in report["entities"].items():
        count = data["created"]
        rps = data["throughput_rps"]
        p50 = data["latency_ms"]["p50"]
        p95 = data["latency_ms"]["p95"]
        p99 = data["latency_ms"]["p99"]
        err_pct = data["error_rate_pct"]
        err_str = f"{err_pct:.1f}%" if err_pct > 0 else "0.0%"
        print(f"{name:<22} {count:>7} {rps:>8.1f} {p50:>7.0f} {p95:>7.0f} {p99:>7.0f} {err_str:>7}")

    print("\u2500" * 70)
    overall = report["overall"]
    total = overall["total_entities_created"]
    overall_rps = overall["overall_throughput_rps"]
    overall_err = overall["overall_error_rate_pct"]
    err_str = f"{overall_err:.1f}%" if overall_err > 0 else "0.0%"
    print(f"{'Overall':<22} {total:>7} {overall_rps:>8.1f} {'':>7} {'':>7} {'':>7} {err_str:>7}")
    print("")

    health = report["server_health"]
    total_checks = health["total_checks"]
    healthy = health["healthy"]
    if total_checks > 0:
        health_pct = healthy / total_checks * 100
        health_p95 = health.get("health_latency_ms", {}).get("p95", 0)
        print(f"Server Health: {healthy}/{total_checks} checks healthy ({health_pct:.1f}%)")
        print(f"Health p95 latency: {health_p95:.0f}ms")
    else:
        print("Server Health: no checks recorded")
    print("")

    sizing = report.get("cluster_sizing", {})
    assessment = sizing.get("assessment", "unknown")
    indicator = {"undersized": "!! UNDERSIZED", "marginal": "?  MARGINAL", "adequate": "OK ADEQUATE"}.get(
        assessment, f"   {assessment.upper()}"
    )
    print(f"CLUSTER SIZING: {indicator}")
    for finding in sizing.get("findings", []):
        print(f"  - {finding}")
    recs = sizing.get("recommendations", {})
    concurrency = recs.get("api_concurrency", {})
    if concurrency:
        print(f"  - Recommend: {concurrency.get('recommended', '?')} workers "
              f"(currently {concurrency.get('current', '?')})")
    estimates = recs.get("estimated_times", {})
    if "1000k_entities" in estimates:
        print(f"  - At current rate: 1M entities = {estimates['1000k_entities']}")
    print("")
    print(f"Full report: {output_path}")
    print(f"Total time: {overall['total_wall_clock_s']:.1f}s")

print_summary_table(report)

print("")
print("Collected IDs for linking:")
print(f"  Table IDs:      {len(collected_table_ids)}")
print(f"  Dashboard IDs:  {len(collected_dashboard_ids)}")
print(f"  Pipeline IDs:   {len(collected_pipeline_ids)}")
print(f"  Test Case FQNs: {len(collected_test_case_fqns)}")
PYEOF

echo ""
echo "Test data loaded. You can now trigger reindexing with: ./scripts/trigger-reindex.sh"
